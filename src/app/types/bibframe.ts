// BIBFRAME 2.0 Type Definitions

export interface AuthorityLookupResult {
  uri: string;
  label: string;
  type: string;
  source?: string;
}

// Records hold any BIBFRAME/BFLC property (and editor copies of them), not only the ones listed here.
export interface BIBFRAMEWork {
  [property: string]: any;
  '@type': 'bf:Work';
  '@id'?: string;
  'bf:creator'?: AuthorityLookupResult[];
  'bf:title'?: {
    [property: string]: any;
    '@type': 'bf:Title';
    'bf:mainTitle': string;
  };
  'bf:contributor'?: AuthorityLookupResult[];
  'bf:subject'?: AuthorityLookupResult[];
  'bf:genreForm'?: AuthorityLookupResult[];
  'bf:classification'?: Array<{
    '@type': 'bf:ClassificationLcc' | 'bf:ClassificationDdc';
    'bf:classificationPortion': string;
    'bf:source'?: string;
  }>;
  'bf:language'?: Array<{
    '@type': 'bf:Language';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:content'?: Array<{
    '@type': 'bf:Content';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:summary'?: Array<{
    '@type': 'bf:Summary';
    'rdfs:label': string;
  }>;
  'bf:note'?: Array<{
    '@type': 'bf:Note';
    'rdfs:label': string;
  }>;
  'bf:originPlace'?: AuthorityLookupResult[];
  'bf:originDate'?: string;
  'bf:intendedAudience'?: Array<{
    '@type': 'bf:IntendedAudience';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:illustrativeContent'?: Array<{
    '@type': 'bf:IllustrativeContent';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:colorContent'?: Array<{
    '@type': 'bf:ColorContent';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:supplementaryContent'?: Array<{
    '@type': 'bf:SupplementaryContent';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:tableOfContents'?: Array<{
    '@type': 'bf:TableOfContents';
    'rdfs:label': string;
  }>;
}

export interface BIBFRAMEInstance {
  [property: string]: any;
  '@type': 'bf:Instance';
  '@id'?: string;
  'bf:instanceOf'?: {
    '@id': string;
  };
  'bf:title'?: {
    [property: string]: any;
    '@type': 'bf:Title';
    'bf:mainTitle': string;
  };
  'bf:responsibilityStatement'?: string;
  'bf:editionStatement'?: string;
  'bf:provisionActivity'?: Array<{
    '@type': 'bf:Publication' | 'bf:Production' | 'bf:Distribution';
    'bf:place'?: {
      '@type': 'bf:Place';
      '@id'?: string;
      'rdfs:label': string;
    };
    'bf:agent'?: {
      '@type': 'bf:Agent';
      '@id'?: string;
      'rdfs:label': string;
    };
    'bf:date'?: string;
  }>;
  'bf:issuance'?: {
    '@type': 'bf:Issuance';
    '@id': string;
    'rdfs:label': string;
  };
  'bf:identifiedBy'?: Array<{
    '@type': 'bf:Lccn' | 'bf:Isbn';
    'rdf:value': string;
  }>;
  'bf:carrier'?: Array<{
    '@type': 'bf:Carrier';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:media'?: Array<{
    '@type': 'bf:Media';
    '@id': string;
    'rdfs:label': string;
  }>;
  'bf:extent'?: {
    '@type': 'bf:Extent';
    'rdfs:label': string;
  };
  'bf:dimensions'?: string;
}

export interface BIBFRAMERecord {
  [property: string]: any;
  '@context': {
    bf: string;
    rdfs: string;
    rdf: string;
    [key: string]: string;
  } | string;
  work: BIBFRAMEWork;
  instance: BIBFRAMEInstance;
  // The rest of the WEMI graph an editor keeps alongside Work and Instance.
  item?: Record<string, any>;
  /** The record's copies: further bf:Item nodes of the Instance (see services/itemCopies). */
  copies?: Record<string, any>[];
  expression?: Record<string, any>;
  adminMetadata?: Record<string, any>;
  metadata?: {
    // Storage key of the saved record; saving again with it updates instead of duplicating.
    storageId?: string;
    status?: string;
    created?: string;
    modified?: string;
    cataloger?: string;
    resourceType?: string;
    catalogingInterface?: string;
    catalogingLanguage?: string;
    descriptionConventions?: string;
    templateId?: string;
    recordId?: string;
    uriSet?: any;
    ontologyVersion?: string;
    createdAt?: string;
    catalogerId?: string;
    jcricket?: {
      provenanceId?: string;
      institutionCode?: string;
      catalogerId?: string;
      catalogerName?: string;
      editHistory?: Array<{
        userId: string;
        username: string;
        timestamp: string;
        action: string;
      }>;
    };
    [key: string]: any;
  };
}