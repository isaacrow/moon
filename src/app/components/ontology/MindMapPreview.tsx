/**
 * Mind Map Preview Component (Classic Graph View)
 * 
 * Interactive hierarchical knowledge graph of BIBFRAME WEMI entities & properties
 * with curved Bezier connections, category coloring, and node inspection.
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen, Package, User, Tag, Hash, FileText, Globe,
  Layers, Building2, Quote, Shield, ExternalLink, Copy, Check,
  ZoomIn, ZoomOut, RotateCcw, X, Sparkles
} from 'lucide-react';

interface MindMapPreviewProps {
  workData: any;
  instanceData: any;
  theme?: 'dark' | 'light' | any;
  itemUri?: string;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  group: 'work' | 'instance' | 'item' | 'creator' | 'subject' | 'classification' | 'manuscript' | 'admin';
  x: number;
  y: number;
  r: number;
  color: string;
  icon: React.ReactNode;
  predicate: string;
  fullText: string;
  uri?: string;
}

interface GraphLink {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

function extractStr(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    for (const it of val) {
      const s = extractStr(it);
      if (s) return s;
    }
    return fallback;
  }
  if (typeof val === 'object') {
    return val['rdfs:label'] || val['bf:mainTitle'] || val['mainTitle'] || val['value'] || val['rdf:value'] || fallback;
  }
  return fallback;
}

function extractArr(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export function MindMapPreview({ workData = {}, instanceData = {}, theme = 'dark', itemUri = '' }: MindMapPreviewProps) {
  const isDark = theme !== 'light';
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Extract Work & Instance fields
  const titleVal = extractStr(workData['bf:title']?.['bf:mainTitle'] || workData['bf:title']?.mainTitle || workData.title, 'القبسات');
  
  const rawContribs = extractArr(workData['bf:contribution'] || workData.contribution || []);
  const agentObj = rawContribs[0]?.['bf:agent'] || rawContribs[0]?.agent || {};
  const creatorName = extractStr(agentObj['rdfs:label'] || agentObj.name || workData.creator, 'الميرداماد، محمد باقر الحسيني');
  const creatorRole = extractStr(rawContribs[0]?.['bf:role']?.['rdfs:label'] || rawContribs[0]?.role, 'مؤلف / Author');
  const creatorUri = agentObj['@id'] || workData.creatorUri || 'http://id.loc.gov/authorities/names/n85043844';

  const rawClass = workData['bf:classification'] || workData.classification || workData.classificationLcc || instanceData['bf:classification'] || 'B753.D363 Q23 1650';
  const callNo = typeof rawClass === 'object'
    ? [rawClass['bf:classificationPortion'], rawClass['bf:itemPortion']].filter(Boolean).join(' ') || rawClass['rdfs:label'] || 'B753.D363 Q23 1650'
    : String(rawClass);

  const rawSubjects = extractArr(workData['bf:subject'] || workData.subject || []);
  const subject1 = rawSubjects[0] ? extractStr(rawSubjects[0]['rdfs:label'] || rawSubjects[0], 'الفلسفة الإسلامية') : 'الفلسفة الإسلامية';
  const subject2 = rawSubjects[1] ? extractStr(rawSubjects[1]['rdfs:label'] || rawSubjects[1], 'علم الكلام') : 'علم الكلام';

  const dateVal = extractStr(instanceData['bf:provisionActivity']?.['bf:date'] || instanceData['bf:provisionActivity']?.date || workData['bf:originDate'] || '1061 هـ = [1650]');
  const extentVal = extractStr(instanceData['bf:extent'] || instanceData.extent, '344 ورقة (18 سطرًا)');
  const dimsVal = extractStr(instanceData['bf:dimensions'] || instanceData.dimensions, '21 × 15 سم');
  const carrierVal = extractStr(instanceData['bf:carrier'] || instanceData.carrier, 'مصدر الكتروني (ck)');

  const rawNotes = extractArr(workData['bf:note'] || workData.note || instanceData['bf:note'] || []);
  let incipitText = 'أوله : الحمد لله الواحد الاحد الصمد المصمود مهيمن كل وجود...';
  let explicitText = 'آخره : ولا تخلنا اللهم مع ذلك من عواطف رأفتك...';
  rawNotes.forEach(n => {
    const s = extractStr(n?.['rdfs:label'] || n);
    if (s.startsWith('أوله') || s.includes('الحمد لله')) incipitText = s;
    if (s.startsWith('آخره') || s.includes('ولا تخلنا')) explicitText = s;
  });

  // Construct Layout Coordinates for 1400x900 Canvas
  const { nodes, links } = useMemo(() => {
    const nList: GraphNode[] = [
      // Central Work Node
      {
        id: 'work',
        label: 'bf:Work',
        sublabel: titleVal,
        group: 'work',
        x: 520,
        y: 440,
        r: 65,
        color: '#3b82f6',
        icon: <BookOpen className="h-6 w-6" />,
        predicate: 'rdf:type bf:Work',
        fullText: `Work Entity: ${titleVal}${workData['@id'] ? ` (${workData['@id']})` : ''}`,
        uri: workData['@id'] || '',
      },

      // Instance Node
      {
        id: 'instance',
        label: 'bf:Instance',
        sublabel: 'مخطوطة أصلية 1061 هـ',
        group: 'instance',
        x: 880,
        y: 440,
        r: 60,
        color: '#06b6d4',
        icon: <Package className="h-6 w-6" />,
        predicate: 'bf:hasInstance',
        fullText: `Instance Manifestation: 1061 H / 1650 M (${carrierVal})`,
        uri: instanceData['@id'] || '',
      },

      // Item Node
      {
        id: 'item',
        label: 'bf:Item',
        sublabel: 'IQ-KaCCS (b125923)',
        group: 'item',
        x: 1200,
        y: 440,
        r: 52,
        color: '#f43f5e',
        icon: <Building2 className="h-5 w-5" />,
        predicate: 'bf:hasItem',
        fullText: 'Physical/Digital Item: خزانة المخطوطات، العتبة العباسية المقدسة (IQ-KaCCS) -- الباركود: b125923',
        uri: itemUri,
      },

      // Work Branches (Left & Top)
      {
        id: 'title-node',
        label: 'Title / العنوان',
        sublabel: titleVal,
        group: 'work',
        x: 240,
        y: 260,
        r: 44,
        color: '#60a5fa',
        icon: <BookOpen className="h-4 w-4" />,
        predicate: 'bf:title -> bf:mainTitle',
        fullText: `Main Title: ${titleVal}`,
      },
      {
        id: 'creator-node',
        label: 'Creator / المؤلف',
        sublabel: creatorName,
        group: 'creator',
        x: 220,
        y: 440,
        r: 48,
        color: '#8b5cf6',
        icon: <User className="h-4 w-4" />,
        predicate: 'bf:contribution -> bf:agent',
        fullText: `${creatorName} (${creatorRole})\nLOC Authority: ${creatorUri}`,
        uri: creatorUri,
      },
      {
        id: 'class-node',
        label: 'LCC Classification',
        sublabel: callNo,
        group: 'classification',
        x: 260,
        y: 620,
        r: 44,
        color: '#f59e0b',
        icon: <Hash className="h-4 w-4" />,
        predicate: 'bf:classification',
        fullText: `Library of Congress Classification: ${callNo} (DDC: 181.07)`,
      },
      {
        id: 'subject1-node',
        label: 'Topical Subject',
        sublabel: subject1,
        group: 'subject',
        x: 440,
        y: 180,
        r: 42,
        color: '#10b981',
        icon: <Tag className="h-4 w-4" />,
        predicate: 'bf:subject (LCSH)',
        fullText: `LCSH Topic: ${subject1}`,
        uri: 'http://id.loc.gov/authorities/subjects/sh85101006',
      },
      {
        id: 'subject2-node',
        label: 'Subject Headings',
        sublabel: subject2,
        group: 'subject',
        x: 600,
        y: 180,
        r: 40,
        color: '#34d399',
        icon: <Tag className="h-4 w-4" />,
        predicate: 'bf:subject',
        fullText: `LCSH Topic: ${subject2}`,
      },

      // Instance Branches (Right & Bottom)
      {
        id: 'provision-node',
        label: 'Production / النسخ',
        sublabel: dateVal,
        group: 'instance',
        x: 800,
        y: 200,
        r: 44,
        color: '#2dd4bf',
        icon: <Package className="h-4 w-4" />,
        predicate: 'bf:provisionActivity',
        fullText: `تاريخ الإنتاج والنسخ: ${dateVal} -- أصفهان / إيران`,
      },
      {
        id: 'extent-node',
        label: 'Extent / الأوراق',
        sublabel: extentVal,
        group: 'manuscript',
        x: 760,
        y: 660,
        r: 44,
        color: '#fb7185',
        icon: <Layers className="h-4 w-4" />,
        predicate: 'bf:extent & bf:dimensions',
        fullText: `عدد الأوراق: ${extentVal} -- المقاس: ${dimsVal}`,
      },
      {
        id: 'codicology-node',
        label: 'Script & Ink / الخط',
        sublabel: 'خط النستعليق / حبر أسود',
        group: 'manuscript',
        x: 960,
        y: 670,
        r: 42,
        color: '#eab308',
        icon: <FileText className="h-4 w-4" />,
        predicate: 'MARC 340 / bf:Note',
        fullText: 'خط النستعليق الفاخر بحبر أسود، وعناوين محمرة، مرتبة بنظام التعقيبات على ورق شرقي',
      },
      {
        id: 'incipit-node',
        label: 'Incipit / أول المخطوط',
        sublabel: 'الحمد لله الواحد الأحد...',
        group: 'manuscript',
        x: 980,
        y: 220,
        r: 44,
        color: '#f59e0b',
        icon: <Quote className="h-4 w-4" />,
        predicate: 'bf:note (Incipit)',
        fullText: `${incipitText}\n\n${explicitText}`,
      },

      // Admin Node
      {
        id: 'admin-node',
        label: 'AdminMetadata',
        sublabel: 'IQ-KaCCS / RDA',
        group: 'admin',
        x: 1200,
        y: 660,
        r: 40,
        color: '#64748b',
        icon: <Shield className="h-4 w-4" />,
        predicate: 'bf:adminMetadata',
        fullText: 'RDA Cataloging Rules -- Agency: IQ-KaCCS -- Control 008: 120203s1650 xx ara',
      },
    ];

    const lList: GraphLink[] = [
      // Primary Backbone Links
      { from: 'work', to: 'instance', label: 'bf:hasInstance', color: '#06b6d4' },
      { from: 'instance', to: 'item', label: 'bf:hasItem', color: '#f43f5e' },

      // Work Links
      { from: 'work', to: 'title-node', label: 'bf:title', color: '#60a5fa' },
      { from: 'work', to: 'creator-node', label: 'bf:contribution', color: '#8b5cf6' },
      { from: 'work', to: 'class-node', label: 'bf:classification', color: '#f59e0b' },
      { from: 'work', to: 'subject1-node', label: 'bf:subject', color: '#10b981' },
      { from: 'work', to: 'subject2-node', label: 'bf:subject', color: '#34d399' },

      // Instance Links
      { from: 'instance', to: 'provision-node', label: 'bf:provisionActivity', color: '#2dd4bf' },
      { from: 'instance', to: 'extent-node', label: 'bf:extent', color: '#fb7185' },
      { from: 'instance', to: 'codicology-node', label: 'MARC 340', color: '#eab308' },
      { from: 'instance', to: 'incipit-node', label: 'bf:note', color: '#f59e0b' },

      // Item Links
      { from: 'item', to: 'admin-node', label: 'bf:adminMetadata', color: '#64748b' },
    ];

    return { nodes: nList, links: lList };
  }, [titleVal, creatorName, creatorRole, creatorUri, callNo, subject1, subject2, dateVal, extentVal, dimsVal, carrierVal, incipitText, explicitText, workData, instanceData]);

  // Cubic Bezier Path calculation between two nodes
  const getPathD = (fromId: string, toId: string) => {
    const fn = nodes.find(n => n.id === fromId);
    const tn = nodes.find(n => n.id === toId);
    if (!fn || !tn) return '';
    const dx = tn.x - fn.x;
    const cx1 = fn.x + dx * 0.45;
    const cy1 = fn.y;
    const cx2 = fn.x + dx * 0.55;
    const cy2 = tn.y;
    return `M ${fn.x} ${fn.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tn.x} ${tn.y}`;
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative w-full h-[650px] rounded-2xl overflow-hidden border transition-all ${
      isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
    }`}>
      {/* Top Header / View Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-xs shadow-lg">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="font-bold text-white">Classic Knowledge Graph</span>
          <span className="text-slate-400 font-mono text-[10px]">({nodes.length} Nodes / {links.length} Relations)</span>
        </div>

        {/* Zoom & Reset Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-lg">
          <button
            onClick={() => setZoom(z => Math.min(1.6, z + 0.15))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setSelectedNode(null); }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Reset Graph"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas with Zoom Scale */}
      <div className="w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
        <svg
          viewBox="0 0 1440 900"
          className="w-full h-full select-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
        >
          <defs>
            {/* Glow Filter */}
            <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
            {/* Background Mesh */}
            <pattern id="graphGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#graphGrid)" />

          {/* Links / Bezier Curves */}
          {links.map((link, idx) => {
            const d = getPathD(link.from, link.to);
            const isHigh = hoveredNode === link.from || hoveredNode === link.to || (selectedNode && (selectedNode.id === link.from || selectedNode.id === link.to));
            return (
              <g key={`link-${idx}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={link.color || '#60a5fa'}
                  strokeWidth={isHigh ? 3 : 1.6}
                  strokeDasharray={link.from === 'work' && link.to === 'instance' ? 'none' : '5,5'}
                  opacity={isHigh ? 0.95 : 0.35}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;
            const isActive = isHovered || isSelected;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => setSelectedNode(isSelected ? null : node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Halo / Glow Ring */}
                <circle
                  r={node.r + (isActive ? 12 : 4)}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={isActive ? 2.5 : 1}
                  opacity={isActive ? 0.8 : 0.25}
                  filter={isActive ? 'url(#nodeGlow)' : undefined}
                />

                {/* Main Node Bubble */}
                <circle
                  r={node.r}
                  fill={node.color}
                  opacity={isActive ? 0.95 : 0.8}
                  className="transition-all duration-200"
                />

                {/* Inner darker core */}
                <circle
                  r={node.r * 0.82}
                  fill="#090d16"
                  opacity={0.7}
                />

                {/* Icon & Primary Label */}
                <text
                  textAnchor="middle"
                  y={-node.r * 0.15}
                  fill="#ffffff"
                  fontSize={node.r > 50 ? 14 : 11}
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {node.label}
                </text>

                {/* Sublabel */}
                <text
                  textAnchor="middle"
                  y={node.r * 0.25}
                  fill="#93c5fd"
                  fontSize={node.r > 50 ? 11 : 9}
                  fontWeight="500"
                  pointerEvents="none"
                  opacity={0.9}
                >
                  {node.sublabel.length > 18 ? node.sublabel.substring(0, 16) + '...' : node.sublabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node Inspector Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-30 w-84 max-w-sm rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 p-4 text-xs text-slate-100 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: selectedNode.color }}>
                {selectedNode.icon}
              </div>
              <div>
                <div className="font-bold text-sm text-white">{selectedNode.label}</div>
                <div className="text-[10px] font-mono text-slate-400">{selectedNode.predicate}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 select-all font-sans leading-relaxed" dir="rtl">
            <div className="text-slate-200 text-xs whitespace-pre-wrap">
              {selectedNode.fullText}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {selectedNode.uri ? (
              <a
                href={selectedNode.uri}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-mono text-[11px]"
              >
                Linked URI <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-slate-500 text-[10px]">W3C / BIBFRAME 2.0</span>
            )}
            <button
              onClick={() => handleCopyText(selectedNode.fullText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
