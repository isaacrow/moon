/**
 * What a record must have before it is published: the mandatory properties of its profile (LC's core
 * requirements for a BIBFRAME description; see profiles.tsx). Saving without them is always allowed;
 * publishing is not.
 *
 * The same rules are published as SHACL shapes (shapesFromProfile), and the tests check that a SHACL
 * engine and this gate agree. The gate reads the stored editor document directly, which may still use
 * older shapes (unprefixed properties, titles as plain text or as a separate Title node).
 */
import { MONOGRAPH_PROFILE, Profile, PropertyTemplate, ResourceTemplate } from "./profiles.tsx";

export interface MissingField {
  entity: "Work" | "Instance";
  field: string;
  en: string;
  ar: string;
}

const BF = "http://id.loc.gov/ontologies/bibframe/";
const local = (uri: string) => uri.startsWith(BF) ? uri.slice(BF.length) : uri;

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

const templateById = (profile: Profile, id: string) => profile.Profile.resourceTemplates.find((t) => t.id === id);
const templateFor = (profile: Profile, cls: string) => profile.Profile.resourceTemplates.find((t) => local(t.resourceURI) === cls);

/** Does `value` hold a node that has every mandatory property of `template` (e.g. a Title with a main title)? */
function satisfiesTemplate(value: any, template: ResourceTemplate, graph: any[], self: any): boolean {
  return ([] as any[]).concat(value ?? []).some((v) => {
    if (typeof v === "string" && !/^https?:\/\//.test(v)) {
      // A title written as plain text is its main title.
      return hasText(v);
    }
    // A node written inline, or a reference to a node elsewhere in the graph.
    const ref = typeof v === "string" ? v : v && typeof v === "object" && Object.keys(v).every((k) => k === "@id") ? v["@id"] : null;
    const node = ref ? graph.find((g) => g?.["@id"] === ref && g !== self) : v;
    if (!node || typeof node !== "object") return false;
    return template.propertyTemplates.filter((p) => p.mandatory === "true")
      .every((p) => (p.type === "literal" ? hasText : hasValue)(prop(node, local(p.propertyURI))));
  });
}

/** Is a mandatory property present on `node`? */
function present(p: PropertyTemplate, node: any, graph: any[], profile: Profile): boolean {
  const name = local(p.propertyURI);
  const value = prop(node, name);
  if (p["moon:inverseOf"]) {
    // A link: it must point at a node of the referenced template, or be stated the other way round.
    const target = templateById(profile, p.valueConstraint.valueTemplateRefs?.[0] || "");
    const cls = target ? local(target.resourceURI) : "";
    const ids = (v: any) => ([] as any[]).concat(v ?? []).map((x) => (typeof x === "object" ? x?.["@id"] : x));
    const targets = graph.filter((g) => isA(g, cls));
    return targets.some((t) => ids(value).includes(t["@id"]) || ids(prop(t, local(p["moon:inverseOf"]!))).includes(node["@id"]));
  }
  if (p.type === "literal") return hasText(value);
  const ref = p.valueConstraint.valueTemplateRefs?.[0];
  const sub = ref ? templateById(profile, ref) : undefined;
  return sub ? satisfiesTemplate(value, sub, graph, node) : hasValue(value);
}

/** The required fields this record lacks under `profile`; empty when it may be published. */
export function missingForPublish(document: any, profile: Profile = MONOGRAPH_PROFILE): MissingField[] {
  const graph: any[] = Array.isArray(document?.["@graph"]) ? document["@graph"] : [];
  const missing: MissingField[] = [];
  const entities = (["Work", "Instance"] as const).map((cls) => ({ cls, node: graph.find((n) => isA(n, cls)), template: templateFor(profile, cls) }));
  for (const { cls, node, template } of entities) {
    if (!node) missing.push({ entity: cls, field: `bf:${cls}`, en: cls, ar: template?.["moon:resourceLabelAr"] || cls });
  }
  // Links between the entities are checked last, once both are known to exist.
  for (const pass of ["fields", "links"] as const) {
    for (const { cls, node, template } of entities) {
      if (!node || !template) continue;
      for (const p of template.propertyTemplates) {
        if (p.mandatory !== "true" || !!p["moon:inverseOf"] !== (pass === "links")) continue;
        if (pass === "links" && entities.some((e) => !e.node)) continue;
        if (!present(p, node, graph, profile)) {
          missing.push({ entity: cls, field: `bf:${local(p.propertyURI)}`, en: p.propertyLabel, ar: p["moon:propertyLabelAr"] });
        }
      }
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// SHACL shapes generated from a profile
// ---------------------------------------------------------------------------

const lit = (s: string, lang: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@${lang}`;

/** The profile's mandatory properties as SHACL Core shapes (Turtle), one node shape per resource template. */
export function shapesFromProfile(profile: Profile = MONOGRAPH_PROFILE): string {
  const shapeName = (id: string) => `moonshape:${id.replace(/^moon:/, "").replace(/[^A-Za-z0-9]+/g, "-")}`;
  const lines = [
    "@prefix sh: <http://www.w3.org/ns/shacl#> .",
    `@prefix bf: <${BF}> .`,
    "@prefix moonshape: <https://mooon.site/shapes/> .",
    "",
  ];
  const targeted = new Set(["Work", "Instance"]);
  for (const t of profile.Profile.resourceTemplates) {
    const cls = local(t.resourceURI);
    lines.push(`${shapeName(t.id)} a sh:NodeShape ;`);
    if (targeted.has(cls)) lines.push(`  sh:targetClass bf:${cls} ;`);
    lines.push(`  sh:name ${lit(t.resourceLabel, "en")}, ${lit(t["moon:resourceLabelAr"], "ar")} ;`);
    const props = t.propertyTemplates.filter((p) => p.mandatory === "true");
    props.forEach((p, i) => {
      const end = i === props.length - 1 ? " ." : " ;";
      const names = `sh:name ${lit(p.propertyLabel, "en")}, ${lit(p["moon:propertyLabelAr"], "ar")}`;
      const path = `bf:${local(p.propertyURI)}`;
      const ref = p.valueConstraint.valueTemplateRefs?.[0];
      if (p["moon:inverseOf"]) {
        // Stated on this node, or the other way round on the linked node.
        lines.push(`  sh:or ( [ sh:path ${path} ; sh:minCount 1 ] [ sh:path [ sh:inversePath bf:${local(p["moon:inverseOf"])} ] ; sh:minCount 1 ] )${end}`);
      } else if (p.type === "literal") {
        lines.push(`  sh:property [ sh:path ${path} ; sh:minCount 1 ; sh:pattern "\\\\S" ; ${names} ]${end}`);
      } else if (ref) {
        lines.push(`  sh:property [ sh:path ${path} ; sh:qualifiedValueShape ${shapeName(ref)} ; sh:qualifiedMinCount 1 ; ${names} ]${end}`);
      } else {
        lines.push(`  sh:property [ sh:path ${path} ; sh:minCount 1 ; ${names} ]${end}`);
      }
    });
    if (!props.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, " .");
    lines.push("");
  }
  return lines.join("\n");
}
