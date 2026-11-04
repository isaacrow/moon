/**
 * RDF Graph Builder
 * 
 * Builds proper RDF quads/triples from BIBFRAME data
 * This ensures the output is true Linked Data, not just JSON
 */

export interface RDFQuad {
  subject: string;
  predicate: string;
  object: string | { value: string; type: 'uri' | 'literal'; lang?: string };
}

export interface RDFGraph {
  '@context': string | object;
  '@graph': any[];
  quads: RDFQuad[];
}

/**
 * Generate a unique URI for an entity
 */
export function generateUri(type: string, id?: string): string {
  const baseUri = 'http://moon.local/';
  const uuid = id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
  return `${baseUri}${type}/${uuid}`;
}

/**
 * Create an RDF quad
 */
export function createQuad(
  subject: string,
  predicate: string,
  object: string | { value: string; type: 'uri' | 'literal'; lang?: string }
): RDFQuad {
  return { subject, predicate, object };
}

/**
 * Build RDF graph from Work data
 */
export function buildWorkGraph(workData: any, workUri?: string): RDFQuad[] {
  const quads: RDFQuad[] = [];
  const workNode = workUri || generateUri('work');

  // Add type declaration
  quads.push(
    createQuad(
      workNode,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://id.loc.gov/ontologies/bibframe/Work'
    )
  );

  // Add properties
  Object.entries(workData).forEach(([key, value]: [string, any]) => {
    if (!value || key.startsWith('_') || key === '@id') return;

    const predicate = key.startsWith('http://') ? key : `http://id.loc.gov/ontologies/bibframe/${key.replace('bf:', '')}`;

    if (typeof value === 'string') {
      quads.push(createQuad(workNode, predicate, { value, type: 'literal' }));
    } else if (typeof value === 'object' && value !== null) {
      if (value['@id']) {
        // URI reference
        quads.push(createQuad(workNode, predicate, value['@id']));
      } else if (value['@value']) {
        // Literal with language
        quads.push(createQuad(workNode, predicate, {
          value: value['@value'],
          type: 'literal',
          lang: value['@language']
        }));
      } else if (Array.isArray(value)) {
        // Array of values
        value.forEach(v => {
          if (typeof v === 'string') {
            quads.push(createQuad(workNode, predicate, { value: v, type: 'literal' }));
          } else if (v['@id']) {
            quads.push(createQuad(workNode, predicate, v['@id']));
          }
        });
      } else {
        // Complex object - create blank node
        const blankNode = generateUri('node');
        quads.push(createQuad(workNode, predicate, blankNode));
        
        if (value['@type']) {
          quads.push(createQuad(
            blankNode,
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            value['@type']
          ));
        }
        
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subKey !== '@type' && subKey !== '@id') {
            const subPredicate = subKey.startsWith('http://') ? subKey : `http://id.loc.gov/ontologies/bibframe/${subKey.replace('bf:', '')}`;
            if (typeof subValue === 'string') {
              quads.push(createQuad(blankNode, subPredicate, { value: subValue, type: 'literal' }));
            }
          }
        });
      }
    }
  });

  return quads;
}

/**
 * Build RDF graph from Instance data
 */
export function buildInstanceGraph(instanceData: any, workUri: string, instanceUri?: string): RDFQuad[] {
  const quads: RDFQuad[] = [];
  const instanceNode = instanceUri || generateUri('instance');

  // Add type declaration
  quads.push(
    createQuad(
      instanceNode,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://id.loc.gov/ontologies/bibframe/Instance'
    )
  );

  // Link to Work
  quads.push(
    createQuad(
      instanceNode,
      'http://id.loc.gov/ontologies/bibframe/instanceOf',
      workUri
    )
  );

  // Add properties (same logic as Work)
  Object.entries(instanceData).forEach(([key, value]: [string, any]) => {
    if (!value || key.startsWith('_') || key === '@id' || key === 'instanceOf') return;

    const predicate = key.startsWith('http://') ? key : `http://id.loc.gov/ontologies/bibframe/${key.replace('bf:', '')}`;

    if (typeof value === 'string') {
      quads.push(createQuad(instanceNode, predicate, { value, type: 'literal' }));
    } else if (typeof value === 'object' && value !== null) {
      if (value['@id']) {
        quads.push(createQuad(instanceNode, predicate, value['@id']));
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          if (typeof v === 'string') {
            quads.push(createQuad(instanceNode, predicate, { value: v, type: 'literal' }));
          } else if (v['@id']) {
            quads.push(createQuad(instanceNode, predicate, v['@id']));
          }
        });
      }
    }
  });

  return quads;
}

/**
 * Convert quads to JSON-LD format
 */
export function quadsToJsonLd(quads: RDFQuad[], context: string | object = "http://id.loc.gov/ontologies/bibframe/"): any {
  const subjects = new Map<string, any>();

  quads.forEach(quad => {
    if (!subjects.has(quad.subject)) {
      subjects.set(quad.subject, { '@id': quad.subject });
    }

    const subject = subjects.get(quad.subject);
    const predicate = quad.predicate;

    // Shorten predicate if using context
    let key = predicate;
    if (typeof context === 'string' && predicate.startsWith(context)) {
      key = predicate.substring(context.length);
    } else if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      key = '@type';
    }

    if (typeof quad.object === 'string') {
      // URI reference
      if (!subject[key]) {
        subject[key] = quad.object;
      } else if (Array.isArray(subject[key])) {
        subject[key].push(quad.object);
      } else {
        subject[key] = [subject[key], quad.object];
      }
    } else {
      // Literal
      const value = quad.object.lang 
        ? { '@value': quad.object.value, '@language': quad.object.lang }
        : quad.object.value;

      if (!subject[key]) {
        subject[key] = value;
      } else if (Array.isArray(subject[key])) {
        subject[key].push(value);
      } else {
        subject[key] = [subject[key], value];
      }
    }
  });

  return {
    '@context': context,
    '@graph': Array.from(subjects.values())
  };
}

/**
 * Convert quads to Turtle format
 */
export function quadsToTurtle(quads: RDFQuad[]): string {
  const prefixes = `
@prefix bf: <http://id.loc.gov/ontologies/bibframe/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix moon: <http://moon.local/> .
`;

  const lines: string[] = [prefixes];

  const grouped = new Map<string, RDFQuad[]>();
  quads.forEach(quad => {
    if (!grouped.has(quad.subject)) {
      grouped.set(quad.subject, []);
    }
    grouped.get(quad.subject)!.push(quad);
  });

  grouped.forEach((subjectQuads, subject) => {
    const shortSubject = subject.replace('http://moon.local/', 'moon:')
      .replace('http://id.loc.gov/ontologies/bibframe/', 'bf:');

    lines.push(`\n${shortSubject}`);

    subjectQuads.forEach((quad, index) => {
      const shortPredicate = quad.predicate
        .replace('http://id.loc.gov/ontologies/bibframe/', 'bf:')
        .replace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:')
        .replace('http://www.w3.org/2000/01/rdf-schema#', 'rdfs:');

      const object = typeof quad.object === 'string'
        ? quad.object.replace('http://id.loc.gov/ontologies/bibframe/', 'bf:')
        : `"${quad.object.value}"${quad.object.lang ? `@${quad.object.lang}` : ''}`;

      const ending = index === subjectQuads.length - 1 ? ' .' : ' ;';
      lines.push(`  ${shortPredicate} ${object}${ending}`);
    });
  });

  return lines.join('\n');
}

/**
 * Build complete BIBFRAME graph
 */
export function buildBibframeGraph(workData: any, instanceData: any): RDFGraph {
  const workUri = workData['@id'] || generateUri('work');
  const instanceUri = instanceData['@id'] || generateUri('instance');

  const workQuads = buildWorkGraph(workData, workUri);
  const instanceQuads = buildInstanceGraph(instanceData, workUri, instanceUri);

  const allQuads = [...workQuads, ...instanceQuads];

  return {
    '@context': 'http://id.loc.gov/ontologies/bibframe/',
    '@graph': quadsToJsonLd(allQuads)['@graph'],
    quads: allQuads
  };
}
