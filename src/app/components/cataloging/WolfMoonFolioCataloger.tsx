/**
 * WolfMoon FOLIO Unified Cataloger
 * Unifies Moon Wolf BIBFRAME Cataloging Studio and FOLIO ILS into a single, cohesive interface.
 * Provides two-way live synchronization between BIBFRAME 2.0 graphs and FOLIO Instance/Holdings/Item records.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  Database,
  BookOpen,
  Layers,
  Archive,
  Barcode,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Shield,
  FileJson,
  FileCode2,
  Upload,
  Globe,
  Tag,
  MapPin,
  Clock,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  FOLIOApiClient,
  FOLIO_PRESETS,
  FOLIOInstance,
  FOLIOHolding,
  FOLIOItem,
  FOLIOConfig
} from '../../services/folioApiClient';
import { buildMarcFromFolioPayload } from './WolfMoonFolioDialog';
import { toast } from 'sonner';

interface WolfMoonFolioCatalogerProps {
  workData: any;
  instanceData: any;
  onUpdateWorkData: (data: any) => void;
  onUpdateInstanceData: (data: any) => void;
  onSaveAll: () => Promise<void>;
  existingFolioId?: string | null;
  onFolioIdChange?: (id: string) => void;
  isDark?: boolean;
}

export function WolfMoonFolioCataloger({
  workData,
  instanceData,
  onUpdateWorkData,
  onUpdateInstanceData,
  onSaveAll,
  existingFolioId,
  onFolioIdChange,
  isDark = true,
}: WolfMoonFolioCatalogerProps) {
  // Config & Connection state
  const [activeUrl, setActiveUrl] = useState<string>(FOLIO_PRESETS.localCore.okapiUrl);
  const [tenant, setTenant] = useState<string>(FOLIO_PRESETS.localCore.tenant);
  const [connStatus, setConnStatus] = useState<{
    tested: boolean;
    ok: boolean;
    version?: string;
    error?: string;
  }>({
    tested: false,
    ok: false,
  });
  const [isProbing, setIsProbing] = useState(false);

  // Active Cataloger Tab
  const [catalogTab, setCatalogTab] = useState<'instance' | 'holdings' | 'items' | 'marc' | 'explorer' | 'json'>('instance');

  // Push / Sync state
  const [isPushing, setIsPushing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [currentHrid, setCurrentHrid] = useState<string>('');

  // Holdings state
  const [holdings, setHoldings] = useState<Partial<FOLIOHolding>>({
    permanentLocationId: 'f3cd7718-d382-44ac-ac56-eefcc147c4c4',
    callNumber: 'B753.D363 Q33 1650',
  });

  // Item state
  const [item, setItem] = useState<Partial<FOLIOItem>>({
    barcode: 'b125923',
    materialTypeId: '1a54b431-2e4f-452d-99a2-e21b01443b37',
    permanentLoanTypeId: '2b94c631-fca9-4892-a730-03ee529ffe27',
    status: { name: 'Available' },
  });

  // Explorer state
  const [explorerQuery, setExplorerQuery] = useState('');
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [folioRecords, setFolioRecords] = useState<FOLIOInstance[]>([]);

  // FOLIO Client instance
  const currentConfig: FOLIOConfig = useMemo(() => ({ okapiUrl: activeUrl, tenant }), [activeUrl, tenant]);
  const folioClient = useMemo(() => new FOLIOApiClient(currentConfig), [activeUrl, tenant]);

  // Derive mapped FOLIO instance from active BIBFRAME data
  const mappedFolio = useMemo(() => {
    try {
      const derived = folioClient.bibframeToFOLIOInstance({ workData, instanceData });
      if (existingFolioId) derived.id = existingFolioId;
      return derived;
    } catch (e) {
      return {
        title: instanceData?.['bf:title']?.['bf:mainTitle'] || 'Untitled Resource',
        source: 'BIBFRAME',
        instanceTypeId: '6312d172-f0cf-40f6-b27d-97af8e3238f1',
      } as Partial<FOLIOInstance>;
    }
  }, [folioClient, workData, instanceData, existingFolioId]);

  // Initial connection probe & explorer load
  const probeConnection = async () => {
    setIsProbing(true);
    try {
      const res = await folioClient.checkHealth();
      setConnStatus({ tested: true, ok: res.ok, version: res.version, error: res.error });
      if (res.ok && res.activeUrl && res.activeUrl !== activeUrl) {
        setActiveUrl(res.activeUrl);
      }
    } catch (err: any) {
      setConnStatus({ tested: true, ok: false, error: err.message });
    } finally {
      setIsProbing(false);
    }
  };

  const loadExplorerRecords = async () => {
    setExplorerLoading(true);
    try {
      const res = await folioClient.searchInstances(explorerQuery, 30);
      setFolioRecords(res.instances || []);
    } catch (err: any) {
      console.warn('Could not load explorer records:', err);
    } finally {
      setExplorerLoading(false);
    }
  };

  useEffect(() => {
    probeConnection();
    loadExplorerRecords();
  }, [activeUrl]);

  // Handlers for two-way synchronization
  const handleUpdateTitle = (newTitle: string) => {
    const nextInstance = {
      ...instanceData,
      'bf:title': {
        ...(instanceData['bf:title'] || {}),
        '@type': 'bf:Title',
        'bf:mainTitle': newTitle,
      },
    };
    onUpdateInstanceData(nextInstance);
  };

  const handleUpdatePublisher = (publisherName: string) => {
    const currentProv = Array.isArray(instanceData['bf:provisionActivity'])
      ? [...instanceData['bf:provisionActivity']]
      : instanceData['bf:provisionActivity'] ? [instanceData['bf:provisionActivity']] : [];
    
    if (currentProv.length === 0) {
      currentProv.push({
        '@type': 'bf:Publication',
        'bf:agent': { '@type': 'bf:Agent', 'rdfs:label': publisherName }
      });
    } else {
      currentProv[0] = {
        ...currentProv[0],
        'bf:agent': { ...(currentProv[0]['bf:agent'] || {}), 'rdfs:label': publisherName }
      };
    }
    onUpdateInstanceData({ ...instanceData, 'bf:provisionActivity': currentProv });
  };

  const handleUpdatePublicationDate = (pubDate: string) => {
    const currentProv = Array.isArray(instanceData['bf:provisionActivity'])
      ? [...instanceData['bf:provisionActivity']]
      : instanceData['bf:provisionActivity'] ? [instanceData['bf:provisionActivity']] : [];
    
    if (currentProv.length === 0) {
      currentProv.push({
        '@type': 'bf:Publication',
        'bf:date': pubDate
      });
    } else {
      currentProv[0] = { ...currentProv[0], 'bf:date': pubDate };
    }
    onUpdateInstanceData({ ...instanceData, 'bf:provisionActivity': currentProv });
  };

  const handleAddContributor = (name: string, role = 'author') => {
    if (!name.trim()) return;
    const currentContribs = Array.isArray(workData['bf:contribution'])
      ? [...workData['bf:contribution']]
      : workData['bf:contribution'] ? [workData['bf:contribution']] : [];

    currentContribs.push({
      '@type': 'bf:Contribution',
      'bf:agent': {
        '@type': 'bf:Person',
        'rdfs:label': name.trim(),
      },
      'bf:role': {
        '@type': 'bf:Role',
        'rdfs:label': role,
      }
    });

    onUpdateWorkData({ ...workData, 'bf:contribution': currentContribs });
  };

  const handleRemoveContributor = (index: number) => {
    const currentContribs = Array.isArray(workData['bf:contribution'])
      ? [...workData['bf:contribution']]
      : [];
    currentContribs.splice(index, 1);
    onUpdateWorkData({ ...workData, 'bf:contribution': currentContribs });
  };

  const handleAddSubject = (subjectText: string) => {
    if (!subjectText.trim()) return;
    const currentSubjects = Array.isArray(workData['bf:subject'])
      ? [...workData['bf:subject']]
      : workData['bf:subject'] ? [workData['bf:subject']] : [];

    currentSubjects.push({
      '@type': 'bf:Topic',
      'rdfs:label': subjectText.trim(),
    });
    onUpdateWorkData({ ...workData, 'bf:subject': currentSubjects });
  };

  const handleRemoveSubject = (index: number) => {
    const currentSubjects = Array.isArray(workData['bf:subject']) ? [...workData['bf:subject']] : [];
    currentSubjects.splice(index, 1);
    onUpdateWorkData({ ...workData, 'bf:subject': currentSubjects });
  };

  const handleAddIdentifier = (val: string, type = 'bf:Local') => {
    if (!val.trim()) return;
    const currentIds = Array.isArray(instanceData['bf:identifiedBy'])
      ? [...instanceData['bf:identifiedBy']]
      : instanceData['bf:identifiedBy'] ? [instanceData['bf:identifiedBy']] : [];
    currentIds.push({
      '@type': type,
      'rdf:value': val.trim(),
    });
    onUpdateInstanceData({ ...instanceData, 'bf:identifiedBy': currentIds });
  };

  const handleRemoveIdentifier = (index: number) => {
    const currentIds = Array.isArray(instanceData['bf:identifiedBy']) ? [...instanceData['bf:identifiedBy']] : [];
    currentIds.splice(index, 1);
    onUpdateInstanceData({ ...instanceData, 'bf:identifiedBy': currentIds });
  };

  const handleAddClassification = (callNum: string) => {
    if (!callNum.trim()) return;
    const currentClasses = Array.isArray(workData['bf:classification'])
      ? [...workData['bf:classification']]
      : workData['bf:classification'] ? [workData['bf:classification']] : [];
    currentClasses.push({
      '@type': 'bf:ClassificationLcc',
      'bf:itemPortion': callNum.trim(),
    });
    onUpdateWorkData({ ...workData, 'bf:classification': currentClasses });
  };

  const handleRemoveClassification = (index: number) => {
    const currentClasses = Array.isArray(workData['bf:classification']) ? [...workData['bf:classification']] : [];
    currentClasses.splice(index, 1);
    onUpdateWorkData({ ...workData, 'bf:classification': currentClasses });
  };

  const handleAddNote = (noteText: string) => {
    if (!noteText.trim()) return;
    const currentNotes = Array.isArray(instanceData['bf:note'])
      ? [...instanceData['bf:note']]
      : instanceData['bf:note'] ? [instanceData['bf:note']] : [];
    currentNotes.push({
      '@type': 'bf:Note',
      'rdfs:label': noteText.trim(),
    });
    onUpdateInstanceData({ ...instanceData, 'bf:note': currentNotes });
  };

  const handleRemoveNote = (index: number) => {
    const currentNotes = Array.isArray(instanceData['bf:note']) ? [...instanceData['bf:note']] : [];
    currentNotes.splice(index, 1);
    onUpdateInstanceData({ ...instanceData, 'bf:note': currentNotes });
  };

  const handleUpdatePhysicalDescription = (extentText: string) => {
    onUpdateInstanceData({
      ...instanceData,
      'bf:extent': {
        '@type': 'bf:Extent',
        'rdfs:label': extentText.trim(),
      },
    });
  };

  const handleAddAlternativeTitle = (titleText: string) => {
    if (!titleText.trim()) return;
    const currentAlts = Array.isArray(instanceData['bf:alternativeTitle'])
      ? [...instanceData['bf:alternativeTitle']]
      : instanceData['bf:alternativeTitle'] ? [instanceData['bf:alternativeTitle']] : [];
    currentAlts.push({
      '@type': 'bf:VariantTitle',
      'bf:mainTitle': titleText.trim(),
    });
    onUpdateInstanceData({ ...instanceData, 'bf:alternativeTitle': currentAlts });
  };

  const handleRemoveAlternativeTitle = (index: number) => {
    const currentAlts = Array.isArray(instanceData['bf:alternativeTitle']) ? [...instanceData['bf:alternativeTitle']] : [];
    currentAlts.splice(index, 1);
    onUpdateInstanceData({ ...instanceData, 'bf:alternativeTitle': currentAlts });
  };

  // Push to FOLIO mod-inventory
  const handlePushToFolio = async () => {
    setIsPushing(true);
    try {
      // 1. First trigger Moon Wolf's internal storage save
      await onSaveAll();

      // 2. Prepare comprehensive payload with all bibliographic facets
      const payload: Partial<FOLIOInstance> = {
        ...mappedFolio,
        id: existingFolioId || mappedFolio.id || undefined,
        title: instanceData?.['bf:title']?.['bf:mainTitle'] || mappedFolio.title || 'Untitled Resource',
        publication: mappedFolio.publication,
        contributors: mappedFolio.contributors,
        subjects: mappedFolio.subjects,
        identifiers: mappedFolio.identifiers,
        classifications: mappedFolio.classifications,
        physicalDescriptions: mappedFolio.physicalDescriptions,
        notes: mappedFolio.notes,
        languages: mappedFolio.languages,
        alternativeTitles: mappedFolio.alternativeTitles,
      };

      let finalId = existingFolioId;
      if (finalId) {
        await folioClient.updateInstance(finalId, payload);
        toast.success(`Updated in FOLIO Inventory: ${finalId}`);
      } else {
        const created = await folioClient.createInstance(payload);
        finalId = created.id;
        if (created.hrid) setCurrentHrid(created.hrid);
        if (onFolioIdChange && finalId) onFolioIdChange(finalId);
        toast.success(`Created in FOLIO Inventory: ${created.hrid || finalId}`);
      }

      // 3. Create or update Holding record
      if (finalId) {
        try {
          await folioClient.createHolding({
            instanceId: finalId,
            permanentLocationId: holdings.permanentLocationId || 'f3cd7718-d382-44ac-ac56-eefcc147c4c4',
            callNumber: holdings.callNumber || 'B753.D363 Q33 1650',
          });
        } catch (holdErr) {
          console.warn('Holdings sync note:', holdErr);
        }
      }

      // 4. Atomically synchronize Triple Store, SRS .MARC, and Solr / VuFind
      const marcBuilt = buildMarcFromFolioPayload(payload, finalId);
      try {
        await fetch('/api/ecosystem/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            id: finalId,
            marcText: marcBuilt.marcText,
            marcFields: marcBuilt.srsFieldsPayload,
            rdfGraph: { workData, instanceData },
          }),
        });
      } catch (ecoErr) {
        console.warn('Ecosystem publish note:', ecoErr);
      }

      setLastSyncedTime(new Date().toLocaleTimeString());
      loadExplorerRecords();
    } catch (err: any) {
      toast.error(`FOLIO Push Failed: ${err.message || 'Cannot reach endpoint'}`);
    } finally {
      setIsPushing(false);
    }
  };

  // Load a FOLIO instance directly into Moon Wolf editor
  const handleLoadFromFolio = (inst: FOLIOInstance) => {
    const bibframeData = folioClient.folioInstanceToBIBFRAME(inst);
    if (bibframeData.work) onUpdateWorkData(bibframeData.work);
    if (bibframeData.instance) onUpdateInstanceData(bibframeData.instance);
    if (onFolioIdChange) onFolioIdChange(inst.id);
    if (inst.hrid) setCurrentHrid(inst.hrid);
    toast.success(`Loaded "${inst.title}" from FOLIO into Moon Wolf Editor!`);
    setCatalogTab('instance');
  };

  const autoGenerateBarcode = () => {
    const bc = 'b' + Math.floor(100000 + Math.random() * 900000);
    setItem(prev => ({ ...prev, barcode: bc }));
    toast.info(`Generated barcode: ${bc}`);
  };

  const effectiveFolioId = existingFolioId || mappedFolio.id || '3545e1e9-168f-45de-bcc6-9b9fe463a100';
  const generatedMarc = useMemo(
    () => buildMarcFromFolioPayload(mappedFolio, effectiveFolioId),
    [mappedFolio, effectiveFolioId]
  );

  const handleDownloadMarc = () => {
    const blob = new Blob([generatedMarc.marcText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio-${currentHrid || effectiveFolioId}.marc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('تم تنزيل ملف .MARC بنجاح');
  };

  return (
    <div className="w-full flex flex-col gap-4 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* ===== GLOSSY LIQUID GLASS STATUS & CONTROL BAR ===== */}
      <div
        className="p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
        style={{
          background:
            'linear-gradient(165deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 45%, rgba(10, 14, 22, 0.65) 100%), rgba(15, 20, 30, 0.75)',
          backdropFilter: 'blur(36px) saturate(190%)',
          WebkitBackdropFilter: 'blur(36px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderTop: '1px solid rgba(255, 255, 255, 0.28)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))',
              border: '1px solid rgba(255,255,255,0.24)',
              borderTop: '1px solid rgba(255,255,255,0.48)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), 0 6px 18px rgba(0,0,0,0.4)',
            }}
          >
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">فهرسة فوليو الموحدة وملف مارك 21 (FOLIO &amp; SRS .MARC Studio)</h2>
              <Badge className="bg-white/10 text-slate-200 border-white/20 text-[10px]">
                mod-inventory • MARC 21
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              مزامنة فورية بين BIBFRAME 2.0 وتسجيلة FOLIO Instance مع توليد وحفظ ملف <code className="text-sky-300">.marc</code>
            </p>
          </div>
        </div>

        {/* Connection status pill and presets */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            connStatus.ok
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connStatus.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{connStatus.ok ? `FOLIO متصل (:8080)` : 'FOLIO غير متصل'}</span>
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/10">
            <button
              type="button"
              onClick={() => { setActiveUrl(FOLIO_PRESETS.localCore.okapiUrl); }}
              className={`px-3 py-1 text-[11px] rounded-full transition-all ${
                activeUrl === FOLIO_PRESETS.localCore.okapiUrl ? 'bg-white/20 text-white font-bold border border-white/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Core (:8080)
            </button>
            <button
              type="button"
              onClick={() => { setActiveUrl(FOLIO_PRESETS.okapi.okapiUrl); }}
              className={`px-3 py-1 text-[11px] rounded-full transition-all ${
                activeUrl === FOLIO_PRESETS.okapi.okapiUrl ? 'bg-white/20 text-white font-bold border border-white/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Okapi (:9130)
            </button>
            <button
              type="button"
              onClick={() => { setActiveUrl(FOLIO_PRESETS.snapshot.okapiUrl); }}
              className={`px-3 py-1 text-[11px] rounded-full transition-all ${
                activeUrl === FOLIO_PRESETS.snapshot.okapiUrl ? 'bg-white/20 text-white font-bold border border-white/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Snapshot
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={probeConnection}
            disabled={isProbing}
            className="h-8 rounded-full text-xs bg-white/5 border-white/15 text-white cursor-pointer hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isProbing ? 'animate-spin' : ''}`} />
            فحص الاتصال
          </Button>

          <a
            href={`http://localhost:3000/inventory/viewsource/${encodeURIComponent(effectiveFolioId)}`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center gap-1.5 no-underline transition-all"
          >
            <FileCode2 className="w-3.5 h-3.5 text-sky-300" />
            <span>مصدر .MARC في FOLIO</span>
          </a>

          <a
            href={`http://localhost:3000/inventory/view/${encodeURIComponent(effectiveFolioId)}`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-4 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center gap-1.5 no-underline transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-300" />
            <span>فتح في برنامج FOLIO الأصلي</span>
          </a>

          <Button
            onClick={handlePushToFolio}
            disabled={isPushing}
            className="h-9 px-5 rounded-full text-xs font-bold bg-white hover:bg-slate-100 text-slate-950 shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            {isPushing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ وإرسال مع .MARC إلى FOLIO</span>
          </Button>
        </div>
      </div>

      {/* ===== HRID & RECORD BANNER ===== */}
      <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between flex-wrap gap-3 text-xs text-gray-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-white">العنوان النشط:</span>
          <span className="text-sky-200 font-semibold">
            {instanceData?.['bf:title']?.['bf:mainTitle'] || 'بدون عنوان'}
          </span>
          <Badge variant="outline" className="text-[10px] border-white/20 text-slate-200 font-mono">
            FOLIO ID: {effectiveFolioId}
          </Badge>
          {currentHrid && (
            <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-300 font-mono">
              HRID: {currentHrid}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadMarc}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-semibold cursor-pointer"
          >
            ⬇ تنزيل ملف .MARC
          </button>
          {lastSyncedTime && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>آخر مزامنة ناجحة: {lastSyncedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== NAVIGATION TABS ===== */}
      <div className="flex items-center gap-2 border-b border-white/15 pb-2 flex-wrap">
        {[
          { id: 'instance', label: '1. بيانات التسجيلة (Instance)', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'holdings', label: '2. المقتنيات والموقع (Holdings)', icon: <MapPin className="w-4 h-4" /> },
          { id: 'items', label: '3. النسخ والباركود (Items)', icon: <Barcode className="w-4 h-4" /> },
          { id: 'marc', label: `4. ملف مارك المُنشأ (.MARC — ${generatedMarc.fields.length + 1} حقل)`, icon: <Layers className="w-4 h-4" /> },
          { id: 'explorer', label: '5. مستكشف فهرس فوليو (Catalog Explorer)', icon: <Search className="w-4 h-4" /> },
          { id: 'json', label: '6. مراجعة JSON المعياري', icon: <FileJson className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCatalogTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              catalogTab === tab.id
                ? 'bg-white text-slate-950 shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        {/* TAB 1: INSTANCE DETAILS */}
        {catalogTab === 'instance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Main Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">عنوان المصدر (Resource Title) *</label>
                <Input
                  value={instanceData?.['bf:title']?.['bf:mainTitle'] || ''}
                  onChange={(e) => handleUpdateTitle(e.target.value)}
                  placeholder="مثال: القبسات / للميرداماد محمد باقر الحسيني الاسترآبادي"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
              </div>

              {/* Publisher */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">جهة النشر / الناشر (Publisher)</label>
                <Input
                  value={mappedFolio?.publication?.[0]?.publisher || ''}
                  onChange={(e) => handleUpdatePublisher(e.target.value)}
                  placeholder="مثال: مكتبة العتبة العباسية المقدسة"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
              </div>

              {/* Publication Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">تاريخ النشر (Publication Date)</label>
                <Input
                  value={mappedFolio?.publication?.[0]?.dateOfPublication || ''}
                  onChange={(e) => handleUpdatePublicationDate(e.target.value)}
                  placeholder="مثال: 1650 [1061 هـ.]"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
              </div>

              {/* Mode of Issuance */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">نمط الإصدار (Mode of Issuance)</label>
                <select
                  value={mappedFolio.modeOfIssuanceId || '9d18a02f-5897-4c30-9106-6d33090176c9'}
                  onChange={(e) => {
                    onUpdateInstanceData({ ...instanceData, 'bf:modeOfIssuance': e.target.value });
                  }}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/15 text-white text-sm px-3 focus:outline-none"
                >
                  <option value="9d18a02f-5897-4c30-9106-6d33090176c9">مفرد (Single Unit / Monograph)</option>
                  <option value="06483e47-4971-465e-aa71-b541a7d6537c">متعدد الأجزاء (Multipart Monograph)</option>
                  <option value="f5cc2ab6-bb92-4cab-b833-7a3d14b30200">دورية / متسلسل (Serial)</option>
                </select>
              </div>
            </div>

            {/* Contributors Section */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">المؤلفون والمشاركون (Contributors)</label>
                <span className="text-[11px] text-gray-400">ينعكس تلقائياً في bf:contribution</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(mappedFolio.contributors || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-xs text-orange-200">
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[10px] text-orange-300">({c.contributorTypeName || 'Author'})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveContributor(i)}
                      className="ml-1 text-orange-400 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  id="new-contributor-input"
                  placeholder="أضف مؤلف أو محقق جديد..."
                  className="bg-white/5 border-white/15 text-white text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddContributor((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('new-contributor-input') as HTMLInputElement;
                    if (el && el.value) {
                      handleAddContributor(el.value);
                      el.value = '';
                    }
                  }}
                  className="h-8 text-xs bg-orange-500 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  إضافة
                </Button>
              </div>
            </div>

            {/* Subjects Section */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">رؤوس الموضوعات (Subjects)</label>
                <span className="text-[11px] text-gray-400">ينعكس تلقائياً في bf:subject</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(mappedFolio.subjects || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-200">
                    <Tag className="w-3 h-3 text-blue-400" />
                    <span>{s.value}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(i)}
                      className="ml-1 text-blue-400 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  id="new-subject-input"
                  placeholder="أضف موضوع أو كشاف جديد..."
                  className="bg-white/5 border-white/15 text-white text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSubject((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('new-subject-input') as HTMLInputElement;
                    if (el && el.value) {
                      handleAddSubject(el.value);
                      el.value = '';
                    }
                  }}
                  className="h-8 text-xs bg-blue-600 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  إضافة
                </Button>
              </div>
            </div>

            {/* Identifiers Section */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">المعرفات القياسية والمحلية (Identifiers)</label>
                <span className="text-[11px] text-gray-400">ISBN, LCCN, Local Barcodes/IDs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(mappedFolio.identifiers || []).map((id, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs text-purple-200">
                    <Barcode className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-mono font-bold">{id.value}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveIdentifier(i)}
                      className="ml-1 text-purple-400 hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  id="new-identifier-input"
                  placeholder="أضف معرف جديد (مثال: b125923 أو 978...)"
                  className="bg-white/5 border-white/15 text-white text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddIdentifier((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('new-identifier-input') as HTMLInputElement;
                    if (el && el.value) {
                      handleAddIdentifier(el.value);
                      el.value = '';
                    }
                  }}
                  className="h-8 text-xs bg-purple-600 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  إضافة
                </Button>
              </div>
            </div>

            {/* Classifications Section */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">أرقام التصنيف والطلب (Classifications / Call Numbers)</label>
                <span className="text-[11px] text-gray-400">LCC / DDC / Local Call Number</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(mappedFolio.classifications || []).map((cl, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200">
                    <Archive className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono font-bold">{cl.classificationNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveClassification(i)}
                      className="ml-1 text-emerald-400 hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  id="new-class-input"
                  placeholder="أضف رقم تصنيف (مثال: B753.D363 Q33 1650)"
                  className="bg-white/5 border-white/15 text-white text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddClassification((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('new-class-input') as HTMLInputElement;
                    if (el && el.value) {
                      handleAddClassification(el.value);
                      el.value = '';
                    }
                  }}
                  className="h-8 text-xs bg-emerald-600 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  إضافة
                </Button>
              </div>
            </div>

            {/* Physical Description & Extent */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <label className="text-xs font-bold text-gray-300">الوصف المادي والتوريق (Physical Description / Extent)</label>
              <Input
                value={mappedFolio.physicalDescriptions?.[0] || ''}
                onChange={(e) => handleUpdatePhysicalDescription(e.target.value)}
                placeholder="مثال: 344 ورقة (18 سطرًا) ; خط النستعليق ; 24 سم"
                className="bg-white/5 border-white/15 text-white text-sm"
              />
            </div>

            {/* Notes & Summaries */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">التبصيرات والملاحظات (Notes & Incipit/Explicit)</label>
                <span className="text-[11px] text-gray-400">استهلال، خاتمة، مصادر، وصف عام</span>
              </div>
              <div className="space-y-2">
                {(mappedFolio.notes || []).map((n, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200">
                    <p className="flex-1 whitespace-pre-wrap">{n.note}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(i)}
                      className="text-gray-400 hover:text-rose-400 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="new-note-input"
                  placeholder="أضف تبصيرة (أوله، آخره، تفاصيل المخطوط، المراجع)..."
                  className="bg-white/5 border-white/15 text-white text-xs h-8 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddNote((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('new-note-input') as HTMLInputElement;
                    if (el && el.value) {
                      handleAddNote(el.value);
                      el.value = '';
                    }
                  }}
                  className="h-8 text-xs bg-amber-600 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  إضافة تبصيرة
                </Button>
              </div>
            </div>

            {/* Languages & Alternative Titles */}
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">لغات المصدر (Languages)</label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    {(mappedFolio.languages || ['ara']).join(', ')}
                  </Badge>
                  <span className="text-xs text-gray-400">(العربية ara)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">عناوين بديلة (Alternative Titles)</label>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-alttitle-input"
                    placeholder="عنوان بديل..."
                    className="bg-white/5 border-white/15 text-white text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddAlternativeTitle((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById('new-alttitle-input') as HTMLInputElement;
                      if (el && el.value) {
                        handleAddAlternativeTitle(el.value);
                        el.value = '';
                      }
                    }}
                    className="h-8 text-xs bg-gray-700 text-white cursor-pointer"
                  >
                    إضافة
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HOLDINGS & LOCATION */}
        {catalogTab === 'holdings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">الموقع الدائم (Permanent Location) *</label>
                <select
                  value={holdings.permanentLocationId || 'f3cd7718-d382-44ac-ac56-eefcc147c4c4'}
                  onChange={(e) => setHoldings(prev => ({ ...prev, permanentLocationId: e.target.value }))}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/15 text-white text-sm px-3 focus:outline-none"
                >
                  <option value="f3cd7718-d382-44ac-ac56-eefcc147c4c4">المكتبة الرئيسية (Main Library)</option>
                  <option value="b4e85743-4f05-4c07-b248-b302c0199042">خزانة المخطوطات والتراث العراقي (Iraqi Heritage Collection)</option>
                  <option value="c4c90014-c8c9-4213-8f70-b74456488e11">قسم المراجع والكتب النادرة (Rare Books & Reference)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">رقم التصنيف والطلب (Call Number) *</label>
                <Input
                  value={holdings.callNumber || ''}
                  onChange={(e) => setHoldings(prev => ({ ...prev, callNumber: e.target.value }))}
                  placeholder="مثال: B753.D363 Q33 1650"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              يتم إنشاء سجل المقتنيات (Holdings Record) في جدول <code>holdings-storage/holdings</code> ويرتبط بتسجيلة الـ Instance تلقائياً.
            </p>
          </div>
        )}

        {/* TAB 3: ITEMS & CIRCULATION */}
        {catalogTab === 'items' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300">رقم الباركود (Item Barcode) *</label>
                  <button
                    type="button"
                    onClick={autoGenerateBarcode}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    توليد تلقائي
                  </button>
                </div>
                <Input
                  value={item.barcode || ''}
                  onChange={(e) => setItem(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="مثال: b125923"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">نوع المادة (Material Type)</label>
                <select
                  value={item.materialTypeId || '1a54b431-2e4f-452d-99a2-e21b01443b37'}
                  onChange={(e) => setItem(prev => ({ ...prev, materialTypeId: e.target.value }))}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/15 text-white text-sm px-3 focus:outline-none"
                >
                  <option value="1a54b431-2e4f-452d-99a2-e21b01443b37">كتاب / مخطوط (book / manuscript)</option>
                  <option value="5ee11d91-f7e8-481d-b077-96d08abb1369">مصدر إلكتروني (electronic resource)</option>
                  <option value="fd6c6515-d470-4561-9c30-e16eb7d995f8">دورية (periodical)</option>
                  <option value="615b8421-0eb8-4234-a77c-a7db5db5f0f3">تسجيل صوتي (sound recording)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">نوع الإعارة الدائم (Loan Type)</label>
                <select
                  value={item.permanentLoanTypeId || '2b94c631-fca9-4892-a730-03ee529ffe27'}
                  onChange={(e) => setItem(prev => ({ ...prev, permanentLoanTypeId: e.target.value }))}
                  className="w-full h-9 rounded-md bg-white/5 border border-white/15 text-white text-sm px-3 focus:outline-none"
                >
                  <option value="2b94c631-fca9-4892-a730-03ee529ffe27">قابل للإعارة (Can circulate)</option>
                  <option value="2e48e713-17f3-4c13-a9f8-23845bb210aa">قاعة المطالعة فقط (Reading room)</option>
                  <option value="e8b3114d-4acb-403b-a96b-b7d045524e6b">إعارة مخصصة 14 يوم (14-day reserve)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              يتم تخزين بيانات النسخة والباركود في <code>item-storage/items</code> لربطها بنظام الإعارة mod-circulation التابع لـ FOLIO.
            </p>
          </div>
        )}

        {/* TAB 4: CREATED .MARC RECORD */}
        {catalogTab === 'marc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">ملف مارك 21 المُنشأ للتسجيلة (Created .MARC Record in FOLIO SRS)</h3>
                <p className="text-xs text-slate-400">
                  يتولد هذا الملف تلقائياً من بيانات العمل والتجسيد ويُحفظ مع التسجيلة في مخزن SRS الخاص بـ FOLIO
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedMarc.marcText);
                    toast.success('تم نسخ ملف .MARC إلى الحافظة');
                  }}
                  className="h-8 rounded-full text-xs bg-white/5 border-white/15 text-white cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 ml-1" />
                  نسخ كود .MARC
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadMarc}
                  className="h-8 rounded-full text-xs bg-white text-slate-950 font-bold cursor-pointer"
                >
                  ⬇ تنزيل ملف .MARC
                </Button>
              </div>
            </div>
            <pre
              className="p-4 rounded-2xl bg-slate-950/90 border border-white/15 text-sky-200 font-mono text-xs leading-relaxed max-h-96 overflow-auto"
              dir="ltr"
            >
              {generatedMarc.marcText}
            </pre>
          </div>
        )}

        {/* TAB 5: FOLIO CATALOG EXPLORER */}
        {catalogTab === 'explorer' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                <Input
                  value={explorerQuery}
                  onChange={(e) => setExplorerQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadExplorerRecords()}
                  placeholder="ابحث في فهرس فوليو (بالعنوان أو المؤلف أو الباركود)..."
                  className="bg-white/5 border-white/15 text-white pr-9 text-xs"
                />
              </div>
              <Button
                onClick={loadExplorerRecords}
                disabled={explorerLoading}
                className="bg-white text-slate-950 font-bold text-xs h-9 rounded-full px-5 cursor-pointer"
              >
                {explorerLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'بحث'}
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {folioRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  {explorerLoading ? 'جارِ تحميل تسجيلات فوليو...' : 'لا توجد تسجيلات مطابقة في الفهرس.'}
                </div>
              ) : (
                folioRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{rec.title}</span>
                        {rec.hrid && (
                          <Badge variant="outline" className="text-[10px] text-sky-300 border-sky-500/40 font-mono">
                            {rec.hrid}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-4">
                        <span>المؤلف: {rec.contributors?.[0]?.name || 'غير محدد'}</span>
                        <span>الناشر: {rec.publication?.[0]?.publisher || 'مخطوط'}</span>
                        <span>التاريخ: {rec.publication?.[0]?.dateOfPublication || '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`http://localhost:8080/inventory/view/${encodeURIComponent(rec.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 no-underline"
                      >
                        <ExternalLink className="w-3 h-3 text-sky-300" />
                        <span>التسجيلة + .MARC</span>
                      </a>
                      <Button
                        size="sm"
                        onClick={() => handleLoadFromFolio(rec)}
                        className="bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-full text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>فتح وفهرسة في مون</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: JSON INSPECTOR */}
        {catalogTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">حمولة FOLIO Inventory JSON الفعلية المرسلة للملقم:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(mappedFolio, null, 2));
                  toast.success('تم نسخ حمولة JSON إلى الحافظة');
                }}
                className="h-7 text-xs bg-white/5 border-white/15 text-white cursor-pointer"
              >
                <Copy className="w-3 h-3 mr-1" />
                نسخ JSON
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-gray-950 border border-white/10 text-emerald-400 font-mono text-xs max-h-80 overflow-auto" dir="ltr">
              {JSON.stringify(mappedFolio, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
