/**
 * Moon's cataloguing profiles, in the JSON form of LC's Marva profiles (Profile → resourceTemplates →
 * propertyTemplates, with mandatory / repeatable / type / valueConstraint). They are the one place that
 * says which fields a record has and which are required; the server's publish gate and the SHACL shapes
 * published at /profiles/<id>/shapes.ttl are generated from them.
 *
 * Moon additions (not in LC's format) start with "moon:": Arabic labels, and an inverse link that also
 * satisfies a property (a Work's bf:hasInstance counts as the Instance's bf:instanceOf).
 *
 * This file is shared: the edge function imports it, and so can the app and the tests.
 */

const BF = "http://id.loc.gov/ontologies/bibframe/";

export interface ValueConstraint {
  valueTemplateRefs?: string[];
  useValuesFrom?: string[];
  defaults?: { defaultURI?: string; defaultLiteral?: string }[];
  valueDataType?: { dataTypeURI?: string };
}

export interface PropertyTemplate {
  propertyURI: string;
  propertyLabel: string;
  "moon:propertyLabelAr": string;
  mandatory: "true" | "false";
  repeatable: "true" | "false";
  /** literal: text; resource: a node built from valueTemplateRefs; lookup: a term from useValuesFrom. */
  type: "literal" | "resource" | "lookup";
  valueConstraint: ValueConstraint;
  /** Moon: the same fact stated from the other end (e.g. bf:hasInstance on the Work for bf:instanceOf). */
  "moon:inverseOf"?: string;
}

export interface ResourceTemplate {
  id: string;
  resourceURI: string;
  resourceLabel: string;
  "moon:resourceLabelAr": string;
  propertyTemplates: PropertyTemplate[];
}

export interface Profile {
  Profile: {
    id: string;
    title: string;
    description: string;
    resourceTemplates: ResourceTemplate[];
  };
}

const P = (
  local: string, label: string, labelAr: string, mandatory: boolean, repeatable: boolean,
  type: PropertyTemplate["type"], valueConstraint: ValueConstraint = {}, extra: Partial<PropertyTemplate> = {},
): PropertyTemplate => ({
  propertyURI: BF + local,
  propertyLabel: label,
  "moon:propertyLabelAr": labelAr,
  mandatory: mandatory ? "true" : "false",
  repeatable: repeatable ? "true" : "false",
  type,
  valueConstraint,
  ...extra,
});

const vocab = (path: string) => `http://id.loc.gov/vocabulary/${path}`;

/** LC's core requirements for a printed monograph (BIBFRAME Monograph profile), with Moon's labels. */
export const MONOGRAPH_PROFILE: Profile = {
  Profile: {
    id: "moon:Monograph",
    title: "Monograph",
    description: "Printed books: a Work, its Instance, and their titles. Required fields follow LC's Monograph profile.",
    resourceTemplates: [
      {
        id: "moon:Monograph:Work",
        resourceURI: BF + "Work",
        resourceLabel: "Work",
        "moon:resourceLabelAr": "العمل",
        propertyTemplates: [
          P("title", "Work title", "عنوان العمل", true, true, "resource", { valueTemplateRefs: ["moon:Monograph:Title"] }),
          P("content", "Content type", "نوع المحتوى", true, true, "lookup", {
            useValuesFrom: [vocab("contentTypes")], defaults: [{ defaultURI: vocab("contentTypes/txt"), defaultLiteral: "text" }],
          }),
          P("language", "Language", "اللغة", false, true, "lookup", { useValuesFrom: [vocab("languages")] }),
          P("contribution", "Contribution", "المساهمة", false, true, "resource"),
          P("subject", "Subject", "الموضوع", false, true, "lookup", { useValuesFrom: ["http://id.loc.gov/authorities/subjects"] }),
          P("genreForm", "Genre / form", "النوع / الشكل", false, true, "lookup", { useValuesFrom: ["http://id.loc.gov/authorities/genreForms"] }),
          P("classification", "Classification", "التصنيف", false, true, "resource"),
        ],
      },
      {
        id: "moon:Monograph:Instance",
        resourceURI: BF + "Instance",
        resourceLabel: "Instance",
        "moon:resourceLabelAr": "التجسيد",
        propertyTemplates: [
          P("title", "Instance title", "عنوان التجسيد", true, true, "resource", { valueTemplateRefs: ["moon:Monograph:Title"] }),
          P("media", "Media type", "نوع الوسيط", true, true, "lookup", {
            useValuesFrom: [vocab("mediaTypes")], defaults: [{ defaultURI: vocab("mediaTypes/n"), defaultLiteral: "unmediated" }],
          }),
          P("carrier", "Carrier type", "نوع الحامل", true, true, "lookup", {
            useValuesFrom: [vocab("carriers")], defaults: [{ defaultURI: vocab("carriers/nc"), defaultLiteral: "volume" }],
          }),
          P("issuance", "Mode of issuance", "طريقة الإصدار", true, false, "lookup", {
            useValuesFrom: [vocab("issuance")], defaults: [{ defaultURI: vocab("issuance/mono"), defaultLiteral: "single unit" }],
          }),
          P("instanceOf", "Link from the Instance to its Work", "ربط التجسيد بعمله", true, false, "resource",
            { valueTemplateRefs: ["moon:Monograph:Work"] }, { "moon:inverseOf": BF + "hasInstance" }),
          P("provisionActivity", "Publication", "بيانات النشر", false, true, "resource"),
          P("identifiedBy", "Identifier", "المعرّف", false, true, "resource"),
          P("extent", "Extent", "الوصف المادي", false, true, "resource"),
        ],
      },
      {
        id: "moon:Monograph:Title",
        resourceURI: BF + "Title",
        resourceLabel: "Title",
        "moon:resourceLabelAr": "العنوان",
        propertyTemplates: [
          P("mainTitle", "Main title", "العنوان الرئيسي", true, true, "literal"),
          P("subtitle", "Subtitle", "العنوان الفرعي", false, true, "literal"),
        ],
      },
    ],
  },
};

export const PROFILES: Record<string, Profile> = { monograph: MONOGRAPH_PROFILE };
