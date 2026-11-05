/**
 * ðŸ§  BIBFRAME Ontology Registry - Single Source of Truth
 * Fully ontology-driven property definitions
 * No templates, no hardcoded fields - pure semantic modeling
 */

export type RangeType = 'Literal' | 'URI' | 'BlankNode';
export type InputComponentType = 
  | 'TextInput' 
  | 'TextArea' 
  | 'YearInput' 
  | 'DateInput'
  | 'EDTFDateInput'
  | 'ProjectedDateInput'
  | 'AuthoritySelect'
  | 'AccessibilitySelect'
  | 'NotationSelect'
  | 'GovernmentPubSelect'
  | 'AuthenticationSelect'
  | 'ContributionEditor'
  | 'TitleEditor'
  | 'IdentifierEditor'
  | 'ProvisionActivityEditor'
  | 'ClassificationEditor'
  | 'DissertationEditor'
  | 'TemporalCoverageEditor'
  | 'SeriesEditor'
  | 'AcquisitionEditor'
  | 'ImmediateAcquisitionEditor';

export interface SHACLValidation {
  minCount?: number;
  maxCount?: number;
  pattern?: string;
  datatype?: string;
  nodeKind?: 'IRI' | 'Literal' | 'BlankNode';
  classType?: string;
}

import { MONOGRAPH_PROFILE, profileRequired } from '../../supabase/functions/server/profiles.tsx';

export interface OntologyProperty {
  uri: string;
  shortName: string;
  label: string;
  description?: string;
  domain: string[]; // Can be used by multiple entity types
  rangeType: RangeType;
  classType?: string; // For BlankNode and URI ranges
  repeatable: boolean;
  required: boolean;
  inputComponent: InputComponentType;
  controlledVocab?: string;
  authoritySource?: string[];
  validation?: SHACLValidation;
  category: string; // For semantic grouping
  inputHint?: string;
  examples?: string[];
}

/**
 * ðŸ“š BIBFRAME Property Registry
 * Comprehensive ontology-driven definitions
 */
export const ONTOLOGY_REGISTRY: Record<string, OntologyProperty> = {
  // ==================== TITLE PROPERTIES ====================
  'bf:title': {
    uri: 'http://id.loc.gov/ontologies/bibframe/title',
    shortName: 'bf:title',
    label: 'Title',
    description: 'Name given to a resource',
    domain: ['Work', 'Instance', 'Item'],
    rangeType: 'BlankNode',
    classType: 'bf:Title',
    repeatable: true,
    required: true,
    inputComponent: 'TitleEditor',
    category: 'Title Information',
    validation: {
      minCount: 1,
      nodeKind: 'BlankNode',
      classType: 'bf:Title'
    }
  },
  'bf:mainTitle': {
    uri: 'http://id.loc.gov/ontologies/bibframe/mainTitle',
    shortName: 'bf:mainTitle',
    label: 'Main Title',
    description: 'Title being addressed',
    domain: ['Title'],
    rangeType: 'Literal',
    repeatable: false,
    required: true,
    inputComponent: 'TextInput',
    category: 'Title Information',
    validation: {
      minCount: 1,
      maxCount: 1,
      datatype: 'xsd:string'
    }
  },
  'bf:subtitle': {
    uri: 'http://id.loc.gov/ontologies/bibframe/subtitle',
    shortName: 'bf:subtitle',
    label: 'Subtitle',
    description: 'Word, character, or group of words appearing in conjunction with the title',
    domain: ['Title'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Title Information'
  },
  'bf:partNumber': {
    uri: 'http://id.loc.gov/ontologies/bibframe/partNumber',
    shortName: 'bf:partNumber',
    label: 'Part Number',
    description: 'Part or section number of a title',
    domain: ['Title'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Title Information'
  },
  'bf:partName': {
    uri: 'http://id.loc.gov/ontologies/bibframe/partName',
    shortName: 'bf:partName',
    label: 'Part Name',
    description: 'Part or section name of a title',
    domain: ['Title'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Title Information'
  },

  // ==================== CONTRIBUTION PROPERTIES ====================
  'bf:contribution': {
    uri: 'http://id.loc.gov/ontologies/bibframe/contribution',
    shortName: 'bf:contribution',
    label: 'Contribution',
    description: 'Agent and their role in relation to the resource',
    domain: ['Work', 'Instance', 'Expression'],
    rangeType: 'BlankNode',
    classType: 'bf:Contribution',
    repeatable: true,
    required: true,
    inputComponent: 'ContributionEditor',
    category: 'Contributors',
    validation: {
      minCount: 1,
      nodeKind: 'BlankNode',
      classType: 'bf:Contribution'
    }
  },
  'bf:agent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/agent',
    shortName: 'bf:agent',
    label: 'Agent',
    description: 'Entity associated with contribution',
    domain: ['Contribution'],
    rangeType: 'URI',
    classType: 'bf:Agent',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    authoritySource: ['LOC', 'VIAF', 'Wikidata'],
    category: 'Contributors',
    validation: {
      minCount: 1,
      maxCount: 1,
      nodeKind: 'IRI'
    }
  },
  'bf:role': {
    uri: 'http://id.loc.gov/ontologies/bibframe/role',
    shortName: 'bf:role',
    label: 'Role',
    description: 'Function performed by agent',
    domain: ['Contribution'],
    rangeType: 'URI',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'relators',
    category: 'Contributors',
    validation: {
      minCount: 1,
      maxCount: 1,
      nodeKind: 'IRI'
    }
  },

  // ==================== LANGUAGE & CONTENT ====================
  'bf:language': {
    uri: 'http://id.loc.gov/ontologies/bibframe/language',
    shortName: 'bf:language',
    label: 'Language',
    description: 'Language of the content',
    domain: ['Work', 'Expression'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'languages',
    category: 'Language & Content',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:content': {
    uri: 'http://id.loc.gov/ontologies/bibframe/content',
    shortName: 'bf:content',
    label: 'Content Type',
    description: 'Categorization reflecting the fundamental form of communication',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: true,
    required: true,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'contentTypes',
    category: 'Language & Content',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== SUBJECT & CLASSIFICATION ====================
  'bf:subject': {
    uri: 'http://id.loc.gov/ontologies/bibframe/subject',
    shortName: 'bf:subject',
    label: 'Subject',
    description: 'Index term, subject term, or descriptor',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    authoritySource: ['LOC', 'FAST', 'Wikidata'],
    category: 'Subject & Classification',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:classification': {
    uri: 'http://id.loc.gov/ontologies/bibframe/classification',
    shortName: 'bf:classification',
    label: 'Classification',
    description: 'Classification number or code',
    domain: ['Work', 'Instance'],
    rangeType: 'BlankNode',
    classType: 'bf:Classification',
    repeatable: true,
    required: false,
    inputComponent: 'ClassificationEditor',
    category: 'Subject & Classification'
  },
  'bf:genreForm': {
    uri: 'http://id.loc.gov/ontologies/bibframe/genreForm',
    shortName: 'bf:genreForm',
    label: 'Genre/Form',
    description: 'Form category or genre',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'genreForms',
    category: 'Subject & Classification',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== CONTENT DESCRIPTION ====================
  'bf:summary': {
    uri: 'http://id.loc.gov/ontologies/bibframe/summary',
    shortName: 'bf:summary',
    label: 'Summary',
    description: 'Description of the content',
    domain: ['Work'],
    rangeType: 'Literal',
    repeatable: true,
    required: false,
    inputComponent: 'TextArea',
    category: 'Content Description'
  },
  'bf:tableOfContents': {
    uri: 'http://id.loc.gov/ontologies/bibframe/tableOfContents',
    shortName: 'bf:tableOfContents',
    label: 'Table of Contents',
    description: 'List of subunits of the resource',
    domain: ['Work', 'Instance'],
    rangeType: 'Literal',
    repeatable: true,
    required: false,
    inputComponent: 'TextArea',
    category: 'Content Description'
  },
  'bf:note': {
    uri: 'http://id.loc.gov/ontologies/bibframe/note',
    shortName: 'bf:note',
    label: 'Note',
    description: 'General textual note',
    domain: ['Work', 'Instance', 'Item'],
    rangeType: 'Literal',
    repeatable: true,
    required: false,
    inputComponent: 'TextArea',
    category: 'Content Description'
  },

  // ==================== DATES ====================
  'bf:originDate': {
    uri: 'http://id.loc.gov/ontologies/bibframe/originDate',
    shortName: 'bf:originDate',
    label: 'Date of Work',
    description: 'Date or date range associated with the creation of the work',
    domain: ['Work'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'EDTFDateInput',
    category: 'Work Metadata',
    inputHint: 'EDTF format: YYYY, YYYY-MM-DD, or YYYY/YYYY',
    examples: ['2024', '2024-03-07', '2020/2024'],
    validation: {
      datatype: 'edtf:EDTF'
    }
  },
  'bf:copyrightDate': {
    uri: 'http://id.loc.gov/ontologies/bibframe/copyrightDate',
    shortName: 'bf:copyrightDate',
    label: 'Copyright Date',
    description: 'Date of copyright',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'YearInput',
    category: 'Dates',
    validation: {
      datatype: 'xsd:gYear'
    }
  },

  // ==================== WORK: PLACE ====================
  'bf:originPlace': {
    uri: 'http://id.loc.gov/ontologies/bibframe/originPlace',
    shortName: 'bf:originPlace',
    label: 'Country/Place of Origin',
    description: 'Place associated with the creation of the work',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:Place',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    authoritySource: ['LOC'],
    controlledVocab: 'countries',
    category: 'Work Metadata',
    inputHint: 'Search for country or place',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== WORK: TEMPORAL COVERAGE ====================
  'bf:temporalCoverage': {
    uri: 'http://id.loc.gov/ontologies/bibframe/temporalCoverage',
    shortName: 'bf:temporalCoverage',
    label: 'Temporal Coverage',
    description: 'Time period covered by the content of the resource',
    domain: ['Work'],
    rangeType: 'BlankNode',
    classType: 'bf:Temporal',
    repeatable: true,
    required: false,
    inputComponent: 'TemporalCoverageEditor',
    category: 'Subject Access',
    inputHint: 'Start date, end date, or textual description',
    validation: {
      nodeKind: 'BlankNode',
      classType: 'bf:Temporal'
    }
  },

  // ==================== WORK: ACCESSIBILITY ====================
  'bf:accessibilityContent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/accessibilityContent',
    shortName: 'bf:accessibilityContent',
    label: 'Accessibility Content',
    description: 'Content features that assist users with disabilities (WCAG compliance)',
    domain: ['Work', 'Instance'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AccessibilitySelect',
    controlledVocab: 'accessibilityContent',
    category: 'Accessibility',
    inputHint: 'Select accessibility features',
    validation: {
      nodeKind: 'IRI'
    }
  },

  'bf:notation': {
    uri: 'http://id.loc.gov/ontologies/bibframe/notation',
    shortName: 'bf:notation',
    label: 'Notation',
    description: 'System of symbols used to represent information (e.g., Braille, music notation)',
    domain: ['Work', 'Instance'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'NotationSelect',
    controlledVocab: 'notationTypes',
    category: 'Accessibility',
    inputHint: 'Braille, music, mathematical, etc.',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== WORK: GOVERNMENT & CLASSIFICATION ====================
  'bf:governmentPublication': {
    uri: 'http://id.loc.gov/ontologies/bibframe/governmentPublication',
    shortName: 'bf:governmentPublication',
    label: 'Government Publication',
    description: 'Indicates whether the resource is a government publication',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: false,
    required: false,
    inputComponent: 'GovernmentPubSelect',
    controlledVocab: 'governmentPublication',
    category: 'Work Metadata',
    validation: {
      nodeKind: 'IRI',
      maxCount: 1
    }
  },

  // ==================== WORK: DISSERTATION ====================
  'bf:dissertation': {
    uri: 'http://id.loc.gov/ontologies/bibframe/dissertation',
    shortName: 'bf:dissertation',
    label: 'Dissertation',
    description: 'Information about a dissertation or thesis',
    domain: ['Work'],
    rangeType: 'BlankNode',
    classType: 'bf:Dissertation',
    repeatable: false,
    required: false,
    inputComponent: 'DissertationEditor',
    category: 'Academic Information',
    inputHint: 'Degree, granting institution, date, and note',
    validation: {
      nodeKind: 'BlankNode',
      classType: 'bf:Dissertation'
    }
  },

  // ==================== WORK: SERIES ====================
  'bf:hasSeries': {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasSeries',
    shortName: 'bf:hasSeries',
    label: 'Series Statement',
    description: 'Series to which the resource belongs',
    domain: ['Work', 'Instance'],
    rangeType: 'BlankNode',
    classType: 'bf:Series',
    repeatable: true,
    required: false,
    inputComponent: 'SeriesEditor',
    category: 'Series Information',
    inputHint: 'Series title, enumeration, ISSN',
    validation: {
      nodeKind: 'BlankNode',
      classType: 'bf:Series'
    }
  },

  // ==================== INSTANCE PROPERTIES ====================
  'bf:instanceOf': {
    uri: 'http://id.loc.gov/ontologies/bibframe/instanceOf',
    shortName: 'bf:instanceOf',
    label: 'Instance Of',
    description: 'Work that the Instance instantiates',
    domain: ['Instance'],
    rangeType: 'URI',
    classType: 'bf:Work',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      minCount: 1,
      maxCount: 1,
      nodeKind: 'IRI'
    }
  },
  'bf:editionStatement': {
    uri: 'http://id.loc.gov/ontologies/bibframe/editionStatement',
    shortName: 'bf:editionStatement',
    label: 'Edition Statement',
    description: 'Information identifying the edition',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Edition & Publication'
  },
  'bf:provisionActivity': {
    uri: 'http://id.loc.gov/ontologies/bibframe/provisionActivity',
    shortName: 'bf:provisionActivity',
    label: 'Provision Activity',
    description: 'Publication, distribution, manufacture activity',
    domain: ['Instance'],
    rangeType: 'BlankNode',
    classType: 'bf:ProvisionActivity',
    repeatable: true,
    required: false,
    inputComponent: 'ProvisionActivityEditor',
    category: 'Edition & Publication'
  },

  // ==================== INSTANCE: PROJECTED DATE ====================
  'bf:projectedProvisionDate': {
    uri: 'http://id.loc.gov/ontologies/bibframe/projectedProvisionDate',
    shortName: 'bf:projectedProvisionDate',
    label: 'Projected Publication Date',
    description: 'Expected date of publication for a forthcoming resource',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'ProjectedDateInput',
    category: 'Publication Information',
    inputHint: 'YYMM format (e.g., 2603 for March 2026)',
    validation: {
      datatype: 'xsd:string',
      pattern: '^\\d{4}$'
    }
  },

  // ==================== INSTANCE: ACQUISITION ====================
  'bf:acquisitionSource': {
    uri: 'http://id.loc.gov/ontologies/bibframe/acquisitionSource',
    shortName: 'bf:acquisitionSource',
    label: 'Acquisition Source',
    description: 'Source from which the resource may be obtained',
    domain: ['Instance'],
    rangeType: 'BlankNode',
    classType: 'bf:AcquisitionSource',
    repeatable: true,
    required: false,
    inputComponent: 'AcquisitionEditor',
    category: 'Acquisition Information',
    inputHint: 'Stock number, source organization, terms',
    validation: {
      nodeKind: 'BlankNode',
      classType: 'bf:AcquisitionSource'
    }
  },

  'bf:immediateAcquisition': {
    uri: 'http://id.loc.gov/ontologies/bibframe/immediateAcquisition',
    shortName: 'bf:immediateAcquisition',
    label: 'Immediate Source of Acquisition',
    description: 'Source from which the library acquired the resource',
    domain: ['Item', 'Instance'],
    rangeType: 'BlankNode',
    classType: 'bf:ImmediateAcquisition',
    repeatable: false,
    required: false,
    inputComponent: 'ImmediateAcquisitionEditor',
    category: 'Acquisition Information',
    inputHint: 'Source, date, method, applicable institution',
    validation: {
      nodeKind: 'BlankNode',
      classType: 'bf:ImmediateAcquisition'
    }
  },

  'bf:identifiedBy': {
    uri: 'http://id.loc.gov/ontologies/bibframe/identifiedBy',
    shortName: 'bf:identifiedBy',
    label: 'Identifier',
    description: 'Identifier for the resource',
    domain: ['Instance', 'Item'],
    rangeType: 'BlankNode',
    classType: 'bf:Identifier',
    repeatable: true,
    required: false,
    inputComponent: 'IdentifierEditor',
    category: 'Identifiers'
  },
  'bf:extent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/extent',
    shortName: 'bf:extent',
    label: 'Extent',
    description: 'Physical extent (e.g., 300 pages)',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Physical Description'
  },
  'bf:dimensions': {
    uri: 'http://id.loc.gov/ontologies/bibframe/dimensions',
    shortName: 'bf:dimensions',
    label: 'Dimensions',
    description: 'Measurements of the carrier',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Physical Description'
  },
  'bf:carrier': {
    uri: 'http://id.loc.gov/ontologies/bibframe/carrier',
    shortName: 'bf:carrier',
    label: 'Carrier Type',
    description: 'Format of the storage medium',
    domain: ['Instance'],
    rangeType: 'URI',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'carriers',
    category: 'Physical Description',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:media': {
    uri: 'http://id.loc.gov/ontologies/bibframe/media',
    shortName: 'bf:media',
    label: 'Media Type',
    description: 'Type of intermediation device',
    domain: ['Instance'],
    rangeType: 'URI',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'mediaTypes',
    category: 'Physical Description',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== ITEM PROPERTIES ====================
  'bf:itemOf': {
    uri: 'http://id.loc.gov/ontologies/bibframe/itemOf',
    shortName: 'bf:itemOf',
    label: 'Item Of',
    description: 'Instance that the Item exemplifies',
    domain: ['Item'],
    rangeType: 'URI',
    classType: 'bf:Instance',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      minCount: 1,
      maxCount: 1,
      nodeKind: 'IRI'
    }
  },
  'bf:heldBy': {
    uri: 'http://id.loc.gov/ontologies/bibframe/heldBy',
    shortName: 'bf:heldBy',
    label: 'Held By',
    description: 'Organization holding the item',
    domain: ['Item'],
    rangeType: 'URI',
    repeatable: false,
    required: false,
    inputComponent: 'AuthoritySelect',
    authoritySource: ['LOC'],
    category: 'Holdings',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:shelfMark': {
    uri: 'http://id.loc.gov/ontologies/bibframe/shelfMark',
    shortName: 'bf:shelfMark',
    label: 'Shelf Mark',
    description: 'Piece identifier such as call number',
    domain: ['Item'],
    rangeType: 'Literal',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Holdings'
  },
  'bf:electronicLocator': {
    uri: 'http://id.loc.gov/ontologies/bibframe/electronicLocator',
    shortName: 'bf:electronicLocator',
    label: 'Electronic Locator',
    description: 'URI for electronic access',
    domain: ['Instance', 'Item'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'TextInput',
    category: 'Electronic Access',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== EXPRESSION PROPERTIES ====================
  'bf:expressionOf': {
    uri: 'http://id.loc.gov/ontologies/bibframe/expressionOf',
    shortName: 'bf:expressionOf',
    label: 'Expression Of',
    description: 'Work that the Expression realizes',
    domain: ['Expression'],
    rangeType: 'URI',
    classType: 'bf:Work',
    repeatable: false,
    required: true,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      minCount: 1,
      maxCount: 1,
      nodeKind: 'IRI'
    }
  },
  'bf:hasExpression': {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasExpression',
    shortName: 'bf:hasExpression',
    label: 'Has Expression',
    description: 'Expression of the Work',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:Expression',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:hasInstance': {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasInstance',
    shortName: 'bf:hasInstance',
    label: 'Has Instance',
    description: 'Instance of the Work or Expression',
    domain: ['Work', 'Expression'],
    rangeType: 'URI',
    classType: 'bf:Instance',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== RELATIONSHIPS ====================
  'bf:relatedTo': {
    uri: 'http://id.loc.gov/ontologies/bibframe/relatedTo',
    shortName: 'bf:relatedTo',
    label: 'Related To',
    description: 'Resource related to the resource',
    domain: ['Work', 'Instance'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:hasPart': {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasPart',
    shortName: 'bf:hasPart',
    label: 'Has Part',
    description: 'Resource that is included in the resource',
    domain: ['Work', 'Instance'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:partOf': {
    uri: 'http://id.loc.gov/ontologies/bibframe/partOf',
    shortName: 'bf:partOf',
    label: 'Part Of',
    description: 'Resource in which the resource is included',
    domain: ['Work', 'Instance'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:translationOf': {
    uri: 'http://id.loc.gov/ontologies/bibframe/translationOf',
    shortName: 'bf:translationOf',
    label: 'Translation Of',
    description: 'Work or Expression of which this is a translation',
    domain: ['Work', 'Expression'],
    rangeType: 'URI',
    repeatable: false,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:hasDerivative': {
    uri: 'http://id.loc.gov/ontologies/bibframe/hasDerivative',
    shortName: 'bf:hasDerivative',
    label: 'Has Derivative',
    description: 'Work derived from this Work',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },
  'bf:originalVersion': {
    uri: 'http://id.loc.gov/ontologies/bibframe/originalVersion',
    shortName: 'bf:originalVersion',
    label: 'Original Version',
    description: 'Work from which this Work is derived',
    domain: ['Work'],
    rangeType: 'URI',
    repeatable: false,
    required: false,
    inputComponent: 'AuthoritySelect',
    category: 'Relationships',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== ADMIN METADATA ====================
  'bf:adminMetadata': {
    uri: 'http://id.loc.gov/ontologies/bibframe/adminMetadata',
    shortName: 'bf:adminMetadata',
    label: 'Administrative Metadata',
    description: 'Metadata about the metadata',
    domain: ['Work', 'Instance', 'Item'],
    rangeType: 'BlankNode',
    classType: 'bf:AdminMetadata',
    repeatable: false,
    required: false,
    inputComponent: 'TextInput',
    category: 'Administrative Metadata'
  },

  'bf:descriptionAuthentication': {
    uri: 'http://id.loc.gov/ontologies/bibframe/descriptionAuthentication',
    shortName: 'bf:descriptionAuthentication',
    label: 'Description Authentication',
    description: 'Authentication code for the bibliographic description',
    domain: ['AdminMetadata'],
    rangeType: 'URI',
    repeatable: false,
    required: false,
    inputComponent: 'AuthenticationSelect',
    controlledVocab: 'descriptionAuthentication',
    category: 'Administrative Metadata',
    validation: {
      nodeKind: 'IRI',
      maxCount: 1
    }
  },

  'bf:descriptionModifier': {
    uri: 'http://id.loc.gov/ontologies/bibframe/descriptionModifier',
    shortName: 'bf:descriptionModifier',
    label: 'Description Modifier',
    description: 'Organization that modified the bibliographic description',
    domain: ['AdminMetadata'],
    rangeType: 'URI',
    classType: 'bf:Organization',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    authoritySource: ['LOC'],
    controlledVocab: 'organizations',
    category: 'Administrative Metadata',
    inputHint: 'Search for organization',
    validation: {
      nodeKind: 'IRI'
    }
  },

  // ==================== FROM LC's MONOGRAPH PROFILE ====================
  // Properties LC's own profiles (as loaded by Marva) include that Moon's form did not offer.
  'bf:issuance': {
    uri: 'http://id.loc.gov/ontologies/bibframe/issuance',
    shortName: 'bf:issuance',
    label: 'Mode of Issuance',
    description: 'Whether the resource is issued as a single unit, a serial, or an integrating resource',
    domain: ['Instance'],
    rangeType: 'URI',
    classType: 'bf:Issuance',
    repeatable: false,
    required: true, // mandatory in LC's profiles
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'issuance',
    category: 'Edition & Publication',
    inputHint: 'single unit, serial, integrating resource…',
    validation: { nodeKind: 'IRI' }
  },
  'bf:responsibilityStatement': {
    uri: 'http://id.loc.gov/ontologies/bibframe/responsibilityStatement',
    shortName: 'bf:responsibilityStatement',
    label: 'Statement of Responsibility',
    description: 'Statement relating to persons or bodies responsible for the content, as it appears on the resource (MARC 245 $c)',
    domain: ['Instance'],
    rangeType: 'Literal',
    repeatable: true,
    required: false,
    inputComponent: 'TextInput',
    category: 'Title Information',
    inputHint: 'e.g. George Orwell ; translated by …',
    validation: { datatype: 'xsd:string' }
  },
  'bf:intendedAudience': {
    uri: 'http://id.loc.gov/ontologies/bibframe/intendedAudience',
    shortName: 'bf:intendedAudience',
    label: 'Intended Audience',
    description: 'Audience for which the content is intended (LC vocabulary maudience)',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:IntendedAudience',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'audience',
    category: 'Content Description',
    inputHint: 'juvenile, adolescent, adult, specialized…',
    validation: { nodeKind: 'IRI' }
  },
  'bf:geographicCoverage': {
    uri: 'http://id.loc.gov/ontologies/bibframe/geographicCoverage',
    shortName: 'bf:geographicCoverage',
    label: 'Geographic Coverage',
    description: 'Geographic area the content covers (LC geographic areas, MARC 043)',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:GeographicCoverage',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'geographicAreas',
    category: 'Subject & Classification',
    inputHint: 'e.g. Iraq, Middle East',
    validation: { nodeKind: 'IRI' }
  },
  'bf:illustrativeContent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/illustrativeContent',
    shortName: 'bf:illustrativeContent',
    label: 'Illustrative Content',
    description: 'Illustrations, maps, portraits… (LC vocabulary millus)',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:Illustration',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'illustrativeContent',
    category: 'Content Description',
    inputHint: 'illustrations, maps, portraits…',
    validation: { nodeKind: 'IRI' }
  },
  'bf:colorContent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/colorContent',
    shortName: 'bf:colorContent',
    label: 'Color Content',
    description: 'Presence of color (LC vocabulary mcolor)',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:ColorContent',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'colorContent',
    category: 'Content Description',
    inputHint: 'color, black and white…',
    validation: { nodeKind: 'IRI' }
  },
  'bf:supplementaryContent': {
    uri: 'http://id.loc.gov/ontologies/bibframe/supplementaryContent',
    shortName: 'bf:supplementaryContent',
    label: 'Supplementary Content',
    description: 'Index, bibliography, glossary… (LC vocabulary msupplcont)',
    domain: ['Work'],
    rangeType: 'URI',
    classType: 'bf:SupplementaryContent',
    repeatable: true,
    required: false,
    inputComponent: 'AuthoritySelect',
    controlledVocab: 'supplementaryContent',
    category: 'Content Description',
    inputHint: 'index, bibliography…',
    validation: { nodeKind: 'IRI' }
  },
};

/**
 * ðŸ” Query Functions
 */

// On a Work or an Instance, "required" is what the profile requires (the fields the server's publish gate
// checks), so the form's red * and the gate never disagree. Other entities keep the registry's flag.
const PROFILE_REQUIRED: Record<string, Set<string>> = {
  Work: profileRequired(MONOGRAPH_PROFILE, 'Work'),
  Instance: profileRequired(MONOGRAPH_PROFILE, 'Instance'),
};

export function getPropertiesByDomain(domain: string): OntologyProperty[] {
  const required = PROFILE_REQUIRED[domain];
  return Object.values(ONTOLOGY_REGISTRY)
    .filter(prop => prop.domain.includes(domain))
    .map(prop => (required ? { ...prop, required: required.has(prop.shortName) } : prop));
}

export function getPropertiesByCategory(domain: string, category: string): OntologyProperty[] {
  return getPropertiesByDomain(domain).filter(prop => 
    prop.category === category
  );
}

export function getCategoriesForDomain(domain: string): string[] {
  const categories = new Set<string>();
  getPropertiesByDomain(domain).forEach(prop => {
    categories.add(prop.category);
  });
  return Array.from(categories);
}

export function getPropertyByShortName(shortName: string): OntologyProperty | undefined {
  return ONTOLOGY_REGISTRY[shortName];
}

export function getRequiredProperties(domain: string): OntologyProperty[] {
  return getPropertiesByDomain(domain).filter(prop => prop.required);
}

export function validatePropertyValue(property: OntologyProperty, value: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!property.validation) {
    return { valid: true, errors: [] };
  }

  const validation = property.validation;

  // Check minCount
  if (validation.minCount !== undefined) {
    if (Array.isArray(value) && value.length < validation.minCount) {
      errors.push(`Minimum ${validation.minCount} value(s) required`);
    } else if (!value && validation.minCount > 0) {
      errors.push(`This field is required`);
    }
  }

  // Check maxCount
  if (validation.maxCount !== undefined && Array.isArray(value) && value.length > validation.maxCount) {
    errors.push(`Maximum ${validation.maxCount} value(s) allowed`);
  }

  // Check pattern
  if (validation.pattern && typeof value === 'string') {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      errors.push(`Value does not match required pattern`);
    }
  }

  // Check nodeKind for URIs
  if (validation.nodeKind === 'IRI' && value && typeof value === 'object' && !value.uri) {
    errors.push(`URI required`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
