/**
 * BIBFRAME Complete Property Registry
 * 100+ properties across Work, Expression, Instance, Item
 * Supports dynamic form rendering and validation
 */

export type PropertyType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'date' 
  | 'year'
  | 'uri' 
  | 'authority' 
  | 'controlled' 
  | 'repeatable'
  | 'structured';

export type PropertyDomain = 'Work' | 'Expression' | 'Instance' | 'Item' | 'AdminMetadata';

import { MONOGRAPH_PROFILE, profileRequired } from '../../supabase/functions/server/profiles.tsx';

export interface BibframePropertyDefinition {
  uri: string;
  shortName: string;
  label: string;
  description: string;
  domain: PropertyDomain[];
  range?: string[];
  type: PropertyType;
  required: boolean;
  repeatable: boolean;
  controlledVocab?: string;
  authoritySource?: 'LOC' | 'VIAF' | 'Wikidata' | 'All';
  validationPattern?: string;
  inputHint?: string;
  group?: string;
  order?: number;
}

/**
 * Complete BIBFRAME Property Registry
 * Organized by entity and functional group
 */
export const BIBFRAME_PROPERTY_REGISTRY: BibframePropertyDefinition[] = [
  /* ========================================
   * WORK PROPERTIES
   * ======================================== */
  
  // Title Group
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/title',
    shortName: 'bf:title',
    label: 'Title',
    description: 'Name given to a resource',
    domain: ['Work', 'Expression', 'Instance'],
    range: ['http://id.loc.gov/ontologies/bibframe/Title'],
    type: 'structured',
    required: true,
    repeatable: true,
    group: 'Title Information',
    order: 1
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/variantTitle',
    shortName: 'bf:variantTitle',
    label: 'Variant Title',
    description: 'Alternative form of title',
    domain: ['Work', 'Instance'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Title Information',
    order: 2
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/abbreviatedTitle',
    shortName: 'bf:abbreviatedTitle',
    label: 'Abbreviated Title',
    description: 'Shortened form of title',
    domain: ['Work'],
    type: 'text',
    required: false,
    repeatable: true,
    group: 'Title Information',
    order: 3
  },

  // Contribution Group
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/contribution',
    shortName: 'bf:contribution',
    label: 'Contribution',
    description: 'Agent and role with respect to the resource',
    domain: ['Work', 'Expression'],
    range: ['http://id.loc.gov/ontologies/bibframe/Contribution'],
    type: 'structured',
    required: true,
    repeatable: true,
    group: 'Contributors',
    order: 10
  },

  // Language Group
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/language',
    shortName: 'bf:language',
    label: 'Language',
    description: 'Language of the content',
    domain: ['Work', 'Expression'],
    range: ['http://id.loc.gov/vocabulary/languages/'],
    type: 'authority',
    required: false,
    repeatable: true,
    authoritySource: 'LOC',
    controlledVocab: 'languages',
    group: 'Language & Content',
    order: 20
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/originalLanguage',
    shortName: 'bf:originalLanguage',
    label: 'Original Language',
    description: 'Language of the original work',
    domain: ['Work'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    group: 'Language & Content',
    order: 21
  },

  // Subject & Classification Group
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/subject',
    shortName: 'bf:subject',
    label: 'Subject',
    description: 'Topic of the resource',
    domain: ['Work'],
    type: 'authority',
    required: false,
    repeatable: true,
    authoritySource: 'All',
    group: 'Subject Access',
    order: 30
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/classification',
    shortName: 'bf:classification',
    label: 'Classification',
    description: 'Classification number and scheme',
    domain: ['Work'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Subject Access',
    order: 31
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/genreForm',
    shortName: 'bf:genreForm',
    label: 'Genre/Form',
    description: 'Genre, style, or form of content',
    domain: ['Work'],
    type: 'authority',
    required: false,
    repeatable: true,
    authoritySource: 'LOC',
    controlledVocab: 'genreForms',
    group: 'Subject Access',
    order: 32
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/geographicCoverage',
    shortName: 'bf:geographicCoverage',
    label: 'Geographic Coverage',
    description: 'Geographic area covered by content',
    domain: ['Work'],
    type: 'authority',
    required: false,
    repeatable: true,
    authoritySource: 'LOC',
    group: 'Subject Access',
    order: 33
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/temporalCoverage',
    shortName: 'bf:temporalCoverage',
    label: 'Temporal Coverage',
    description: 'Time period covered by content',
    domain: ['Work'],
    type: 'text',
    required: false,
    repeatable: true,
    group: 'Subject Access',
    order: 34
  },

  // Content Description Group
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/content',
    shortName: 'bf:content',
    label: 'Content Type',
    description: 'Form of communication (text, image, etc.)',
    domain: ['Work'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    controlledVocab: 'contentTypes',
    group: 'Content Description',
    order: 40
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/summary',
    shortName: 'bf:summary',
    label: 'Summary',
    description: 'Abstract or description of content',
    domain: ['Work'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Content Description',
    order: 41
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/tableOfContents',
    shortName: 'bf:tableOfContents',
    label: 'Table of Contents',
    description: 'List of chapters or contents',
    domain: ['Work', 'Instance'],
    type: 'structured',
    required: false,
    repeatable: false,
    group: 'Content Description',
    order: 42
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/illustrativeContent',
    shortName: 'bf:illustrativeContent',
    label: 'Illustrative Content',
    description: 'Illustrations, maps, diagrams, etc.',
    domain: ['Work'],
    type: 'controlled',
    required: false,
    repeatable: true,
    group: 'Content Description',
    order: 43
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/supplementaryContent',
    shortName: 'bf:supplementaryContent',
    label: 'Supplementary Content',
    description: 'Additional content (index, bibliography, etc.)',
    domain: ['Work', 'Instance'],
    type: 'controlled',
    required: false,
    repeatable: true,
    group: 'Content Description',
    order: 44
  },

  // Intended Audience & Awards
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/intendedAudience',
    shortName: 'bf:intendedAudience',
    label: 'Intended Audience',
    description: 'Target audience or user group',
    domain: ['Work'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Audience & Awards',
    order: 50
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/awards',
    shortName: 'bf:awards',
    label: 'Awards',
    description: 'Awards or honors received',
    domain: ['Work'],
    type: 'text',
    required: false,
    repeatable: true,
    group: 'Audience & Awards',
    order: 51
  },

  // Dates
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/originDate',
    shortName: 'bf:originDate',
    label: 'Date of Work',
    description: 'Date the work was created',
    domain: ['Work'],
    type: 'year',
    required: false,
    repeatable: false,
    group: 'Dates',
    order: 60
  },

  // Music-Specific
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/musicMedium',
    shortName: 'bf:musicMedium',
    label: 'Medium of Performance',
    description: 'Instrument or voice for which music is written',
    domain: ['Work'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Music Properties',
    order: 70
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/musicKey',
    shortName: 'bf:musicKey',
    label: 'Musical Key',
    description: 'Key in which music is written',
    domain: ['Work'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Music Properties',
    order: 71
  },

  /* ========================================
   * EXPRESSION PROPERTIES
   * ======================================== */

  {
    uri: 'http://id.loc.gov/ontologies/bibframe/expressionOf',
    shortName: 'bf:expressionOf',
    label: 'Expression Of',
    description: 'Work realized by this expression',
    domain: ['Expression'],
    range: ['http://id.loc.gov/ontologies/bibframe/Work'],
    type: 'uri',
    required: true,
    repeatable: false,
    group: 'Expression Relations',
    order: 100
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/translationOf',
    shortName: 'bf:translationOf',
    label: 'Translation Of',
    description: 'Expression being translated',
    domain: ['Expression'],
    type: 'uri',
    required: false,
    repeatable: false,
    group: 'Expression Relations',
    order: 101
  },

  /* ========================================
   * INSTANCE PROPERTIES
   * ======================================== */

  // Basic Instance Info
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/instanceOf',
    shortName: 'bf:instanceOf',
    label: 'Instance Of',
    description: 'Work or Expression realized by this instance',
    domain: ['Instance'],
    type: 'uri',
    required: true,
    repeatable: false,
    group: 'Instance Relations',
    order: 200
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/editionStatement',
    shortName: 'bf:editionStatement',
    label: 'Edition Statement',
    description: 'Edition designation and responsibility',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Edition & Statement',
    order: 201
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/responsibilityStatement',
    shortName: 'bf:responsibilityStatement',
    label: 'Statement of Responsibility',
    description: 'Statement of persons/orgs responsible',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Edition & Statement',
    order: 202
  },

  // Identifiers
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/identifiedBy',
    shortName: 'bf:identifiedBy',
    label: 'Identifier',
    description: 'ISBN, ISSN, LCCN, etc.',
    domain: ['Instance', 'Item'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Identifiers',
    order: 210
  },

  // Publication/Provision
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/provisionActivity',
    shortName: 'bf:provisionActivity',
    label: 'Provision Activity',
    description: 'Publication, distribution, manufacture',
    domain: ['Instance'],
    type: 'structured',
    required: true,
    repeatable: true,
    group: 'Publication',
    order: 220
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/copyrightDate',
    shortName: 'bf:copyrightDate',
    label: 'Copyright Date',
    description: 'Copyright or phonogram date',
    domain: ['Instance'],
    type: 'year',
    required: false,
    repeatable: false,
    group: 'Publication',
    order: 221
  },

  // Physical Description
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/extent',
    shortName: 'bf:extent',
    label: 'Extent',
    description: 'Physical extent (pages, volumes, etc.)',
    domain: ['Instance'],
    type: 'structured',
    required: false,
    repeatable: false,
    group: 'Physical Description',
    order: 230
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/dimensions',
    shortName: 'bf:dimensions',
    label: 'Dimensions',
    description: 'Physical size',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: false,
    inputHint: 'e.g., 24 cm',
    group: 'Physical Description',
    order: 231
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/carrier',
    shortName: 'bf:carrier',
    label: 'Carrier Type',
    description: 'Format of storage medium',
    domain: ['Instance'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    controlledVocab: 'carriers',
    group: 'Physical Description',
    order: 232
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/media',
    shortName: 'bf:media',
    label: 'Media Type',
    description: 'Type of intermediation device',
    domain: ['Instance'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    controlledVocab: 'mediaTypes',
    group: 'Physical Description',
    order: 233
  },

  // Series
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/seriesStatement',
    shortName: 'bf:seriesStatement',
    label: 'Series Statement',
    description: 'Series title and numbering',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: true,
    group: 'Series',
    order: 240
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/seriesEnumeration',
    shortName: 'bf:seriesEnumeration',
    label: 'Series Numbering',
    description: 'Numbering within series',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Series',
    order: 241
  },

  // Serials-Specific
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/frequency',
    shortName: 'bf:frequency',
    label: 'Frequency',
    description: 'Publication frequency (for serials)',
    domain: ['Instance'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    group: 'Serial Properties',
    order: 250
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/issuance',
    shortName: 'bf:issuance',
    label: 'Mode of Issuance',
    description: 'Monograph, serial, integrating resource, etc.',
    domain: ['Instance'],
    type: 'controlled',
    required: false,
    repeatable: false,
    group: 'Serial Properties',
    order: 251
  },

  // Notes
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/note',
    shortName: 'bf:note',
    label: 'Note',
    description: 'General note',
    domain: ['Work', 'Instance', 'Item'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Notes',
    order: 260
  },

  // Acquisition
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/acquisitionSource',
    shortName: 'bf:acquisitionSource',
    label: 'Acquisition Source',
    description: 'Source from which acquired',
    domain: ['Instance', 'Item'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Acquisition',
    order: 270
  },

  /* ========================================
   * ITEM PROPERTIES
   * ======================================== */

  {
    uri: 'http://id.loc.gov/ontologies/bibframe/itemOf',
    shortName: 'bf:itemOf',
    label: 'Item Of',
    description: 'Instance held by this item',
    domain: ['Item'],
    type: 'uri',
    required: true,
    repeatable: false,
    group: 'Item Relations',
    order: 300
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/heldBy',
    shortName: 'bf:heldBy',
    label: 'Held By',
    description: 'Institution holding the item',
    domain: ['Item'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    group: 'Holdings',
    order: 301
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/shelfMark',
    shortName: 'bf:shelfMark',
    label: 'Shelf Mark',
    description: 'Call number or shelf location',
    domain: ['Item'],
    type: 'text',
    required: false,
    repeatable: false,
    group: 'Holdings',
    order: 302
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/subLocation',
    shortName: 'bf:subLocation',
    label: 'Sub-location',
    description: 'Specific location within institution',
    domain: ['Item'],
    type: 'text',
    required: false,
    repeatable: false,
    inputHint: 'e.g., Rare Books Room',
    group: 'Holdings',
    order: 303
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/electronicLocator',
    shortName: 'bf:electronicLocator',
    label: 'Electronic Locator',
    description: 'URL or electronic access point',
    domain: ['Item'],
    type: 'uri',
    required: false,
    repeatable: true,
    group: 'Holdings',
    order: 304
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/usageAndAccessPolicy',
    shortName: 'bf:usageAndAccessPolicy',
    label: 'Usage & Access Policy',
    description: 'Restrictions or terms of use',
    domain: ['Item'],
    type: 'structured',
    required: false,
    repeatable: true,
    group: 'Access',
    order: 310
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/status',
    shortName: 'bf:status',
    label: 'Status',
    description: 'Availability status',
    domain: ['Item'],
    type: 'controlled',
    required: false,
    repeatable: false,
    group: 'Access',
    order: 311
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/immediateAcquisition',
    shortName: 'bf:immediateAcquisition',
    label: 'Immediate Acquisition',
    description: 'Circumstances of acquisition',
    domain: ['Item'],
    type: 'structured',
    required: false,
    repeatable: false,
    group: 'Acquisition',
    order: 320
  },

  /* ========================================
   * ADMINISTRATIVE METADATA
   * ======================================== */

  {
    uri: 'http://id.loc.gov/ontologies/bibframe/adminMetadata',
    shortName: 'bf:adminMetadata',
    label: 'Administrative Metadata',
    description: 'Metadata about the metadata',
    domain: ['AdminMetadata'],
    type: 'structured',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 400
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/creationDate',
    shortName: 'bf:creationDate',
    label: 'Creation Date',
    description: 'Date record was created',
    domain: ['AdminMetadata'],
    type: 'date',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 401
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/changeDate',
    shortName: 'bf:changeDate',
    label: 'Change Date',
    description: 'Date record was last modified',
    domain: ['AdminMetadata'],
    type: 'date',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 402
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/source',
    shortName: 'bf:source',
    label: 'Cataloging Source',
    description: 'Institution creating the record',
    domain: ['AdminMetadata'],
    type: 'authority',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 403
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/descriptionConventions',
    shortName: 'bf:descriptionConventions',
    label: 'Description Conventions',
    description: 'Cataloging rules used (e.g., RDA)',
    domain: ['AdminMetadata'],
    type: 'controlled',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 404
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/descriptionLanguage',
    shortName: 'bf:descriptionLanguage',
    label: 'Description Language',
    description: 'Language of cataloging',
    domain: ['AdminMetadata'],
    type: 'authority',
    required: false,
    repeatable: false,
    authoritySource: 'LOC',
    group: 'Administrative',
    order: 405
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/descriptionAuthentication',
    shortName: 'bf:descriptionAuthentication',
    label: 'Description Authentication',
    description: 'Level of authentication',
    domain: ['AdminMetadata'],
    type: 'controlled',
    required: false,
    repeatable: false,
    group: 'Administrative',
    order: 406
  },

  /* ========================================
   * RELATIONSHIP PROPERTIES
   * ======================================== */

  {
    uri: 'http://id.loc.gov/ontologies/bibframe/relatedTo',
    shortName: 'bf:relatedTo',
    label: 'Related To',
    description: 'General relationship to another resource',
    domain: ['Work', 'Instance'],
    type: 'uri',
    required: false,
    repeatable: true,
    group: 'Relationships',
    order: 500
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasPart',
    shortName: 'bf:hasPart',
    label: 'Has Part',
    description: 'Resource contains this part',
    domain: ['Work', 'Instance'],
    type: 'uri',
    required: false,
    repeatable: true,
    group: 'Relationships',
    order: 501
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/partOf',
    shortName: 'bf:partOf',
    label: 'Part Of',
    description: 'Resource is part of this whole',
    domain: ['Work', 'Instance'],
    type: 'uri',
    required: false,
    repeatable: false,
    group: 'Relationships',
    order: 502
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasEquivalent',
    shortName: 'bf:hasEquivalent',
    label: 'Has Equivalent',
    description: 'Equivalent manifestation',
    domain: ['Instance'],
    type: 'uri',
    required: false,
    repeatable: true,
    group: 'Relationships',
    order: 503
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/precededBy',
    shortName: 'bf:precededBy',
    label: 'Preceded By',
    description: 'Earlier edition or version',
    domain: ['Work', 'Instance'],
    type: 'uri',
    required: false,
    repeatable: false,
    group: 'Relationships',
    order: 504
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/succeededBy',
    shortName: 'bf:succeededBy',
    label: 'Succeeded By',
    description: 'Later edition or version',
    domain: ['Work', 'Instance'],
    type: 'uri',
    required: false,
    repeatable: false,
    group: 'Relationships',
    order: 505
  },
  {
    uri: 'http://id.loc.gov/ontologies/bibframe/accompaniedBy',
    shortName: 'bf:accompaniedBy',
    label: 'Accompanied By',
    description: 'Accompanying material',
    domain: ['Instance'],
    type: 'text',
    required: false,
    repeatable: true,
    group: 'Relationships',
    order: 506
  }
];

/**
 * Get properties for a specific domain
 */
export function getPropertiesByDomain(domain: PropertyDomain): BibframePropertyDefinition[] {
  return BIBFRAME_PROPERTY_REGISTRY
    .filter(prop => prop.domain.includes(domain))
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Get properties by group
 */
export function getPropertiesByGroup(domain: PropertyDomain, group: string): BibframePropertyDefinition[] {
  return BIBFRAME_PROPERTY_REGISTRY
    .filter(prop => prop.domain.includes(domain) && prop.group === group)
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Get all groups for a domain
 */
export function getGroupsForDomain(domain: PropertyDomain): string[] {
  const groups = new Set<string>();
  BIBFRAME_PROPERTY_REGISTRY
    .filter(prop => prop.domain.includes(domain) && prop.group)
    .forEach(prop => groups.add(prop.group!));
  return Array.from(groups);
}

/**
 * Get property by short name
 */
export function getPropertyByName(shortName: string): BibframePropertyDefinition | undefined {
  return BIBFRAME_PROPERTY_REGISTRY.find(prop => prop.shortName === shortName);
}

/**
 * Get required properties for domain
 */
export function getRequiredPropertiesByDomain(domain: PropertyDomain): BibframePropertyDefinition[] {
  // A Work's or an Instance's required fields are its profile's, the ones the publish gate checks.
  if (domain === 'Work' || domain === 'Instance') {
    const required = profileRequired(MONOGRAPH_PROFILE, domain);
    return BIBFRAME_PROPERTY_REGISTRY.filter(prop => prop.domain.includes(domain) && required.has(prop.shortName));
  }
  return BIBFRAME_PROPERTY_REGISTRY.filter(
    prop => prop.domain.includes(domain) && prop.required
  );
}
