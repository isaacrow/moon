/**
 * The "Standard MARC Fields" layout of Moon Studio: the BIBFRAME properties it lists, in MARC order of
 * thought, with what only this layout needs: the MARC tags shown beside each field, which LC lookup the
 * field searches, and its Arabic label. Everything else comes from the one field registry
 * (ontologyRegistry), so this layout and Category Cards always agree: the field's label, whether it can
 * repeat, and whether it is required (which follows the cataloguing profile, i.e. the publish gate).
 */
import { ONTOLOGY_REGISTRY, getPropertiesByDomain } from './ontologyRegistry';

/** A field as the Standard layout's components (components/ontology/*) render it. */
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

const BF = 'http://id.loc.gov/ontologies/bibframe/';

/** `marcFor`: the tags for one entity when they differ from the property's general list. */
type LayoutRow = Omit<OntologyProperty, 'uri' | 'label'> & { name: string; label?: string; marcFor?: Record<string, string[]> };

// Only real BIBFRAME properties (the former engine also listed invented ones such as "topical",
// "primary" or "publisher", which every export had to repair; their inputs are covered by the real ones).
const LAYOUT: LayoutRow[] = [
  // A Work's title is its uniform title (130/240); an Instance's is the title proper and its variants (245/246).
  {name:"title",domain:["bf:Work","bf:Instance"],marc:["130","240","245"],marcFor:{"bf:Work":["130","240"],"bf:Instance":["245","246"]},range:["bf:Title"],valueType:"entity",labelAr:"العنوان"},
  {name:"contribution",domain:["bf:Work","bf:Instance"],marc:["100","110","111","700","710","711"],range:["bf:Contribution"],valueType:"entity",api:"loc-names",labelAr:"المساهمة"},
  {name:"subject",domain:["bf:Work"],marc:["600","610","611","630","650","651","653","654","655","656","657"],range:["bf:Topic","bf:Subject"],valueType:"entity",api:"loc-subjects",labelAr:"الموضوع"},
  {name:"classification",domain:["bf:Work"],marc:["050","082","080","084"],range:["bf:Classification"],valueType:"entity",api:"loc-classification",labelAr:"التصنيف"},
  {name:"geographicCoverage",domain:["bf:Work"],marc:["043","651","662"],range:["bf:Place"],valueType:"entity",api:"loc-places",labelAr:"التغطية الجغرافية"},
  {name:"language",domain:["bf:Work"],marc:["041","546"],range:["bf:Language"],valueType:"entity",api:"iso639",labelAr:"اللغة"},
  {name:"content",domain:["bf:Work"],marc:["336"],range:["bf:Content"],valueType:"entity",api:"rda-vocab",labelAr:"نوع المحتوى"},
  {name:"genreForm",domain:["bf:Work"],marc:["655"],range:["bf:GenreForm"],valueType:"entity",api:"loc-subjects",labelAr:"النوع/الشكل"},
  {name:"originDate",domain:["bf:Work"],marc:["046"],range:["rdfs:Literal"],valueType:"literal",labelAr:"تاريخ الأصل"},
  {name:"originPlace",domain:["bf:Work"],marc:["370"],range:["bf:Place"],valueType:"entity",api:"loc-places",labelAr:"مكان الأصل"},
  {name:"intendedAudience",domain:["bf:Work"],marc:["521"],range:["bf:IntendedAudience"],valueType:"entity",labelAr:"الجمهور المستهدف"},
  {name:"summary",domain:["bf:Work"],marc:["520"],range:["bf:Summary"],valueType:"entity",labelAr:"الملخص"},
  {name:"tableOfContents",domain:["bf:Work"],marc:["505"],range:["bf:TableOfContents"],valueType:"entity",labelAr:"جدول المحتويات"},
  {name:"note",domain:["bf:Work","bf:Instance"],marc:["500","501","502","504","508","511","515","516","518"],range:["bf:Note"],valueType:"entity",labelAr:"ملاحظة"},
  {name:"provisionActivity",domain:["bf:Instance"],marc:["260","264"],range:["bf:ProvisionActivity"],valueType:"entity",labelAr:"النشر/الإصدار"},
  {name:"identifiedBy",domain:["bf:Instance"],marc:["010","020","022","024","028"],range:["bf:Identifier"],valueType:"entity",labelAr:"المعرف"},
  {name:"extent",domain:["bf:Instance"],marc:["300$a"],range:["bf:Extent"],valueType:"entity",labelAr:"الحجم"},
  {name:"dimensions",domain:["bf:Instance"],marc:["300$c"],range:["rdfs:Literal"],valueType:"literal",labelAr:"الأبعاد"},
  {name:"media",domain:["bf:Instance"],marc:["337"],range:["bf:Media"],valueType:"entity",api:"rda-vocab",labelAr:"نوع الوسيط"},
  {name:"carrier",domain:["bf:Instance"],marc:["338"],range:["bf:Carrier"],valueType:"entity",api:"rda-vocab",labelAr:"نوع الحامل"},
  {name:"editionStatement",domain:["bf:Instance"],marc:["250"],range:["rdfs:Literal"],valueType:"literal",labelAr:"بيان الطبعة"},
  {name:"responsibilityStatement",domain:["bf:Instance"],marc:["245$c"],range:["rdfs:Literal"],valueType:"literal",labelAr:"بيان المسؤولية"},
  {name:"seriesStatement",domain:["bf:Instance"],marc:["490"],range:["rdfs:Literal"],valueType:"literal",labelAr:"بيان السلسلة",label:"Series Statement",repeatable:true},
  {name:"illustrativeContent",domain:["bf:Instance"],marc:["300$b","340"],range:["bf:Illustration"],valueType:"entity",labelAr:"المحتوى التوضيحي"},
  {name:"supplementaryContent",domain:["bf:Instance"],marc:["504","500"],range:["bf:SupplementaryContent"],valueType:"entity",labelAr:"المحتوى التكميلي"},
  {name:"issuance",domain:["bf:Instance"],marc:["Leader/07"],range:["bf:Issuance"],valueType:"entity",labelAr:"نوع الإصدار"},
  {name:"adminMetadata",domain:["bf:Work","bf:Instance"],marc:["040"],range:["bf:AdminMetadata"],valueType:"entity",labelAr:"البيانات الوصفية الإدارية"}
];

const registryByUri = new Map(Object.values(ONTOLOGY_REGISTRY).map((p) => [p.uri, p]));

/** The fields the Standard layout shows for a Work or an Instance ("bf:Work", "bf:Instance"...). */
export function getPropertiesForDomain(domain: string): OntologyProperty[] {
  const entity = domain.replace(/^bf:/, '');
  const required = new Set(getPropertiesByDomain(entity).filter((p) => p.required).map((p) => p.uri));
  return LAYOUT.filter((row) => row.domain.includes(domain)).map(({ name, marcFor, ...row }) => {
    const uri = BF + name;
    const reg = registryByUri.get(uri);
    return {
      ...row,
      marc: marcFor?.[domain] || row.marc,
      uri,
      label: reg?.label || row.label || name,
      repeatable: reg ? reg.repeatable : row.repeatable,
      required: required.has(uri),
      ...(reg?.description ? { description: reg.description } : {}),
    };
  });
}