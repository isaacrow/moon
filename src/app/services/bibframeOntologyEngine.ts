/**
 * BIBFRAME Ontology Engine
 * 
 * This engine defines the complete BIBFRAME ontology structure
 * and determines how fields should be rendered based on their properties.
 * 
 * Each property knows:
 * - Its URI and label
 * - Domain (which classes can use it)
 * - Range (what type of value it accepts)
 * - MARC field mappings
 * - Which LOC API to use (if any)
 * - Whether it's required
 */

export interface OntologyProperty {
  uri: string;
  label: string;
  labelAr?: string;
  domain: string[];
  range: string[];
  marc: string[];
  required?: boolean;
  repeatable?: boolean;
  api?: 'loc-names' | 'loc-subjects' | 'loc-places' | 'rda-vocab' | 'loc-classification' | 'loc-relators' | 'loc-languages' | 'loc-geographicAreas' | 'loc-countries' | 'iso639';
  controlledVocabulary?: boolean;
  valueType?: 'literal' | 'uri' | 'entity';
  description?: string;
}

export const BIBFRAME_PROPERTIES: OntologyProperty[] = [
  // ========== WORK PROPERTIES ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/title",
    label: "Title",
    labelAr: "العنوان",
    domain: ["bf:Work", "bf:Instance"],
    range: ["bf:Title"],
    marc: ["130", "240", "245"],
    required: true,
    repeatable: false,
    valueType: 'entity',
    description: "Title of the resource"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/contribution",
    label: "Contribution",
    labelAr: "المساهمة",
    domain: ["bf:Work", "bf:Instance"],
    range: ["bf:Contribution"],
    marc: ["100", "110", "111", "700", "710", "711"],
    api: "loc-names",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Agent and their role in creating the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/subject",
    label: "Subject",
    labelAr: "الموضوع",
    domain: ["bf:Work"],
    range: ["bf:Topic", "bf:Subject"],
    marc: ["600", "610", "611", "630", "650", "651", "653", "654", "655", "656", "657"],
    api: "loc-subjects",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Subject headings from LCSH"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/classification",
    label: "Classification",
    labelAr: "التصنيف",
    domain: ["bf:Work"],
    range: ["bf:Classification"],
    marc: ["050", "082", "080", "084"],
    api: "loc-classification",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Classification numbers (LCC, DDC)"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/geographicCoverage",
    label: "Geographic Coverage",
    labelAr: "التغطية الجغرافية",
    domain: ["bf:Work"],
    range: ["bf:Place"],
    marc: ["043", "651", "662"],
    api: "loc-places",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Geographic area the work is about"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/language",
    label: "Language",
    labelAr: "اللغة",
    domain: ["bf:Work"],
    range: ["bf:Language"],
    marc: ["041", "546"],
    api: "iso639",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Language of the content"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/content",
    label: "Content Type",
    labelAr: "نوع المحتوى",
    domain: ["bf:Work"],
    range: ["bf:Content"],
    marc: ["336"],
    api: "rda-vocab",
    required: false,
    repeatable: false,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "RDA Content Type"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/genreForm",
    label: "Genre/Form",
    labelAr: "النوع/الشكل",
    domain: ["bf:Work"],
    range: ["bf:GenreForm"],
    marc: ["655"],
    api: "loc-subjects",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Genre or form of the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/originDate",
    label: "Origin Date",
    labelAr: "تاريخ الأصل",
    domain: ["bf:Work"],
    range: ["rdfs:Literal"],
    marc: ["046"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Date of creation of the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/originPlace",
    label: "Origin Place",
    labelAr: "مكان الأصل",
    domain: ["bf:Work"],
    range: ["bf:Place"],
    marc: ["370"],
    api: "loc-places",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Place associated with the origin of the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/intendedAudience",
    label: "Intended Audience",
    labelAr: "الجمهور المستهدف",
    domain: ["bf:Work"],
    range: ["bf:IntendedAudience"],
    marc: ["521"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "Target audience for the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/summary",
    label: "Summary",
    labelAr: "الملخص",
    domain: ["bf:Work"],
    range: ["bf:Summary"],
    marc: ["520"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "Summary or abstract of the work"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/tableOfContents",
    label: "Table of Contents",
    labelAr: "جدول المحتويات",
    domain: ["bf:Work"],
    range: ["bf:TableOfContents"],
    marc: ["505"],
    required: false,
    repeatable: false,
    valueType: 'entity',
    description: "Table of contents"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/note",
    label: "Note",
    labelAr: "ملاحظة",
    domain: ["bf:Work", "bf:Instance"],
    range: ["bf:Note"],
    marc: ["500", "501", "502", "504", "508", "511", "515", "516", "518"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "General notes"
  },

  // ========== INSTANCE PROPERTIES ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/provisionActivity",
    label: "Publication/Provision",
    labelAr: "النشر/الإصدار",
    domain: ["bf:Instance"],
    range: ["bf:ProvisionActivity"],
    marc: ["260", "264"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "Publication, distribution, or production activity"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/identifiedBy",
    label: "Identifier",
    labelAr: "المعرف",
    domain: ["bf:Instance"],
    range: ["bf:Identifier"],
    marc: ["010", "020", "022", "024", "028"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "ISBN, LCCN, or other identifiers"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/extent",
    label: "Extent",
    labelAr: "الحجم",
    domain: ["bf:Instance"],
    range: ["bf:Extent"],
    marc: ["300$a"],
    required: false,
    repeatable: false,
    valueType: 'entity',
    description: "Physical extent (e.g., number of pages)"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/dimensions",
    label: "Dimensions",
    labelAr: "الأبعاد",
    domain: ["bf:Instance"],
    range: ["rdfs:Literal"],
    marc: ["300$c"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Physical dimensions"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/media",
    label: "Media Type",
    labelAr: "نوع الوسيط",
    domain: ["bf:Instance"],
    range: ["bf:Media"],
    marc: ["337"],
    api: "rda-vocab",
    required: false,
    repeatable: false,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "RDA Media Type"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/carrier",
    label: "Carrier Type",
    labelAr: "نوع الحامل",
    domain: ["bf:Instance"],
    range: ["bf:Carrier"],
    marc: ["338"],
    api: "rda-vocab",
    required: false,
    repeatable: false,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "RDA Carrier Type"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/editionStatement",
    label: "Edition Statement",
    labelAr: "بيان الطبعة",
    domain: ["bf:Instance"],
    range: ["rdfs:Literal"],
    marc: ["250"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Edition statement"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/responsibilityStatement",
    label: "Statement of Responsibility",
    labelAr: "بيان المسؤولية",
    domain: ["bf:Instance"],
    range: ["rdfs:Literal"],
    marc: ["245$c"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Statement of responsibility"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/seriesStatement",
    label: "Series Statement",
    labelAr: "بيان السلسلة",
    domain: ["bf:Instance"],
    range: ["rdfs:Literal"],
    marc: ["490"],
    required: false,
    repeatable: true,
    valueType: 'literal',
    description: "Series statement"
  },

  // ========== CLASSIFICATION PROPERTIES ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/classificationLcc",
    label: "Library of Congress Classification",
    labelAr: "تصنيف مكتبة الكونغرس",
    domain: ["bf:Work"],
    range: ["bf:ClassificationLcc"],
    marc: ["050"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "LCC classification number with item number and metadata"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/classificationDdc",
    label: "Dewey Decimal Classification",
    labelAr: "تصنيف ديوي العشري",
    domain: ["bf:Work"],
    range: ["bf:ClassificationDdc"],
    marc: ["082"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "DDC classification number with edition"
  },

  // ========== SUBJECT ACCESS - EXPANDED ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/subject/topical",
    label: "Topical Subject (LCSH)",
    labelAr: "الموضوع الموضعي",
    domain: ["bf:Work"],
    range: ["bf:Topic"],
    marc: ["650"],
    api: "loc-subjects",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Library of Congress Subject Headings - Topical"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/subject/geographic",
    label: "Geographic Subject",
    labelAr: "الموضوع الجغرافي",
    domain: ["bf:Work"],
    range: ["bf:Place"],
    marc: ["651"],
    api: "loc-places",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Geographic area as a subject"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/subject/name",
    label: "Name Subject",
    labelAr: "موضوع الاسم",
    domain: ["bf:Work"],
    range: ["bf:Person", "bf:Organization"],
    marc: ["600", "610"],
    api: "loc-names",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Personal or corporate name as subject"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/geographicAreaCode",
    label: "Geographic Area Code",
    labelAr: "رمز المنطقة الجغرافية",
    domain: ["bf:Work"],
    range: ["bf:GeographicArea"],
    marc: ["043"],
    api: "loc-geographicAreas",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Geographic area codes (MARC 043)"
  },

  // ========== CONTENT DESCRIPTION ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/illustrativeContent",
    label: "Illustrative Content",
    labelAr: "المحتوى التوضيحي",
    domain: ["bf:Instance"],
    range: ["bf:Illustration"],
    marc: ["300$b", "340"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "Type of illustrations (maps, charts, etc.)"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/supplementaryContent",
    label: "Supplementary Content",
    labelAr: "المحتوى التكميلي",
    domain: ["bf:Instance"],
    range: ["bf:SupplementaryContent"],
    marc: ["504", "500"],
    required: false,
    repeatable: true,
    valueType: 'entity',
    description: "Index, bibliography, etc."
  },

  // ========== CONTRIBUTORS - EXPANDED ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/contribution/primary",
    label: "Primary Creator",
    labelAr: "المنشئ الأساسي",
    domain: ["bf:Work"],
    range: ["bf:Contribution"],
    marc: ["100", "110"],
    api: "loc-names",
    required: false,
    repeatable: false,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Main entry - personal or corporate name"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/contribution/additional",
    label: "Additional Contributors",
    labelAr: "المساهمون الإضافيون",
    domain: ["bf:Work"],
    range: ["bf:Contribution"],
    marc: ["700", "710"],
    api: "loc-names",
    required: false,
    repeatable: true,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Added entries for additional contributors"
  },

  // ========== PHYSICAL DESCRIPTION - EXPANDED ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/issuance",
    label: "Mode of Issuance",
    labelAr: "نوع الإصدار",
    domain: ["bf:Instance"],
    range: ["bf:Issuance"],
    marc: ["Leader/07"],
    required: false,
    repeatable: false,
    valueType: 'entity',
    description: "Single unit, serial, integrating resource, etc."
  },

  // ========== PUBLICATION - EXPANDED ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/place/uri",
    label: "Publication Place (URI)",
    labelAr: "مكان النشر (URI)",
    domain: ["bf:ProvisionActivity"],
    range: ["bf:Place"],
    marc: ["264$a"],
    api: "loc-countries",
    required: false,
    repeatable: false,
    valueType: 'entity',
    controlledVocabulary: true,
    description: "Controlled URI for place of publication"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/place/text",
    label: "Publication Place (Text)",
    labelAr: "مكان النشر (نص)",
    domain: ["bf:ProvisionActivity"],
    range: ["rdfs:Literal"],
    marc: ["264$a"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Text form of publication place"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/agent/publisher",
    label: "Publisher Name",
    labelAr: "اسم الناشر",
    domain: ["bf:ProvisionActivity"],
    range: ["rdfs:Literal"],
    marc: ["264$b"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Name of publisher"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/date/publication",
    label: "Publication Date",
    labelAr: "تاريخ النشر",
    domain: ["bf:ProvisionActivity"],
    range: ["rdfs:Literal"],
    marc: ["264$c"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Date of publication"
  },
  {
    uri: "http://id.loc.gov/ontologies/bibframe/date/copyright",
    label: "Copyright Date",
    labelAr: "تاريخ حقوق النشر",
    domain: ["bf:ProvisionActivity"],
    range: ["rdfs:Literal"],
    marc: ["264$c"],
    required: false,
    repeatable: false,
    valueType: 'literal',
    description: "Copyright date (with c prefix)"
  },

  // ========== ADMIN METADATA ==========
  {
    uri: "http://id.loc.gov/ontologies/bibframe/adminMetadata",
    label: "Administrative Metadata",
    labelAr: "البيانات الوصفية الإدارية",
    domain: ["bf:Work", "bf:Instance"],
    range: ["bf:AdminMetadata"],
    marc: ["040"],
    required: false,
    repeatable: false,
    valueType: 'entity',
    description: "Cataloging source, date, language, etc."
  },
];

/**
 * Get properties for a specific domain (bf:Work or bf:Instance)
 */
export function getPropertiesForDomain(domain: string): OntologyProperty[] {
  return BIBFRAME_PROPERTIES.filter(prop => prop.domain.includes(domain));
}

/**
 * Get a property by its URI
 */
export function getPropertyByUri(uri: string): OntologyProperty | undefined {
  return BIBFRAME_PROPERTIES.find(prop => prop.uri === uri);
}

/**
 * Get properties that require a specific API
 */
export function getPropertiesByApi(api: string): OntologyProperty[] {
  return BIBFRAME_PROPERTIES.filter(prop => prop.api === api);
}

/**
 * Check if a property is required for a given domain
 */
export function isPropertyRequired(uri: string, domain: string): boolean {
  const property = getPropertyByUri(uri);
  return property?.required === true && property.domain.includes(domain);
}

/**
 * Get MARC field mapping for a property
 */
export function getMarcMapping(uri: string): string[] {
  const property = getPropertyByUri(uri);
  return property?.marc || [];
}
