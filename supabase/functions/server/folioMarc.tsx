/**
 * Moon → FOLIO as MARC (Phase 5, route 2): the record's MARC 21 goes to FOLIO's quickMARC API
 * (mod-quick-marc, /records-editor/records). FOLIO stores the MARC in Source Record Storage and builds the
 * Instance from it with its own MARC-to-Instance mapping, so the library gets both, kept in step: the MARC
 * ("View source", editable in quickMARC) and the Inventory Instance.
 *
 * - Create: POST /records-editor/records (action create). Older FOLIO answers with a qmRecordId to poll
 *   (/records-editor/records/status); newer FOLIO answers with the new Instance id at once. Both are handled.
 * - Update: the record already sent (its Instance id is stored) is read with GET
 *   /records-editor/records?externalId=, and PUT back with the new fields; FOLIO's own 001, 005 and 999 stay.
 * - quickMARC field shape: { tag, indicators: [i1, i2], content }, a blank as "\", subfields as "$a value",
 *   a literal $ as {dollar}; the books 008 as quickMARC's named elements.
 * No imports: the edge function passes the FOLIO API; the tests pass a fake FOLIO.
 */
import type { FolioApi, FolioLink, SendResult } from "./folio.tsx";
import { cqlString } from "./folio.tsx";

export interface MarcIn {
  leader: string;
  fields: Array<{ tag: string; data?: string; ind1?: string; ind2?: string; subfields?: [string, string][] }>;
}
export interface QuickMarcField { tag: string; content: any; indicators?: string[] }

const blank = (c: string | undefined) => (!c || c === " " || c === "#" ? "\\" : c);
const chars = (s: string) => s.replace(/ /g, "\\");

/** The checks quickMARC itself makes, said before anything is sent. */
export function marcProblems(marc: MarcIn): string[] {
  const out: string[] = [];
  if (typeof marc?.leader !== "string" || marc.leader.length !== 24) out.push("The leader must have 24 characters.");
  if (!Array.isArray(marc?.fields) || !marc.fields.length || marc.fields.length > 900) out.push("The record has no fields, or too many.");
  for (const f of marc?.fields || []) if (!/^\d{3}$/.test(String(f?.tag))) out.push(`Bad tag: ${String(f?.tag).slice(0, 10)}`);
  if (!(marc?.fields || []).some((f) => f.tag === "245" && (f.subfields || []).some(([c, v]) => c === "a" && String(v).trim()))) out.push("A title (245 $a) is required.");
  const f008 = (marc?.fields || []).find((f) => f.tag === "008");
  if (!f008 || String(f008.data || "").length !== 40) out.push("FOLIO needs an 008 of 40 characters.");
  return out;
}

/** The books 008 as quickMARC's named elements. */
export function books008(leader: string, d: string): Record<string, any> {
  const v = d.padEnd(40, " ");
  const one = (i: number) => chars(v[i]);
  const run = (a: number, b: number) => chars(v.slice(a, b));
  return {
    Type: leader[6], BLvl: leader[7], Entered: v.slice(0, 6), DtSt: one(6), Date1: run(7, 11), Date2: run(11, 15), Ctry: run(15, 18),
    Ills: [one(18), one(19), one(20), one(21)], Audn: one(22), Form: one(23), Cont: [one(24), one(25), one(26), one(27)],
    GPub: one(28), Conf: one(29), Fest: one(30), Indx: one(31), LitF: one(33), Biog: one(34), Lang: run(35, 38), MRec: one(38), Srce: one(39),
  };
}

/** Moon's MARC as quickMARC fields: FOLIO assigns 001/003/005 and keeps 999 itself. */
export function toQuickMarc(marc: MarcIn): { leader: string; fields: QuickMarcField[] } {
  const leader = marc.leader.slice(0, 20) + "4500";
  const isBook = /^[at]$/.test(leader[6]) && /^[acdm]$/.test(leader[7]);
  const fields: QuickMarcField[] = [];
  for (const f of marc.fields) {
    if (/^(001|003|005|999)$/.test(f.tag)) continue;
    if (/^00\d$/.test(f.tag)) {
      const data = String(f.data || "");
      fields.push({ tag: f.tag, content: f.tag === "008" && isBook ? books008(leader, data) : data });
      continue;
    }
    const subs = (f.subfields || []).filter(([, v]) => String(v).trim());
    if (!subs.length) continue;
    fields.push({
      tag: f.tag,
      indicators: [blank(f.ind1), blank(f.ind2)],
      content: subs.map(([c, v]) => `$${c} ${String(v).trim().replace(/\$/g, "{dollar}")}`).join(" "),
    });
  }
  return { leader, fields };
}

const errorText = (r: { status: number; json: any }) =>
  r.json?.errors?.[0]?.message || r.json?.message || r.json?.errorMessage || (typeof r.json === "string" ? r.json : "") || `HTTP ${r.status}`;

/**
 * Creates the FOLIO record from MARC (MARC in SRS + Instance), or updates the one already sent.
 * Before a first send, Instances with the same ISBN are offered (as with the Instance route).
 */
export async function sendMarc(api: FolioApi, marc: MarcIn, link: (FolioLink & { mode?: string }) | null,
  opts: { createAnyway?: boolean; warnings?: string[]; wait?: (ms: number) => Promise<void> } = {}): Promise<SendResult> {
  const warnings = opts.warnings || [];
  const wait = opts.wait || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const q = toQuickMarc(marc);
  const instanceOf = async (id: string) => {
    const r = await api.get(`/instance-storage/instances/${encodeURIComponent(id)}`);
    return r.status === 200 ? r.json : null;
  };

  // ---- Update the record sent before ----
  if (link?.instanceId) {
    const instance = await instanceOf(link.instanceId);
    if (instance && instance.source && instance.source !== "MARC") {
      return { status: "blocked", message: `This record was sent before as an Instance without MARC (${instance.hrid || instance.id}). Send it as an Instance, or delete that Instance in FOLIO first.`, warnings };
    }
    if (instance) {
      const view = await api.get(`/records-editor/records?externalId=${encodeURIComponent(instance.id)}`);
      if (view.status !== 200 || !view.json?.parsedRecordId) return { status: "error", message: `FOLIO did not return the MARC record to update: ${errorText(view)}`, warnings };
      const own = (view.json.fields || []).filter((f: any) => /^(001|003|005|999)$/.test(f.tag));
      const body = {
        ...view.json, _actionType: "edit", leader: q.leader, fields: [...own.filter((f: any) => f.tag !== "999"), ...q.fields, ...own.filter((f: any) => f.tag === "999")],
        relatedRecordVersion: String(instance._version ?? view.json.relatedRecordVersion ?? 1),
      };
      const r = await api.put(`/records-editor/records/${encodeURIComponent(view.json.parsedRecordId)}`, body);
      if (r.status >= 300) return { status: "error", message: `FOLIO refused the MARC update: ${errorText(r)}`, warnings };
      return { status: "updated", instanceId: instance.id, hrid: instance.hrid, warnings };
    }
  }

  // ---- Same ISBN already in FOLIO? Offer it first ----
  if (!opts.createAnyway) {
    const isbns = marc.fields.filter((f) => f.tag === "020").flatMap((f) => (f.subfields || []).filter(([c]) => c === "a").map(([, v]) => String(v).split(/\s/)[0]))
      .filter((v) => /^[\dXx-]{10,17}$/.test(v));
    if (isbns.length) {
      const query = isbns.map((v) => `identifiers =/@value ${cqlString(v)}`).join(" or ");
      const r = await api.get(`/instance-storage/instances?limit=5&query=${encodeURIComponent(query)}`);
      const found = r.json?.instances || [];
      if (found.length) return { status: "match", candidates: found.map((f: any) => ({ id: f.id, hrid: f.hrid, title: f.title })), warnings };
    }
  }

  // ---- Create: MARC in SRS + the Instance FOLIO maps from it ----
  const created = await api.post("/records-editor/records", {
    _actionType: "create", marcFormat: "BIBLIOGRAPHIC", suppressDiscovery: false, relatedRecordVersion: "1", leader: q.leader, fields: q.fields,
  });
  if (created.status >= 300) return { status: "error", message: `FOLIO refused the MARC record: ${errorText(created)}`, warnings };
  let instanceId: string = created.json?.externalId || "";
  const qmId: string = created.json?.qmRecordId || "";
  for (let i = 0; !instanceId && qmId && i < 15; i++) {
    await wait(1500);
    const s = await api.get(`/records-editor/records/status?qmRecordId=${encodeURIComponent(qmId)}`);
    const st = String(s.json?.status || "");
    if (st === "ERROR") return { status: "error", message: `FOLIO could not create the record: ${s.json?.errorMessage || "unknown error"}`, warnings };
    if (st === "CREATED" && s.json?.externalId) instanceId = s.json.externalId;
  }
  if (!instanceId) return { status: "error", message: "FOLIO accepted the MARC record but did not report the new Instance in time. Check Inventory before sending again.", warnings };
  const instance = await instanceOf(instanceId);
  return { status: "created", instanceId, hrid: instance?.hrid, warnings };
}
