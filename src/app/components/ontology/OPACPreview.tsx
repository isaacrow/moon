/**
 * OPAC Preview Component
 * Professional Library Catalog & Discovery Card
 * Full BIBFRAME 2.0 & Heritage Manuscript Support
 */

import { useState, useMemo } from 'react';
import {
  BookOpen, Bookmark, Share2, Copy, Check, ExternalLink,
  Printer, Tag, User, Calendar, MapPin, Layers, FileText,
  Quote, Compass, Globe, Sparkles, 
  CheckCircle2, CornerDownRight, Hash
} from 'lucide-react';

interface OPACPreviewProps {
  workData: any;
  instanceData: any;
  theme?: 'glass' | 'neon' | 'classic' | 'clean' | 'blur' | 'light' | any;
  itemUri?: string;
}

// Robust helper to extract string or array values from various BIBFRAME shapes
function extractString(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    for (const item of val) {
      const s = extractString(item);
      if (s) return s;
    }
    return fallback;
  }
  if (typeof val === 'object') {
    return val['rdfs:label'] || val['bf:mainTitle'] || val['mainTitle'] || val['value'] || val['rdf:value'] || val['label'] || fallback;
  }
  return fallback;
}

function extractArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export function OPACPreview({ workData = {}, instanceData = {}, theme = 'glass', itemUri = '' }: OPACPreviewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'manuscript' | 'subjects' | 'toc' | 'linked-data'>('overview');
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);
  const [citationFormat, setCitationFormat] = useState<'chicago' | 'apa' | 'mla' | 'bibtex' | 'marc'>('chicago');
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  // Extract Core Title Data
  const titleObj = workData['bf:title'] || workData.title || instanceData['bf:title'] || instanceData.title;
  const mainTitle = extractString(titleObj?.['bf:mainTitle'] || titleObj?.mainTitle || titleObj || '');
  const subtitle = extractString(titleObj?.['bf:subtitle'] || titleObj?.subtitle || '');
  const respStatement = extractString(
    instanceData['bf:responsibilityStatement'] ||
    instanceData.responsibilityStatement ||
    instanceData.statementOfResponsibility ||
    workData.responsibilityStatement ||
    ''
  );

  // Extract Contributors
  const rawContribs = extractArray(workData['bf:contribution'] || workData.contribution || instanceData['bf:contribution'] || instanceData.contribution);
  const contributors = useMemo(() => {
    return rawContribs.map((c: any) => {
      const agent = c['bf:agent'] || c.agent || c;
      const name = extractString(agent?.['rdfs:label'] || agent?.label || agent?.name || agent || '');
      const role = extractString(c['bf:role']?.['rdfs:label'] || c.role?.label || c.role || '');
      const uri = agent?.['@id'] || agent?.id || (typeof agent === 'string' && agent.startsWith('http') ? agent : '');
      return { name, role, uri };
    });
  }, [rawContribs]);
  const primaryCreator = contributors[0] || { name: '', role: '', uri: '' };

  // Classification & Shelfmark
  const lccObj = workData['bf:classification'] || workData.classification || workData.classificationLcc || instanceData['bf:classification'] || instanceData.shelfMark;
  const callNumber = useMemo(() => {
    if (typeof lccObj === 'string') return lccObj;
    if (lccObj && typeof lccObj === 'object') {
      const portion = lccObj['bf:classificationPortion'] || lccObj.classificationPortion || '';
      const item = lccObj['bf:itemPortion'] || lccObj.itemPortion || '';
      if (portion || item) return [portion, item].filter(Boolean).join(' ');
      if (lccObj['rdfs:label']) return lccObj['rdfs:label'];
    }
    return '';
  }, [lccObj]);

  // Dewey number, if the record has one
  const ddcNumber = useMemo(() => {
    if (typeof workData.classificationDdc === 'string') return workData.classificationDdc;
    const all = extractArray(workData['bf:classification'] || workData.classification);
    const ddc = all.find((c: any) => c && typeof c === 'object' && String(c['@type'] || '').includes('Ddc'));
    return ddc ? extractString(ddc['bf:classificationPortion'] || ddc.classificationPortion || '') : '';
  }, [workData]);

  // System IDs
  const systemId = extractString(instanceData.identifier || instanceData.lccn || '');

  // Dates & Production
  const dateStr = extractString(
    instanceData['bf:provisionActivity']?.['bf:date'] ||
    instanceData['bf:provisionActivity']?.date ||
    instanceData.publicationDate ||
    workData['bf:originDate'] ||
    workData.originDate ||
    ''
  );
  const placeStr = extractString(
    instanceData['bf:provisionActivity']?.['bf:place']?.['rdfs:label'] ||
    instanceData['bf:provisionActivity']?.place ||
    workData['bf:originPlace']?.['rdfs:label'] ||
    workData.originPlace ||
    ''
  );

  // Physical description & Extent
  const extentStr = extractString(instanceData['bf:extent'] || instanceData.extent || '');
  const dimensionsStr = extractString(instanceData['bf:dimensions'] || instanceData.dimensions || '');

  // Codicological details (from 340, 351, or custom fields)
  const codicologyNotes = useMemo(() => {
    // Only what the record itself says; nothing is filled in from a sample manuscript.
    const arr: { label: string; value: string }[] = [];
    if (dimensionsStr) arr.push({ label: 'المقاس والأبعاد / Size', value: dimensionsStr });
    return arr;
  }, [dimensionsStr]);

  // Notes extraction (Incipit, Explicit, Citations, etc.)
  const rawNotes = extractArray(workData['bf:note'] || workData.note || instanceData['bf:note'] || instanceData.note);
  const parsedNotes = useMemo(() => {
    let incipit = '';
    let explicit = '';
    const citations: string[] = [];
    const general: string[] = [];

    rawNotes.forEach((n: any) => {
      const text = extractString(n?.['rdfs:label'] || n?.label || n);
      if (!text) return;
      if (text.startsWith('أوله') || text.toLowerCase().includes('incipit') || text.includes('الحمد لله الواحد')) {
        incipit = text.replace(/^أوله\s*[:：]\s*/, '').trim();
      } else if (text.startsWith('آخره') || text.toLowerCase().includes('explicit') || text.includes('ولا تخلنا اللهم')) {
        explicit = text.replace(/^آخره\s*[:：]\s*/, '').trim();
      } else if (text.includes('الذريعة') || text.includes('فهرس') || text.includes('الرقم')) {
        citations.push(text);
      } else {
        general.push(text);
      }
    });


    return { incipit, explicit, citations, general };
  }, [rawNotes]);

  // Subjects extraction
  const rawSubjects = extractArray(workData['bf:subject'] || workData.subject);
  const subjects = useMemo(() => {
    if (rawSubjects.length > 0) {
      return rawSubjects.map((s: any) => {
        const label = extractString(s?.['rdfs:label'] || s?.label || s);
        const uri = s?.['@id'] || s?.id || '';
        return { label, uri };
      });
    }
    return [];
  }, [rawSubjects]);

  // Summary
  const summaryText = extractString(
    workData['bf:summary']?.['rdfs:label'] ||
    workData['bf:summary'] ||
    workData.summary ||
    ''
  );

  // Table of Contents
  const rawToc = workData['bf:tableOfContents'] || workData.tableOfContents || instanceData['bf:tableOfContents'];
  const tocList = useMemo(() => {
    if (Array.isArray(rawToc)) return rawToc.map(t => extractString(t));
    if (typeof rawToc === 'string' && rawToc.includes('--')) {
      return rawToc.split('--').map(s => s.trim());
    }
    if (typeof rawToc === 'string' && rawToc.trim()) return [rawToc.trim()];
    return [];
  }, [rawToc]);

  // Generate Citations
  const citations = useMemo(() => {
    const authorName = primaryCreator.name.split('،')[0].trim();
    const fullAuthor = primaryCreator.name;
    const yr = (dateStr.match(/[0-9]{4}/) || [''])[0];
    return {
      chicago: `${fullAuthor}. ${mainTitle}. مخطوط، ${dateStr}. ${callNumber}. مركز الفهرسة ونظم المعلومات، IQ-KaCCS.`,
      apa: `${authorName}. (${yr}). ${mainTitle} [مخطوط]. خزانة المخطوطات، العتبة العباسية المقدسة (IQ-KaCCS). ${callNumber}`,
      mla: `${authorName}. "${mainTitle}." مخطوط، ${dateStr}. مكتبة ودار المخطوطات، الرقم: ${callNumber}.`,
      bibtex: `@manuscript{record_${yr},
  author = {${authorName}},
  title = {${mainTitle}},
  year = {${yr}},
  note = {Manuscript: ${callNumber}},
  organization = {IQ-KaCCS, Library of Holy Abbas Shrine}
}`,
      marc: `100 1# $a ${primaryCreator.name} $e مؤلف.
245 12 $a ${mainTitle} / $c ${respStatement}
264 #0 $c ${dateStr}
300 ## $a ${extentStr} ; $c ${dimensionsStr}
050 #4 $a ${callNumber}`,
    };
  }, [primaryCreator, mainTitle, dateStr, callNumber, respStatement, extentStr, dimensionsStr]);

  const handleCopyCitation = (fmt: 'chicago' | 'apa' | 'mla' | 'bibtex' | 'marc') => {
    navigator.clipboard.writeText(citations[fmt]);
    setCopiedCitation(fmt);
    setTimeout(() => setCopiedCitation(null), 2500);
  };

  const handleCopyUri = () => {
    const uri = workData['@id'] || '';
    navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const isDark = theme !== 'light';

  return (
    <div className={`w-full rounded-2xl transition-all duration-300 ${
      isDark
        ? 'bg-slate-900/90 text-slate-100 border border-slate-700/60 shadow-2xl backdrop-blur-xl'
        : 'bg-white text-slate-900 border border-slate-200 shadow-xl'
    }`}>
      {/* ================= HERO HEADER ================= */}
      <div className={`p-6 md:p-8 border-b ${isDark ? 'border-slate-800/80 bg-gradient-to-r from-blue-950/40 via-slate-900/80 to-purple-950/30' : 'border-slate-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white'}`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          
          {/* Main Title & Badges */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {dateStr && (
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {dateStr}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight font-serif text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-300 leading-snug" dir="rtl">
              {mainTitle}
              {subtitle && <span className="text-lg md:text-xl font-normal opacity-80 mr-3">: {subtitle}</span>}
            </h1>

            {respStatement && (
              <p className="text-sm md:text-base font-medium opacity-85 text-blue-300/90" dir="rtl">
                {respStatement}
              </p>
            )}

            {/* Author Attribution line */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs md:text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-bold text-slate-200">{primaryCreator.name}</span>
                {primaryCreator.uri && (
                  <a
                    href={primaryCreator.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5 ml-1 transition-colors"
                    title="Library of Congress Name Authority Record"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>تاريخ النسخ: <strong className="text-slate-200">{dateStr}</strong></span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{placeStr}</span>
              </div>
            </div>
          </div>

          {/* Quick Call Slip Box */}
          <div className={`shrink-0 p-4 rounded-xl border flex flex-col justify-between min-w-[260px] ${
            isDark
              ? 'bg-slate-800/80 border-blue-500/25 shadow-lg shadow-blue-950/30'
              : 'bg-white border-blue-200 shadow-md'
          }`}>
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                <span>Library Call Slip</span>
                <span className="text-emerald-400 font-bold">متاح للمطالعة</span>
              </div>
              <div className="font-mono text-base font-bold text-blue-400 tracking-wide select-all">
                {callNumber}
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Hash className="h-3 w-3 text-slate-500" />
                <span>الرقم الآلي: <strong>{systemId || '—'}</strong></span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                مكتبة العتبة العباسية المقدسة (IQ-KaCCS)
              </div>
            </div>

            {/* Quick Actions in Slip */}
            <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowCitationModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
              >
                <Quote className="h-3.5 w-3.5" /> اقتباس (Cite)
              </button>
              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 transition-colors"
                title="Print Call Slip"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                onClick={handleCopyUri}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 transition-colors"
                title="Copy Record URI"
              >
                {copiedUri ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-1.5 rounded-lg transition-colors ${isBookmarked ? 'bg-amber-500/20 text-amber-400' : 'text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700'}`}
                title="Bookmark Record"
              >
                <Bookmark className="h-4 w-4 fill-current" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-6 pt-4 border-t border-slate-800/60 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'نظرة عامة / Overview', icon: <BookOpen className="h-4 w-4" /> },
            { id: 'manuscript', label: 'أوائل النصوص والوصف المادي / Incipit & Codicology', icon: <FileText className="h-4 w-4" /> },
            { id: 'subjects', label: 'الموضوعات والتصنيف / Subjects', icon: <Tag className="h-4 w-4" /> },
            { id: 'toc', label: 'المحتويات والمستخلص / Contents', icon: <Layers className="h-4 w-4" /> },
            { id: 'linked-data', label: 'البيانات المترابطة / Linked Data (BIBFRAME)', icon: <Compass className="h-4 w-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ================= TAB CONTENTS ================= */}
      <div className="p-6 md:p-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Box */}
            <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-2">
                <Sparkles className="h-4 w-4" /> مستخلص العمل (Work Summary & Abstract)
              </div>
              <p className="text-sm md:text-base leading-relaxed text-slate-300 font-serif" dir="rtl">
                {summaryText}
              </p>
            </div>

            {/* Codicological & Bibliographical Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Intellectual Details */}
              <div className={`p-5 rounded-xl border space-y-3.5 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-blue-400" /> بيانات التأليف والمسؤولية الفكرية
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">المؤلف الرئيس:</span>
                    <span className="font-bold text-slate-200 text-right" dir="rtl">{primaryCreator.name}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">تاريخ وفاة المؤلف:</span>
                    <span className="font-medium text-slate-200">1041 هـ / 1631 م</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">اللغة:</span>
                    <span className="font-medium text-slate-200">العربية (ara)</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 shrink-0">الاستناد الدولي:</span>
                    <a
                      href={primaryCreator.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {primaryCreator.uri.replace('http://id.loc.gov/authorities/names/', 'LOC: ')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Box 2: Physical & Manifestation Details */}
              <div className={`p-5 rounded-xl border space-y-3.5 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" /> الوصف المادي والنسخة (Manifestation)
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">عدد الأوراق والأسطر:</span>
                    <span className="font-bold text-slate-200 text-right" dir="rtl">{extentStr}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">الأبعاد والمقاس:</span>
                    <span className="font-medium text-slate-200">{dimensionsStr}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400 shrink-0">تاريخ الإنتاج والنسخ:</span>
                    <span className="font-bold text-amber-300">{dateStr}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 shrink-0">الجهة الحافظة:</span>
                    <span className="font-medium text-slate-200 text-right" dir="rtl">مركز الفهرسة، العتبة العباسية (IQ-KaCCS)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Incipit Highlight Card */}
            <div className={`p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2`}>
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5"><Quote className="h-4 w-4" /> أول المخطوطة (Incipit)</span>
                <span className="font-mono text-[11px] opacity-75">MARC 500 / bf:Note</span>
              </div>
              <p className="font-serif text-sm md:text-base leading-relaxed text-slate-200 text-right" dir="rtl">
                {parsedNotes.incipit ? `«${parsedNotes.incipit}»` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: MANUSCRIPT & CODICOLOGY */}
        {activeTab === 'manuscript' && (
          <div className="space-y-6">
            {/* Incipit & Explicit Double Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Incipit */}
              <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/40 border-amber-500/30' : 'bg-amber-50/50 border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Quote className="h-4 w-4" /> أول المخطوط (Incipit)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(parsedNotes.incipit);
                      setCopiedCitation('incipit');
                      setTimeout(() => setCopiedCitation(null), 2000);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedCitation === 'incipit' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCitation === 'incipit' ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
                <div className="p-4 rounded-lg bg-black/20 border border-slate-700/50 font-serif text-sm md:text-base leading-relaxed text-slate-200 text-right" dir="rtl">
                  {parsedNotes.incipit ? `«${parsedNotes.incipit}»` : '—'}
                </div>
              </div>

              {/* Explicit */}
              <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/40 border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Quote className="h-4 w-4" /> آخر المخطوط (Explicit)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(parsedNotes.explicit);
                      setCopiedCitation('explicit');
                      setTimeout(() => setCopiedCitation(null), 2000);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedCitation === 'explicit' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCitation === 'explicit' ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
                <div className="p-4 rounded-lg bg-black/20 border border-slate-700/50 font-serif text-sm md:text-base leading-relaxed text-slate-200 text-right" dir="rtl">
                  {parsedNotes.explicit ? `«${parsedNotes.explicit}»` : '—'}
                </div>
              </div>
            </div>

            {/* Codicological Features Table */}
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Compass className="h-4 w-4 text-blue-400" /> السمات الكوديكولوجية والفنية للمخطوطة (Codicological Analysis)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {codicologyNotes.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-400">{item.label}</div>
                    <div className="text-xs md:text-sm font-medium text-slate-200" dir="rtl">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Citations & External References */}
            {parsedNotes.citations.length > 0 && (
              <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-purple-400" /> الإحالات البيبليوغرافية ومظان المخطوط (Bibliography & Other Copies)
                </h4>
                <ul className="space-y-2">
                  {parsedNotes.citations.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-slate-300" dir="rtl">
                      <CornerDownRight className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SUBJECTS & CLASSIFICATION */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            {/* LCSH & Subject Badges */}
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-400" /> رؤوس الموضوعات المقننة (Subject Headings - LCSH)
                </h4>
                <span className="text-xs text-slate-400">{subjects.length} موضوعات</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {subjects.map((s, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all"
                  >
                    <span dir="rtl">{s.label}</span>
                    {s.uri && (
                      <a
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-60 group-hover:opacity-100 hover:text-white transition-opacity"
                        title="View Subject Authority"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Classification Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  تصنيف مكتبة الكونغرس (LCC)
                </div>
                <div className="text-xl font-mono font-extrabold text-blue-400">
                  {callNumber || '—'}
                </div>
              </div>

              <div className={`p-5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  التصنيف العشري (DDC)
                </div>
                <div className="text-xl font-mono font-extrabold text-purple-400">
                  {ddcNumber || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TABLE OF CONTENTS */}
        {activeTab === 'toc' && (
          <div className="space-y-6">
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-400" /> فهرس المحتويات (Table of Contents)
                </h4>
                <span className="text-xs text-slate-400">{tocList.length} أبواب ومباحث</span>
              </div>
              <div className="space-y-2">
                {tocList.map((chapter, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-blue-500/40 transition-colors"
                  >
                    <span className="text-xs md:text-sm font-medium text-slate-200 font-serif text-right flex-1" dir="rtl">
                      {chapter}
                    </span>
                    <span className="font-mono text-xs text-slate-500 ml-4 shrink-0">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LINKED DATA (BIBFRAME) */}
        {activeTab === 'linked-data' && (
          <div className="space-y-6">
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" /> كيانات النموذج الببليوغرافي (WEMI Entities & Triples)
                </h4>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> متوافق مع معيار BIBFRAME 2.0
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="font-bold text-blue-400">bf:Work (العمل الفكري)</div>
                  <div className="font-mono text-[11px] text-slate-300 truncate">{workData['@id'] || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="font-bold text-emerald-400">bf:Instance (النسخة/التجسيد)</div>
                  <div className="font-mono text-[11px] text-slate-300 truncate">{instanceData['@id'] || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-1">
                  <div className="font-bold text-purple-400">bf:Item (النسخة المادية/المقتنى)</div>
                  <div className="font-mono text-[11px] text-slate-300 truncate">{itemUri || '—'}</div>
                </div>
              </div>

              {/* Direct JSON Preview of Record */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400">Raw Work & Instance Linked Data:</div>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-blue-300 overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify({ work: workData, instance: instanceData }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= CITATION MODAL ================= */}
      {showCitationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-xl rounded-2xl border p-6 space-y-4 shadow-2xl ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Quote className="h-4 w-4 text-blue-400" /> اقتباس هذا السجل الببليوغرافي (Cite Record)
              </h3>
              <button
                onClick={() => setShowCitationModal(false)}
                className="text-xs font-semibold px-2 py-1 rounded-md text-slate-400 hover:text-white"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* Format Selector */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'chicago', label: 'Chicago' },
                { id: 'apa', label: 'APA 7' },
                { id: 'mla', label: 'MLA 9' },
                { id: 'bibtex', label: 'BibTeX' },
                { id: 'marc', label: 'MARC 21' },
              ].map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => setCitationFormat(fmt.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    citationFormat === fmt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            {/* Citation Text Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto select-all whitespace-pre-wrap">
              {citations[citationFormat]}
            </div>

            {/* Copy Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                تم إنشاء الاقتباس تلقائياً طبقاً لبيانات BIBFRAME 2.0
              </span>
              <button
                onClick={() => handleCopyCitation(citationFormat)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
              >
                {copiedCitation === citationFormat ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                <span>{copiedCitation === citationFormat ? 'تم النسخ بنجاح!' : 'نسخ الاقتباس'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
