/**
 * BIBFRAME Semantic Validator
 * Enforces strict BIBFRAME rules
 * Validates graph integrity before save
 */


export interface ValidationError {
  severity: 'error' | 'warning';
  entity: string;
  property?: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate complete BIBFRAME record
 */
export function validateBibframeRecord(jsonld: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Ensure @graph exists
  if (!jsonld['@graph'] || !Array.isArray(jsonld['@graph'])) {
    errors.push({
      severity: 'error',
      entity: 'Record',
      message: 'Record must contain @graph array',
      code: 'MISSING_GRAPH'
    });
    return { valid: false, errors, warnings };
  }

  const graph = jsonld['@graph'];

  // Find core entities
  const work = graph.find((node: any) => node['@type'] === 'bf:Work');
  const instance = graph.find((node: any) => node['@type'] === 'bf:Instance');
  const item = graph.find((node: any) => node['@type'] === 'bf:Item');

  // RULE 1: Work must exist
  if (!work) {
    errors.push({
      severity: 'error',
      entity: 'Work',
      message: 'bf:Work entity is required',
      code: 'MISSING_WORK'
    });
  }

  // RULE 2: Instance must exist
  if (!instance) {
    errors.push({
      severity: 'error',
      entity: 'Instance',
      message: 'bf:Instance entity is required',
      code: 'MISSING_INSTANCE'
    });
  }

  // RULE 3: Item must exist
  if (!item) {
    errors.push({
      severity: 'error',
      entity: 'Item',
      message: 'bf:Item entity is required',
      code: 'MISSING_ITEM'
    });
  }

  // If core entities missing, stop validation
  if (!work || !instance || !item) {
    return { valid: false, errors, warnings };
  }

  // Validate Work
  validateWork(work, errors, warnings);

  // Validate Instance
  validateInstance(instance, errors, warnings);

  // Validate Item
  validateItem(item, errors, warnings);

  // Validate relationships
  validateRelationships(graph, work, instance, item, errors, warnings);

  // Validate all URIs
  validateURIs(graph, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate Work entity
 */
function validateWork(work: any, errors: ValidationError[], warnings: ValidationError[]) {
  // RULE: Work must have URI
  if (!work['@id'] || !isValidHttpUri(work['@id'])) {
    errors.push({
      severity: 'error',
      entity: 'Work',
      property: '@id',
      message: 'Work must have valid HTTP/HTTPS URI',
      code: 'INVALID_WORK_URI'
    });
  }

  // RULE: Work must have title
  if (!work['bf:title'] || !Array.isArray(work['bf:title']) || work['bf:title'].length === 0) {
    errors.push({
      severity: 'error',
      entity: 'Work',
      property: 'bf:title',
      message: 'Work must have at least one title',
      code: 'MISSING_WORK_TITLE'
    });
  } else {
    // Validate title structure
    const title = work['bf:title'][0];
    if (!title['@type'] || title['@type'] !== 'bf:Title') {
      errors.push({
        severity: 'error',
        entity: 'Work',
        property: 'bf:title',
        message: 'Title must be typed as bf:Title',
        code: 'INVALID_TITLE_TYPE'
      });
    }
    if (!title['bf:mainTitle'] || !Array.isArray(title['bf:mainTitle']) || !title['bf:mainTitle'][0]?.['@value']) {
      errors.push({
        severity: 'error',
        entity: 'Work',
        property: 'bf:title/bf:mainTitle',
        message: 'Title must have bf:mainTitle with @value',
        code: 'MISSING_MAIN_TITLE'
      });
    }
  }

  // RULE: Work must have at least one contribution
  if (!work['bf:contribution'] || !Array.isArray(work['bf:contribution']) || work['bf:contribution'].length === 0) {
    errors.push({
      severity: 'error',
      entity: 'Work',
      property: 'bf:contribution',
      message: 'Work must have at least one contribution',
      code: 'MISSING_CONTRIBUTION'
    });
  } else {
    // Validate each contribution
    work['bf:contribution'].forEach((contrib: any, index: number) => {
      if (!contrib['@type'] || contrib['@type'] !== 'bf:Contribution') {
        errors.push({
          severity: 'error',
          entity: 'Work',
          property: `bf:contribution[${index}]`,
          message: 'Contribution must be typed as bf:Contribution',
          code: 'INVALID_CONTRIBUTION_TYPE'
        });
      }

      // RULE: Contribution must have agent
      if (!contrib['bf:agent']) {
        errors.push({
          severity: 'error',
          entity: 'Work',
          property: `bf:contribution[${index}]/bf:agent`,
          message: 'Contribution must have bf:agent',
          code: 'MISSING_AGENT'
        });
      } else if (!contrib['bf:agent']['@id'] || !isValidHttpUri(contrib['bf:agent']['@id'])) {
        errors.push({
          severity: 'error',
          entity: 'Work',
          property: `bf:contribution[${index}]/bf:agent`,
          message: 'Agent must have valid HTTP/HTTPS URI',
          code: 'INVALID_AGENT_URI'
        });
      }

      // RULE: Contribution must have role
      if (!contrib['bf:role']) {
        errors.push({
          severity: 'error',
          entity: 'Work',
          property: `bf:contribution[${index}]/bf:role`,
          message: 'Contribution must have bf:role',
          code: 'MISSING_ROLE'
        });
      } else if (!contrib['bf:role']['@id'] || !contrib['bf:role']['@id'].includes('relators/')) {
        errors.push({
          severity: 'error',
          entity: 'Work',
          property: `bf:contribution[${index}]/bf:role`,
          message: 'Role must be a LOC relators URI',
          code: 'INVALID_ROLE_URI'
        });
      }
    });
  }

  // RULE: Work must have hasInstance
  if (!work['bf:hasInstance']) {
    errors.push({
      severity: 'error',
      entity: 'Work',
      property: 'bf:hasInstance',
      message: 'Work must have bf:hasInstance relationship',
      code: 'MISSING_HAS_INSTANCE'
    });
  }

  // Validate language if present
  if (work['bf:language']) {
    const lang = Array.isArray(work['bf:language']) ? work['bf:language'][0] : work['bf:language'];
    if (lang['@id'] && !lang['@id'].includes('id.loc.gov/vocabulary/languages/')) {
      warnings.push({
        severity: 'warning',
        entity: 'Work',
        property: 'bf:language',
        message: 'Language should use LOC vocabulary URI',
        code: 'NON_LOC_LANGUAGE'
      });
    }
  }
}

/**
 * Validate Instance entity
 */
function validateInstance(instance: any, errors: ValidationError[], warnings: ValidationError[]) {
  // RULE: Instance must have URI
  if (!instance['@id'] || !isValidHttpUri(instance['@id'])) {
    errors.push({
      severity: 'error',
      entity: 'Instance',
      property: '@id',
      message: 'Instance must have valid HTTP/HTTPS URI',
      code: 'INVALID_INSTANCE_URI'
    });
  }

  // RULE: Instance must have instanceOf
  if (!instance['bf:instanceOf']) {
    errors.push({
      severity: 'error',
      entity: 'Instance',
      property: 'bf:instanceOf',
      message: 'Instance must have bf:instanceOf relationship',
      code: 'MISSING_INSTANCE_OF'
    });
  }

  // RULE: Instance must have provisionActivity
  if (!instance['bf:provisionActivity'] || !Array.isArray(instance['bf:provisionActivity']) || instance['bf:provisionActivity'].length === 0) {
    errors.push({
      severity: 'error',
      entity: 'Instance',
      property: 'bf:provisionActivity',
      message: 'Instance must have provision activity',
      code: 'MISSING_PROVISION_ACTIVITY'
    });
  } else {
    const provision = instance['bf:provisionActivity'][0];

    // RULE: ProvisionActivity must have agent
    if (!provision['bf:agent']) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:provisionActivity/bf:agent',
        message: 'Provision activity must have bf:agent (publisher)',
        code: 'MISSING_PUBLISHER'
      });
    } else if (!provision['bf:agent']['@id'] || !isValidHttpUri(provision['bf:agent']['@id'])) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:provisionActivity/bf:agent',
        message: 'Publisher must have valid HTTP/HTTPS URI',
        code: 'INVALID_PUBLISHER_URI'
      });
    }

    // RULE: ProvisionActivity must have place
    if (!provision['bf:place']) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:provisionActivity/bf:place',
        message: 'Provision activity must have bf:place',
        code: 'MISSING_PLACE'
      });
    } else if (!provision['bf:place']['@id'] || !isValidHttpUri(provision['bf:place']['@id'])) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:provisionActivity/bf:place',
        message: 'Place must have valid HTTP/HTTPS URI',
        code: 'INVALID_PLACE_URI'
      });
    }

    // RULE: ProvisionActivity must have date
    if (!provision['bf:date']) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:provisionActivity/bf:date',
        message: 'Provision activity must have bf:date',
        code: 'MISSING_DATE'
      });
    }
  }

  // Validate identifiers if present
  if (instance['bf:identifiedBy']) {
    const identifiers = Array.isArray(instance['bf:identifiedBy']) ? instance['bf:identifiedBy'] : [instance['bf:identifiedBy']];
    identifiers.forEach((id: any, index: number) => {
      if (!id['rdf:value']) {
        errors.push({
          severity: 'error',
          entity: 'Instance',
          property: `bf:identifiedBy[${index}]/rdf:value`,
          message: 'Identifier must have rdf:value',
          code: 'MISSING_IDENTIFIER_VALUE'
        });
      }
      if (!id['@type']) {
        warnings.push({
          severity: 'warning',
          entity: 'Instance',
          property: `bf:identifiedBy[${index}]`,
          message: 'Identifier should have type (bf:Isbn, bf:Lccn, etc.)',
          code: 'MISSING_IDENTIFIER_TYPE'
        });
      }
    });
  }

  // RULE: Instance must have hasItem
  if (!instance['bf:hasItem']) {
    errors.push({
      severity: 'error',
      entity: 'Instance',
      property: 'bf:hasItem',
      message: 'Instance must have bf:hasItem relationship',
      code: 'MISSING_HAS_ITEM'
    });
  }
}

/**
 * Validate Item entity
 */
function validateItem(item: any, errors: ValidationError[], warnings: ValidationError[]) {
  // RULE: Item must have URI
  if (!item['@id'] || !isValidHttpUri(item['@id'])) {
    errors.push({
      severity: 'error',
      entity: 'Item',
      property: '@id',
      message: 'Item must have valid HTTP/HTTPS URI',
      code: 'INVALID_ITEM_URI'
    });
  }

  // RULE: Item must have itemOf
  if (!item['bf:itemOf']) {
    errors.push({
      severity: 'error',
      entity: 'Item',
      property: 'bf:itemOf',
      message: 'Item must have bf:itemOf relationship',
      code: 'MISSING_ITEM_OF'
    });
  }

  // Warning: Item should have heldBy
  if (!item['bf:heldBy']) {
    warnings.push({
      severity: 'warning',
      entity: 'Item',
      property: 'bf:heldBy',
      message: 'Item should specify holding institution (bf:heldBy)',
      code: 'MISSING_HELD_BY'
    });
  }
}

/**
 * Validate entity relationships
 */
function validateRelationships(
  graph: any[],
  work: any,
  instance: any,
  item: any,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  // Validate Work -> Instance
  if (work['bf:hasInstance']) {
    const instanceRef = Array.isArray(work['bf:hasInstance']) ? work['bf:hasInstance'][0] : work['bf:hasInstance'];
    if (instanceRef['@id'] !== instance['@id']) {
      errors.push({
        severity: 'error',
        entity: 'Work',
        property: 'bf:hasInstance',
        message: `Work references instance ${instanceRef['@id']} but instance has URI ${instance['@id']}`,
        code: 'BROKEN_WORK_INSTANCE_LINK'
      });
    }
  }

  // Validate Instance -> Work
  if (instance['bf:instanceOf']) {
    const workRef = Array.isArray(instance['bf:instanceOf']) ? instance['bf:instanceOf'][0] : instance['bf:instanceOf'];
    if (workRef['@id'] !== work['@id']) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:instanceOf',
        message: `Instance references work ${workRef['@id']} but work has URI ${work['@id']}`,
        code: 'BROKEN_INSTANCE_WORK_LINK'
      });
    }
  }

  // Validate Instance -> Item
  if (instance['bf:hasItem']) {
    const itemRef = Array.isArray(instance['bf:hasItem']) ? instance['bf:hasItem'][0] : instance['bf:hasItem'];
    if (itemRef['@id'] !== item['@id']) {
      errors.push({
        severity: 'error',
        entity: 'Instance',
        property: 'bf:hasItem',
        message: `Instance references item ${itemRef['@id']} but item has URI ${item['@id']}`,
        code: 'BROKEN_INSTANCE_ITEM_LINK'
      });
    }
  }

  // Validate Item -> Instance
  if (item['bf:itemOf']) {
    const instanceRef = Array.isArray(item['bf:itemOf']) ? item['bf:itemOf'][0] : item['bf:itemOf'];
    if (instanceRef['@id'] !== instance['@id']) {
      errors.push({
        severity: 'error',
        entity: 'Item',
        property: 'bf:itemOf',
        message: `Item references instance ${instanceRef['@id']} but instance has URI ${instance['@id']}`,
        code: 'BROKEN_ITEM_INSTANCE_LINK'
      });
    }
  }
}

/**
 * Validate all URIs in graph
 */
function validateURIs(graph: any[], errors: ValidationError[], warnings: ValidationError[]) {
  graph.forEach((node: any) => {
    if (node['@id'] && !isValidHttpUri(node['@id'])) {
      errors.push({
        severity: 'error',
        entity: node['@type'] || 'Unknown',
        property: '@id',
        message: `Entity URI must be HTTP/HTTPS: ${node['@id']}`,
        code: 'INVALID_URI_SCHEME'
      });
    }
  });
}

/**
 * Validate HTTP/HTTPS URI
 */
function isValidHttpUri(uri: string): boolean {
  if (!uri) return false;
  try {
    const url = new URL(uri);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Quick validation - check for critical errors only
 */
export function quickValidate(jsonld: any): boolean {
  if (!jsonld['@graph'] || !Array.isArray(jsonld['@graph'])) {
    return false;
  }

  const graph = jsonld['@graph'];
  const hasWork = graph.some((n: any) => n['@type'] === 'bf:Work');
  const hasInstance = graph.some((n: any) => n['@type'] === 'bf:Instance');
  const hasItem = graph.some((n: any) => n['@type'] === 'bf:Item');

  return hasWork && hasInstance && hasItem;
}
