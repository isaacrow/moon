/**
 * What a record must have before it is published (LC's core requirements for a BIBFRAME description):
 * a Work and an Instance linked to each other, a main title on each, the Work's content type and the
 * Instance's media type, carrier type and mode of issuance. Saving without them is always allowed;
 * publishing is not.
 */

export interface MissingField {
  entity: "Work" | "Instance";
  field: string;
  en: string;
  ar: string;
}

// Older records keep some properties without the bf: prefix (mainTitle, carrier…); both count.
const prop = (node: any, name: string) => node?.[`bf:${name}`] ?? node?.[name];

const typeOf = (node: any) => ([] as any[]).concat(node?.["@type"] ?? []).map(String);
const isA = (node: any, cls: string) => typeOf(node).some((t) => t === `bf:${cls}` || t === cls || t.endsWith(`/bibframe/${cls}`));

/** Any non-empty text in a value: a string, {@value}, {rdfs:label}, a list of those. */
function hasText(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (Array.isArray(v)) return v.some(hasText);
  if (typeof v === "object") return hasText(v["@value"]) || hasText(v["rdfs:label"]) || hasText(v["label"]);
  return false;
}

/** A value that names something: a URI, or a node with a URI or a label. */
function hasValue(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasValue);
  if (typeof v === "object") return hasText(v["@id"]) || hasText(v["rdfs:label"]) || hasText(v["label"]) || hasText(v["@value"]);
  return false;
}

function hasMainTitle(node: any, graph: any[]): boolean {
  const titles = ([] as any[]).concat(prop(node, "title") ?? []);
  return titles.some((t) => {
    // A title can be written inline, as plain text, or as a reference to a Title node elsewhere in the graph.
    const ref = typeof t === "string" && /^https?:\/\//.test(t) ? t : typeof t === "object" && !prop(t, "mainTitle") ? t?.["@id"] : null;
    const n = ref ? graph.find((g) => g?.["@id"] === ref && g !== node) : t;
    return typeof n === "string" ? hasText(n) : hasText(prop(n, "mainTitle"));
  });
}

const F = (entity: "Work" | "Instance", field: string, en: string, ar: string): MissingField => ({ entity, field, en, ar });

/** The required fields this record lacks; empty when it may be published. */
export function missingForPublish(document: any): MissingField[] {
  const graph: any[] = Array.isArray(document?.["@graph"]) ? document["@graph"] : [];
  const work = graph.find((n) => isA(n, "Work"));
  const instance = graph.find((n) => isA(n, "Instance"));
  const missing: MissingField[] = [];
  if (!work) missing.push(F("Work", "bf:Work", "Work", "العمل"));
  if (!instance) missing.push(F("Instance", "bf:Instance", "Instance", "التجسيد"));
  if (work) {
    if (!hasMainTitle(work, graph)) missing.push(F("Work", "bf:title", "Work title", "عنوان العمل"));
    if (!hasValue(prop(work, "content"))) missing.push(F("Work", "bf:content", "Content type", "نوع المحتوى"));
  }
  if (instance) {
    if (!hasMainTitle(instance, graph)) missing.push(F("Instance", "bf:title", "Instance title", "عنوان التجسيد"));
    if (!hasValue(prop(instance, "media"))) missing.push(F("Instance", "bf:media", "Media type", "نوع الوسيط"));
    if (!hasValue(prop(instance, "carrier"))) missing.push(F("Instance", "bf:carrier", "Carrier type", "نوع الحامل"));
    if (!hasValue(prop(instance, "issuance"))) missing.push(F("Instance", "bf:issuance", "Mode of issuance", "طريقة الإصدار"));
  }
  if (work && instance) {
    const ids = (v: any) => ([] as any[]).concat(v ?? []).map((x) => (typeof x === "object" ? x?.["@id"] : x));
    const linked = ids(prop(instance, "instanceOf")).includes(work["@id"]) || ids(prop(work, "hasInstance")).includes(instance["@id"]);
    if (!linked) missing.push(F("Instance", "bf:instanceOf", "Link from the Instance to its Work", "ربط التجسيد بعمله"));
  }
  return missing;
}
