/**
 * Phase 10, the entities system: how a Moon entity is described as linked data, in two parts as LC does.
 *
 *   1. The real-world thing at https://mooon.site/resource/<kind>/<id>: bf:Person, bf:Family,
 *      bf:Organization, bf:Meeting, bf:Jurisdiction, bf:Hub, bf:Topic, bf:Place, bf:GenreForm or bf:Temporal,
 *      with its name, other names, sameAs links and (for a Hub) title, creator and expressions.
 *   2. Its authority data at <uri>#authority, as id.loc.gov writes it in MADS/RDF: madsrdf:Authority plus the
 *      MADS class (PersonalName, CorporateName …), the authoritative label, each other name as a
 *      madsrdf:Variant, the external authorities it matches, and madsrdf:identifiesRWO back to the thing.
 *
 * Pure (no network, no npm: imports), so the tests can run it.
 */

/** The kinds of entity, each with its own address: /resource/<kind>/<id>. */
export const ENTITY_KINDS = ["agent", "place", "topic", "hub", "genre", "period"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** What sort of agent an agent entity is (LC's Marva templates: bfPerson, bfFamily, bfCorp, bfConf, bfJurisdiction). */
export const AGENT_TYPES = ["person", "family", "organization", "meeting", "jurisdiction"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const isEntityKind = (k: unknown): k is EntityKind => typeof k === "string" && (ENTITY_KINDS as readonly string[]).includes(k);

export function agentTypeOf(data: any): AgentType {
  const t = String(data?.agentType || "").toLowerCase();
  return (AGENT_TYPES as readonly string[]).includes(t) ? (t as AgentType) : "person";
}

const BF_AGENT: Record<AgentType, string> = {
  person: "bf:Person", family: "bf:Family", organization: "bf:Organization", meeting: "bf:Meeting", jurisdiction: "bf:Jurisdiction",
};
const MADS_AGENT: Record<AgentType, string> = {
  person: "madsrdf:PersonalName", family: "madsrdf:FamilyName", organization: "madsrdf:CorporateName",
  meeting: "madsrdf:ConferenceName", jurisdiction: "madsrdf:Geographic",
};

/** The BIBFRAME class of the thing itself. */
export function entityClass(kind: string, data?: any): string {
  switch (kind) {
    case "hub": return "bf:Hub";
    case "place": return "bf:Place";
    case "topic": return "bf:Topic";
    case "genre": return "bf:GenreForm";
    case "period": return "bf:Temporal";
    default: return BF_AGENT[agentTypeOf(data)];
  }
}

/** The MADS/RDF class of its authority data. */
export function madsClass(kind: string, data?: any): string {
  switch (kind) {
    case "hub": return "madsrdf:NameTitle";
    case "place": return "madsrdf:Geographic";
    case "topic": return "madsrdf:Topic";
    case "genre": return "madsrdf:GenreForm";
    case "period": return "madsrdf:Temporal";
    default: return MADS_AGENT[agentTypeOf(data)];
  }
}

export interface EntityInput {
  id: string;
  kind: string;
  label: string;
  variants: string[];
  sameAs: string[];
  note?: string | null;
  data?: any;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** The two nodes (the thing, then its authority data) for one entity at `base`/<kind>/<id>. */
export function entityNodes(a: EntityInput, base: string, expressions: string[] = []): any[] {
  const uri = `${base}/${a.kind}/${a.id}`;
  const d = a.data || {};
  const thing: any = { "@id": uri, "@type": [entityClass(a.kind, d)], "rdfs:label": a.label, "skos:prefLabel": a.label };
  if (a.variants.length) thing["skos:altLabel"] = a.variants;
  if (a.sameAs.length) thing["owl:sameAs"] = a.sameAs.map((s) => ({ "@id": s }));
  if (a.note) thing["skos:note"] = a.note;

  if (a.kind === "agent") {
    if (text(d.birthDate)) thing["madsrdf:birthDate"] = text(d.birthDate);
    if (text(d.deathDate)) thing["madsrdf:deathDate"] = text(d.deathDate);
    if (text(d.occupation)) thing["madsrdf:occupation"] = text(d.occupation);
    // A meeting's or organization's date and place, as LC's bfConf and bfCorp templates give them.
    if (text(d.date)) thing["bf:date"] = text(d.date);
    if (text(d.place)) thing["bf:place"] = { "@type": "bf:Place", "rdfs:label": text(d.place) };
  }
  if (a.kind === "place" && /^https?:\/\//.test(text(d.partOf))) thing["bf:partOf"] = { "@id": text(d.partOf) };
  if (a.kind === "period" && (text(d.start) || text(d.end))) {
    // An EDTF interval ("1258/1534"), as LC's madsTemporal template records a date range.
    thing["bf:date"] = { "@value": `${text(d.start) || ".."}/${text(d.end) || ".."}`, "@type": "http://id.loc.gov/datatypes/edtf/EDTF" };
  }
  if (["topic", "genre"].includes(a.kind) && /^https?:\/\//.test(text(d.source))) thing["bf:source"] = { "@id": text(d.source) };
  if (a.kind === "topic") {
    const refs = (v: unknown) => (Array.isArray(v) ? v : []).map(text).filter((s) => /^https?:\/\//.test(s)).map((s) => ({ "@id": s }));
    if (refs(d.broader).length) thing["skos:broader"] = refs(d.broader);
    if (refs(d.narrower).length) thing["skos:narrower"] = refs(d.narrower);
  }
  if (a.kind === "hub") {
    // A hub's name is its authorized access point; its title and creator as LC's hubs give them.
    thing["bflc:aap"] = a.label;
    const title = text(d.title);
    if (title) thing["bf:title"] = { "@type": "bf:Title", "bf:mainTitle": title };
    const creator = text(d.creator);
    const creatorUri = text(d.creatorUri);
    if (creator || /^https?:\/\//.test(creatorUri)) {
      const agent: any = /^https?:\/\//.test(creatorUri) ? { "@id": creatorUri } : { "@type": "bf:Agent" };
      if (creator) agent["rdfs:label"] = creator;
      thing["bf:contribution"] = { "@type": "bf:PrimaryContribution", "bf:agent": agent };
    }
    if (text(d.language)) thing["bf:language"] = text(d.language);
    if (expressions.length) thing["bf:hasExpression"] = expressions.map((id) => ({ "@id": id }));
  }

  const authority: any = {
    "@id": `${uri}#authority`,
    "@type": ["madsrdf:Authority", madsClass(a.kind, d)],
    "madsrdf:authoritativeLabel": a.label,
    "madsrdf:identifiesRWO": { "@id": uri },
  };
  if (a.variants.length) {
    authority["madsrdf:hasVariant"] = a.variants.map((v) => ({ "@type": ["madsrdf:Variant", madsClass(a.kind, d)], "madsrdf:variantLabel": v }));
  }
  if (a.sameAs.length) authority["madsrdf:hasExactExternalAuthority"] = a.sameAs.map((s) => ({ "@id": s }));
  if (a.note) authority["madsrdf:editorialNote"] = a.note;
  thing["madsrdf:isIdentifiedByAuthority"] = { "@id": authority["@id"] };
  return [thing, authority];
}

/** Where an entity's address sends a person in a browser: its OPAC page, or a search for its name. */
export function entityPageParams(kind: string, label: string, uri: string): [string, string] {
  if (kind === "agent") return ["person", label];
  if (kind === "topic") return ["subject", label];
  if (kind === "place") return ["place", label];
  if (kind === "hub") return ["hub", uri];
  return ["q", label];
}
