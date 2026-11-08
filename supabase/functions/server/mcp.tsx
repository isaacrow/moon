/**
 * Moon's MCP server (Phase 13 S20): an AI agent (Claude, or any Model Context Protocol client) can search
 * Moon, read records, run SPARQL and check a description, over MCP's Streamable HTTP transport at
 * https://mooon.site/resource/mcp (JSON-RPC 2.0, plain JSON replies, no stream).
 *
 * Reading is open, as the OPAC is. The one write tool, create_draft, needs a signed-in cataloguer's session
 * (X-Moon-Session) and only ever makes a draft: it waits for review like any cataloguer's save, carries who
 * and which agent made it, and only a person can publish it. No tool publishes, deletes or edits.
 * No imports: index.tsx passes what each tool needs; the tests run it in Node.
 */

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export interface McpDeps {
  search(query: string, limit: number): Promise<Array<{ id: string; title: string; uri: string }>>;
  record(id: string): Promise<{ id: string; title: string; document: any } | null>;
  sparql(query: string): Promise<string>;
  validate(document: any): { missing: Array<{ entity: string; field: string; en: string }> };
  /** Null when no cataloguer is signed in. */
  user: string | null;
  createDraft(input: { title: string; document: any; agent: string; note: string }): Promise<{ id: string; version: number }>;
}

const TOOLS = [
  {
    name: "search_records",
    title: "Search Moon's catalogue",
    description: "Search the published records of Moon (a BIBFRAME catalogue strong in Arabic). Arabic letter variants and romanization marks are folded. Returns ids, titles and permanent URIs.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to find, Arabic or English" }, limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } }, required: ["query"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_record",
    title: "Read one record",
    description: "One published record as BIBFRAME 3.0.1 JSON-LD (its Work, Instance and Items), by its Moon id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "sparql",
    title: "Run a SPARQL query",
    description: "A read-only SPARQL 1.1 SELECT, ASK or CONSTRUCT over everything Moon publishes (records and entities). Prefixes bf:, bflc:, rdfs:, madsrdf:, skos: are the usual ones.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "validate_record",
    title: "Check a description",
    description: "Checks a BIBFRAME JSON-LD document (with @graph) against what Moon requires before publishing (LC's core requirements). Returns what is missing, in plain words.",
    inputSchema: { type: "object", properties: { document: { type: "object" } }, required: ["document"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_draft",
    title: "Save a draft for a cataloguer to review",
    description: "Saves a BIBFRAME JSON-LD document as a new DRAFT record. It is never published by this tool: it waits for review, and a person decides. Needs a signed-in cataloguer (X-Moon-Session). Say in `note` what you did and from which sources.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, document: { type: "object" }, note: { type: "string", description: "What the agent did and from which sources" } }, required: ["title", "document", "note"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
];

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (s: string, isError = false) => ({ content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) });

function isBibframe(doc: any): string | null {
  const graph = doc?.["@graph"];
  if (!Array.isArray(graph) || !graph.length) return "The document needs a @graph array";
  if (graph.length > 500 || JSON.stringify(doc).length > 2_000_000) return "The document is too large";
  const typed = (s: string) => graph.some((n: any) => ([] as any[]).concat(n?.["@type"] || []).some((t: any) => typeof t === "string" && t.endsWith(s)));
  return typed("Work") && typed("Instance") ? null : "A BIBFRAME record needs a bf:Work and a bf:Instance";
}

async function callTool(name: string, args: any, deps: McpDeps, agent: string) {
  switch (name) {
    case "search_records": {
      const q = String(args?.query || "").trim().slice(0, 200);
      if (!q) return text("Give a query.", true);
      const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 50);
      const found = await deps.search(q, limit);
      return { ...text(found.length ? found.map((r) => `${r.id}\t${r.title}\t${r.uri}`).join("\n") : "Nothing found."), structuredContent: { records: found } };
    }
    case "get_record": {
      const id = String(args?.id || "");
      if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id)) return text("Not a record id.", true);
      const r = await deps.record(id);
      return r ? { ...text(JSON.stringify(r.document)), structuredContent: r } : text(`No published record ${id}.`, true);
    }
    case "sparql": {
      const q = String(args?.query || "");
      if (!q.trim()) return text("Give a query.", true);
      if (/\b(INSERT|DELETE|LOAD|CLEAR|DROP|CREATE|COPY|MOVE|ADD)\b/i.test(q.replace(/"[^"]*"|'[^']*'|<[^>]*>/g, ""))) return text("Only read-only queries (SELECT, ASK, CONSTRUCT, DESCRIBE).", true);
      return text(await deps.sparql(q));
    }
    case "validate_record": {
      const bad = isBibframe(args?.document);
      if (bad) return text(bad, true);
      const { missing } = deps.validate(args.document);
      return {
        ...text(missing.length ? `Missing before it can be published:\n${missing.map((m) => `- ${m.entity}: ${m.en}`).join("\n")}` : "Nothing required is missing."),
        structuredContent: { ready: !missing.length, missing },
      };
    }
    case "create_draft": {
      if (!deps.user) return text("Sign in first: send a Moon cataloguer's session as X-Moon-Session. Drafts are always saved under a person.", true);
      const bad = isBibframe(args?.document);
      if (bad) return text(bad, true);
      const title = String(args?.title || "").trim().slice(0, 500);
      const note = String(args?.note || "").trim().slice(0, 2000);
      if (!title || !note) return text("Give a title and a note saying what you did and from which sources.", true);
      const saved = await deps.createDraft({ title, document: args.document, agent, note });
      return {
        ...text(`Saved as draft ${saved.id} (version ${saved.version}) for ${deps.user} to review. It is not published.`),
        structuredContent: { id: saved.id, version: saved.version, status: "pending-review" },
      };
    }
    default:
      return null;
  }
}

/** One JSON-RPC message → its reply (null for a notification, which gets 202 and no body). */
export async function handleMcp(msg: any, deps: McpDeps, clientName = "an MCP client"): Promise<any | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Not a JSON-RPC 2.0 request");
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  try {
    switch (msg.method) {
      case "initialize": {
        const asked = String(msg.params?.protocolVersion || "");
        return ok(msg.id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "moon", title: "Moon (mooon.site)", version: "1.0.0" },
          instructions: "Moon is a BIBFRAME 3.0.1 catalogue strong in Arabic. Read freely; any record you make is a draft a cataloguer reviews. Prefer Arabic script with the ALA-LC romanization beside it, and say where every fact came from.",
        });
      }
      case "ping":
        return ok(msg.id, {});
      case "tools/list":
        return ok(msg.id, { tools: TOOLS });
      case "tools/call": {
        const result = await callTool(String(msg.params?.name || ""), msg.params?.arguments || {}, deps, String(msg.params?._meta?.agent || clientName));
        return result ? ok(msg.id, result) : fail(msg.id, -32602, `Unknown tool: ${msg.params?.name}`);
      }
      default:
        return fail(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (error) {
    return ok(msg.id, text(`The tool failed: ${error instanceof Error ? error.message : String(error)}`, true));
  }
}
