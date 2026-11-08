/**
 * Vocabularies for special materials (Phase 13 S24), reusing what exists before adding anything:
 *
 * - Maqām: the Arabic modal systems as SKOS concepts in Moon's own scheme (mooon.site/resource/vocab/maqam/…),
 *   given through BIBFRAME's own bf:mode (a bf:Mode, "mode of a musical work, not associated with a key").
 *   Concepts, not classes, as the Tehran Iranian-music work learned; each maqām names the family it belongs to.
 * - Copy-level description from ARM 1.0, the Art and Rare Materials BIBFRAME extension
 *   (https://w3id.org/arm/ontology/1.0/): markings (seal, stamp, bookplate, inscription, marginalia,
 *   autograph, watermark, label) through arm:markedBy, physical condition through arm:hasPhysicalCondition,
 *   and the binding as a bf:Note typed arm:Binding.
 * - Item actions (digitised, condition reviewed, retention committed, as shared-print programmes record
 *   them): small events on the copy (arm:Event or arm:ConditionAssessment through arm:hasItemHistory), each
 *   with its kind from Moon's scheme (mooon.site/resource/vocab/item-action/…), date and who — not free notes.
 * No imports: the editor, the OPAC, the server and the tests all use it.
 */

export const ARM = "https://w3id.org/arm/ontology/1.0/";
const SKOS = "http://www.w3.org/2004/02/skos/core#";

export interface Concept { id: string; ar: string; latn: string; en: string; broader?: string }

/** The main Arabic maqāmāt (families first), with ALA-LC romanization. */
export const MAQAMAT: Concept[] = [
  { id: "rast", ar: "راست", latn: "Rāst", en: "Rast" },
  { id: "bayati", ar: "بياتي", latn: "Bayātī", en: "Bayati" },
  { id: "sikah", ar: "سيكاه", latn: "Sīkāh", en: "Sikah" },
  { id: "hijaz", ar: "حجاز", latn: "Ḥijāz", en: "Hijaz" },
  { id: "saba", ar: "صبا", latn: "Ṣabā", en: "Saba" },
  { id: "nahawand", ar: "نهاوند", latn: "Nahāwand", en: "Nahawand" },
  { id: "ajam", ar: "عجم", latn: "ʻAjam", en: "Ajam" },
  { id: "kurd", ar: "كرد", latn: "Kurd", en: "Kurd" },
  { id: "suznak", ar: "سوزناك", latn: "Sūznāk", en: "Suznak", broader: "rast" },
  { id: "husayni", ar: "حسيني", latn: "Ḥusaynī", en: "Husayni", broader: "bayati" },
  { id: "huzam", ar: "هزام", latn: "Huzām", en: "Huzam", broader: "sikah" },
  { id: "nikriz", ar: "نكريز", latn: "Nikrīz", en: "Nikriz", broader: "nahawand" },
  { id: "jiharkah", ar: "جهاركاه", latn: "Jihārkāh", en: "Jiharkah", broader: "ajam" },
  { id: "hijazkar", ar: "حجاز كار", latn: "Ḥijāz kār", en: "Hijazkar", broader: "hijaz" },
];

/** What an item action is, as a concept of Moon's item-action scheme. */
export const ITEM_ACTIONS: Concept[] = [
  { id: "digitised", ar: "رُقمنت", latn: "", en: "Digitised" },
  { id: "condition-reviewed", ar: "رُوجعت حالتها", latn: "", en: "Condition reviewed" },
  { id: "retention-committed", ar: "التُزم بحفظها", latn: "", en: "Retention committed" },
  { id: "conserved", ar: "رُمّمت", latn: "", en: "Conserved" },
];

/** The kinds of marking, each an ARM 1.0 class. */
export const MARK_KINDS: Array<{ id: string; cls: string; ar: string; en: string }> = [
  { id: "seal", cls: "Seal", ar: "ختم (خاتم)", en: "Seal" },
  { id: "stamp", cls: "Stamp", ar: "ختم مطبوع (طابع)", en: "Stamp" },
  { id: "bookplate", cls: "Bookplate", ar: "ختم ملكية ملصق (اكسلبرس)", en: "Bookplate" },
  { id: "inscription", cls: "Inscription", ar: "كتابة (إهداء، قيد)", en: "Inscription" },
  { id: "marginalia", cls: "Marginalia", ar: "حواشٍ وتعليقات", en: "Marginalia" },
  { id: "autograph", cls: "Autograph", ar: "توقيع بخط صاحبه", en: "Autograph" },
  { id: "watermark", cls: "Watermark", ar: "علامة مائية", en: "Watermark" },
  { id: "label", cls: "Label", ar: "بطاقة ملصقة", en: "Label" },
];

export const schemeUri = (base: string, scheme: "maqam" | "item-action") => `${base}/vocab/${scheme}`;
export const conceptUri = (base: string, scheme: "maqam" | "item-action", id: string) => `${base}/vocab/${scheme}/${id}`;
const labels = (c: Concept) => [{ "@value": c.ar, "@language": "ar" }, ...(c.latn ? [{ "@value": c.latn, "@language": "ar-Latn-t-ar-m0-alaloc" }] : []), { "@value": c.en, "@language": "en" }];

/** A scheme as SKOS JSON-LD, served at /resource/vocab/<scheme> (and each concept at /resource/vocab/<scheme>/<id>). */
export function vocabDocument(base: string, scheme: "maqam" | "item-action", only?: string): any | null {
  const list = scheme === "maqam" ? MAQAMAT : ITEM_ACTIONS;
  const chosen = only ? list.filter((c) => c.id === only) : list;
  if (!chosen.length) return null;
  const s = schemeUri(base, scheme);
  return {
    "@context": { skos: SKOS, bf: "http://id.loc.gov/ontologies/bibframe/", rdfs: "http://www.w3.org/2000/01/rdf-schema#" },
    "@graph": [
      ...(only ? [] : [{
        "@id": s, "@type": "skos:ConceptScheme",
        "skos:prefLabel": scheme === "maqam"
          ? [{ "@value": "المقامات العربية", "@language": "ar" }, { "@value": "Arabic maqāmāt", "@language": "en" }]
          : [{ "@value": "أعمال على النسخ", "@language": "ar" }, { "@value": "Actions on copies", "@language": "en" }],
        "skos:hasTopConcept": list.filter((c) => !c.broader).map((c) => ({ "@id": conceptUri(base, scheme, c.id) })),
      }]),
      ...chosen.map((c) => ({
        "@id": conceptUri(base, scheme, c.id),
        "@type": scheme === "maqam" ? ["skos:Concept", "bf:Mode"] : ["skos:Concept"],
        "skos:prefLabel": labels(c),
        "skos:inScheme": { "@id": s },
        ...(c.broader ? { "skos:broader": { "@id": conceptUri(base, scheme, c.broader) } } : { "skos:topConceptOf": { "@id": s } }),
      })),
    ],
  };
}

// ---- Records ----

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const text = (v: any): string => {
  for (const x of list(v)) {
    if (typeof x === "string" && x.trim()) return x.trim();
    if (x && typeof x === "object") {
      const t = typeof x["@value"] === "string" ? x["@value"].trim() : text(x["rdfs:label"]);
      if (t) return t;
    }
  }
  return "";
};

/** The bf:mode value for a maqām (a node with its concept address and labels in both scripts). */
export function maqamNode(base: string, id: string): any | null {
  const c = MAQAMAT.find((m) => m.id === id);
  return c ? { "@id": conceptUri(base, "maqam", c.id), "@type": "bf:Mode", "rdfs:label": [c.ar, c.latn] } : null;
}
/** The maqām a Work's bf:mode names, if it is one of Moon's. */
export function maqamOf(work: any): Concept | undefined {
  for (const m of list(work?.["bf:mode"])) {
    const id = String(m?.["@id"] || "").match(/\/vocab\/maqam\/([a-z-]+)$/)?.[1];
    const found = MAQAMAT.find((c) => c.id === id || c.ar === text(m) || c.latn === text(m));
    if (found) return found;
  }
  return undefined;
}

export interface Marking { kind: string; text: string; place?: string }
export interface ItemAction { kind: string; date?: string; by?: string; note?: string }
export interface CopyCondition { binding?: string; condition?: string; marks?: Marking[]; actions?: ItemAction[] }

/** Adds the ARM description to an Item node. */
export function withCondition(node: any, c: CopyCondition, base: string): any {
  const out = { ...node };
  const marks = (c.marks || []).filter((m) => m.text?.trim());
  if (marks.length) {
    out["arm:markedBy"] = marks.map((m) => {
      const k = MARK_KINDS.find((x) => x.id === m.kind) || MARK_KINDS[0];
      return { "@type": [`arm:${k.cls}`, "arm:Marking"], "rdfs:label": m.text.trim(), ...(m.place?.trim() ? { "bf:note": { "@type": "bf:Note", "rdfs:label": m.place.trim() } } : {}) };
    });
  }
  if (c.condition?.trim()) out["arm:hasPhysicalCondition"] = { "@type": "arm:PhysicalCondition", "rdfs:label": c.condition.trim() };
  if (c.binding?.trim()) {
    out["bf:note"] = [...list(out["bf:note"]), { "@type": ["bf:Note", "arm:Binding"], "bf:noteType": "binding", "rdfs:label": c.binding.trim() }];
  }
  const actions = (c.actions || []).filter((a) => ITEM_ACTIONS.some((x) => x.id === a.kind));
  if (actions.length) {
    out["arm:hasItemHistory"] = actions.map((a) => ({
      "@type": a.kind === "condition-reviewed" ? ["arm:ConditionAssessment", "arm:Event"] : ["arm:Event"],
      "arm:hasType": { "@id": conceptUri(base, "item-action", a.kind), "rdfs:label": ITEM_ACTIONS.find((x) => x.id === a.kind)!.en },
      ...(a.date?.trim() ? { "bf:date": a.date.trim() } : {}),
      ...(a.by?.trim() ? { "bf:agent": { "@type": "bf:Agent", "rdfs:label": a.by.trim() } } : {}),
      ...(a.note?.trim() ? { "bf:note": { "@type": "bf:Note", "rdfs:label": a.note.trim() } } : {}),
    }));
  }
  return out;
}

const typed = (n: any, cls: string) => list(n?.["@type"]).some((t: any) => t === `arm:${cls}` || t === `${ARM}${cls}`);

/** Reads the ARM description back from an Item node. */
export function conditionOf(node: any): CopyCondition {
  const marks = list(node?.["arm:markedBy"]).map((m: any): Marking => ({
    kind: MARK_KINDS.find((k) => typed(m, k.cls))?.id || "inscription",
    text: text(m),
    ...(text(m?.["bf:note"]) ? { place: text(m["bf:note"]) } : {}),
  })).filter((m) => m.text);
  const binding = list(node?.["bf:note"]).find((n: any) => typed(n, "Binding") || n?.["bf:noteType"] === "binding");
  const actions = list(node?.["arm:hasItemHistory"]).map((e: any): ItemAction | null => {
    const kind = String(e?.["arm:hasType"]?.["@id"] || "").split("/").pop() || "";
    if (!ITEM_ACTIONS.some((x) => x.id === kind)) return null;
    return { kind, ...(text(e["bf:date"]) ? { date: text(e["bf:date"]) } : {}), ...(text(e["bf:agent"]) ? { by: text(e["bf:agent"]) } : {}), ...(text(e["bf:note"]) ? { note: text(e["bf:note"]) } : {}) };
  }).filter((a): a is ItemAction => !!a);
  const condition = text(node?.["arm:hasPhysicalCondition"]);
  return {
    ...(binding ? { binding: text(binding) } : {}),
    ...(condition ? { condition } : {}),
    ...(marks.length ? { marks } : {}),
    ...(actions.length ? { actions } : {}),
  };
}

/** Whether a bf:note on an Item is the binding description (so it is not shown as the copy's general note). */
export const isBindingNote = (n: any) => typed(n, "Binding") || n?.["bf:noteType"] === "binding";
