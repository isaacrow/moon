// MARC View Component - Comprehensive BIBFRAME to MARC21 Converter
import type { RecordData } from './types';

interface MarcViewProps {
  data: RecordData;
}

export function MarcView({ data }: MarcViewProps) {
  // Convert BIBFRAME to MARC21 (comprehensive)
  const marcRecords = convertToMARC(data);

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50">
        <div className="bg-gradient-to-r from-blue-500/90 to-indigo-600/90 text-white px-6 py-5 rounded-t-2xl backdrop-blur-sm">
          <h2 className="text-xl font-semibold">MARC 21 View</h2>
          <p className="text-sm text-blue-50 mt-1">Machine-Readable Cataloging</p>
        </div>

        <div className="p-6 font-mono text-sm">
          {marcRecords.map((record, idx) => (
            <div key={idx} className="mb-6">
              {/* Leader */}
              <div className="flex border-b border-gray-200 py-2">
                <div className="w-20 text-gray-600 font-semibold">LEADER</div>
                <div className="flex-1 text-gray-900">{record.leader}</div>
              </div>

              {/* Fields */}
              {record.fields.map((field, fieldIdx) => (
                <div 
                  key={fieldIdx} 
                  className="flex border-b border-gray-100 py-2 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="w-20 text-blue-600 font-semibold">
                    {field.tag}
                  </div>
                  <div className="w-12 text-gray-500">
                    {field.ind1}{field.ind2}
                  </div>
                  <div className="flex-1">
                    {field.subfields.map((sub, subIdx) => (
                      <span key={subIdx} className="mr-3">
                        <span className="text-green-600 font-semibold">${sub.code}</span>
                        <span className="text-gray-900 ml-1">{sub.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 px-6 py-4 border-t rounded-b-2xl">
          <p className="text-xs text-gray-600">
            Generated from BIBFRAME data • MARC 21 Format for Bibliographic Data
          </p>
        </div>
      </div>
    </div>
  );
}

interface MARCRecord {
  leader: string;
  fields: MARCField[];
}

interface MARCField {
  tag: string;
  ind1: string;
  ind2: string;
  subfields: { code: string; value: string }[];
}

function convertToMARC(data: RecordData): MARCRecord[] {
  const records: MARCRecord[] = [];

  const record: MARCRecord = {
    leader: '00000nam  2200000Ia 4500',
    fields: []
  };

  // ============================================================================
  // CONTROL FIELDS
  // ============================================================================

  // 001 Control Number
  if (data.admin?.recordId) {
    record.fields.push({
      tag: '001',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: data.admin.recordId }]
    });
  }

  // 003 Control Number Identifier
  record.fields.push({
    tag: '003',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: 'MOON' }]
  });

  // 005 Date and Time of Latest Transaction
  record.fields.push({
    tag: '005',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] }]
  });

  // 008 Fixed-Length Data Elements
  const date008 = new Date().toISOString().slice(2, 8).replace(/-/g, '');
  const pubDate = data.instance?.['bf:provisionActivity']?.[0]?.['bf:date'] || '    ';
  record.fields.push({
    tag: '008',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: `${date008}s${pubDate}    xxu           000 0 eng d` }]
  });

  // ============================================================================
  // IDENTIFIERS
  // ============================================================================

  // 020 ISBN
  const identifiers = data.instance?.['bf:identifiedBy'] || [];
  identifiers.forEach((id: any) => {
    if (id['@type'] === 'bf:Isbn' && id['rdf:value']) {
      record.fields.push({
        tag: '020',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: id['rdf:value'] }]
      });
    }
  });

  // 022 ISSN
  identifiers.forEach((id: any) => {
    if (id['@type'] === 'bf:Issn' && id['rdf:value']) {
      record.fields.push({
        tag: '022',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: id['rdf:value'] }]
      });
    }
  });

  // 024 Other Standard Identifier
  identifiers.forEach((id: any) => {
    if (id['@type'] === 'bf:Identifier' && id['rdf:value']) {
      record.fields.push({
        tag: '024',
        ind1: '8',
        ind2: ' ',
        subfields: [{ code: 'a', value: id['rdf:value'] }]
      });
    }
  });

  // 028 Publisher Number
  identifiers.forEach((id: any) => {
    if (id['@type'] === 'bf:PublisherNumber' && id['rdf:value']) {
      record.fields.push({
        tag: '028',
        ind1: '0',
        ind2: '0',
        subfields: [{ code: 'a', value: id['rdf:value'] }]
      });
    }
  });

  // 035 System Control Number
  identifiers.forEach((id: any) => {
    if (id['@type'] === 'bf:SystemNumber' && id['rdf:value']) {
      record.fields.push({
        tag: '035',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: id['rdf:value'] }]
      });
    }
  });

  // 040 Cataloging Source
  record.fields.push({
    tag: '040',
    ind1: ' ',
    ind2: ' ',
    subfields: [
      { code: 'a', value: data.admin?.catalogingSource || 'MOON' },
      { code: 'b', value: 'eng' },
      { code: 'c', value: data.admin?.catalogingSource || 'MOON' },
      { code: 'e', value: 'rda' }
    ]
  });

  // 041 Language Code
  const languages = data.work?.['bf:language'] || [];
  if (languages.length > 0) {
    const langCodes = languages.map((l: any) => {
      const code = l['@id']?.split('/').pop() || l['rdfs:label']?.toLowerCase().slice(0, 3) || 'eng';
      return code;
    }).join('');
    record.fields.push({
      tag: '041',
      ind1: '0',
      ind2: ' ',
      subfields: [{ code: 'a', value: langCodes }]
    });
  }

  // ============================================================================
  // CLASSIFICATION
  // ============================================================================

  // 050 Library of Congress Classification
  const classifications = data.work?.['bf:classification'] || [];
  classifications.forEach((cls: any) => {
    if (cls['@type'] === 'bf:ClassificationLcc') {
      const subfields = [];
      if (cls['bf:classificationPortion']) {
        subfields.push({ code: 'a', value: cls['bf:classificationPortion'] });
      }
      if (cls['bf:itemPortion']) {
        subfields.push({ code: 'b', value: cls['bf:itemPortion'] });
      }
      if (subfields.length > 0) {
        record.fields.push({
          tag: '050',
          ind1: '0',
          ind2: '0',
          subfields
        });
      }
    }
  });

  // 082 Dewey Decimal Classification
  classifications.forEach((cls: any) => {
    if (cls['@type'] === 'bf:ClassificationDdc') {
      const subfields = [];
      if (cls['bf:classificationPortion']) {
        subfields.push({ code: 'a', value: cls['bf:classificationPortion'] });
      }
      if (cls['bf:edition']) {
        subfields.push({ code: '2', value: cls['bf:edition'] });
      }
      if (subfields.length > 0) {
        record.fields.push({
          tag: '082',
          ind1: '0',
          ind2: '0',
          subfields
        });
      }
    }
  });

  // ============================================================================
  // MAIN ENTRIES
  // ============================================================================

  // 100 Main Entry - Personal Name
  const creators = data.work?.['bf:creator'] || [];
  if (creators.length > 0) {
    const creator = creators[0];
    const creatorLabel = creator['rdfs:label'] || creator.label || 'Unknown';
    record.fields.push({
      tag: '100',
      ind1: '1',
      ind2: ' ',
      subfields: [
        { code: 'a', value: creatorLabel },
        ...(creator.uri ? [{ code: '0', value: creator.uri }] : [])
      ]
    });
  }

  // 110 Main Entry - Corporate Name
  const corporateCreators = data.work?.['bf:creator']?.filter((c: any) => 
    c['@type'] === 'bf:Organization'
  ) || [];
  if (corporateCreators.length > 0) {
    const creator = corporateCreators[0];
    record.fields.push({
      tag: '110',
      ind1: '2',
      ind2: ' ',
      subfields: [
        { code: 'a', value: creator['rdfs:label'] || creator.label },
        ...(creator.uri ? [{ code: '0', value: creator.uri }] : [])
      ]
    });
  }

  // ============================================================================
  // TITLE AND TITLE-RELATED FIELDS
  // ============================================================================

  // 245 Title Statement
  const workTitle = data.work?.['bf:title'] || data.work?.title;
  const instanceTitle = data.instance?.['bf:title'] || data.instance?.title;
  const titleObj = instanceTitle || workTitle;
  
  if (titleObj) {
    const mainTitle = typeof titleObj === 'string' ? titleObj : 
      (titleObj['bf:mainTitle'] || titleObj.mainTitle || titleObj['@value'] || 'Untitled');
    const subtitle = typeof titleObj === 'object' ? (titleObj['bf:subtitle'] || titleObj.subtitle) : null;
    
    const subfields = [
      { code: 'a', value: mainTitle + (subtitle ? ' :' : '') }
    ];
    
    if (subtitle) {
      subfields.push({ code: 'b', value: subtitle });
    }
    
    if (data.instance?.['bf:responsibilityStatement']) {
      subfields.push({ code: 'c', value: data.instance['bf:responsibilityStatement'] });
    }
    
    record.fields.push({
      tag: '245',
      ind1: creators.length > 0 ? '1' : '0',
      ind2: '0',
      subfields
    });
  }

  // 246 Varying Form of Title
  const variantTitles = data.work?.['bf:variantTitle'] || [];
  variantTitles.forEach((vt: any) => {
    const varTitle = vt['bf:mainTitle'] || vt.mainTitle || vt;
    if (varTitle) {
      record.fields.push({
        tag: '246',
        ind1: '3',
        ind2: ' ',
        subfields: [{ code: 'a', value: varTitle }]
      });
    }
  });

  // 250 Edition Statement
  if (data.instance?.['bf:editionStatement']) {
    record.fields.push({
      tag: '250',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: data.instance['bf:editionStatement'] }]
    });
  }

  // ============================================================================
  // PUBLICATION, DISTRIBUTION, ETC.
  // ============================================================================

  // 264 Production, Publication, Distribution, Manufacture
  const provisionActivitiesRaw = data.instance?.['bf:provisionActivity'] || [];
  const provisionActivities = Array.isArray(provisionActivitiesRaw) ? provisionActivitiesRaw : [provisionActivitiesRaw];
  provisionActivities.forEach((prov: any) => {
    const subfields = [];
    
    const place = prov['bf:place']?.['rdfs:label'] || prov.place;
    if (place) {
      subfields.push({ code: 'a', value: place });
    }
    
    const agent = prov['bf:agent']?.['rdfs:label'] || prov.agent;
    if (agent) {
      subfields.push({ code: 'b', value: agent });
    }
    
    const date = prov['bf:date'] || prov.date;
    if (date) {
      subfields.push({ code: 'c', value: date });
    }
    
    if (subfields.length > 0) {
      record.fields.push({
        tag: '264',
        ind1: ' ',
        ind2: '1',
        subfields
      });
    }
  });

  // ============================================================================
  // PHYSICAL DESCRIPTION
  // ============================================================================

  // 300 Physical Description
  const extent = data.instance?.['bf:extent'];
  const dimensions = data.instance?.['bf:dimensions'];
  const illustrativeContent = data.instance?.['bf:illustrativeContent'];
  
  if (extent || dimensions || illustrativeContent) {
    const subfields = [];
    
    if (extent) {
      const extentValue = extent['rdfs:label'] || extent;
      subfields.push({ code: 'a', value: extentValue });
    }
    
    if (illustrativeContent) {
      const illValue = Array.isArray(illustrativeContent) 
        ? illustrativeContent.map((i: any) => i['rdfs:label'] || i).join(', ')
        : (illustrativeContent['rdfs:label'] || illustrativeContent);
      subfields.push({ code: 'b', value: illValue });
    }
    
    if (dimensions) {
      subfields.push({ code: 'c', value: dimensions });
    }
    
    if (subfields.length > 0) {
      record.fields.push({
        tag: '300',
        ind1: ' ',
        ind2: ' ',
        subfields
      });
    }
  }

  // ============================================================================
  // SERIES STATEMENT
  // ============================================================================

  // 490 Series Statement
  const seriesStatements = data.instance?.['bf:seriesStatement'] || [];
  const seriesArray = Array.isArray(seriesStatements) ? seriesStatements : [seriesStatements];
  seriesArray.forEach((series: any) => {
    if (series) {
      record.fields.push({
        tag: '490',
        ind1: '0',
        ind2: ' ',
        subfields: [{ code: 'a', value: series }]
      });
    }
  });

  // ============================================================================
  // NOTES
  // ============================================================================

  // 500 General Note
  const notes = data.work?.['bf:note'] || data.instance?.['bf:note'] || [];
  notes.forEach((note: any) => {
    const noteValue = note['rdfs:label'] || note.value || note;
    if (noteValue) {
      record.fields.push({
        tag: '500',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: noteValue }]
      });
    }
  });

  // 504 Bibliography Note
  const supplementaryContent = data.work?.['bf:supplementaryContent'] || [];
  supplementaryContent.forEach((sup: any) => {
    if (sup['@type'] === 'bf:Bibliography') {
      const supValue = sup['rdfs:label'] || sup;
      record.fields.push({
        tag: '504',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: supValue }]
      });
    }
  });

  // 505 Table of Contents
  const tableOfContents = data.work?.['bf:tableOfContents'] || [];
  tableOfContents.forEach((toc: any) => {
    const tocValue = toc['rdfs:label'] || toc;
    if (tocValue) {
      record.fields.push({
        tag: '505',
        ind1: '0',
        ind2: ' ',
        subfields: [{ code: 'a', value: tocValue }]
      });
    }
  });

  // 520 Summary
  const summaries = data.work?.['bf:summary'] || [];
  summaries.forEach((summary: any) => {
    const summaryValue = summary['rdfs:label'] || summary;
    if (summaryValue) {
      record.fields.push({
        tag: '520',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: summaryValue }]
      });
    }
  });

  // 546 Language Note
  if (languages.length > 0) {
    const langNames = languages.map((l: any) => l['rdfs:label']).filter(Boolean).join(', ');
    if (langNames) {
      record.fields.push({
        tag: '546',
        ind1: ' ',
        ind2: ' ',
        subfields: [{ code: 'a', value: langNames }]
      });
    }
  }

  // ============================================================================
  // SUBJECT ACCESS FIELDS
  // ============================================================================

  // 600-651 Subject Added Entries
  const subjects = data.work?.['bf:subject'] || [];
  subjects.forEach((subject: any) => {
    const subjectType = subject['@type'];
    const subjectLabel = subject['rdfs:label'] || subject.label;
    const subjectUri = subject['@id'] || subject.uri;
    
    if (!subjectLabel) return;
    
    const subfields = [
      { code: 'a', value: subjectLabel },
      ...(subjectUri ? [{ code: '0', value: subjectUri }] : [])
    ];
    
    if (subjectType === 'bf:Person') {
      // 600 Personal Name
      record.fields.push({
        tag: '600',
        ind1: '1',
        ind2: '0',
        subfields
      });
    } else if (subjectType === 'bf:Organization') {
      // 610 Corporate Name
      record.fields.push({
        tag: '610',
        ind1: '2',
        ind2: '0',
        subfields
      });
    } else if (subjectType === 'bf:Place') {
      // 651 Geographic Name
      record.fields.push({
        tag: '651',
        ind1: ' ',
        ind2: '0',
        subfields
      });
    } else {
      // 650 Topical Term (default)
      record.fields.push({
        tag: '650',
        ind1: ' ',
        ind2: '0',
        subfields
      });
    }
  });

  // 655 Index Term - Genre/Form
  const genreForms = data.work?.['bf:genreForm'] || [];
  genreForms.forEach((genre: any) => {
    const genreLabel = genre['rdfs:label'] || genre.label;
    const genreUri = genre['@id'] || genre.uri;
    
    if (genreLabel) {
      record.fields.push({
        tag: '655',
        ind1: ' ',
        ind2: '7',
        subfields: [
          { code: 'a', value: genreLabel },
          ...(genreUri ? [{ code: '0', value: genreUri }] : []),
          { code: '2', value: 'lcgft' }
        ]
      });
    }
  });

  // ============================================================================
  // ADDED ENTRIES
  // ============================================================================

  // 700 Added Entry - Personal Name (contributors other than main creator)
  const contributors = data.work?.['bf:contributor'] || [];
  contributors.forEach((contrib: any) => {
    const contribLabel = contrib['rdfs:label'] || contrib.label;
    const contribUri = contrib['@id'] || contrib.uri;
    const role = contrib['bf:role']?.['rdfs:label'] || contrib.role;
    
    if (contribLabel) {
      record.fields.push({
        tag: '700',
        ind1: '1',
        ind2: ' ',
        subfields: [
          { code: 'a', value: contribLabel },
          ...(role ? [{ code: 'e', value: role }] : []),
          ...(contribUri ? [{ code: '0', value: contribUri }] : [])
        ]
      });
    }
  });

  // 710 Added Entry - Corporate Name
  const corporateContributors = data.work?.['bf:contributor']?.filter((c: any) => 
    c['@type'] === 'bf:Organization'
  ) || [];
  corporateContributors.forEach((contrib: any) => {
    const contribLabel = contrib['rdfs:label'] || contrib.label;
    const contribUri = contrib['@id'] || contrib.uri;
    
    if (contribLabel) {
      record.fields.push({
        tag: '710',
        ind1: '2',
        ind2: ' ',
        subfields: [
          { code: 'a', value: contribLabel },
          ...(contribUri ? [{ code: '0', value: contribUri }] : [])
        ]
      });
    }
  });

  // ============================================================================
  // ELECTRONIC LOCATION AND ACCESS
  // ============================================================================

  // 856 Electronic Location and Access
  if (data.work?.['@id']) {
    record.fields.push({
      tag: '856',
      ind1: '4',
      ind2: '0',
      subfields: [
        { code: 'u', value: data.work['@id'] },
        { code: 'z', value: 'BIBFRAME Work URI' }
      ]
    });
  }

  if (data.instance?.['@id']) {
    record.fields.push({
      tag: '856',
      ind1: '4',
      ind2: '0',
      subfields: [
        { code: 'u', value: data.instance['@id'] },
        { code: 'z', value: 'BIBFRAME Instance URI' }
      ]
    });
  }

  records.push(record);
  return records;
}