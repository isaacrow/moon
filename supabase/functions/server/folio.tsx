/**
 * Moon → FOLIO Inventory (Phase 5, route 1): a published Moon record becomes a FOLIO Instance through the
 * Inventory storage API, without MARC.
 *
 * - The mapping reads the stored BIBFRAME graph and never invents a value: a field Moon does not have is
 *   left out. Output follows FOLIO's Instance schema (mod-inventory-storage instance.json): source FOLIO,
 *   title, instanceTypeId, and only the schema's own properties.
 * - Reference data (identifier types, instance types, contributor types …) differs per tenant, so it is
 *   looked up by name or code at send time, never hard-coded.
 * - No duplicates: the Moon Instance URI is the FOLIO Instance's sourceUri, and Moon keeps the FOLIO id.
 *   A second send updates the same Instance; before a first send an Instance with the same ISBN is offered.
 * No imports: the edge function passes a fetch, the tests pass a fake FOLIO.
 */

const BF = "http://id.loc.gov/ontologies/bibframe/";
const all = (v: any): any[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const types = (n: any): string[] => all(n?.["@type"]).map((t: any) => String(t).replace(BF, "bf:"));
const isA = (n: any, t: string) => types(n).includes(t);
const get = (n: any, k: string): any[] => all(n?.[`bf:${k}`] ?? n?.[BF + k]);
const lastSegment = (uri: any) => String(uri?.["@id"] ?? uri ?? "").replace(/\/+$/, "").split(/[/#]/).pop() || "";

/** The words of a value: a string, a {@value}, or a node's label. */
function text(v: any): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (Array.isArray(v)) return text(v[0]);
  if (v["@value"] !== undefined) return String(v["@value"]).trim();
  for (const k of ["rdfs:label", "bf:mainTitle", "rdf:value", "madsrdf:authoritativeLabel", "bf:code"]) {
    const t = text(v[k]);
    if (t) return t;
  }
  return "";
}
const texts = (vs: any[]) => [...new Set(vs.map(text).filter(Boolean))];

export interface FolioRef {
  /** RDA content code (txt, sti, prm …) → instance type id; FOLIO's instance types are the RDA content types. */
  instanceTypes: Record<string, string>;
  identifierTypes: { ISBN?: string; ISSN?: string; LCCN?: string; OCLC?: string };
  contributorNameTypes: { personal?: string; corporate?: string; meeting?: string };
  /** MARC relator code (aut, trl …) → contributor type id. */
  contributorTypes: Record<string, string>;
  classificationTypes: { LC?: string; Dewey?: string };
  generalNoteTypeId?: string;
  /** "single unit", "serial", "integrating resource", "multipart monograph" → mode of issuance id. */
  modesOfIssuance: Record<string, string>;
}

const ISSUANCE: Record<string, string> = { mono: "single unit", serl: "serial", intg: "integrating resource", mulm: "multipart monograph" };

export interface FolioInstance { [k: string]: any; source: string; title: string; instanceTypeId: string }

/**
 * The FOLIO Instance for a Moon record, plus warnings for what could not be carried over. Every field Moon
 * manages is present (empty when Moon has nothing), so an update also clears a value removed in Moon.
 */
export function buildFolioInstance(document: any, ref: FolioRef): { instance: FolioInstance | null; warnings: string[] } {
  const graph = all(document?.["@graph"]);
  const work = graph.find((n) => isA(n, "bf:Work")) || {};
  const inst = graph.find((n) => isA(n, "bf:Instance"));
  const warnings: string[] = [];
  if (!inst) return { instance: null, warnings: ["The record has no Instance."] };

  // Title: the Instance's title (not a variant), "main : subtitle".
  const titleNode = [...get(inst, "title"), ...get(work, "title")].find((t) => !isA(t, "bf:VariantTitle") && !isA(t, "bf:AbbreviatedTitle")) || get(inst, "title")[0];
  const mains = texts(get(titleNode, "mainTitle"));
  const sub = text(get(titleNode, "subtitle"));
  const title = [mains[0] || text(titleNode), sub].filter(Boolean).join(" : ");
  if (!title) return { instance: null, warnings: ["The record has no title."] };

  const contentCode = lastSegment(get(work, "content")[0]) || "txt";
  const instanceTypeId = ref.instanceTypes[contentCode] || ref.instanceTypes.txt || ref.instanceTypes.zzz;
  if (!instanceTypeId) return { instance: null, warnings: [`FOLIO has no instance type for "${contentCode}".`] };
  if (!ref.instanceTypes[contentCode]) warnings.push(`Content type "${contentCode}" is not in FOLIO; sent as ${ref.instanceTypes.txt ? "text" : "unspecified"}.`);

  // Contributors (the Work's; the Instance's when the Work has none).
  const contributions = get(work, "contribution").length ? get(work, "contribution") : get(inst, "contribution");
  const seen = new Set<string>();
  const contributors = contributions.flatMap((c, i) => {
    const agent = get(c, "agent")[0];
    const name = text(agent);
    if (!name || seen.has(name)) return [];
    seen.add(name);
    const nameType = isA(agent, "bf:Organization") || isA(agent, "bf:Jurisdiction") ? ref.contributorNameTypes.corporate
      : isA(agent, "bf:Meeting") ? ref.contributorNameTypes.meeting : ref.contributorNameTypes.personal;
    if (!nameType) { warnings.push(`No FOLIO name type for ${name}; left out.`); return []; }
    const role = get(c, "role")[0];
    const code = lastSegment(role);
    const typeId = ref.contributorTypes[code];
    return [{
      name,
      contributorNameTypeId: nameType,
      primary: isA(c, "bflc:PrimaryContribution") || (i === 0 && !contributions.some((x) => isA(x, "bflc:PrimaryContribution"))),
      ...(typeId ? { contributorTypeId: typeId } : text(role) ? { contributorTypeText: text(role) } : {}),
    }];
  });

  // Identifiers FOLIO knows: ISBN, ISSN, LCCN, OCLC (bf:Local assigned by ocolc).
  const identifiers = get(inst, "identifiedBy").flatMap((id) => {
    const value = text(get(id, "value").length ? get(id, "value") : id["rdf:value"] ?? id);
    const kind = isA(id, "bf:Isbn") ? "ISBN" : isA(id, "bf:Issn") ? "ISSN" : isA(id, "bf:Lccn") ? "LCCN"
      : isA(id, "bf:Local") && /ocolc/i.test(lastSegment(get(id, "assigner")[0])) ? "OCLC" : "";
    const typeId = kind ? (ref.identifierTypes as any)[kind] : undefined;
    return value && typeId ? [{ identifierTypeId: typeId, value }] : [];
  });

  const ROLES: Record<string, string> = { "bf:Publication": "Publication", "bf:Production": "Production", "bf:Distribution": "Distribution", "bf:Manufacture": "Manufacture" };
  const publication = get(inst, "provisionActivity").flatMap((p) => {
    const role = Object.keys(ROLES).find((t) => isA(p, t));
    const entry = {
      publisher: texts(get(p, "agent")).join(" ; "),
      place: texts(get(p, "place")).join(" ; "),
      dateOfPublication: text(p["bflc:simpleDate"]) || text(get(p, "date")),
      ...(role ? { role: ROLES[role] } : {}),
    };
    return entry.publisher || entry.place || entry.dateOfPublication ? [entry] : [];
  });

  const classifications = get(work, "classification").concat(get(inst, "classification")).flatMap((c) => {
    const number = [text(get(c, "classificationPortion")), text(get(c, "itemPortion"))].filter(Boolean).join(" ");
    const typeId = isA(c, "bf:ClassificationLcc") ? ref.classificationTypes.LC : isA(c, "bf:ClassificationDdc") ? ref.classificationTypes.Dewey : undefined;
    return number && typeId ? [{ classificationNumber: number, classificationTypeId: typeId }] : [];
  });

  const noteTexts = texts([...get(inst, "note"), ...get(work, "note"), ...get(work, "summary")]);
  if (noteTexts.length && !ref.generalNoteTypeId) warnings.push("FOLIO has no \"General note\" type; notes left out.");
  const issuance = ISSUANCE[lastSegment(get(inst, "issuance")[0])];

  const instance: FolioInstance = {
    source: "FOLIO",
    title,
    instanceTypeId,
    sourceUri: String(inst["@id"] || ""),
    contributors,
    identifiers,
    publication,
    editions: texts(get(inst, "editionStatement")),
    physicalDescriptions: [[...texts(get(inst, "extent")), ...texts(get(inst, "dimensions"))].join(" ; ")].filter(Boolean),
    languages: [...new Set(get(work, "language").map(lastSegment).filter((c) => /^[a-z]{3}$/.test(c)))],
    subjects: texts(get(work, "subject")).map((value) => ({ value })),
    classifications,
    series: texts(get(inst, "seriesStatement")).map((value) => ({ value })),
    notes: ref.generalNoteTypeId ? noteTexts.map((note) => ({ instanceNoteTypeId: ref.generalNoteTypeId, note, staffOnly: false })) : [],
    administrativeNotes: [`Catalogued in Moon: ${String(work["@id"] || inst["@id"] || "")}`],
    ...(issuance && ref.modesOfIssuance[issuance] ? { modeOfIssuanceId: ref.modesOfIssuance[issuance] } : {}),
  };
  if (!instance.sourceUri) delete instance.sourceUri;
  return { instance, warnings };
}

// ---------------------------------------------------------------------------
// Talking to FOLIO

export interface FolioApi {
  get(path: string): Promise<{ status: number; json: any }>;
  post(path: string, body: any): Promise<{ status: number; json: any; location?: string }>;
  put(path: string, body: any): Promise<{ status: number; json: any }>;
}

/** CQL string literal: quotes and backslashes escaped, wildcards taken literally. */
export const cqlString = (s: string) => `"${String(s).replace(/[\\"*?^]/g, (c) => `\\${c}`)}"`;

/** Reference data by name or code, so the same Moon works with any tenant. */
export async function loadReference(api: FolioApi): Promise<FolioRef> {
  const list = async (path: string, key: string) => (await api.get(`${path}?limit=1000`)).json?.[key] || [];
  const [itypes, idTypes, nameTypes, contribTypes, classTypes, noteTypes, modes] = await Promise.all([
    list("/instance-types", "instanceTypes"),
    list("/identifier-types", "identifierTypes"),
    list("/contributor-name-types", "contributorNameTypes"),
    list("/contributor-types", "contributorTypes"),
    list("/classification-types", "classificationTypes"),
    list("/instance-note-types", "instanceNoteTypes"),
    list("/modes-of-issuance", "issuanceModes"),
  ]);
  const byName = (rows: any[], name: string) => rows.find((r) => String(r.name).toLowerCase() === name.toLowerCase())?.id;
  return {
    instanceTypes: Object.fromEntries(itypes.filter((t: any) => t.code).map((t: any) => [t.code, t.id])),
    identifierTypes: { ISBN: byName(idTypes, "ISBN"), ISSN: byName(idTypes, "ISSN"), LCCN: byName(idTypes, "LCCN"), OCLC: byName(idTypes, "OCLC") },
    contributorNameTypes: {
      personal: byName(nameTypes, "Personal name"), corporate: byName(nameTypes, "Corporate name"), meeting: byName(nameTypes, "Meeting name"),
    },
    contributorTypes: Object.fromEntries(contribTypes.filter((t: any) => t.code).map((t: any) => [t.code, t.id])),
    classificationTypes: { LC: byName(classTypes, "LC"), Dewey: byName(classTypes, "Dewey") },
    generalNoteTypeId: byName(noteTypes, "General note"),
    modesOfIssuance: Object.fromEntries(modes.map((m: any) => [String(m.name).toLowerCase(), m.id])),
  };
}

export interface FolioConfig { url: string; tenant: string; username: string; password: string }

/** Signs in (login-with-expiry, then the older /authn/login) and returns an API that sends the token. */
export async function folioClient(cfg: FolioConfig, fetchImpl: typeof fetch = fetch): Promise<FolioApi> {
  const base = cfg.url.replace(/\/+$/, "");
  const head = { "Content-Type": "application/json", Accept: "application/json", "X-Okapi-Tenant": cfg.tenant };
  const creds = JSON.stringify({ username: cfg.username, password: cfg.password });
  let token = "";
  const modern = await fetchImpl(`${base}/authn/login-with-expiry`, { method: "POST", headers: head, body: creds });
  if (modern.ok) {
    const cookie = modern.headers.get("set-cookie") || "";
    token = (cookie.match(/folioAccessToken=([^;]+)/) || [])[1] || "";
  }
  if (!token) {
    const old = await fetchImpl(`${base}/authn/login`, { method: "POST", headers: head, body: creds });
    if (!old.ok) throw new Error(`FOLIO sign-in failed (${modern.status}/${old.status}). Check the URL, tenant and account.`);
    token = old.headers.get("x-okapi-token") || "";
  }
  if (!token) throw new Error("FOLIO sign-in gave no token.");
  const call = async (method: string, path: string, body?: any) => {
    const res = await fetchImpl(`${base}${path}`, {
      method, headers: { ...head, "X-Okapi-Token": token }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await res.text();
    let json: any = null;
    try { json = raw ? JSON.parse(raw) : null; } catch { json = { message: raw.slice(0, 500) }; }
    return { status: res.status, json, location: res.headers.get("location") || undefined };
  };
  return { get: (p) => call("GET", p), post: (p, b) => call("POST", p, b), put: (p, b) => call("PUT", p, b) };
}

export interface FolioLink { instanceId: string; hrid?: string; sentAt: string; hash: string }

export type SendResult =
  | { status: "created" | "updated"; instanceId: string; hrid?: string; warnings: string[] }
  | { status: "match"; candidates: { id: string; hrid?: string; title: string }[]; warnings: string[] }
  | { status: "blocked" | "error"; message: string; warnings: string[] };

/** A short stable hash of what was sent, to tell "changed since sent". */
export function instanceHash(instance: FolioInstance): string {
  const s = JSON.stringify(instance);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

const errorText = (r: { status: number; json: any }) =>
  r.json?.errors?.[0]?.message || r.json?.message || (typeof r.json === "string" ? r.json : "") || `HTTP ${r.status}`;

/**
 * Creates or updates the FOLIO Instance for a record.
 * Order: the stored link → an Instance whose sourceUri is this record's URI → `linkTo` chosen by the user →
 * (unless createAnyway) Instances with the same ISBN, returned for the user to choose → a new Instance.
 */
export async function sendInstance(api: FolioApi, instance: FolioInstance, link: FolioLink | null,
  opts: { linkTo?: string; createAnyway?: boolean; warnings?: string[] } = {}): Promise<SendResult> {
  const warnings = opts.warnings || [];
  const fetchExisting = async (id: string) => {
    const r = await api.get(`/instance-storage/instances/${encodeURIComponent(id)}`);
    return r.status === 200 ? r.json : null;
  };
  let existing: any = null;
  if (link?.instanceId) existing = await fetchExisting(link.instanceId);
  if (!existing && instance.sourceUri) {
    const r = await api.get(`/instance-storage/instances?limit=2&query=${encodeURIComponent(`sourceUri==${cqlString(instance.sourceUri)}`)}`);
    existing = r.json?.instances?.[0] || null;
  }
  if (!existing && opts.linkTo) {
    existing = await fetchExisting(opts.linkTo);
    if (!existing) return { status: "error", message: "That FOLIO Instance was not found.", warnings };
  }
  if (!existing && !opts.createAnyway) {
    const isbns = instance.identifiers.map((i: any) => i.value).filter((v: string) => /^[\dXx-]{10,17}/.test(v));
    if (isbns.length) {
      const q = isbns.map((v: string) => `identifiers =/@value ${cqlString(v.split(/\s/)[0])}`).join(" or ");
      const r = await api.get(`/instance-storage/instances?limit=5&query=${encodeURIComponent(q)}`);
      const found = r.json?.instances || [];
      if (found.length) return { status: "match", candidates: found.map((f: any) => ({ id: f.id, hrid: f.hrid, title: f.title })), warnings };
    }
  }

  if (existing) {
    if (existing.source && existing.source !== "FOLIO") {
      return { status: "blocked", message: `This FOLIO Instance (${existing.hrid || existing.id}) is controlled by its ${existing.source} record; send it as MARC through Data Import instead.`, warnings };
    }
    // FOLIO's PUT replaces the record: keep FOLIO's own fields, replace the ones Moon manages.
    const body = { ...existing, ...instance, id: existing.id, hrid: existing.hrid, _version: existing._version };
    delete body.metadata;
    const r = await api.put(`/instance-storage/instances/${encodeURIComponent(existing.id)}`, body);
    if (r.status !== 204 && r.status !== 200) return { status: "error", message: `FOLIO refused the update: ${errorText(r)}`, warnings };
    return { status: "updated", instanceId: existing.id, hrid: existing.hrid, warnings };
  }
  const r = await api.post("/instance-storage/instances", instance);
  if (r.status !== 201 && r.status !== 200) return { status: "error", message: `FOLIO refused the new Instance: ${errorText(r)}`, warnings };
  const id = r.json?.id || (r.location || "").split("/").pop() || "";
  return { status: "created", instanceId: id, hrid: r.json?.hrid, warnings };
}
