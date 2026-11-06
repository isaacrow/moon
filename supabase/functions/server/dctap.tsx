/**
 * Moon's cataloguing profiles as DCTAP tables (https://www.dublincore.org/specifications/dctap/), the CSV
 * form LC's profile editor Dancer (bibframe.org/dancer) reads and writes, with the same columns as LC's own
 * Marva profiles there:
 *
 *   shapeID, shapeLabel, resourceURI, propertyID, propertyLabel, mandatory, repeatable, valueNodeType,
 *   valueDataType, valueShape, valueConstraint, valueConstraintType, note, lcDefaultLiteral, lcDefaultURI,
 *   lcDataTypeURI, lcRemark
 *
 * One row per property; a shape's first row names it (the following rows leave shapeID empty); several
 * values in one cell are separated by " | ". Moon's own additions go in extra columns (DCTAP allows them):
 * moonShapeLabelAr, moonPropertyLabelAr, moonInverseOf.
 *
 * profileToDctap() and dctapToProfile() are each other's reverse for Moon's profiles, and dctapToProfile()
 * also reads LC's Marva tables from Dancer. Pure and dependency-free (edge function, app, tests).
 */
import type { Profile, PropertyTemplate, ResourceTemplate } from "./profiles.tsx";

export const DCTAP_COLUMNS = [
  "shapeID", "shapeLabel", "resourceURI", "propertyID", "propertyLabel", "mandatory", "repeatable", "valueNodeType",
  "valueDataType", "valueShape", "valueConstraint", "valueConstraintType", "note", "lcDefaultLiteral", "lcDefaultURI",
  "lcDataTypeURI", "lcRemark", "moonShapeLabelAr", "moonPropertyLabelAr", "moonInverseOf",
] as const;
type Row = Partial<Record<(typeof DCTAP_COLUMNS)[number], string>>;

export const NAMESPACES: Record<string, string> = {
  bf: "http://id.loc.gov/ontologies/bibframe/",
  bflc: "http://id.loc.gov/ontologies/bflc/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  madsrdf: "http://www.loc.gov/mads/rdf/v1#",
  mads: "http://www.loc.gov/mads/rdf/v1#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
};
const SEP = " | ";

/** A full IRI as prefix:name when a known namespace fits (as Dancer writes them), else as it is. */
export function compact(iri: string): string {
  for (const [p, ns] of Object.entries(NAMESPACES)) if (p !== "mads" && iri.startsWith(ns) && /^[A-Za-z_][\w.-]*$/.test(iri.slice(ns.length))) return `${p}:${iri.slice(ns.length)}`;
  return iri;
}
/** prefix:name back to a full IRI; a full IRI or an unknown prefix stays as it is. */
export function expand(term: string): string {
  const m = term.match(/^([A-Za-z][\w-]*):([^/].*)$/);
  return m && NAMESPACES[m[1]] ? NAMESPACES[m[1]] + m[2] : term;
}
const split = (cell: string | undefined) => String(cell || "").split("|").map((s) => s.trim()).filter(Boolean);

// ---- CSV (RFC 4180) ----
const csvCell = (v: string) => (/[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((v) => csvCell(v ?? "")).join(",")).join("\r\n") + "\r\n";
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

// ---- Profile → DCTAP ----
function propertyRow(t: PropertyTemplate): Row {
  const vc = t.valueConstraint || {};
  const d = vc.defaults?.[0];
  const row: Row = {
    propertyID: compact(t.propertyURI),
    propertyLabel: t.propertyLabel,
    mandatory: t.mandatory,
    repeatable: t.repeatable,
    lcDefaultLiteral: d?.defaultLiteral || "",
    lcDefaultURI: d?.defaultURI || "",
    moonPropertyLabelAr: t["moon:propertyLabelAr"] || "",
    moonInverseOf: t["moon:inverseOf"] ? compact(t["moon:inverseOf"]) : "",
  };
  if (t.type === "resource") {
    row.valueNodeType = "bnode";
    row.valueShape = (vc.valueTemplateRefs || []).join(SEP);
  } else if (t.type === "lookup") {
    row.valueNodeType = "IRI";
    row.valueConstraint = (vc.useValuesFrom || []).join(SEP);
    row.valueConstraintType = (vc.useValuesFrom || []).length ? "IRIstem" : "";
  } else {
    row.valueNodeType = "literal";
    row.valueDataType = vc.valueDataType?.dataTypeURI ? compact(vc.valueDataType.dataTypeURI) : "";
  }
  return row;
}

/** A profile as one DCTAP table (CSV text), one shape per resource template. */
export function profileToDctap(profile: Profile): string {
  const rows: string[][] = [[...DCTAP_COLUMNS]];
  for (const rt of profile.Profile.resourceTemplates) {
    rt.propertyTemplates.forEach((pt, i) => {
      const row: Row = { ...propertyRow(pt) };
      if (i === 0) Object.assign(row, { shapeID: rt.id, shapeLabel: rt.resourceLabel, resourceURI: compact(rt.resourceURI), moonShapeLabelAr: rt["moon:resourceLabelAr"] || "" });
      rows.push(DCTAP_COLUMNS.map((c) => row[c] ?? ""));
    });
  }
  return toCsv(rows);
}

// ---- DCTAP → Profile ----
/**
 * A DCTAP table (Moon's export, or LC's Marva table from Dancer) as a profile in Marva's JSON form. Rows
 * with no propertyID (a shape with no properties yet) only name their shape.
 */
export function dctapToProfile(csv: string, meta: { id: string; title: string; description?: string }): Profile {
  const [header, ...body] = parseCsv(csv);
  if (!header || !header.includes("propertyID")) throw new Error("Not a DCTAP table: it has no propertyID column.");
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i < 0 ? "" : (r[i] ?? "").trim();
  };
  const templates: ResourceTemplate[] = [];
  let current: ResourceTemplate | undefined;
  for (const r of body) {
    const shapeID = col(r, "shapeID");
    if (shapeID && shapeID !== current?.id) {
      current = templates.find((t) => t.id === shapeID);
      if (!current) {
        current = {
          id: shapeID,
          resourceURI: expand(col(r, "resourceURI")),
          resourceLabel: col(r, "shapeLabel") || shapeID,
          "moon:resourceLabelAr": col(r, "moonShapeLabelAr"),
          propertyTemplates: [],
        };
        templates.push(current);
      }
    }
    const prop = col(r, "propertyID");
    if (!current || !prop) continue;
    const nodeType = col(r, "valueNodeType").toLowerCase();
    const shapes = split(col(r, "valueShape"));
    const values = split(col(r, "valueConstraint"));
    const type: PropertyTemplate["type"] = nodeType === "bnode" || (!nodeType && shapes.length) ? "resource"
      : nodeType === "iri" || (!nodeType && values.length) ? "lookup" : "literal";
    const valueConstraint: PropertyTemplate["valueConstraint"] = {};
    if (type === "resource" && shapes.length) valueConstraint.valueTemplateRefs = shapes;
    if (type === "lookup" && values.length) valueConstraint.useValuesFrom = values;
    if (type === "literal" && col(r, "valueDataType")) valueConstraint.valueDataType = { dataTypeURI: expand(col(r, "valueDataType")) };
    if (col(r, "lcDefaultURI") || col(r, "lcDefaultLiteral")) {
      valueConstraint.defaults = [{
        ...(col(r, "lcDefaultURI") ? { defaultURI: col(r, "lcDefaultURI") } : {}),
        ...(col(r, "lcDefaultLiteral") ? { defaultLiteral: col(r, "lcDefaultLiteral") } : {}),
      }];
    }
    const pt: PropertyTemplate = {
      propertyURI: expand(prop),
      propertyLabel: col(r, "propertyLabel") || prop,
      "moon:propertyLabelAr": col(r, "moonPropertyLabelAr"),
      mandatory: col(r, "mandatory") === "true" ? "true" : "false",
      repeatable: col(r, "repeatable") === "false" ? "false" : "true",
      type,
      valueConstraint,
    };
    if (col(r, "moonInverseOf")) pt["moon:inverseOf"] = expand(col(r, "moonInverseOf"));
    current.propertyTemplates.push(pt);
  }
  return { Profile: { id: meta.id, title: meta.title, description: meta.description || "", resourceTemplates: templates } };
}
