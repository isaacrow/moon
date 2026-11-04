/**
 * 📖 Record Viewer Dialog - Multi-Format Display
 * Shows BIBFRAME records in OPAC, Mind Map, and MARC 21 views
 */

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BookOpen, Network, FileText, Download } from 'lucide-react';
import { Button } from '../ui/button';

interface RecordViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonldData: any;
  title?: string;
}

export function RecordViewerDialog({ 
  open, 
  onOpenChange, 
  jsonldData, 
  title = 'Record Viewer' 
}: RecordViewerDialogProps) {
  const [activeTab, setActiveTab] = useState('opac');

  // Transform data for different views
  const transformedData = transformForViews(jsonldData);

  const handleDownloadJsonLd = () => {
    const blob = new Blob([JSON.stringify(jsonldData, null, 2)], { 
      type: 'application/ld+json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bibframe-record-${Date.now()}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
              <DialogDescription>
                Multi-format view: OPAC, Mind Map, and MARC 21
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJsonLd}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download JSON-LD
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="opac" className="gap-2">
              <BookOpen className="h-4 w-4" />
              OPAC View
            </TabsTrigger>
            <TabsTrigger value="mindmap" className="gap-2">
              <Network className="h-4 w-4" />
              Mind Map
            </TabsTrigger>
            <TabsTrigger value="marc" className="gap-2">
              <FileText className="h-4 w-4" />
              MARC 21
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="opac" className="h-full mt-0 overflow-auto">
              <OPACViewContent data={transformedData} />
            </TabsContent>

            <TabsContent value="mindmap" className="h-full mt-0 overflow-hidden">
              <MindMapViewContent 
                workData={transformedData.work} 
                instanceData={transformedData.instance} 
              />
            </TabsContent>

            <TabsContent value="marc" className="h-full mt-0 overflow-auto">
              <MARCViewContent data={transformedData} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Transform JSON-LD graph data for views
function transformForViews(jsonldData: any) {
  const graph = jsonldData['@graph'] || [];
  
  // Find Work, Instance, Item
  const work = graph.find((node: any) => 
    node['@type'] === 'bf:Work' || 
    node['@type']?.includes('Work')
  ) || {};
  
  const instance = graph.find((node: any) => 
    node['@type'] === 'bf:Instance' || 
    node['@type']?.includes('Instance')
  ) || {};

  const item = graph.find((node: any) => 
    node['@type'] === 'bf:Item' || 
    node['@type']?.includes('Item')
  ) || {};

  // Helper to resolve references
  const resolveRef = (ref: any) => {
    if (!ref) return null;
    if (typeof ref === 'string') {
      return graph.find((n: any) => n['@id'] === ref);
    }
    if (ref['@id']) {
      return graph.find((n: any) => n['@id'] === ref['@id']) || ref;
    }
    return ref;
  };

  // Helper to get value
  const getValue = (node: any, prop: string) => {
    if (!node || !node[prop]) return null;
    const val = node[prop];
    if (typeof val === 'string') return val;
    if (val['@value']) return val['@value'];
    if (val.value) return val.value;
    return val;
  };

  return {
    '@graph': graph,
    work: work,
    instance: instance,
    item: item,
    admin: {
      recordId: work['@id']?.split('/').pop(),
      catalogingSource: 'MOON'
    }
  };
}

// OPAC View Component
function OPACViewContent({ data }: { data: any }) {
  const graph = data['@graph'] || [];
  const work = data.work || {};
  const instance = data.instance || {};

  // Helper to resolve node by reference
  const resolveNode = (ref: any) => {
    if (!ref) return null;
    if (typeof ref === 'string') {
      return graph.find((n: any) => n['@id'] === ref);
    }
    if (ref['@id']) {
      return graph.find((n: any) => n['@id'] === ref['@id']) || ref;
    }
    return ref;
  };

  // Get title
  const titleRef = work['bf:title'];
  const titleNode = resolveNode(titleRef);
  const mainTitle = titleNode?.['bf:mainTitle'] || 'Untitled Work';
  const subtitle = titleNode?.['bf:subtitle'];

  // Get responsibility statement
  const responsibilityStatement = instance['bf:responsibilityStatement'];

  return (
    <div className="p-6 space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-xl">
            <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {mainTitle}
            </h1>
            {subtitle && (
              <h2 className="text-xl text-gray-700 dark:text-gray-300 mb-4">
                {subtitle}
              </h2>
            )}
            {responsibilityStatement && (
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {responsibilityStatement}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Work Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Work Information
          </h3>
          <dl className="space-y-3">
            {work['bf:originDate'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Date</dt>
                <dd className="text-gray-900">{work['bf:originDate']}</dd>
              </div>
            )}
            {work['bf:language'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Language</dt>
                <dd className="text-gray-900">
                  {Array.isArray(work['bf:language']) 
                    ? work['bf:language'].map((l: any) => 
                        resolveNode(l)?.['rdfs:label'] || l['@id']?.split('/').pop()
                      ).join(', ')
                    : resolveNode(work['bf:language'])?.['rdfs:label'] || 'N/A'
                  }
                </dd>
              </div>
            )}
            {work['bf:content'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Content Type</dt>
                <dd className="text-gray-900">
                  {Array.isArray(work['bf:content'])
                    ? work['bf:content'].map((c: any) => c['@id']?.split('/').pop()).join(', ')
                    : work['bf:content']['@id']?.split('/').pop()
                  }
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Instance Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Instance Information
          </h3>
          <dl className="space-y-3">
            {instance['bf:editionStatement'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Edition</dt>
                <dd className="text-gray-900">{instance['bf:editionStatement']}</dd>
              </div>
            )}
            {instance['bf:dimensions'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Dimensions</dt>
                <dd className="text-gray-900">{instance['bf:dimensions']}</dd>
              </div>
            )}
            {instance['bf:extent'] && (
              <div>
                <dt className="text-sm font-semibold text-gray-600">Extent</dt>
                <dd className="text-gray-900">
                  {resolveNode(instance['bf:extent'])?.['rdfs:label'] || instance['bf:extent']}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Subjects & Topics */}
      {work['bf:subject'] && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Network className="h-5 w-5 text-purple-600" />
            Subjects & Topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(work['bf:subject']) ? work['bf:subject'] : [work['bf:subject']]).map((subj: any, idx: number) => {
              const subjNode = resolveNode(subj);
              const label = subjNode?.['rdfs:label'] || subj['@id']?.split('/').pop() || 'Subject';
              return (
                <span 
                  key={idx} 
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Data URIs */}
      <div className="bg-gray-50 rounded-lg border p-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Linked Data Identifiers</h3>
        <dl className="space-y-2 font-mono text-xs">
          {work['@id'] && (
            <div>
              <dt className="text-gray-500">Work URI:</dt>
              <dd className="text-blue-600 break-all">{work['@id']}</dd>
            </div>
          )}
          {instance['@id'] && (
            <div>
              <dt className="text-gray-500">Instance URI:</dt>
              <dd className="text-blue-600 break-all">{instance['@id']}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// Mind Map View Component
function MindMapViewContent({ workData, instanceData }: { workData: any; instanceData: any }) {
  // Helper to safely get title
  const getTitle = () => {
    const titleProp = workData['bf:title'];
    if (typeof titleProp === 'object' && titleProp['bf:mainTitle']) {
      return titleProp['bf:mainTitle'];
    }
    return 'Untitled';
  };

  const mainTitle = getTitle();

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-8 overflow-auto">
      <svg width="100%" height="100%" viewBox="0 0 1400 1000" className="mx-auto">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          <linearGradient id="workGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
          </linearGradient>
          
          <linearGradient id="instanceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {/* Central Work Node */}
        <g transform="translate(400, 300)">
          <circle r="80" fill="url(#workGrad)" filter="url(#glow)" />
          <text textAnchor="middle" y="-10" fill="white" fontSize="16" fontWeight="bold">
            bf:Work
          </text>
          <text textAnchor="middle" y="10" fill="white" fontSize="12">
            {mainTitle.substring(0, 20)}
          </text>
          <text textAnchor="middle" y="25" fill="white" fontSize="10" opacity="0.8">
            {workData['@id']?.split('/').pop() || ''}
          </text>
        </g>

        {/* Instance Node */}
        <g transform="translate(800, 300)">
          <line x1="-320" y1="0" x2="-100" y2="0" stroke="#60a5fa" strokeWidth="2" strokeDasharray="5,5" opacity="0.6" />
          <circle r="70" fill="url(#instanceGrad)" filter="url(#glow)" />
          <text textAnchor="middle" y="-10" fill="white" fontSize="16" fontWeight="bold">
            bf:Instance
          </text>
          <text textAnchor="middle" y="10" fill="white" fontSize="12">
            Physical
          </text>
          <text textAnchor="middle" y="25" fill="white" fontSize="10" opacity="0.8">
            {instanceData['@id']?.split('/').pop() || ''}
          </text>
        </g>

        {/* Title Property */}
        <g transform="translate(200, 150)">
          <line x1="200" y1="150" x2="120" y2="30" stroke="#60a5fa" strokeWidth="1.5" opacity="0.4" />
          <circle r="30" fill="#3b82f6" opacity="0.8" />
          <text textAnchor="middle" y="-5" fill="white" fontSize="10" fontWeight="bold">Title</text>
          <text textAnchor="middle" y="8" fill="white" fontSize="8">
            {mainTitle.substring(0, 12)}
          </text>
        </g>

        {/* Language */}
        {workData['bf:language'] && (
          <g transform="translate(550, 500)">
            <line x1="-150" y1="-200" x2="-80" y2="-30" stroke="#60a5fa" strokeWidth="1.5" opacity="0.4" />
            <circle r="25" fill="#ec4899" opacity="0.8" />
            <text textAnchor="middle" y="-3" fill="white" fontSize="9">Lang</text>
            <text textAnchor="middle" y="8" fill="white" fontSize="7">
              {workData['bf:language']?.['@id']?.split('/').pop()?.substring(0, 6) || 'eng'}
            </text>
          </g>
        )}

        {/* Subjects */}
        {workData['bf:subject'] && (
          <g transform="translate(550, 150)">
            <line x1="-150" y1="150" x2="-80" y2="30" stroke="#60a5fa" strokeWidth="1.5" opacity="0.4" />
            <circle r="32" fill="#10b981" opacity="0.8" />
            <text textAnchor="middle" y="-5" fill="white" fontSize="10" fontWeight="bold">Subject</text>
            <text textAnchor="middle" y="8" fill="white" fontSize="7">Topic</text>
          </g>
        )}

        {/* Extent */}
        {instanceData['bf:extent'] && (
          <g transform="translate(650, 450)">
            <line x1="150" y1="-150" x2="80" y2="-30" stroke="#34d399" strokeWidth="1.5" opacity="0.4" />
            <circle r="28" fill="#14b8a6" opacity="0.8" />
            <text textAnchor="middle" y="-3" fill="white" fontSize="9">Extent</text>
            <text textAnchor="middle" y="8" fill="white" fontSize="7">Physical</text>
          </g>
        )}

        {/* Relationship Label */}
        <text x="600" y="285" textAnchor="middle" fill="white" fontSize="11" opacity="0.7">
          bf:instanceOf
        </text>

        {/* Legend */}
        <g transform="translate(50, 850)">
          <text fill="white" fontSize="14" fontWeight="bold" opacity="0.9">Legend:</text>
          <circle cx="15" cy="30" r="8" fill="url(#workGrad)" />
          <text x="30" y="35" fill="white" fontSize="11">bf:Work (Conceptual)</text>
          
          <circle cx="15" cy="55" r="8" fill="url(#instanceGrad)" />
          <text x="30" y="60" fill="white" fontSize="11">bf:Instance (Physical)</text>
          
          <circle cx="200" cy="30" r="8" fill="#3b82f6" opacity="0.8" />
          <text x="215" y="35" fill="white" fontSize="11">Properties</text>
          
          <line x1="200" y1="52" x2="230" y2="52" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
          <text x="235" y="57" fill="white" fontSize="11">Relationships</text>
        </g>

        {/* Title */}
        <text x="700" y="50" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
          BIBFRAME Mind Map / خريطة ذهنية
        </text>
      </svg>
    </div>
  );
}

// MARC 21 View Component
function MARCViewContent({ data }: { data: any }) {
  const marcRecords = convertToMARC(data);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <h2 className="text-xl font-semibold">MARC 21 View</h2>
          <p className="text-sm text-blue-100 mt-1">Machine-Readable Cataloging</p>
        </div>

        <div className="p-6 font-mono text-sm">
          {marcRecords.map((record, idx) => (
            <div key={idx} className="mb-6">
              {/* Leader */}
              <div className="flex border-b border-gray-200 py-2">
                <div className="w-20 text-gray-500 font-semibold">LEADER</div>
                <div className="flex-1 text-gray-900">{record.leader}</div>
              </div>

              {/* Fields */}
              {record.fields.map((field, fieldIdx) => (
                <div 
                  key={fieldIdx} 
                  className="flex border-b border-gray-100 py-2 hover:bg-blue-50 transition-colors"
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

        <div className="bg-gray-50 px-6 py-4 border-t">
          <p className="text-xs text-gray-500">
            Generated from BIBFRAME data • MARC 21 Format for Bibliographic Data
          </p>
        </div>
      </div>
    </div>
  );
}

// MARC Conversion
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

function convertToMARC(data: any): MARCRecord[] {
  const records: MARCRecord[] = [];
  const work = data.work || {};
  const instance = data.instance || {};

  const record: MARCRecord = {
    leader: '00000nam  2200000Ia 4500',
    fields: []
  };

  // Helper to resolve reference
  const resolveRef = (ref: any) => {
    if (!ref) return null;
    if (typeof ref === 'string') {
      const graph = data['@graph'] || [];
      return graph.find((n: any) => n['@id'] === ref);
    }
    if (ref['@id']) {
      const graph = data['@graph'] || [];
      return graph.find((n: any) => n['@id'] === ref['@id']) || ref;
    }
    return ref;
  };

  // 001 Control Number
  if (work['@id']) {
    record.fields.push({
      tag: '001',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: work['@id'].split('/').pop() || 'unknown' }]
    });
  }

  // 003 Control Number Identifier
  record.fields.push({
    tag: '003',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: 'MOON' }]
  });

  // 005 Date and Time
  record.fields.push({
    tag: '005',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] }]
  });

  // 008 Fixed-Length Data
  const date008 = new Date().toISOString().slice(2, 8).replace(/-/g, '');
  record.fields.push({
    tag: '008',
    ind1: ' ',
    ind2: ' ',
    subfields: [{ code: 'a', value: `${date008}s2024    xxu           000 0 eng d` }]
  });

  // 040 Cataloging Source
  record.fields.push({
    tag: '040',
    ind1: ' ',
    ind2: ' ',
    subfields: [
      { code: 'a', value: 'MOON' },
      { code: 'b', value: 'eng' },
      { code: 'c', value: 'MOON' },
      { code: 'e', value: 'rda' }
    ]
  });

  // 245 Title
  const titleRef = work['bf:title'];
  const titleNode = resolveRef(titleRef);
  const mainTitle = titleNode?.['bf:mainTitle'] || 'Untitled';
  const subtitle = titleNode?.['bf:subtitle'];

  const titleSubfields = [
    { code: 'a', value: mainTitle + (subtitle ? ' :' : '') }
  ];
  
  if (subtitle) {
    titleSubfields.push({ code: 'b', value: subtitle });
  }
  
  if (instance['bf:responsibilityStatement']) {
    titleSubfields.push({ code: 'c', value: instance['bf:responsibilityStatement'] });
  }
  
  record.fields.push({
    tag: '245',
    ind1: '0',
    ind2: '0',
    subfields: titleSubfields
  });

  // 250 Edition
  if (instance['bf:editionStatement']) {
    record.fields.push({
      tag: '250',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: instance['bf:editionStatement'] }]
    });
  }

  // 300 Physical Description
  if (instance['bf:extent'] || instance['bf:dimensions']) {
    const subfields = [];
    
    if (instance['bf:extent']) {
      const extentNode = resolveRef(instance['bf:extent']);
      const extentValue = extentNode?.['rdfs:label'] || instance['bf:extent'];
      subfields.push({ code: 'a', value: extentValue });
    }
    
    if (instance['bf:dimensions']) {
      subfields.push({ code: 'c', value: instance['bf:dimensions'] });
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

  // 650 Subjects
  if (work['bf:subject']) {
    const subjects = Array.isArray(work['bf:subject']) ? work['bf:subject'] : [work['bf:subject']];
    subjects.forEach((subj: any) => {
      const subjNode = resolveRef(subj);
      const label = subjNode?.['rdfs:label'] || subj['@id']?.split('/').pop();
      
      if (label) {
        record.fields.push({
          tag: '650',
          ind1: ' ',
          ind2: '0',
          subfields: [{ code: 'a', value: label }]
        });
      }
    });
  }

  // 856 Electronic Location
  if (work['@id']) {
    record.fields.push({
      tag: '856',
      ind1: '4',
      ind2: '0',
      subfields: [
        { code: 'u', value: work['@id'] },
        { code: 'z', value: 'BIBFRAME Work URI' }
      ]
    });
  }

  if (instance['@id']) {
    record.fields.push({
      tag: '856',
      ind1: '4',
      ind2: '0',
      subfields: [
        { code: 'u', value: instance['@id'] },
        { code: 'z', value: 'BIBFRAME Instance URI' }
      ]
    });
  }

  records.push(record);
  return records;
}
