/**
 * WOF MOON — Linked Data Public Discovery OPAC
 * Standalone Public Catalog Portal (Completely separated from cataloging editor)
 *
 * Heavily inspired by:
 * 1. Swedish National Library LIBRIS (libris.kb.se/en) — Sticky TOC, Details table, multi-format downloaders
 * 2. Share-VDE (svde.org) — Work-level entity cluster, "Publications of this", dotted hyperlinks
 * 3. Library of Congress (catalog.loc.gov) — Availability badge, request item, permalinks, cartographic/format data
 * 4. Iraqi Knowledge & Manuscript Portal (دار المخطوطات العراقية) — Illuminated manuscript viewer, holding accession tables, "ربما يعجبك أيضاً" recommendations
 *
 * Core Features:
 * - Info on Search: Deep real-time categorized overlay as you type (Works, Persons, Subjects, Publishers)
 * - Info on Hover: Rich floating glass hover cards for any Person, Subject, Publisher, and Edition
 * - Full Entity Hyperlinking: Traversal across all graph nodes
 * - Shared Live Database: Instant sync with Supabase and Wolf Moon editor
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, BookOpen, User, Tag, Layers, Network, ExternalLink,
  Download, Copy, Check, ChevronRight, ChevronLeft, ArrowLeft,
  Share2, BookMarked, Globe, Sparkles, Building, MapPin, Hash,
  Library, Clock, RefreshCw, Filter, List, LayoutGrid, Eye,
  Sliders, Calendar, ArrowUpDown, ChevronDown, CheckCircle2,
  FileText, Code, Database, Compass, Award, Quote, Info, X,
  Printer, ArrowUpRight, BookCheck, Bookmark, CornerDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import {
  wolfMoonOpacService,
  OpacWorkEntity,
  OpacPersonEntity,
  OpacSubjectEntity,
  OpacPublisherEntity,
  OpacInstanceEntity,
  OpacFacets,
  DeepSearchParsedQuery,
  FederatedDeepSearchResult,
  VirtualShelfItem,
  WemiClusterNode,
  resolveWorkCover,
  normalizeArabic
} from '../../services/wolfMoonOpacService';
import {
  AISuggestionProfile,
  generateCanonicalMoonUri,
  isAuthorSavedInMoonSystem
} from '../../services/authorFinderService';
import { VERIFIED_IRAQI_AUTHORS } from '../../services/iraqiAuthorAIService';
import { WolfMoonVuFindPortal } from './cataloging/WolfMoonVuFindPortal';
import '../../styles/liquid-glass.css';

// Navigation Views
type OpacNavigationState =
  | { mode: 'home' }
  | { mode: 'search'; query: string; subject?: string; author?: string; era?: string; scope?: string }
  | { mode: 'work'; workId: string }
  | { mode: 'person'; personIdOrName: string }
  | { mode: 'subject'; subjectIdOrLabel: string }
  | { mode: 'publisher'; publisherName: string }
  | { mode: 'all-persons' }
  | { mode: 'all-subjects' }
  | { mode: 'vufind'; initialQuery?: string };

export function WolfMoonStandaloneOpac({ onOpenEditor }: { onOpenEditor?: () => void }) {
  // Navigation State
  const [navState, setNavState] = useState<OpacNavigationState>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const work = p.get('work');
      const person = p.get('person');
      const subject = p.get('subject');
      const q = p.get('q');
      const dir = p.get('dir');
      if (work) return { mode: 'work', workId: work };
      if (person) return { mode: 'person', personIdOrName: person };
      if (subject) return { mode: 'subject', subjectIdOrLabel: subject };
      if (dir === 'persons') return { mode: 'all-persons' };
      if (dir === 'subjects') return { mode: 'all-subjects' };
      if (p.get('view') === 'vufind') return { mode: 'vufind', initialQuery: q || undefined };
      if (q) return { mode: 'search', query: q };
    }
    return { mode: 'home' };
  });

  // Search State & Deep Live Typeahead
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'title' | 'creator' | 'subject' | 'publisher' | 'callNumber'>('all');
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Unified Discovery Display Mode: Share-VDE Clusters | LIBRIS XL Split Inspector | VuFind Discovery Matrix
  const [searchDisplayMode, setSearchDisplayMode] = useState<'svde-clusters' | 'libris-split' | 'vufind-matrix'>('svde-clusters');
  const [librisSelectedWorkId, setLibrisSelectedWorkId] = useState<string | null>(null);
  const [librisInspectorTab, setLibrisInspectorTab] = useState<'overview' | 'wemi' | 'marc' | 'jsonld' | 'holdings'>('overview');

  // VuFind Bookbag & Multi-Record Comparator State
  const [isBookbagOpen, setIsBookbagOpen] = useState(false);
  const [bookbagIds, setBookbagIds] = useState<string[]>(() => wolfMoonOpacService.getBookbagIds());

  // Live Federated VuFind + Solr + Share-VDE + LIBRIS Deep Search Result
  const [federatedSearchData, setFederatedSearchData] = useState<FederatedDeepSearchResult | null>(null);
  const [isFederatedLoading, setIsFederatedLoading] = useState(false);
  const [shelfBrowseAnchorId, setShelfBrowseAnchorId] = useState<string>('work-qabasat');

  // Advanced Search State
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advTitle, setAdvTitle] = useState('');
  const [advCreator, setAdvCreator] = useState('');
  const [advSubject, setAdvSubject] = useState('');
  const [advPublisher, setAdvPublisher] = useState('');
  const [advYearFrom, setAdvYearFrom] = useState('');
  const [advYearTo, setAdvYearTo] = useState('');
  const [advFormat, setAdvFormat] = useState('all');
  const [advCallNumber, setAdvCallNumber] = useState('');
  const [isAdvancedActive, setIsAdvancedActive] = useState(false);

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSort, setCurrentSort] = useState<'relevance' | 'title' | 'date-desc' | 'date-asc'>('relevance');

  // Facet Filters for Search View
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<string>('all');
  const [selectedEraFilter, setSelectedEraFilter] = useState<string>('all');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('all');
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState<string>('all');
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0);
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Record Detail Sub-Tabs
  const [recordFormatMode, setRecordFormatMode] = useState<'full' | 'marc' | 'wemi' | 'graph' | 'jsonld' | 'turtle' | 'relations' | 'holdings' | 'triples'>('full');
  const [activeTripleFormat, setActiveTripleFormat] = useState<'table' | 'turtle' | 'jsonld' | 'marc'>('table');
  const [citationModalWork, setCitationModalWork] = useState<OpacWorkEntity | null>(null);
  const [activeSection, setActiveSection] = useState<'top' | 'details' | 'instances' | 'related' | 'linkeddata'>('top');

  // Floating Hover Card State
  const [hoverCardState, setHoverCardState] = useState<{
    visible: boolean;
    type: 'person' | 'subject' | 'publisher' | 'work' | 'classification';
    key: string;
    x: number;
    y: number;
    data?: any;
  }>({ visible: false, type: 'person', key: '', x: 0, y: 0 });

  const hoverTimerRef = useRef<any>(null);

  // VisionOS Spatial Computing Environment
  const [spatialEnv, setSpatialEnv] = useState<'living-room' | 'architectural' | 'nocturne'>('living-room');

  // Multi-Source AI Author Profile Synthesis State (Requested Add-on)
  const [isAiProfileModalOpen, setIsAiProfileModalOpen] = useState(false);
  const [aiAuthorQuery, setAiAuthorQuery] = useState('علي الوردي');
  const [isAiSynthesizing, setIsAiSynthesizing] = useState(false);
  const [synthesizedProfile, setSynthesizedProfile] = useState<AISuggestionProfile | null>(null);
  const [profileSavedSuccess, setProfileSavedSuccess] = useState(false);

  // Synthesize Author Profile from Multi-Source Real Registries + AI
  const handleSynthesizeAuthorProfile = (authorName: string) => {
    setIsAiSynthesizing(true);
    setProfileSavedSuccess(false);

    setTimeout(() => {
      const norm = normalizeArabic(authorName);
      const matched = VERIFIED_IRAQI_AUTHORS.find(a => 
        normalizeArabic(a.nameArabic).includes(norm) ||
        normalizeArabic(a.nameEnglish).includes(norm) ||
        a.variantNames.some(v => normalizeArabic(v).includes(norm))
      );

      let profile: AISuggestionProfile;

      if (matched) {
        const canonicalUri = `moon:person:${matched.id}:${matched.birthDate || 'era'}-${matched.deathDate || 'now'}`;
        profile = {
          query: authorName,
          primarySuggestion: matched.nameArabic,
          suggestedNameArabic: matched.nameArabic,
          suggestedNameEnglish: matched.nameEnglish,
          normalizedAuthorName: matched.nameNormalized,
          birthDate: matched.birthDate,
          deathDate: matched.deathDate,
          birthCity: matched.city,
          affiliation: matched.affiliation,
          summaryAr: matched.biographyArabic,
          summaryEn: matched.biographyEnglish,
          disciplines: matched.disciplines,
          literaryMovement: matched.era,
          confidenceScore: 0.98,
          moonUri: canonicalUri,
          majorWorks: matched.majorWorks.map(w => ({
            title: w.title,
            year: w.year,
            genre: 'مصنف ببليوغرافي موثق'
          })),
          authorities: matched.authorities.map(a => ({
            name: a.source,
            uri: a.uri,
            identifier: a.identifier
          })),
          isSavedInSystem: isAuthorSavedInMoonSystem(canonicalUri),
          generatedAt: new Date().toISOString()
        };
      } else {
        const canonicalUri = generateCanonicalMoonUri(authorName);
        profile = {
          query: authorName,
          primarySuggestion: authorName,
          suggestedNameArabic: authorName,
          suggestedNameEnglish: '',
          normalizedAuthorName: authorName,
          birthDate: '',
          deathDate: '',
          birthCity: '',
          affiliation: '',
          summaryAr: `كيان مؤلف مسجل في الفهرس المحلي باسم "${authorName}". لم ترتبط به بيانات سيرة تفصيلية إضافية في ملفات الاستناد الحالية.`,
          summaryEn: `Local authority entity recorded for "${authorName}". No further biographical attributes in current authority files.`,
          disciplines: [],
          literaryMovement: '',
          confidenceScore: 0.5,
          moonUri: canonicalUri,
          majorWorks: [],
          authorities: [],
          isSavedInSystem: isAuthorSavedInMoonSystem(canonicalUri),
          generatedAt: new Date().toISOString()
        };
      }

      setSynthesizedProfile(profile);
      setProfileSavedSuccess(isAuthorSavedInMoonSystem(profile.moonUri));
      setIsAiSynthesizing(false);
    }, 450);
  };

  useEffect(() => {
    if (isAiProfileModalOpen && !synthesizedProfile) {
      handleSynthesizeAuthorProfile(aiAuthorQuery);
    }
  }, [isAiProfileModalOpen]);

  const handleSaveProfileRecord = () => {
    if (!synthesizedProfile) return;
    const res = wolfMoonOpacService.saveMultiSourceAuthorProfile(synthesizedProfile);
    if (res.success) {
      setProfileSavedSuccess(true);
      toast.success(`تم حفظ تسجيلة الاستناد المعرفي بنجاح في نظام MOON برمز URI: ${res.uri}`);
    } else {
      toast.error('حدث خطأ أثناء حفظ التسجيلة في النظام');
    }
  };

  // Database Synchronization
  useEffect(() => {
    wolfMoonOpacService.initDatabase().then(() => {
      setDbRefreshKey(k => k + 1);
      setBookbagIds(wolfMoonOpacService.getBookbagIds());
    });
    return wolfMoonOpacService.subscribe(() => {
      setDbRefreshKey(k => k + 1);
      setBookbagIds(wolfMoonOpacService.getBookbagIds());
    });
  }, []);

  // Live Federated Search across Share-VDE WEMI, LIBRIS XL, VuFind 11.0, and Apache Solr biblio
  useEffect(() => {
    const activeQ = navState.mode === 'search' ? navState.query : searchQuery;
    let cancelled = false;
    setIsFederatedLoading(true);
    const timer = setTimeout(() => {
      wolfMoonOpacService.executeDeepFederatedSearch(activeQ).then(res => {
        if (!cancelled) {
          setFederatedSearchData(res);
          setIsFederatedLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setIsFederatedLoading(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, navState, dbRefreshKey]);

  const parsedDeepQuery = useMemo(() => {
    const activeQ = searchQuery || (navState.mode === 'search' ? navState.query : '');
    return wolfMoonOpacService.parseDeepSearchQuery(activeQ);
  }, [searchQuery, navState]);

  const handleToggleBookbag = (workId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = wolfMoonOpacService.toggleBookbag(workId);
    setBookbagIds(res.items || wolfMoonOpacService.getBookbagIds());
    if (res.added) {
      toast.success('تمت إضافة المصنف إلى حقيبة الباحث والمقارنة (VuFind Bookbag)');
    } else {
      toast.info('تمت إزالة المصنف من حقيبة الباحث');
    }
  };

  const handleExportBookbag = (format: 'ris' | 'bibtex' | 'marc21' | 'jsonld') => {
    const content = wolfMoonOpacService.exportBookbag(format);
    if (!content) {
      toast.error('حقيبة الباحث فارغة حالياً');
      return;
    }
    navigator.clipboard.writeText(content);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'jsonld' ? 'jsonld' : format === 'marc21' ? 'mrc.txt' : format === 'bibtex' ? 'bib' : 'ris';
    a.download = `wolfmoon-bookbag-${format}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ونسخ حقيبة الباحث بصيغة ${format.toUpperCase()} بنجاح`);
  };

  const bookbagWorks = useMemo(() => {
    return wolfMoonOpacService.getBookbagWorks();
  }, [bookbagIds, dbRefreshKey]);

  // Close search overlay on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOverlayOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const telemetry = useMemo(() => wolfMoonOpacService.getEcosystemTelemetry(), [dbRefreshKey]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await wolfMoonOpacService.refreshCatalog();
    setDbRefreshKey(k => k + 1);
    setIsRefreshing(false);
    toast.success('تمت مزامنة الفهرس الحي مع FOLIO ILS ومحرك Solr وقاعدة البيانات المترابطة بنجاح');
  };

  const handleCirculationAction = async (params: {
    itemId?: string;
    instanceId?: string;
    workId?: string;
    action: 'checkout' | 'checkin' | 'request';
  }) => {
    const res = await wolfMoonOpacService.performCirculationAction(params);
    setDbRefreshKey(k => k + 1);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  // Synchronize URL on navigation
  const navigateTo = (state: OpacNavigationState) => {
    setNavState(state);
    setIsSearchOverlayOpen(false);
    setHoverCardState(h => ({ ...h, visible: false }));
    setSelectedInstanceIndex(0);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('work');
      url.searchParams.delete('person');
      url.searchParams.delete('subject');
      url.searchParams.delete('dir');
      url.searchParams.delete('q');
      url.searchParams.delete('view');

      if (state.mode === 'work') url.searchParams.set('work', state.workId);
      else if (state.mode === 'person') url.searchParams.set('person', state.personIdOrName);
      else if (state.mode === 'subject') url.searchParams.set('subject', state.subjectIdOrLabel);
      else if (state.mode === 'all-persons') url.searchParams.set('dir', 'persons');
      else if (state.mode === 'all-subjects') url.searchParams.set('dir', 'subjects');
      else if (state.mode === 'search') url.searchParams.set('q', state.query);
      else if (state.mode === 'vufind') url.searchParams.set('view', 'vufind');

      window.history.pushState({}, '', url.toString());
    }
  };

  // Live Categorized Deep Search Results for Typeahead Overlay
  const liveSearchResults = useMemo(() => {
    return wolfMoonOpacService.deepCategorizedSearch(searchQuery, searchScope);
  }, [searchQuery, searchScope, dbRefreshKey]);

  // Faceted Search Results with Sorting & Pagination for Catalog View
  const { works: catalogSearchResults, totalCount, totalPages, page: activePageNumber, facets } = useMemo(() => {
    if (isAdvancedActive) {
      return wolfMoonOpacService.searchWorksAdvanced({
        query: navState.mode === 'search' ? navState.query : searchQuery,
        title: advTitle,
        creator: advCreator,
        subject: advSubject,
        publisher: advPublisher,
        yearFrom: advYearFrom,
        yearTo: advYearTo,
        format: advFormat,
        callNumber: advCallNumber,
        sort: currentSort,
        page: currentPage,
        pageSize: 12
      });
    }

    const q = navState.mode === 'search' ? navState.query : '';
    return wolfMoonOpacService.searchWorks(
      q,
      selectedSubjectFilter,
      selectedAuthorFilter,
      selectedEraFilter,
      'all',
      currentSort,
      currentPage,
      12,
      selectedFormatFilter,
      selectedAvailabilityFilter
    );
  }, [
    navState,
    selectedSubjectFilter,
    selectedAuthorFilter,
    selectedEraFilter,
    selectedFormatFilter,
    selectedAvailabilityFilter,
    currentSort,
    currentPage,
    isAdvancedActive,
    advTitle,
    advCreator,
    advSubject,
    advPublisher,
    advYearFrom,
    advYearTo,
    advFormat,
    advCallNumber,
    searchQuery,
    dbRefreshKey
  ]);

  // Active Entity Lookups
  const activeWork = useMemo(() => {
    if (navState.mode !== 'work') return null;
    return wolfMoonOpacService.getWorkByIdOrUri(navState.workId);
  }, [navState, dbRefreshKey]);

  const librisInspectedWork = useMemo(() => {
    if (librisSelectedWorkId) {
      const found = wolfMoonOpacService.getWorkByIdOrUri(librisSelectedWorkId);
      if (found) return found;
    }
    return catalogSearchResults[0] || null;
  }, [librisSelectedWorkId, catalogSearchResults, dbRefreshKey]);

  const virtualShelfItems = useMemo(() => {
    const anchor = activeWork?.id || librisInspectedWork?.id || shelfBrowseAnchorId || catalogSearchResults[0]?.id || 'work-qabasat';
    return wolfMoonOpacService.getVirtualShelfNeighbors(anchor, 6);
  }, [activeWork, librisInspectedWork, shelfBrowseAnchorId, catalogSearchResults, dbRefreshKey]);

  const activeWorkWemiTree = useMemo(() => {
    if (!activeWork) return null;
    return wolfMoonOpacService.getWemiClusterTree(activeWork.id);
  }, [activeWork, dbRefreshKey]);

  const qabasatWork = useMemo(() => {
    const list = wolfMoonOpacService.getAllWorks();
    return list.find(w => w.title.includes('قبسات') || w.id.includes('qabasat')) || list[0];
  }, [dbRefreshKey]);

  const relatedWorksList = useMemo(() => {
    if (!activeWork) return [];
    return wolfMoonOpacService.getRelatedWorks(activeWork.id, 4);
  }, [activeWork, dbRefreshKey]);

  const activePersonData = useMemo(() => {
    if (navState.mode !== 'person') return null;
    return wolfMoonOpacService.getPersonByNameOrUri(navState.personIdOrName);
  }, [navState, dbRefreshKey]);

  const activeSubjectData = useMemo(() => {
    if (navState.mode !== 'subject') return null;
    return wolfMoonOpacService.getSubjectByLabelOrUri(navState.subjectIdOrLabel);
  }, [navState, dbRefreshKey]);

  const allPersonsList = useMemo(() => {
    return wolfMoonOpacService.getAllPersons();
  }, [dbRefreshKey]);

  const allSubjectsList = useMemo(() => {
    return wolfMoonOpacService.getAllSubjects();
  }, [dbRefreshKey]);

  // Hover Handlers
  const triggerHoverCard = (type: 'person' | 'subject' | 'publisher' | 'work' | 'classification', key: string, e: React.MouseEvent) => {
    clearTimeout(hoverTimerRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + window.scrollY + 8;

    hoverTimerRef.current = setTimeout(() => {
      const data = wolfMoonOpacService.getHoverInfo(type, key);
      if (data) {
        setHoverCardState({ visible: true, type, key, x, y, data });
      }
    }, 240);
  };

  const closeHoverCard = () => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverCardState(h => ({ ...h, visible: false }));
    }, 180);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label} إلى الحافظة بنجاح`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen w-full opac-spatial-bg ${spatialEnv === 'architectural' ? 'env-architectural' : spatialEnv === 'nocturne' ? 'env-nocturne' : ''} text-slate-900 font-sans selection:bg-blue-500/20 flex flex-col antialiased`} dir="rtl">
      <Toaster position="top-center" richColors />

      {/* =========================================================================
          1. UNIFIED HEADER (Share-VDE + LIBRIS XL + VuFind 11.0 + FOLIO ILS)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          
          {/* Logo & Project Identity */}
          <div
            onClick={() => {
              setSearchQuery('');
              navigateTo({ mode: 'home' });
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-600 text-white flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-slate-900">
                  WOF MOON OPAC
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold">
                  SVDE • LIBRIS • VuFind
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold hidden sm:block">
                منظومة الاكتشاف الببليوغرافي المترابط والبحث الفيدرالي الموحد
              </div>
            </div>
          </div>

          {/* Discovery Mode Switcher: Share-VDE / LIBRIS / VuFind */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/90 shadow-xs flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSearchDisplayMode('svde-clusters');
                if (navState.mode === 'vufind') navigateTo({ mode: 'home' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                navState.mode !== 'vufind' && searchDisplayMode === 'svde-clusters'
                  ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمط Share-VDE (svde.org): عناقيد الأعمال الفكرية WEMI وجداول الطبعات المدمجة"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>عناقيد Share-VDE</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchDisplayMode('libris-split');
                if (navState.mode === 'vufind') navigateTo({ mode: 'home' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                navState.mode !== 'vufind' && searchDisplayMode === 'libris-split'
                  ? 'bg-white text-blue-900 shadow-xs border border-blue-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمط المكتبة الوطنية السويدية LIBRIS XL (libris.kb.se): الفاحص الأكاديمي المقسم"
            >
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span>فاحص LIBRIS XL</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchDisplayMode('vufind-matrix');
                if (navState.mode === 'vufind') navigateTo({ mode: 'home' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                navState.mode !== 'vufind' && searchDisplayMode === 'vufind-matrix'
                  ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="مصفوفة VuFind + Solr المدمجة مع تصفح الرف الافتراضي"
            >
              <Database className="w-3.5 h-3.5 text-teal-600" />
              <span>مصفوفة VuFind + الرف</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ mode: 'vufind', initialQuery: searchQuery || undefined })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                navState.mode === 'vufind'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="بوابة VuFind 11.0 الكاملة"
            >
              <Search className="w-3.5 h-3.5 text-teal-400" />
              <span>بوابة VuFind الكاملة</span>
            </button>
          </div>

          {/* Right Utility Actions: VuFind Bookbag + AI Authority + Return to Editor */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBookbagOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              title="حقيبة الباحث ومقارنة التسجيلات وتصديرها (VuFind Bookbag & Record Comparator)"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>حقيبة الباحث والمقارنة</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-mono text-[10px] font-black">
                {bookbagIds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsAiProfileModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/90 text-xs font-bold hidden md:flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              title="توليف ملفات الاستناد الذكية متعددة المصادر"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>استناد الذكاء الاصطناعي</span>
            </button>

            {onOpenEditor && (
              <button
                onClick={onOpenEditor}
                className="liquid-glass-btn px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-xs transition-all hover:bg-slate-100 cursor-pointer"
                title="الرجوع إلى محرر الفهرسة (Moon Editor)"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>محرر Moon</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* =========================================================================
          LIVE INTEGRATED ECOSYSTEM STATUS BAR (FOLIO ILS + VuFind + Solr + SPARQL + SVDE + LIBRIS)
          ========================================================================= */}
      <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-2 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>FOLIO ILS ({telemetry.totalFolioInstances || totalCount} عنوان • {telemetry.totalFolioItems || 12} نسخة)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold text-[11px]">
              <Database className="w-3 h-3" />
              <span>Solr biblio ({federatedSearchData?.solrLiveCount ?? telemetry.totalSolrDocs ?? totalCount} وثيقة)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold text-[11px]">
              <Layers className="w-3 h-3" />
              <span>Share-VDE WEMI ({federatedSearchData?.workClusters?.length || totalCount} عنقود Hub)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold text-[11px]">
              <Network className="w-3 h-3" />
              <span>SPARQL ({telemetry.totalTriples || 334} ثلاثية RDF)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => setIsBookbagOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Bookmark className="w-3 h-3" />
              <span>حقيبة المقارنة ({bookbagIds.length})</span>
            </button>
            <a
              href="http://localhost:8085"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono flex items-center gap-1 transition-colors"
            >
              <span>VuFind (:8085)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span>مزامنة فورية</span>
            </button>
          </div>
        </div>
      </div>

      {/* Screen Reader Live Announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {navState.mode === 'search'
          ? `تم العثور على ${totalCount} نتيجة بحث في الفهرس العام`
          : ''}
      </div>

      {/* =========================================================================
          2. DEEP SEARCH BAR WITH LIBRIS/VUFIND SYNTAX BUILDER & LIVE FEDERATED OVERLAY
          ========================================================================= */}
      <section className="bg-white/55 backdrop-blur-2xl border-b border-slate-200/80 py-5 px-4 sm:px-6 relative z-30 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
        <div ref={searchContainerRef} className="max-w-5xl mx-auto space-y-2.5 relative">
          
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Scope Dropdown */}
            <div className="relative">
              <select
                value={searchScope}
                onChange={e => setSearchScope(e.target.value as any)}
                className="appearance-none bg-white/90 hover:bg-white text-xs font-bold text-slate-800 py-3 pl-7 pr-3 rounded-2xl outline-none cursor-pointer border border-slate-200/90 shadow-xs backdrop-blur-md transition-colors"
                title="نطاق البحث"
              >
                <option value="all" className="text-slate-900 bg-white font-medium">جميع الحقول (SVDE + LIBRIS + VuFind)</option>
                <option value="title" className="text-slate-900 bg-white font-medium">العنوان (title:)</option>
                <option value="creator" className="text-slate-900 bg-white font-medium">المؤلف / العلم (author:)</option>
                <option value="subject" className="text-slate-900 bg-white font-medium">الموضوع (subject:)</option>
                <option value="publisher" className="text-slate-900 bg-white font-medium">دار النشر (publisher:)</option>
                <option value="callNumber" className="text-slate-900 bg-white font-medium">رمز الرف / ISBN (call:)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Main Search Input */}
            <div className="relative flex-1 rounded-2xl bg-white/90 hover:bg-white focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 backdrop-blur-md shadow-xs transition-all flex items-center px-3.5 py-1.5">
              <Search className="w-4 h-4 text-blue-600 ml-2.5 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOverlayOpen(true)}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOverlayOpen(true);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setIsSearchOverlayOpen(false);
                    navigateTo({ mode: 'search', query: searchQuery.trim() });
                  }
                }}
                placeholder="بحث عميق موحد (يدعم صيغ LIBRIS وVuFind مثل: author:الوردي year:1950-2025 status:available)..."
                className="w-full py-1.5 bg-transparent text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOverlayOpen(false);
                    if (navState.mode === 'search') navigateTo({ mode: 'search', query: '' });
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={() => {
                setIsSearchOverlayOpen(false);
                setIsAdvancedActive(false);
                navigateTo({ mode: 'search', query: searchQuery.trim() });
              }}
              className="liquid-glass-primary text-xs sm:text-sm flex-shrink-0 flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Search className="w-3.5 h-3.5" />
              <span>بحث عميق</span>
            </button>

            {/* Advanced Search Toggle Button */}
            <button
              onClick={() => setIsAdvancedSearchOpen(o => !o)}
              className={`p-3 sm:px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isAdvancedSearchOpen || isAdvancedActive
                  ? 'liquid-glass-primary shadow-xs'
                  : 'liquid-glass-btn text-xs font-bold'
              }`}
              title="البحث المتقدم بحقول متعددة"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">بحث متقدم</span>
            </button>
          </div>

          {/* LIBRIS XL & VuFind Interactive Fielded Syntax Chips + Live Parsed Query Tokens */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5 text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Code className="w-3 h-3 text-indigo-600" />
                <span>مشغلات البحث العميق (LIBRIS / VuFind Syntax):</span>
              </span>
              {[
                { label: 'title: العنوان', token: 'title:القبسات ' },
                { label: 'author: المؤلف', token: 'author:الوردي ' },
                { label: 'subject: الموضوع', token: 'subject:فلسفة ' },
                { label: 'call: رقم الطلب', token: 'call:B753 ' },
                { label: 'year: النطاق الزمني', token: 'year:1600-2025 ' },
                { label: 'status:available المتاح', token: 'status:available ' },
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    const nextQ = `${searchQuery.trim()} ${chip.token}`.trim() + ' ';
                    setSearchQuery(nextQ);
                    searchInputRef.current?.focus();
                    setIsSearchOverlayOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white/90 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200/90 hover:border-indigo-300 font-mono font-semibold cursor-pointer transition-all shadow-2xs"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Live Parsed Query Clauses Indicator */}
            {((parsedDeepQuery?.clauses?.length || 0) > 0 || parsedDeepQuery?.yearFrom || (parsedDeepQuery?.excludedTerms?.length || 0) > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap bg-indigo-50/90 border border-indigo-200 px-2.5 py-1 rounded-xl text-[10px] font-bold text-indigo-900">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>تحليل الاستعلام الفوري:</span>
                {(parsedDeepQuery?.clauses || []).map((c, idx) => (
                  <span key={idx} className="px-1.5 py-0.2 rounded bg-white border border-indigo-200 font-mono text-indigo-800">
                    {c.field}={c.value}
                  </span>
                ))}
                {(parsedDeepQuery?.yearFrom || parsedDeepQuery?.yearTo) && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 font-mono text-amber-900">
                    الفترة: {parsedDeepQuery.yearFrom || '...'}–{parsedDeepQuery.yearTo || '...'}
                  </span>
                )}
                {(parsedDeepQuery?.excludedTerms || []).map((ex, idx) => (
                  <span key={idx} className="px-1.5 py-0.2 rounded bg-rose-100 border border-rose-300 font-mono text-rose-800">
                    NOT {ex}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ADVANCED SEARCH EXPANDABLE PANEL */}
          <AnimatePresence>
            {isAdvancedSearchOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-xl mt-2 space-y-4 text-xs text-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="font-black text-slate-900 flex items-center gap-1.5 text-sm">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>البحث الببليوغرافي المتقدم (Multi-Field Search — LIBRIS & VuFind)</span>
                    </span>
                    <button
                      onClick={() => {
                        setAdvTitle('');
                        setAdvCreator('');
                        setAdvSubject('');
                        setAdvPublisher('');
                        setAdvYearFrom('');
                        setAdvYearTo('');
                        setAdvFormat('all');
                        setAdvCallNumber('');
                        setIsAdvancedActive(false);
                      }}
                      className="text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      تفريغ الحقول
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">العنوان أو جزء منه:</label>
                      <input
                        type="text"
                        value={advTitle}
                        onChange={e => setAdvTitle(e.target.value)}
                        placeholder="مثل: القبسات، مهزلة..."
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">المؤلف / المسؤولية الفكرية:</label>
                      <input
                        type="text"
                        value={advCreator}
                        onChange={e => setAdvCreator(e.target.value)}
                        placeholder="مثل: الميرداماد، علي الوردي..."
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">الموضوع أو المفهوم:</label>
                      <input
                        type="text"
                        value={advSubject}
                        onChange={e => setAdvSubject(e.target.value)}
                        placeholder="مثل: فلسفة، شعر، اجتماع..."
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">دار النشر أو المطبعة:</label>
                      <input
                        type="text"
                        value={advPublisher}
                        onChange={e => setAdvPublisher(e.target.value)}
                        placeholder="دار النشر أو المطبعة..."
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">سنة النشر (من):</label>
                      <input
                        type="number"
                        value={advYearFrom}
                        onChange={e => setAdvYearFrom(e.target.value)}
                        placeholder="1600"
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium font-mono shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">سنة النشر (إلى):</label>
                      <input
                        type="number"
                        value={advYearTo}
                        onChange={e => setAdvYearTo(e.target.value)}
                        placeholder="2026"
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium font-mono shadow-xs transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">شكل الوعاء / المادة:</label>
                      <select
                        value={advFormat}
                        onChange={e => setAdvFormat(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 font-semibold"
                      >
                        <option value="all">كافة الأشكال</option>
                        <option value="مخطوط">مخطوطة نادرة</option>
                        <option value="كتاب">كتاب مطبوع</option>
                        <option value="شعر">ديوان شعري</option>
                        <option value="خريطة">خريطة / مصور</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">رمز الرف أو ISBN:</label>
                      <input
                        type="text"
                        value={advCallNumber}
                        onChange={e => setAdvCallNumber(e.target.value)}
                        placeholder="رقم الاستدعاء..."
                        className="w-full p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400 outline-none font-medium font-mono shadow-xs transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
                    <button
                      onClick={() => setIsAdvancedSearchOpen(false)}
                      className="px-4 py-2 rounded-xl hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                    >
                      إغلاق
                    </button>
                    <button
                      onClick={() => {
                        setIsAdvancedActive(true);
                        setIsAdvancedSearchOpen(false);
                        setCurrentPage(1);
                        navigateTo({ mode: 'search', query: searchQuery });
                      }}
                      className="liquid-glass-primary px-6 py-2 rounded-xl text-white font-bold cursor-pointer shadow-md transition-all"
                    >
                      تنفيذ البحث المتقدم
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DEEP LIVE FEDERATED SEARCH OVERLAY ("info on search" — Share-VDE + LIBRIS + VuFind Solr) */}
          <AnimatePresence>
            {isSearchOverlayOpen && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute top-full right-0 left-0 mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden z-50 max-h-[82vh] overflow-y-auto text-slate-900"
              >
                <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 font-bold bg-slate-50/90">
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>الاكتشاف الفيدرالي اللحظي ({liveSearchResults.totalMatches + (federatedSearchData?.vufindLiveRecords?.length || 0)} تطابق)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      SVDE Hubs: {federatedSearchData?.workClusters?.length || liveSearchResults.works.length}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                      VuFind/Solr: {federatedSearchData?.solrLiveCount || liveSearchResults.works.length}
                    </span>
                    <span className="text-slate-500">Enter للبحث الشامل</span>
                  </div>
                </div>

                <div className="p-4 space-y-4 divide-y divide-slate-100 text-xs">
                  
                  {/* Category 0: Share-VDE Opus / Hub Clusters */}
                  {federatedSearchData?.workClusters && federatedSearchData.workClusters.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>عناقيد الأعمال الفكرية الموحدة (Share-VDE Opus / bf:Hub)</span>
                        </span>
                        <span className="text-[10px] font-mono text-indigo-500">IFLA LRM / BIBFRAME Hub</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {federatedSearchData.workClusters.slice(0, 4).map(cluster => (
                          <div
                            key={cluster.hubUri}
                            onClick={() => navigateTo({ mode: 'work', workId: cluster.works[0].id })}
                            className="p-2.5 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200/70 transition-all cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              <div className="font-black text-indigo-950 truncate">{cluster.hubTitle}</div>
                              <div className="text-[10px] text-indigo-700 font-medium truncate">
                                {cluster.creatorName} • <span className="font-mono">{cluster.hubUri}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="px-2 py-0.5 rounded-full bg-white text-indigo-800 border border-indigo-200 text-[10px] font-mono font-bold">
                                {cluster.totalEditions} طبعة
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                {cluster.availableItems} متاح
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category 1: Matching Works */}
                  {liveSearchResults.works.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <div className="text-[11px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>الأعمال والكتب الفكرية (LIBRIS XL / bf:Work)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {liveSearchResults.works.map(work => (
                          <div
                            key={work.id}
                            onClick={() => navigateTo({ mode: 'work', workId: work.id })}
                            className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group border border-transparent hover:border-slate-200"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shadow-xs">
                                <BookOpen className="w-4 h-4 text-blue-600" />
                              </span>
                              <div>
                                <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {work.title}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  بواسطة: <span className="font-bold text-slate-800">{work.primaryCreator.nameArabic}</span> • {work.originDate || 'غير مؤرخ'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                                {work.instances.length} طبعة
                              </span>
                              <button
                                type="button"
                                onClick={e => handleToggleBookbag(work.id, e)}
                                className={`p-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                                  bookbagIds.includes(work.id)
                                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-amber-700'
                                }`}
                                title="حفظ في حقيبة الباحث (VuFind Bookbag)"
                              >
                                <Bookmark className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category 2: Live VuFind + Apache Solr DisMax Matches */}
                  {federatedSearchData?.vufindLiveRecords && federatedSearchData.vufindLiveRecords.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <div className="text-[11px] font-black uppercase text-teal-700 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-teal-600" />
                          <span>نتائج محرك VuFind 11.0 وفهرس Apache Solr (biblio DisMax)</span>
                        </span>
                        <span className="text-[10px] font-mono text-teal-600">Live Solr RTA</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {federatedSearchData.vufindLiveRecords.slice(0, 4).map((rec: any, rIdx: number) => (
                          <div
                            key={rec.id || rIdx}
                            onClick={() => {
                              const matchedW = wolfMoonOpacService.getWorkByIdOrUri(rec.id) || liveSearchResults.works[0];
                              if (matchedW) navigateTo({ mode: 'work', workId: matchedW.id });
                              else navigateTo({ mode: 'vufind', initialQuery: rec.title || searchQuery });
                            }}
                            className="p-2.5 rounded-xl bg-teal-50/40 hover:bg-teal-50 border border-teal-200/70 transition-all cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              <div className="font-bold text-slate-900 truncate">{rec.title}</div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {rec.callnumber || 'B753'} • {rec.format || 'Book'}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                              rec.availability === 'Checked Out' || rec.status === 'checked_out'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {rec.availability === 'Checked Out' || rec.status === 'checked_out' ? 'معار FOLIO' : 'متاح FOLIO'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category 3: Matching Authors */}
                  {liveSearchResults.persons.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <div className="text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-600" />
                        <span>المؤلفون والأعلام (bf:Person / NACO / VIAF)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {liveSearchResults.persons.map(person => (
                          <div
                            key={person.id}
                            onClick={() => navigateTo({ mode: 'person', personIdOrName: person.nameArabic })}
                            className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-black text-xs flex items-center justify-center shadow-xs">
                                {person.nameArabic.charAt(0)}
                              </span>
                              <div>
                                <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {person.nameArabic}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                                  {person.lifespan || person.nameEnglish}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                              {person.worksCount} مؤلف
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category 4: Matching Subjects */}
                  {liveSearchResults.subjects.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <div className="text-[11px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>رؤوس الموضوعات والمفاهيم (skos:Concept / LCSH)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {liveSearchResults.subjects.map(s => (
                          <button
                            key={s.id}
                            onClick={() => navigateTo({ mode: 'subject', subjectIdOrLabel: s.label })}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 border border-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-emerald-600" /> {s.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({s.worksCount})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category 5: Matching Publishers */}
                  {liveSearchResults.publishers.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-purple-600" />
                        <span>دور النشر والمؤسسات (bf:Organization)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {liveSearchResults.publishers.map(pub => (
                          <button
                            key={pub.id}
                            onClick={() => navigateTo({ mode: 'search', query: pub.name, scope: 'publisher' })}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-purple-300 border border-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5 text-purple-600" /> {pub.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({pub.worksCount} مطبوع)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between px-4">
                  <button
                    onClick={() => {
                      setIsSearchOverlayOpen(false);
                      navigateTo({ mode: 'search', query: searchQuery.trim() });
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>عرض كافة النتائج في صفحة الفهرس الشامل</span>
                    <span>←</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSearchOverlayOpen(false);
                      navigateTo({ mode: 'vufind', initialQuery: searchQuery.trim() });
                    }}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>فتح النتائج في بوابة VuFind 11.0</span>
                    <span>←</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </section>

      {/* =========================================================================
          3. MAIN CONTENT ROUTER
          ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* -------------------- VIEW A: HOME VIEW (Unified Share-VDE + LIBRIS XL + VuFind Discovery) -------------------- */}
        {navState.mode === 'home' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 flex-wrap">
                  <span>الفهرس الدلالي الموحد (Share-VDE • LIBRIS XL • VuFind)</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200/80">
                    {catalogSearchResults.length} عمل فكري ({telemetry.totalFolioItems || 12} نسخة FOLIO)
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                  اكتشاف ببليوغرافي عميق يدمج عناقيد Share-VDE (WEMI)، وفاحص LIBRIS XL الأكاديمي، وخدمات VuFind + Solr والإعارة الفورية FOLIO ILS
                </p>
              </div>

              {/* View & Directory Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  onClick={() => navigateTo({ mode: 'search', query: '' })}
                  className="liquid-glass-btn px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>البحث الموجه والفلاتر</span>
                </button>
                <button
                  onClick={() => navigateTo({ mode: 'all-persons' })}
                  className="liquid-glass-btn px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span>دليل الأعلام ({allPersonsList.length})</span>
                </button>
                <button
                  onClick={() => navigateTo({ mode: 'all-subjects' })}
                  className="liquid-glass-btn px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>مكنز المفاهيم ({allSubjectsList.length})</span>
                </button>
                <button
                  onClick={() => setIsBookbagOpen(true)}
                  className="liquid-glass-btn px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 border-amber-200/90 flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-amber-100"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                  <span>حقيبة المقارنة ({bookbagIds.length})</span>
                </button>
              </div>
            </div>

            {/* MODE 1: SHARE-VDE CLUSTERS (Default in Home) */}
            {searchDisplayMode === 'svde-clusters' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catalogSearchResults.map(work => (
                    <WorkCardComponent
                      key={work.id}
                      work={work}
                      onSelectWork={() => navigateTo({ mode: 'work', workId: work.id })}
                      onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                      onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                      onHoverPerson={(p, e) => triggerHoverCard('person', p, e)}
                      onHoverSubject={(s, e) => triggerHoverCard('subject', s, e)}
                      onLeaveHover={closeHoverCard}
                      isInBookbag={bookbagIds.includes(work.id)}
                      onToggleBookbag={e => handleToggleBookbag(work.id, e)}
                      onCirculationAction={handleCirculationAction}
                    />
                  ))}
                </div>

                {/* VuFind Integrated Virtual Shelf Browse Strip on Home Page */}
                <VirtualShelfBrowseSection
                  items={virtualShelfItems}
                  onSelectWork={workId => navigateTo({ mode: 'work', workId })}
                  onReanchor={workId => setShelfBrowseAnchorId(workId)}
                />
              </div>
            )}

            {/* MODE 2: LIBRIS XL SPLIT-PANE ACADEMIC INSPECTOR */}
            {searchDisplayMode === 'libris-split' && (
              <LibrisSplitInspectorView
                works={catalogSearchResults}
                selectedWork={librisInspectedWork}
                inspectorTab={librisInspectorTab}
                onSelectWorkRow={w => setLibrisSelectedWorkId(w.id)}
                onChangeTab={t => setLibrisInspectorTab(t)}
                onOpenFullWork={wId => navigateTo({ mode: 'work', workId: wId })}
                onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                onCirculationAction={handleCirculationAction}
                bookbagIds={bookbagIds}
                onToggleBookbag={handleToggleBookbag}
                onCopy={handleCopy}
              />
            )}

            {/* MODE 3: VUFIND + SOLR INTEGRATED DISCOVERY MATRIX & VIRTUAL SHELF */}
            {searchDisplayMode === 'vufind-matrix' && (
              <VuFindIntegratedMatrixView
                works={catalogSearchResults}
                federatedData={federatedSearchData}
                shelfItems={virtualShelfItems}
                onSelectWork={wId => navigateTo({ mode: 'work', workId: wId })}
                onReanchorShelf={wId => setShelfBrowseAnchorId(wId)}
                onFilterSubject={s => {
                  setSelectedSubjectFilter(s);
                  navigateTo({ mode: 'search', query: searchQuery });
                }}
                onCirculationAction={handleCirculationAction}
                bookbagIds={bookbagIds}
                onToggleBookbag={handleToggleBookbag}
                onOpenFullVuFind={() => navigateTo({ mode: 'vufind', initialQuery: searchQuery || undefined })}
              />
            )}
          </div>
        )}

        {/* -------------------- VIEW B: SEARCH RESULTS & FACETS (Share-VDE + LIBRIS XL + VuFind Federated) -------------------- */}
        {navState.mode === 'search' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div>
                <h1 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>نتائج البحث الببليوغرافي والفيدرالي العميق</span>
                  {navState.query && (
                    <span className="text-blue-700 font-bold text-sm font-mono bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      "{navState.query}"
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-xs font-mono font-bold text-indigo-700 border border-indigo-200/80">
                    {totalCount} عمل • {federatedSearchData?.solrLiveCount ?? totalCount} وثيقة Solr
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  عرض {totalCount === 0 ? 0 : ((activePageNumber - 1) * 12) + 1} إلى {Math.min(activePageNumber * 12, totalCount)} من إجمالي {totalCount} مصنف — مع إتاحة FOLIO ILS اللحظية وخدمات VuFind
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View Mode Switcher inside Search Results */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSearchDisplayMode('svde-clusters')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      searchDisplayMode === 'svde-clusters' ? 'bg-white text-indigo-900 shadow-2xs font-black' : 'text-slate-600'
                    }`}
                  >
                    Share-VDE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchDisplayMode('libris-split')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      searchDisplayMode === 'libris-split' ? 'bg-white text-blue-900 shadow-2xs font-black' : 'text-slate-600'
                    }`}
                  >
                    LIBRIS XL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchDisplayMode('vufind-matrix')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      searchDisplayMode === 'vufind-matrix' ? 'bg-white text-teal-900 shadow-2xs font-black' : 'text-slate-600'
                    }`}
                  >
                    VuFind Matrix
                  </button>
                </div>

                {/* Sorting Dropdown */}
                <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200/90 rounded-xl px-2.5 py-1 shadow-xs">
                  <span className="text-xs font-bold text-slate-500">الترتيب:</span>
                  <select
                    value={currentSort}
                    onChange={e => {
                      setCurrentSort(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="relevance" className="text-slate-900 bg-white font-medium">الأكثر صلة (DisMax Relevance)</option>
                    <option value="title" className="text-slate-900 bg-white font-medium">العنوان (أ - ي)</option>
                    <option value="date-desc" className="text-slate-900 bg-white font-medium">الأحدث نشراً</option>
                    <option value="date-asc" className="text-slate-900 bg-white font-medium">الأقدم تاريخاً</option>
                  </select>
                </div>

                {(selectedSubjectFilter !== 'all' || selectedAuthorFilter !== 'all' || selectedEraFilter !== 'all' || selectedFormatFilter !== 'all' || selectedAvailabilityFilter !== 'all' || isAdvancedActive) && (
                  <button
                    onClick={() => {
                      setSelectedSubjectFilter('all');
                      setSelectedAuthorFilter('all');
                      setSelectedEraFilter('all');
                      setSelectedFormatFilter('all');
                      setSelectedAvailabilityFilter('all');
                      setIsAdvancedActive(false);
                      setCurrentPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>إعادة تعيين الفلاتر</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Sidebar Facets */}
              <div className="space-y-4">
                {/* Format / Carrier Facet */}
                {facets.formats && facets.formats.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xl space-y-3 border border-slate-200/90 shadow-xs">
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>شكل الوعاء والمادة (Carrier Type)</span>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                      <button
                        onClick={() => {
                          setSelectedFormatFilter('all');
                          setCurrentPage(1);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                          selectedFormatFilter === 'all' ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>كافة الأشكال</span>
                        <span className="text-[10px] opacity-75">{totalCount}</span>
                      </button>
                      {facets.formats.map(f => (
                        <button
                          key={f.value}
                          onClick={() => {
                            setSelectedFormatFilter(f.value);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer truncate ${
                            selectedFormatFilter === f.value ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={f.label}
                        >
                          <span className="truncate">{f.label}</span>
                          <span className="text-[10px] opacity-75 ml-1">{f.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Availability Facet */}
                {facets.availabilities && facets.availabilities.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xl space-y-3 border border-slate-200/90 shadow-xs">
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>حالة الإتاحة في FOLIO ILS</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <button
                        onClick={() => {
                          setSelectedAvailabilityFilter('all');
                          setCurrentPage(1);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                          selectedAvailabilityFilter === 'all' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>الكل</span>
                        <span className="text-[10px] opacity-75">{totalCount}</span>
                      </button>
                      {facets.availabilities.map(av => (
                        <button
                          key={av.value}
                          onClick={() => {
                            setSelectedAvailabilityFilter(av.value);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer truncate ${
                            selectedAvailabilityFilter === av.value ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={av.label}
                        >
                          <span className="truncate">{av.label}</span>
                          <span className="text-[10px] opacity-75 ml-1">{av.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject Facet */}
                <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xl space-y-3 border border-slate-200/90 shadow-xs">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>المواضيع والمفاهيم (SKOS / Solr)</span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                    <button
                      onClick={() => {
                        setSelectedSubjectFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        selectedSubjectFilter === 'all' ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>الكل</span>
                      <span className="text-[10px] opacity-75">{totalCount}</span>
                    </button>
                    {facets.subjects.map(s => (
                      <button
                        key={s.value}
                        onClick={() => {
                          setSelectedSubjectFilter(s.value);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer truncate ${
                          selectedSubjectFilter === s.value ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                        title={s.label}
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="text-[10px] opacity-75 ml-1">{s.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Author Facet */}
                <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xl space-y-3 border border-slate-200/90 shadow-xs">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>المؤلفون والأعلام (NACO)</span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                    <button
                      onClick={() => {
                        setSelectedAuthorFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        selectedAuthorFilter === 'all' ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>الكل</span>
                      <span className="text-[10px] opacity-75">{totalCount}</span>
                    </button>
                    {facets.authors.map(a => (
                      <button
                        key={a.value}
                        onClick={() => {
                          setSelectedAuthorFilter(a.value);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer truncate ${
                          selectedAuthorFilter === a.value ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                        title={a.label}
                      >
                        <span className="truncate">{a.label}</span>
                        <span className="text-[10px] opacity-75 ml-1">{a.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Works Results Area (Supports all 3 modes: Share-VDE, LIBRIS XL, VuFind Matrix) */}
              <div className="lg:col-span-3 space-y-5">
                {catalogSearchResults.length === 0 ? (
                  <div className="p-8 sm:p-12 rounded-3xl bg-white/85 backdrop-blur-xl border border-slate-200/90 text-slate-900 shadow-sm space-y-6">
                    <div className="text-center space-y-2 max-w-lg mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
                        <Search className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">
                        لم يتم العثور على مصنفات مطابقة لمعايير البحث
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        لم يُسفر البحث عن نتائج مطابقة للتعبير أو التصفية الحالية. يمكنك تعديل العبارة، توسيع نطاق البحث، أو استكشاف المسارات المقترحة أدناه:
                      </p>
                    </div>

                    <div className="max-w-md mx-auto p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <button
                        onClick={() => {
                          setSelectedSubjectFilter('all');
                          setSelectedAuthorFilter('all');
                          setSelectedEraFilter('all');
                          setSelectedFormatFilter('all');
                          setSelectedAvailabilityFilter('all');
                          setSearchScope('all');
                          setIsAdvancedActive(false);
                          setSearchQuery('');
                          navigateTo({ mode: 'search', query: '' });
                        }}
                        className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        <span>إلغاء كافة الفلاتر وتوسيع البحث لكامل الفهرس</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2 text-center">
                      <div className="text-xs font-bold text-slate-500">عمليات بحث ومفاهيم استكشافية مقترحة:</div>
                      <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
                        {['القبسات', 'علي الوردي', 'مهزلة العقل البشري', 'أنشودة المطر', 'علم الاجتماع', 'الميرداماد', 'الفلسفة الإسلامية'].map(term => (
                          <button
                            key={term}
                            onClick={() => {
                              setSearchQuery(term);
                              navigateTo({ mode: 'search', query: term });
                            }}
                            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 font-semibold cursor-pointer transition-all"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {searchDisplayMode === 'svde-clusters' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {catalogSearchResults.map(work => (
                          <WorkCardComponent
                            key={work.id}
                            work={work}
                            onSelectWork={() => navigateTo({ mode: 'work', workId: work.id })}
                            onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                            onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                            onHoverPerson={(p, e) => triggerHoverCard('person', p, e)}
                            onHoverSubject={(s, e) => triggerHoverCard('subject', s, e)}
                            onLeaveHover={closeHoverCard}
                            isInBookbag={bookbagIds.includes(work.id)}
                            onToggleBookbag={e => handleToggleBookbag(work.id, e)}
                            onCirculationAction={handleCirculationAction}
                          />
                        ))}
                      </div>
                    )}

                    {searchDisplayMode === 'libris-split' && (
                      <LibrisSplitInspectorView
                        works={catalogSearchResults}
                        selectedWork={librisInspectedWork}
                        inspectorTab={librisInspectorTab}
                        onSelectWorkRow={w => setLibrisSelectedWorkId(w.id)}
                        onChangeTab={t => setLibrisInspectorTab(t)}
                        onOpenFullWork={wId => navigateTo({ mode: 'work', workId: wId })}
                        onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                        onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                        onCirculationAction={handleCirculationAction}
                        bookbagIds={bookbagIds}
                        onToggleBookbag={handleToggleBookbag}
                        onCopy={handleCopy}
                      />
                    )}

                    {searchDisplayMode === 'vufind-matrix' && (
                      <VuFindIntegratedMatrixView
                        works={catalogSearchResults}
                        federatedData={federatedSearchData}
                        shelfItems={virtualShelfItems}
                        onSelectWork={wId => navigateTo({ mode: 'work', workId: wId })}
                        onReanchorShelf={wId => setShelfBrowseAnchorId(wId)}
                        onFilterSubject={s => {
                          setSelectedSubjectFilter(s);
                          setCurrentPage(1);
                        }}
                        onCirculationAction={handleCirculationAction}
                        bookbagIds={bookbagIds}
                        onToggleBookbag={handleToggleBookbag}
                        onOpenFullVuFind={() => navigateTo({ mode: 'vufind', initialQuery: navState.query || searchQuery || undefined })}
                      />
                    )}

                    {/* PAGINATION CONTROLS */}
                    {totalPages > 1 && (
                      <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-700 shadow-xs">
                        <div className="text-slate-600">
                          الصفحة <span className="text-slate-900 font-black">{activePageNumber}</span> من أصل <span className="text-slate-900 font-black">{totalPages}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={activePageNumber <= 1}
                            onClick={() => {
                              setCurrentPage(p => Math.max(1, p - 1));
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <ChevronRight className="w-4 h-4" />
                            <span>السابق</span>
                          </button>

                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                            <button
                              key={pageNum}
                              onClick={() => {
                                setCurrentPage(pageNum);
                                window.scrollTo({ top: 300, behavior: 'smooth' });
                              }}
                              className={`w-8 h-8 rounded-xl transition-all cursor-pointer font-bold ${
                                pageNum === activePageNumber
                                  ? 'bg-blue-600 text-white shadow-xs font-black'
                                  : 'hover:bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {pageNum}
                            </button>
                          ))}

                          <button
                            disabled={activePageNumber >= totalPages}
                            onClick={() => {
                              setCurrentPage(p => Math.min(totalPages, p + 1));
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <span>التالي</span>
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* -------------------- VIEW C: PERSON ENTITY PAGE (Full Linking!) -------------------- */}
        {navState.mode === 'person' && activePersonData && (
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <button onClick={() => navigateTo({ mode: 'home' })} className="hover:text-slate-900 cursor-pointer">
                الرئيسية
              </button>
              <ChevronLeft className="w-3.5 h-3.5" />
              <button onClick={() => navigateTo({ mode: 'all-persons' })} className="hover:text-slate-900 cursor-pointer">
                دليل الأعلام
              </button>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-slate-900 font-black">{activePersonData.person.nameArabic}</span>
            </div>

            {/* Person Entity Profile Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur-2xl space-y-6 text-slate-900 border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-black flex items-center gap-1.5 border border-blue-200/80 shadow-xs">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>كيان استنادي معتمد (bf:Person / NACO)</span>
                    </span>
                    {activePersonData.person.lifespan && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700 font-mono border border-slate-200" dir="ltr">
                        {activePersonData.person.lifespan}
                      </span>
                    )}
                    {activePersonData.person.city && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 border border-slate-200">
                        <MapPin className="w-3 h-3 text-amber-600" />
                        <span>{activePersonData.person.city}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-slate-900">
                      {activePersonData.person.nameArabic}
                    </h1>
                    {activePersonData.person.nameEnglish && (
                      <div className="text-sm font-semibold text-blue-700 mt-1 font-sans" dir="ltr">
                        {activePersonData.person.nameEnglish}
                      </div>
                    )}
                  </div>

                  {activePersonData.person.bioArabic && (
                    <p className="text-sm text-slate-600 leading-relaxed font-medium pt-1 max-w-3xl">
                      {activePersonData.person.bioArabic}
                    </p>
                  )}

                  {activePersonData.person.disciplines && activePersonData.person.disciplines.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-xs font-bold text-slate-500">المجالات:</span>
                      {activePersonData.person.disciplines.map(d => (
                        <span key={d} className="px-2.5 py-0.5 rounded-md bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked Authority Identifiers Card */}
                <div className="w-full md:w-80 p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3 flex-shrink-0 text-slate-900 shadow-xs">
                  <div className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>المعرفات الاستنادية الدولية (Linked Authorities)</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold">Canonical MOON URI:</div>
                      <div className="flex items-center gap-1 bg-white p-2 rounded-xl border border-slate-200 font-mono text-[11px] truncate text-blue-700 shadow-xs">
                        <span className="truncate flex-1" dir="ltr">{activePersonData.person.canonicalMoonUri}</span>
                        <button
                          onClick={() => handleCopy(activePersonData.person.canonicalMoonUri, 'Canonical URI')}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="نسخ المعرف"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {activePersonData.person.viafUri && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-bold text-slate-600">VIAF Global:</span>
                        <a
                          href={activePersonData.person.viafUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:text-blue-900 underline flex items-center gap-1 font-mono text-[11px]"
                          dir="ltr"
                        >
                          <span>VIAF Record</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {activePersonData.person.locUri && (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-600">Library of Congress:</span>
                        <a
                          href={activePersonData.person.locUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:text-blue-900 underline flex items-center gap-1 font-mono text-[11px]"
                          dir="ltr"
                        >
                          <span>LOC Authority</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connected Works by This Person */}
              <div className="pt-6 border-t border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>كافة المؤلفات والأعمال الفكرية المرتبطة بهذا العلم ({activePersonData.works.length})</span>
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    مستخرجة من قاعدة البيانات المشتركة
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activePersonData.works.map(work => (
                    <WorkCardComponent
                      key={work.id}
                      work={work}
                      onSelectWork={() => navigateTo({ mode: 'work', workId: work.id })}
                      onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                      onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                      onHoverPerson={(p, e) => triggerHoverCard('person', p, e)}
                      onHoverSubject={(s, e) => triggerHoverCard('subject', s, e)}
                      onLeaveHover={closeHoverCard}
                    />
                  ))}
                </div>
              </div>

              {/* Suggested Bibliography from Authority Profile (Not Yet Cataloged in This Library) */}
              {activePersonData.person.suggestedWorks && activePersonData.person.suggestedWorks.length > 0 && (
                <div className="pt-6 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>مؤلفات استنادية مقترحة (Authority Bibliography — لم تُفهرس في هذه المكتبة بعد)</span>
                    </h3>
                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                      مقترحات استناد فقط (Suggestions Only)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    هذه المصنفات مسجلة ضمن الملف الاستنادي للعلم كمصنفات شهيرة منسوبة إليه، ولكن لم يتم إدخال تسجيلة ببليوغرافية مفهرسة لها في هذه المكتبة بعد.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {activePersonData.person.suggestedWorks.map((title, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="truncate">{title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------- VIEW D: SUBJECT ENTITY PAGE (Full Linking!) -------------------- */}
        {navState.mode === 'subject' && activeSubjectData && (
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <button onClick={() => navigateTo({ mode: 'home' })} className="hover:text-slate-900 cursor-pointer">
                الرئيسية
              </button>
              <ChevronLeft className="w-3.5 h-3.5" />
              <button onClick={() => navigateTo({ mode: 'all-subjects' })} className="hover:text-slate-900 cursor-pointer">
                مكنز المواضيع
              </button>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-slate-900 font-black">{activeSubjectData.subject.label}</span>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur-2xl space-y-6 text-slate-900 border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-black flex items-center gap-1.5 border border-blue-200/80 shadow-xs">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>رأس موضوع استنادي (bf:Topic / skos:Concept)</span>
                  </span>
                  {activeSubjectData.subject.notationDdc && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700 font-mono border border-slate-200">
                      DDC: {activeSubjectData.subject.notationDdc}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 uppercase border border-slate-200">
                    {activeSubjectData.subject.scheme}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-slate-900">
                  {activeSubjectData.subject.label}
                </h1>

                {activeSubjectData.subject.broader && (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                    <span className="font-bold text-slate-500">المصطلح الأعم (Broader Term):</span>
                    <button
                      onClick={() => navigateTo({ mode: 'subject', subjectIdOrLabel: activeSubjectData.subject.broader! })}
                      className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:text-blue-900 border border-blue-200 font-bold cursor-pointer transition-colors"
                    >
                      {activeSubjectData.subject.broader}
                    </button>
                  </div>
                )}
              </div>

              {/* Every Work Classified Under This Subject */}
              <div className="pt-6 border-t border-slate-200/80 space-y-4">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>كافة الكتب والمصنفات المفهرسة تحت هذا الموضوع ({activeSubjectData.works.length})</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSubjectData.works.map(work => (
                    <WorkCardComponent
                      key={work.id}
                      work={work}
                      onSelectWork={() => navigateTo({ mode: 'work', workId: work.id })}
                      onSelectPerson={p => navigateTo({ mode: 'person', personIdOrName: p })}
                      onSelectSubject={s => navigateTo({ mode: 'subject', subjectIdOrLabel: s })}
                      onHoverPerson={(p, e) => triggerHoverCard('person', p, e)}
                      onHoverSubject={(s, e) => triggerHoverCard('subject', s, e)}
                      onLeaveHover={closeHoverCard}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- VIEW E: WORK DETAIL (Synthesizing Libris, LOC, Share-VDE, Iraqi Portal) -------------------- */}
        {navState.mode === 'work' && activeWork && (() => {
          const currentInstance = activeWork.instances[selectedInstanceIndex] || activeWork.instances[0];
          const currentInstanceItems = currentInstance?.items && currentInstance.items.length > 0
            ? currentInstance.items
            : (activeWork.holdingItems?.filter(it => it.instanceId ? it.instanceId === currentInstance?.id : true) || activeWork.holdingItems || []);

          return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Main Record Body (3 Columns) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Breadcrumb Navigation & Top Action Bar (Libris Style) */}
              <div className="flex items-center justify-between text-xs font-bold text-white/60">
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateTo({ mode: 'home' })} className="hover:text-white cursor-pointer">
                    الرئيسية
                  </button>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <button
                    onClick={() => navigateTo({ mode: 'person', personIdOrName: activeWork.primaryCreator.nameArabic })}
                    className="hover:text-white cursor-pointer text-sky-300 underline"
                  >
                    {activeWork.primaryCreator.nameArabic}
                  </button>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-white font-black truncate max-w-sm">{activeWork.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer flex items-center gap-1 transition-colors"
                    title="طباعة التسجيلة"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة</span>
                  </button>
                  <button
                    onClick={() => setCitationModalWork(activeWork)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer flex items-center gap-1 transition-colors"
                    title="توثيق الاقتباس"
                  >
                    <Quote className="w-3.5 h-3.5" />
                    <span>اقتباس</span>
                  </button>
                </div>
              </div>

              {/* Main Work Header Showcase (Libris & Share-VDE Linked Data Synthesis) */}
              <div id="section-top" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] space-y-6 text-slate-900">
                
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* High-definition Cover / Manuscript Illuminations representation */}
                  <div className="w-full sm:w-48 h-64 sm:h-64 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-slate-100 border border-blue-200/80 flex-shrink-0 overflow-hidden shadow-sm flex flex-col items-center justify-center p-4 text-center relative group">
                    <BookOpen className="w-12 h-12 text-blue-600 mb-2" />
                    <div className="font-serif font-black text-slate-900 text-sm leading-snug line-clamp-3">
                      {activeWork.title}
                    </div>
                    <div className="text-[11px] text-blue-700 mt-1 truncate max-w-full font-semibold">
                      {activeWork.primaryCreator.nameArabic}
                    </div>
                    <div className="mt-3 text-[10px] px-2.5 py-0.5 rounded-full bg-white text-slate-700 font-mono border border-slate-200 font-bold">
                      {activeWork.originDate || (activeWork.instances[0]?.publicationYear ? `${activeWork.instances[0].publicationYear} م` : 'تاريخ غير محدد')}
                    </div>
                  </div>

                  {/* Metadata Header Block */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-black flex items-center gap-1.5 border border-blue-200/80 shadow-xs">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>عمل فكري (bf:Work / BIBFRAME 2.0)</span>
                      </span>
                      {/* Live FOLIO Real-Time Availability (RTA) & Circulation Controls */}
                      {activeWork.instances.some(i => i.holdingStatus === 'checked_out') || activeWork.holdingItems?.some(it => it.status === 'checked_out') ? (
                        <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1 shadow-xs">
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          <span>معار حالياً في FOLIO ILS (Checked out)</span>
                        </span>
                      ) : activeWork.instances.some(i => i.holdingStatus === 'paged') || activeWork.holdingItems?.some(it => it.status === 'paged') ? (
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 shadow-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>محجوز / قيد التجهيز في FOLIO (Paged)</span>
                        </span>
                      ) : activeWork.instances.some(i => i.holdingStatus === 'digital_access') ? (
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1 shadow-xs">
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                          <span>إتاحة رقمية مباشرة + نسخة FOLIO</span>
                        </span>
                      ) : activeWork.instances.some(i => i.holdingStatus === 'reference_only') ? (
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 shadow-xs">
                          <BookMarked className="w-3.5 h-3.5 text-amber-600" />
                          <span>محفوظات نادرة — للمطالعة المرجعية في القاعة</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>متاح للإعارة الفورية عبر FOLIO ILS</span>
                        </span>
                      )}
                      {activeWork.classificationLcc && (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700 font-mono border border-slate-200">
                          {activeWork.classificationLcc}
                        </span>
                      )}
                      {/* Direct 1-Click Circulation Action in Header */}
                      {activeWork.instances.some(i => i.holdingStatus === 'checked_out' || i.holdingStatus === 'paged') ? (
                        <button
                          onClick={() => handleCirculationAction({
                            itemId: currentInstanceItems[0]?.id,
                            instanceId: currentInstance?.folioInstanceId || currentInstance?.id || activeWork.id,
                            workId: activeWork.id,
                            action: 'checkin'
                          })}
                          className="px-3 py-1 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>إرجاع النسخة إلى المكتبة (FOLIO Checkin)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCirculationAction({
                            itemId: currentInstanceItems[0]?.id,
                            instanceId: currentInstance?.folioInstanceId || currentInstance?.id || activeWork.id,
                            workId: activeWork.id,
                            action: 'checkout'
                          })}
                          className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <BookCheck className="w-3.5 h-3.5" />
                          <span>إعارة فورية عبر FOLIO (Checkout)</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                        {activeWork.title}
                      </h1>
                      {activeWork.subtitle && (
                        <p className="text-sm sm:text-base text-slate-600 font-semibold pt-1">
                          {activeWork.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Author Dotted Hyperlink with Hover Card (Share-VDE style) */}
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-2 pt-1 flex-wrap">
                      <span className="text-slate-500">المؤلف الرئيسي:</span>
                      <button
                        onMouseEnter={e => triggerHoverCard('person', activeWork.primaryCreator.nameArabic, e)}
                        onMouseLeave={closeHoverCard}
                        onClick={() => navigateTo({ mode: 'person', personIdOrName: activeWork.primaryCreator.nameArabic })}
                        className="text-blue-700 border-b border-dotted border-blue-400 hover:text-blue-900 cursor-pointer font-black inline-flex items-center gap-1 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>{activeWork.primaryCreator.nameArabic}</span>
                      </button>
                      {activeWork.primaryCreator.locUri && (
                        <a
                          href={activeWork.primaryCreator.locUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-mono font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <span>LOC NACO</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Summary */}
                    {activeWork.summaryArabic && (
                      <p className="text-sm text-slate-600 leading-relaxed font-medium pt-1">
                        {activeWork.summaryArabic}
                      </p>
                    )}

                    {/* Subject Tags with Hover Card (Libris & SVDE style) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-xs font-bold text-slate-500 ml-1">المواضيع:</span>
                      {activeWork.subjects.map(s => (
                        <button
                          key={s.id}
                          onMouseEnter={e => triggerHoverCard('subject', s.label, e)}
                          onMouseLeave={closeHoverCard}
                          onClick={() => navigateTo({ mode: 'subject', subjectIdOrLabel: s.label })}
                          className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200/90 transition-colors shadow-xs"
                        >
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3 text-slate-400" /> {s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BIBFRAME INSTANCE SWITCHER (Manifestations & Carrier Types Picker) */}
                <div className="pt-4 border-t border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>الطبعات والمظاهر المادية المتاحة (BIBFRAME Instances • {activeWork.instances.length} مظاهر):</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      نموذج BIBFRAME 2.0: العمل الفكري (Work) ➔ الطبعة (Instance) ➔ النسخة (Item)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {activeWork.instances.map((inst, idx) => {
                      const isSelected = selectedInstanceIndex === idx;
                      return (
                        <button
                          key={inst.id || idx}
                          onClick={() => setSelectedInstanceIndex(idx)}
                          className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer border text-xs space-y-1.5 flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-200 text-slate-900 shadow-sm'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                          }`}
                          aria-selected={isSelected}
                          aria-label={`اختيار الطبعة: ${inst.title}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-black text-xs text-slate-900 truncate">
                                {inst.carrierType || 'طبعة معتمدة'}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                                isSelected ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {inst.publicationYear || 'غير مؤرخ'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-1 font-medium">
                              {inst.publisher || inst.title}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span className="truncate" dir="ltr">{inst.callNumber || inst.shelfLocation}</span>
                            <span className={`font-bold ${
                              inst.holdingStatus === 'digital_access' ? 'text-blue-700' :
                              inst.holdingStatus === 'reference_only' ? 'text-amber-700' :
                              inst.holdingStatus === 'available' ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {inst.holdingStatus === 'digital_access' ? 'رقمي مباشر' :
                               inst.holdingStatus === 'reference_only' ? 'للاطلاع فقط' :
                               inst.holdingStatus === 'available' ? 'متاح' : 'غير متصل'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4 PRIMARY LINKED DATA TABS (Share-VDE & Libris Standard) */}
                <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs font-bold">
                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/90 shadow-xs flex-wrap">
                    <button
                      onClick={() => setRecordFormatMode('full')}
                      className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        recordFormatMode === 'full' ? 'bg-white text-slate-900 font-black shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>تسجيلة الفهرسة الكاملة (Details)</span>
                    </button>

                    <button
                      onClick={() => setRecordFormatMode('relations')}
                      className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        recordFormatMode === 'relations' ? 'bg-white text-blue-900 font-black shadow-xs border border-blue-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Network className="w-3.5 h-3.5 text-blue-600" />
                      <span>شبكة العلاقات الببليوغرافية</span>
                      {activeWork.relatedWorks && activeWork.relatedWorks.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-mono">
                          {activeWork.relatedWorks.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setRecordFormatMode('holdings')}
                      className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        recordFormatMode === 'holdings' ? 'bg-white text-emerald-900 font-black shadow-xs border border-emerald-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Library className="w-3.5 h-3.5 text-emerald-600" />
                      <span>النسخ والمقتنيات (bf:Item)</span>
                      {activeWork.holdingItems && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-mono">
                          {activeWork.holdingItems.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setRecordFormatMode('triples')}
                      className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        recordFormatMode === 'triples' ? 'bg-white text-purple-900 font-black shadow-xs border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5 text-purple-600" />
                      <span>شفرة البيانات المترابطة (RDF)</span>
                    </button>

                    <button
                      onClick={() => setRecordFormatMode('wemi')}
                      className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        recordFormatMode === 'wemi' ? 'bg-white text-slate-900 font-black shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>شجرة الكيانات (WEMI)</span>
                    </button>

                    <a
                      href={`/vufind/Record/${activeWork.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-teal-800 bg-teal-50 border border-teal-200/90 hover:bg-teal-100 font-bold"
                      title="عرض التسجيلة المباشرة في بوابة فايفايند وفهرس Solr"
                    >
                      <Search className="w-3.5 h-3.5 text-teal-600" />
                      <span>عرض في VuFind</span>
                      <ExternalLink className="w-2.5 h-2.5 text-teal-500" />
                    </a>
                  </div>

                  {/* Permalink Copy */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(activeWork.uri, 'Permalink')}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer text-xs font-bold border border-slate-200 shadow-xs transition-colors"
                    >
                      <Copy className="w-3 h-3 text-blue-600" />
                      <span>المعرف الدائم Permalink</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* TAB 1: FULL BIBLIOGRAPHIC DETAILS & MANUSCRIPT CODICOLOGY */}
              {recordFormatMode === 'full' && (
                <div id="section-details" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] space-y-5 text-slate-900">
                  <h2 className="text-base font-black text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>التفاصيل الفهرسية والخصائص الكوديكولوجية (Bibliographic Details & Codicology)</span>
                  </h2>

                  {/* Highlighted Incipit (أوله) and Explicit (آخره) Callouts */}
                  {(activeWork.incipit || activeWork.explicit) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                      {activeWork.incipit && (
                        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-slate-900 space-y-2 shadow-xs">
                          <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <BookMarked className="w-4 h-4 text-amber-700" />
                            <span>فاتحة المخطوطة (أوله):</span>
                          </div>
                          <p className="text-xs font-serif leading-relaxed text-slate-800 pr-3 border-r-2 border-amber-400">
                            {activeWork.incipit}
                          </p>
                        </div>
                      )}
                      {activeWork.explicit && (
                        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-slate-900 space-y-2 shadow-xs">
                          <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <BookMarked className="w-4 h-4 text-amber-700" />
                            <span>خاتمة المخطوطة (آخره):</span>
                          </div>
                          <p className="text-xs font-serif leading-relaxed text-slate-800 pr-3 border-r-2 border-amber-400">
                            {activeWork.explicit}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 text-xs">
                    
                    {/* Contributor and role */}
                    <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <span className="font-bold text-slate-500">المؤلف والمسؤولية الفكرية:</span>
                      <div className="sm:col-span-2">
                        <button
                          onMouseEnter={e => triggerHoverCard('person', activeWork.primaryCreator.nameArabic, e)}
                          onMouseLeave={closeHoverCard}
                          onClick={() => navigateTo({ mode: 'person', personIdOrName: activeWork.primaryCreator.nameArabic })}
                          className="font-black text-blue-700 hover:text-blue-900 underline border-b border-dotted border-blue-400 cursor-pointer transition-colors"
                        >
                          {activeWork.primaryCreator.nameArabic} ({activeWork.primaryCreator.role})
                        </button>
                      </div>
                    </div>

                    {/* Classifications */}
                    <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <span className="font-bold text-slate-500">التصنيف المكتبي (Classification):</span>
                      <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
                        {activeWork.classificationLcc && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-slate-800 font-bold">
                            LCC {activeWork.classificationLcc}
                          </span>
                        )}
                        {activeWork.classificationDdc && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-slate-800 font-bold">
                            DDC {activeWork.classificationDdc}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Identifiers */}
                    <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <span className="font-bold text-slate-500">معرفات الكيان (Identified by):</span>
                      <div className="sm:col-span-2 space-y-1 font-mono text-[11px] text-blue-700">
                        {currentInstance?.callNumber && <div>Accession / ShelfMark: {currentInstance.callNumber}</div>}
                        {currentInstance?.isbn && <div>ISBN: {currentInstance.isbn}</div>}
                        <div>Canonical URI: {activeWork.canonicalMoonUri}</div>
                        <div>Work URI: {activeWork.uri}</div>
                        {currentInstance?.uri && <div>Instance URI: {currentInstance.uri}</div>}
                      </div>
                    </div>

                    {/* Publication details */}
                    {(currentInstance?.publisher || currentInstance?.publicationPlace || currentInstance?.publicationYear || activeWork.originDate) ? (
                      <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <span className="font-bold text-slate-500">مكان وتاريخ النشر / الإنتاج:</span>
                        <div className="sm:col-span-2 text-slate-800 font-medium">
                          {currentInstance?.publisher && <span className="font-bold text-slate-900">{currentInstance.publisher} — </span>}
                          {currentInstance?.publicationPlace ? `${currentInstance.publicationPlace} : ` : ''}
                          {currentInstance?.publicationYear || activeWork.originDate || ''}
                        </div>
                      </div>
                    ) : null}

                    {/* Extent & Physical description */}
                    {(currentInstance?.extent || activeWork.extent || currentInstance?.dimensions || currentInstance?.carrierType) ? (
                      <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <span className="font-bold text-slate-500">الوصف المادي والوعاء:</span>
                        <div className="sm:col-span-2 text-slate-800 font-medium">
                          {currentInstance?.extent || activeWork.extent || ''}
                          {currentInstance?.dimensions && ` ؛ ${currentInstance.dimensions}`}
                          {currentInstance?.carrierType && (
                            <div className="text-slate-500 font-semibold mt-0.5">شكل الوعاء: {currentInstance.carrierType}</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Script & Notation */}
                    {activeWork.notation && (
                      <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <span className="font-bold text-slate-500">نوع الخط والأسلوب التدويني:</span>
                        <div className="sm:col-span-2 text-slate-800 font-medium">
                          {activeWork.notation}
                        </div>
                      </div>
                    )}

                    {/* Codicological Notes */}
                    {activeWork.notes && activeWork.notes.length > 0 && (
                      <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <span className="font-bold text-slate-500">الملاحظات التوثيقية والكوديكولوجية:</span>
                        <div className="sm:col-span-2 space-y-1.5 text-slate-700">
                          {activeWork.notes.map((n, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{n}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Administrative Metadata */}
                    {activeWork.adminMetadata && (
                      <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <span className="font-bold text-slate-500">بيانات الفهرسة الإدارية (bf:AdminMetadata):</span>
                        <div className="sm:col-span-2 font-mono text-[11px] text-slate-600">
                          {activeWork.adminMetadata}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* TAB 2: BIBFRAME 2.0 LINKED GRAPH & RELATIONS (The user's core request!) */}
              {recordFormatMode === 'relations' && (
                <div id="section-relations" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] space-y-6 text-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Network className="w-5 h-5 text-blue-600" />
                        <span>شبكة العلاقات الببليوغرافية المترابطة (BIBFRAME 2.0 Linked Graph)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        روابط حقيقية تربط المجمع التعبيري العام (Hub)، والشروح، والفهارس المرجعية (الذريعة)، والسلاسل التوثيقية
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 self-start sm:self-auto">
                      Share-VDE Linked Data Graph
                    </span>
                  </div>

                  {/* Relations Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeWork.relatedWorks && activeWork.relatedWorks.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400/80 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold border border-blue-200">
                              {rel.predicate}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {rel.targetType}
                            </span>
                          </div>

                          <h3 className="font-black text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                            {rel.targetTitle}
                          </h3>

                          <div className="text-xs text-blue-800 font-bold">
                            {rel.predicateLabel}
                          </div>

                          {rel.details && (
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                              {rel.details}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          {rel.targetUri ? (
                            <a
                              href={rel.targetUri}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-mono flex items-center gap-1 truncate max-w-[200px]"
                              dir="ltr"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{rel.targetUri}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">Internal Linked Entity</span>
                          )}

                          <button
                            onClick={() => {
                              setSearchQuery(rel.targetTitle.split('—')[0].trim());
                              navigateTo({ mode: 'search', query: rel.targetTitle.split('—')[0].trim() });
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>بحث في الفهرس</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: HOLDINGS & PHYSICAL ITEMS (bf:Item + Live FOLIO Circulation) */}
              {recordFormatMode === 'holdings' && (
                <div id="section-holdings" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23_42,0.04)] space-y-6 text-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Library className="w-5 h-5 text-emerald-600" />
                      <span>النسخ والمقتنيات المادية الحية (FOLIO ILS Holdings & Items - bf:Item)</span>
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>متصل لحظياً بنظام الإعارة FOLIO (:8080)</span>
                    </span>
                  </div>

                  {currentInstanceItems && currentInstanceItems.length > 0 ? (
                    <div className="space-y-4">
                      {currentInstanceItems.map((item, idx) => (
                        <div key={item.id || idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-mono font-bold">
                                {idx + 1}
                              </span>
                              <span>{item.heldBy}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono border border-slate-200">
                                {item.shelfMark}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                item.status === 'digital_access' ? 'bg-blue-100 text-blue-800' :
                                item.status === 'reference_only' ? 'bg-amber-100 text-amber-900' :
                                item.status === 'checked_out' ? 'bg-rose-100 text-rose-800' :
                                item.status === 'paged' ? 'bg-amber-100 text-amber-800' :
                                'bg-emerald-100 text-emerald-800'
                              }`}>
                                {item.status === 'digital_access' ? 'إتاحة رقمية مباشرة' :
                                 item.status === 'reference_only' ? 'للاطلاع التراثي المقيد' :
                                 item.status === 'checked_out' ? 'معار حالياً (Checked out)' :
                                 item.status === 'paged' ? 'محجوز (Hold Requested)' :
                                 'متاح للإعارة الفورية (Available)'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="font-bold text-slate-500 block">رمز الاستدعاء (Call Number):</span>
                              <span className="font-mono font-bold text-blue-700">{item.shelfMark}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-500 block">الباركود (FOLIO Barcode):</span>
                              <span className="font-mono text-slate-800">{item.barcode || '3192400001'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-500 block">الوصف المادي:</span>
                              <span className="text-slate-800">{item.extent || currentInstance?.extent || 'مجلد مطبوع'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-500 block">حالة الإعارة في FOLIO:</span>
                              <span className="font-bold text-slate-800">
                                {item.status === 'digital_access' ? 'وصول حر عبر الشابكة' :
                                 item.status === 'reference_only' ? 'للمطالعة داخل القاعة فقط' :
                                 item.status === 'checked_out' ? `معار ${item.dueDate ? `(الاستحقاق: ${item.dueDate})` : ''}` :
                                 item.status === 'paged' ? 'محجوز للمستفيد في قاعة التسليم' :
                                 'جاهزة للإعارة الفورية على الرف'}
                              </span>
                            </div>
                          </div>

                          {/* Live FOLIO Circulation Action Bar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                            <div className="text-[11px] text-slate-500 font-mono">
                              FOLIO Item ID: {item.id}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.status === 'checked_out' || item.status === 'paged' ? (
                                <button
                                  onClick={() => handleCirculationAction({
                                    itemId: item.id,
                                    instanceId: item.folioInstanceId || currentInstance?.folioInstanceId || activeWork.id,
                                    workId: activeWork.id,
                                    action: 'checkin'
                                  })}
                                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>إرجاع النسخة إلى المكتبة (Checkin)</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleCirculationAction({
                                      itemId: item.id,
                                      instanceId: item.folioInstanceId || currentInstance?.folioInstanceId || activeWork.id,
                                      workId: activeWork.id,
                                      action: 'checkout'
                                    })}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <BookCheck className="w-3.5 h-3.5" />
                                    <span>إعارة فورية عبر FOLIO (Checkout)</span>
                                  </button>
                                  <button
                                    onClick={() => handleCirculationAction({
                                      itemId: item.id,
                                      instanceId: item.folioInstanceId || currentInstance?.folioInstanceId || activeWork.id,
                                      workId: activeWork.id,
                                      action: 'request'
                                    })}
                                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                                    <span>طلب حجز (Place Hold)</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {item.acquisitionSource && (
                            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                              <span className="font-bold text-slate-900">مصدر التملك والحفظ: </span>
                              <span>{item.acquisitionSource}</span>
                              {item.immediateAcquisition && <div className="text-slate-500 mt-0.5">{item.immediateAcquisition}</div>}
                            </div>
                          )}

                          {item.notes && item.notes.length > 0 && (
                            <div className="text-xs text-slate-600 space-y-1">
                              <span className="font-bold text-slate-800">ملاحظات النسخة:</span>
                              {item.notes.map((n, i) => (
                                <div key={i} className="flex items-center gap-1.5 pr-2">
                                  <span className="text-emerald-500">•</span>
                                  <span>{n}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Direct Digital Access Action Button */}
                          {item.accessUrl && (
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                              <a
                                href={item.accessUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                              >
                                <span>الوصول المباشر إلى النسخة الرقمية (Open Digital Access)</span>
                                <ExternalLink className="w-3.5 h-3.5 text-white" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 space-y-2">
                      <Library className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="font-bold text-slate-800">لا توجد نسخ مادية أو رقمية (bf:Item) مسجلة لهذه الطبعة حالياً</div>
                      <div className="text-slate-500">
                        وفقاً لمعيار BIBFRAME 2.0، يتم إظهار النسخ فقط عندما ترتبط تسجيلة كينونة مادية موثقة بهذه الطبعة.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: RAW LINKED DATA & RDF TRIPLES */}
              {recordFormatMode === 'triples' && (
                <div id="section-triples" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] space-y-5 text-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Code className="w-5 h-5 text-purple-600" />
                        <span>مفتش البيانات المترابطة (Linked Data Triples & Formats)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        استعراض ثلاثيات RDF الحية أو تصدير التسجيلة بصيغ Turtle وJSON-LD وMARC 21
                      </p>
                    </div>

                    {/* Sub-format toggles */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
                      <button
                        onClick={() => setActiveTripleFormat('table')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTripleFormat === 'table' ? 'bg-white text-purple-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        جدول الثلاثيات
                      </button>
                      <button
                        onClick={() => setActiveTripleFormat('turtle')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTripleFormat === 'turtle' ? 'bg-white text-purple-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Turtle RDF
                      </button>
                      <button
                        onClick={() => setActiveTripleFormat('jsonld')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTripleFormat === 'jsonld' ? 'bg-white text-purple-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        JSON-LD
                      </button>
                      <button
                        onClick={() => setActiveTripleFormat('marc')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTripleFormat === 'marc' ? 'bg-white text-purple-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        MARC 21
                      </button>
                    </div>
                  </div>

                  {/* Triples Table View */}
                  {activeTripleFormat === 'table' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                            <th className="py-2.5 px-3">العنصر (Subject)</th>
                            <th className="py-2.5 px-3">المحمول (Predicate)</th>
                            <th className="py-2.5 px-3">الكيان / القيمة (Object / Target)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {activeWork.rawBibframeTriples && activeWork.rawBibframeTriples.map((t, i) => (
                            <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-800">{t.subject}</td>
                              <td className="py-2.5 px-3 font-bold text-blue-700">{t.predicate}</td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {t.objectUri ? (
                                  <a
                                    href={t.objectUri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                    dir="ltr"
                                  >
                                    <span>{t.object}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span>{t.object}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Turtle View */}
                  {activeTripleFormat === 'turtle' && (
                    <div className="p-4 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto space-y-2" dir="ltr">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                        <span>Turtle RDF Representation</span>
                        <button
                          onClick={() => handleCopy(wolfMoonOpacService.generateTurtleRdf(activeWork), 'Turtle')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
                        >
                          Copy Turtle
                        </button>
                      </div>
                      <pre className="text-emerald-300">{wolfMoonOpacService.generateTurtleRdf(activeWork)}</pre>
                    </div>
                  )}

                  {/* JSON-LD View */}
                  {activeTripleFormat === 'jsonld' && (
                    <div className="p-4 rounded-2xl bg-slate-900 text-sky-300 font-mono text-xs overflow-x-auto space-y-2" dir="ltr">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                        <span>Framed JSON-LD (Libris / SVDE standard)</span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(wolfMoonOpacService.generateFramedJsonLd(activeWork), null, 2), 'JSON-LD')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
                        >
                          Copy JSON-LD
                        </button>
                      </div>
                      <pre className="text-sky-300">{JSON.stringify(wolfMoonOpacService.generateFramedJsonLd(activeWork), null, 2)}</pre>
                    </div>
                  )}

                  {/* MARC 21 View */}
                  {activeTripleFormat === 'marc' && (
                    <div className="p-4 rounded-2xl bg-slate-900 text-amber-300 font-mono text-xs overflow-x-auto space-y-2" dir="ltr">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                        <span>MARC 21 Bibliographic Format</span>
                        <button
                          onClick={() => handleCopy(wolfMoonOpacService.generateMarc21Mapping(activeWork), 'MARC21')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
                        >
                          Copy MARC
                        </button>
                      </div>
                      <pre className="text-amber-300">{wolfMoonOpacService.generateMarc21Mapping(activeWork)}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-SECTION: SHARE-VDE 4-TIER WEMI CLUSTER (Hub -> Work/Expression -> Instance -> Item) */}
              {recordFormatMode === 'wemi' && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] text-xs space-y-5 text-slate-900">
                  <div className="font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-sm font-black">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>شجرة الكيانات الببليوغرافية ذات الـ 4 طبقات (Share-VDE Sapientia WEMI / IFLA LRM)</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px]">
                      bf:Hub ➔ bf:Work ➔ bf:Instance ➔ bf:Item
                    </span>
                  </div>

                  {activeWorkWemiTree ? (
                    <div className="space-y-4">
                      {/* Tier 1: Opus / Hub */}
                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-mono font-bold text-[10px]">
                              TIER 1 • {activeWorkWemiTree.badge}
                            </span>
                            <span className="font-black text-indigo-950 text-sm">{activeWorkWemiTree.label}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(activeWorkWemiTree.uri, 'Hub URI')}
                            className="text-[10px] font-mono text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                            dir="ltr"
                          >
                            <span>{activeWorkWemiTree.uri}</span>
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {activeWorkWemiTree.subtitle && (
                          <div className="text-[11px] text-indigo-800 font-medium">{activeWorkWemiTree.subtitle}</div>
                        )}

                        {/* Tier 2: Work / Expression */}
                        <div className="pr-4 border-r-2 border-indigo-400 space-y-3 pt-2">
                          {activeWorkWemiTree.children?.map(workNode => (
                            <div key={workNode.id} className="p-4 rounded-2xl bg-white border border-blue-200 space-y-3 shadow-xs">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-[10px]">
                                    TIER 2 • {workNode.badge}
                                  </span>
                                  <span className="font-black text-slate-900">{workNode.label}</span>
                                </div>
                                <span className="text-[10px] font-mono text-blue-700" dir="ltr">{workNode.uri}</span>
                              </div>
                              {workNode.subtitle && (
                                <div className="text-[11px] text-slate-600 font-medium">{workNode.subtitle}</div>
                              )}

                              {/* Tier 3: Instances / Manifestations */}
                              <div className="pr-4 border-r-2 border-blue-400 space-y-2.5 pt-1">
                                {workNode.children?.map((instNode, instIdx) => (
                                  <div key={instNode.id || instIdx} className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 font-mono font-bold text-[10px]">
                                          TIER 3 • {instNode.badge}
                                        </span>
                                        <span className="font-bold text-slate-900">{instNode.label}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-500" dir="ltr">{instNode.uri}</span>
                                    </div>
                                    {instNode.subtitle && (
                                      <div className="text-[11px] text-slate-600">{instNode.subtitle}</div>
                                    )}

                                    {/* Tier 4: Physical / Digital Items (FOLIO ILS) */}
                                    {instNode.children && instNode.children.length > 0 && (
                                      <div className="pr-4 border-r-2 border-emerald-400 space-y-1.5 pt-1">
                                        {instNode.children.map((itemNode, itIdx) => (
                                          <div
                                            key={itemNode.id || itIdx}
                                            className="p-2.5 rounded-xl bg-white border border-emerald-200/80 flex items-center justify-between flex-wrap gap-2"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[10px]">
                                                TIER 4 • {itemNode.badge}
                                              </span>
                                              <div>
                                                <div className="font-bold text-slate-800 text-[11px]">{itemNode.label}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{itemNode.subtitle}</div>
                                              </div>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                              itemNode.status === 'checked_out' ? 'bg-rose-100 text-rose-800' :
                                              itemNode.status === 'paged' ? 'bg-amber-100 text-amber-800' :
                                              'bg-emerald-100 text-emerald-800'
                                            }`}>
                                              {itemNode.status === 'checked_out' ? 'معار FOLIO' :
                                               itemNode.status === 'paged' ? 'محجوز FOLIO' : 'متاح على الرف FOLIO'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* VUFIND VIRTUAL SHELF BROWSE CAROUSEL (Call Number Neighbor Discovery) */}
              <VirtualShelfBrowseSection
                items={virtualShelfItems}
                onSelectWork={workId => navigateTo({ mode: 'work', workId })}
                onReanchor={workId => setShelfBrowseAnchorId(workId)}
              />

              {/* RECOMMENDATION ENGINE: "ربما يعجبك أيضاً" */}
              <div id="section-related" className="p-6 sm:p-8 rounded-3xl bg-white/75 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.04)] space-y-4 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>ربما يعجبك أيضاً (مصنفات ذات صلة في الفهرس)</span>
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">مبنية على تشابه المواضيع والأعلام</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedWorksList.map(rw => (
                    <div
                      key={rw.id}
                      onClick={() => navigateTo({ mode: 'work', workId: rw.id })}
                      className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group text-slate-900"
                    >
                      <div className="space-y-2">
                        <div className="h-28 rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-800 font-serif font-black text-xs text-center p-2 group-hover:scale-102 transition-transform shadow-xs">
                          <BookOpen className="w-5 h-5 text-blue-600 mb-1" />
                          <span className="line-clamp-2 px-1">{rw.title}</span>
                        </div>
                        <h4 className="font-black text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {rw.title}
                        </h4>
                        <div className="text-[11px] text-blue-700 font-medium truncate">
                          {rw.primaryCreator.nameArabic}
                        </div>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                        {rw.originDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Sticky "On This Page" Table of Contents (Matching Libris & LOC) */}
            <div className="hidden lg:block lg:col-span-1 sticky top-20 space-y-4">
              <div className="p-5 rounded-3xl bg-white/80 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-3 text-slate-900">
                <div className="text-xs font-black text-slate-900 border-b border-slate-200/80 pb-2">
                  في هذه الصفحة (On this page)
                </div>
                <nav className="space-y-1 text-xs font-semibold text-slate-600">
                  <button
                    onClick={() => setRecordFormatMode('full')}
                    className={`w-full text-right block px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      recordFormatMode === 'full' ? 'bg-blue-50 text-blue-900 font-black' : 'hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    • تسجيلة الفهرسة الكاملة (Details)
                  </button>
                  <button
                    onClick={() => setRecordFormatMode('relations')}
                    className={`w-full text-right block px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      recordFormatMode === 'relations' ? 'bg-blue-50 text-blue-900 font-black' : 'hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    • شبكة العلاقات الببليوغرافية (Graph)
                  </button>
                  <button
                    onClick={() => setRecordFormatMode('holdings')}
                    className={`w-full text-right block px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      recordFormatMode === 'holdings' ? 'bg-emerald-50 text-emerald-900 font-black' : 'hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    • النسخ والمقتنيات (Holdings)
                  </button>
                  <button
                    onClick={() => setRecordFormatMode('triples')}
                    className={`w-full text-right block px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      recordFormatMode === 'triples' ? 'bg-purple-50 text-purple-900 font-black' : 'hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    • شفرة وثلاثيات RDF
                  </button>
                  <button
                    onClick={() => setRecordFormatMode('wemi')}
                    className={`w-full text-right block px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      recordFormatMode === 'wemi' ? 'bg-indigo-50 text-indigo-900 font-black' : 'hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    • شجرة الكيانات WEMI Cluster
                  </button>
                </nav>
              </div>

              {/* Quick Actions Card */}
              <div className="p-5 rounded-3xl bg-white/80 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-2.5 text-xs text-slate-900">
                <div className="font-black text-slate-900 pb-1">الإجراءات السريعة:</div>
                <button
                  onClick={() => handleToggleBookbag(activeWork.id)}
                  className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all border ${
                    bookbagIds.includes(activeWork.id)
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{bookbagIds.includes(activeWork.id) ? 'محفوظ في حقيبة المقارنة' : 'إضافة لحقيبة المقارنة (Bookbag)'}</span>
                </button>
                <button
                  onClick={() => setCitationModalWork(activeWork)}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Quote className="w-3.5 h-3.5 text-white" />
                  <span>اقتباس العمل (Cite)</span>
                </button>
                <button
                  onClick={() => handleCopy(activeWork.canonicalMoonUri, 'Canonical URI')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 transition-all"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>نسخ المعرف الدائم</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>طباعة تسجيلة الفهرسة</span>
                </button>
              </div>
            </div>

            </div>
          );
        })()}

        {/* -------------------- VIEW F: ALL PERSONS DIRECTORY ("show every person") -------------------- */}
        {navState.mode === 'all-persons' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div>
                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <span>دليل الأعلام والمؤلفين الشامل (Every Person Directory)</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium pt-0.5">
                  استعراض لكافة الأعلام المعتمدين والمربوطين في قاعدة البيانات المشتركة مع عدد المصنفات لكل علم
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 font-mono font-bold text-xs border border-blue-200/80 text-blue-700">
                {allPersonsList.length} شخصية
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allPersonsList.map(person => (
                <div
                  key={person.id}
                  onClick={() => navigateTo({ mode: 'person', personIdOrName: person.nameArabic })}
                  className="p-5 rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/90 hover:bg-white transition-all cursor-pointer flex flex-col justify-between group text-slate-900 shadow-xs hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors border border-slate-200">
                        {person.nameArabic.charAt(0)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-200">
                        {person.worksCount} مؤلف
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                        {person.nameArabic}
                      </h3>
                      {person.nameEnglish && (
                        <div className="text-[11px] text-slate-500 font-medium" dir="ltr">
                          {person.nameEnglish}
                        </div>
                      )}
                    </div>

                    {person.lifespan && (
                      <div className="text-[11px] text-amber-700 font-mono" dir="ltr">
                        {person.lifespan}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700 group-hover:text-blue-900 group-hover:translate-x-0.5 transition-all">
                    <span>استعراض الكيان وكافة أعماله</span>
                    <ChevronLeft className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------- VIEW G: ALL SUBJECTS DIRECTORY ("show every subject") -------------------- */}
        {navState.mode === 'all-subjects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div>
                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  <span>مكنز ومفهرس المواضيع العام (Every Subject Taxonomy)</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium pt-0.5">
                  رؤوس الموضوعات والمفاهيم المعيارية وتصنيفاتها المترابطة
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 font-mono font-bold text-xs border border-blue-200/80 text-blue-700">
                {allSubjectsList.length} موضوع
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {allSubjectsList.map(subj => (
                <div
                  key={subj.id}
                  onClick={() => navigateTo({ mode: 'subject', subjectIdOrLabel: subj.label })}
                  className="p-5 rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/90 hover:bg-white transition-all cursor-pointer flex flex-col justify-between group text-slate-900 shadow-xs hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 uppercase border border-slate-200">
                        {subj.scheme}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        {subj.worksCount} مصنف
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      {subj.label}
                    </h3>

                    {subj.notationDdc && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        DDC: {subj.notationDdc}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700 group-hover:text-blue-900 group-hover:translate-x-0.5 transition-all">
                    <span>فتح الأعمال المرتبطة</span>
                    <ChevronLeft className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------- VIEW H: VUFIND DISCOVERY OPAC -------------------- */}
        {navState.mode === 'vufind' && (
          <div className="space-y-6">
            <WolfMoonVuFindPortal
              onImportToEditor={() => {
                if (onOpenEditor) onOpenEditor();
                else window.location.href = '/';
              }}
              isDark={false}
            />
          </div>
        )}

      </main>

      {/* =========================================================================
          4. FLOATING GLASS HOVER CARD ("show info on hover")
          ========================================================================= */}
      <AnimatePresence>
        {hoverCardState.visible && hoverCardState.data && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={() => clearTimeout(hoverTimerRef.current)}
            onMouseLeave={closeHoverCard}
            style={{
              position: 'absolute',
              left: Math.max(16, Math.min(window.innerWidth - 340, hoverCardState.x - 160)),
              top: hoverCardState.y,
              zIndex: 100
            }}
            className="w-80 p-5 rounded-2xl bg-white/95 backdrop-blur-2xl shadow-2xl space-y-2.5 text-xs pointer-events-auto border border-slate-200/90 text-slate-900"
          >
            {/* Person Hover Card */}
            {hoverCardState.type === 'person' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-black text-sm flex items-center justify-center shadow-xs">
                    <User className="w-4 h-4 text-blue-600" />
                  </span>
                  <div>
                    <div className="font-black text-slate-900">{hoverCardState.data.title}</div>
                    <div className="text-[10px] text-blue-700 font-mono" dir="ltr">
                      {hoverCardState.data.lifespan || hoverCardState.data.subtitle}
                    </div>
                  </div>
                </div>
                {hoverCardState.data.bio && (
                  <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                    {hoverCardState.data.bio}
                  </p>
                )}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">مؤلفات في الفهرس:</span>
                  <span className="font-black text-blue-700">{hoverCardState.data.worksCount} عمل</span>
                </div>
              </div>
            )}

            {/* Subject Hover Card */}
            {hoverCardState.type === 'subject' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-sm flex items-center justify-center shadow-xs">
                    <Tag className="w-4 h-4 text-emerald-600" />
                  </span>
                  <div>
                    <div className="font-black text-slate-900">{hoverCardState.data.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Scheme: {hoverCardState.data.scheme} {hoverCardState.data.ddc && `• DDC ${hoverCardState.data.ddc}`}
                    </div>
                  </div>
                </div>
                {hoverCardState.data.broader && (
                  <div className="text-[10px] text-slate-500">
                    المصطلح الأعم: <span className="font-bold text-slate-800">{hoverCardState.data.broader}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">المصنفات تحت هذا الموضوع:</span>
                  <span className="font-black text-emerald-700">{hoverCardState.data.worksCount} مصنف</span>
                </div>
              </div>
            )}

            {/* Publisher Hover Card */}
            {hoverCardState.type === 'publisher' && (
              <div className="space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-1.5"><Building className="w-4 h-4 text-purple-600" /> {hoverCardState.data.title}</div>
                {hoverCardState.data.city && (
                  <div className="text-[11px] text-slate-500">المقر: {hoverCardState.data.city}</div>
                )}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">المطبوعات في الفهرس:</span>
                  <span className="font-black text-purple-700">{hoverCardState.data.worksCount} مطبوع</span>
                </div>
              </div>
            )}

            {/* Classification Hover Card */}
            {hoverCardState.type === 'classification' && (
              <div className="space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-1.5"><Compass className="w-4 h-4 text-amber-600" /> {hoverCardState.data.title}</div>
                {hoverCardState.data.subtitle && (
                  <div className="text-[11px] text-slate-500">{hoverCardState.data.subtitle}</div>
                )}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">المصنفات المرتبطة:</span>
                  <span className="font-black text-blue-700">{hoverCardState.data.worksCount} مصنف</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          5. CITATION MODAL
          ========================================================================= */}
      {citationModalWork && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl p-6 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Quote className="w-4 h-4 text-blue-600" />
                <span>توثيق واقتباس العمل: {citationModalWork.title}</span>
              </h3>
              <button
                onClick={() => setCitationModalWork(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const cites = wolfMoonOpacService.generateCitations(citationModalWork);
              return (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                      <span>APA 7th Edition:</span>
                      <button
                        onClick={() => handleCopy(cites.apa, 'APA')}
                        className="text-blue-700 hover:text-blue-900 underline cursor-pointer font-bold"
                      >
                        نسخ
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-medium select-all text-slate-800 leading-relaxed">
                      {cites.apa}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                      <span>Chicago Manual of Style:</span>
                      <button
                        onClick={() => handleCopy(cites.chicago, 'Chicago')}
                        className="text-blue-700 hover:text-blue-900 underline cursor-pointer font-bold"
                      >
                        نسخ
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-medium select-all text-slate-800 leading-relaxed">
                      {cites.chicago}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                      <span>BibTeX:</span>
                      <button
                        onClick={() => handleCopy(cites.bibtex, 'BibTeX')}
                        className="text-blue-700 hover:text-blue-900 underline cursor-pointer font-bold"
                      >
                        نسخ
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner" dir="ltr">
                      {cites.bibtex}
                    </pre>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          5B. VUFIND RESEARCH BOOKBAG & MULTI-RECORD COMPARATOR MODAL
          ========================================================================= */}
      <AnimatePresence>
        {isBookbagOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-6xl p-6 sm:p-8 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl space-y-5 text-slate-900 my-auto max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-amber-600 fill-amber-500" />
                    <span>حقيبة الباحث ومقارنة التسجيلات الببليوغرافية (VuFind Bookbag & Multi-Record Comparator)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-xs">
                      {bookbagWorks.length} مصنف
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    قارن التسجيلات جنباً إلى جنب وفق معايير Share-VDE وLIBRIS XL أو صدّرها دفعة واحدة بصيغ RIS وBibTeX وMARC21 وJSON-LD
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {bookbagWorks.length > 0 && (
                    <>
                      <button
                        onClick={() => handleExportBookbag('ris')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>تصدير RIS</span>
                      </button>
                      <button
                        onClick={() => handleExportBookbag('bibtex')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تصدير BibTeX</span>
                      </button>
                      <button
                        onClick={() => handleExportBookbag('marc21')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-600" />
                        <span>تصدير MARC 21</span>
                      </button>
                      <button
                        onClick={() => handleExportBookbag('jsonld')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>تصدير BIBFRAME JSON-LD</span>
                      </button>
                      <button
                        onClick={() => {
                          wolfMoonOpacService.clearBookbag();
                          setBookbagIds([]);
                          toast.info('تم تفريغ حقيبة الباحث');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                      >
                        تفريغ الحقيبة
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsBookbagOpen(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {bookbagWorks.length === 0 ? (
                <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <Bookmark className="w-10 h-10 text-amber-500 mx-auto" />
                  <div className="font-black text-base text-slate-900">حقيبة الباحث فارغة حالياً</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    اضغط على أيقونة الحفظ (Bookmark) على أي تسجيلة عمل في نتائج البحث لإضافتها إلى مصفوفة المقارنة الببليوغرافية والتصدير المجمع.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="p-3 font-black text-slate-700 w-40 border-l border-slate-200">حقل المقارنة</th>
                        {bookbagWorks.map(w => (
                          <th key={w.id} className="p-3 font-black text-slate-900 min-w-[230px] border-l border-slate-200">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() => {
                                  setIsBookbagOpen(false);
                                  navigateTo({ mode: 'work', workId: w.id });
                                }}
                                className="text-blue-700 hover:underline text-right font-black line-clamp-2 cursor-pointer"
                              >
                                {w.title}
                              </button>
                              <button
                                onClick={() => handleToggleBookbag(w.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="إزالة من المقارنة"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">المؤلف (bf:Agent)</td>
                        {bookbagWorks.map(w => (
                          <td key={w.id} className="p-3 font-bold text-slate-800 border-l border-slate-200">
                            {w.primaryCreator.nameArabic}
                            <div className="text-[10px] font-mono text-slate-500" dir="ltr">{w.primaryCreator.canonicalMoonUri}</div>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">تاريخ التأليف / النشر</td>
                        {bookbagWorks.map(w => (
                          <td key={w.id} className="p-3 font-mono text-slate-800 border-l border-slate-200">
                            {w.originDate || w.instances[0]?.publicationYear || 'غير مؤرخ'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">التصنيف ورقم الطلب</td>
                        {bookbagWorks.map(w => (
                          <td key={w.id} className="p-3 font-mono text-blue-700 font-bold border-l border-slate-200">
                            {w.classificationLcc || w.instances[0]?.callNumber || '—'} {w.classificationDdc ? `• DDC ${w.classificationDdc}` : ''}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">الطبعات (bf:Instance)</td>
                        {bookbagWorks.map(w => (
                          <td key={w.id} className="p-3 text-slate-800 border-l border-slate-200">
                            <span className="font-bold">{w.instances.length} طبعات</span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {w.instances.map(i => i.publisher || i.title).slice(0, 2).join(' • ')}
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">إتاحة FOLIO ILS</td>
                        {bookbagWorks.map(w => {
                          const isOut = w.instances.some(i => i.holdingStatus === 'checked_out');
                          return (
                            <td key={w.id} className="p-3 border-l border-slate-200">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOut ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isOut ? 'معار حالياً' : 'متاح للإعارة'}
                                </span>
                                <button
                                  onClick={() => handleCirculationAction({
                                    workId: w.id,
                                    instanceId: w.instances[0]?.folioInstanceId || w.instances[0]?.id || w.id,
                                    action: isOut ? 'checkin' : 'checkout'
                                  })}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  {isOut ? 'إرجاع FOLIO' : 'إعارة FOLIO'}
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-500 bg-slate-50 border-l border-slate-200">رؤوس الموضوعات</td>
                        {bookbagWorks.map(w => (
                          <td key={w.id} className="p-3 border-l border-slate-200">
                            <div className="flex flex-wrap gap-1">
                              {w.subjects.map(s => (
                                <span key={s.id} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {s.label}
                                </span>
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          6. MULTI-SOURCE AI AUTHOR PROFILE SYNTHESIS MODAL (Requested Add-on)
          ========================================================================= */}
      <AnimatePresence>
        {isAiProfileModalOpen && (
          <div className="fixed inset-0 z-50 ai-liquid-glass-backdrop flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.24 }}
              className="w-full max-w-4xl p-6 sm:p-8 rounded-3xl ai-liquid-glass-panel relative overflow-hidden border border-white/25 shadow-2xl space-y-6 text-white my-auto max-h-[92vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-white/15 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="visionos-spatial-orb w-9 h-9 flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5 text-amber-200" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      منظومة توليف ملفات الاستناد الذكية متعددة المصادر
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-white/70 font-medium">
                    توليف وتحليل سير الأعلام المعرفية عبر وفاق الذكاء الاصطناعي مع حفظ تسجيلة الاستناد المعرفي برمز MOON URI في النظام
                  </p>
                </div>
                <button
                  onClick={() => setIsAiProfileModalOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Multi-Source API Pipeline Active Status Bar */}
              <div className="p-3.5 rounded-2xl css-glass-card space-y-2 border border-white/15">
                <div className="flex items-center justify-between text-xs font-bold text-white/80">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>المصادر المتصلة في خوارزمية التوليف المباشر (Multi-Source Consensus):</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300">7 API Endpoints Active</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>Google Gemini 3.7 Flash</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>Library of Congress (id.loc.gov)</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>VIAF International Authority</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>دار الكتب والوثائق العراقية (INLA)</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>OpenAlex Academic Graph</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 font-medium flex items-center gap-1">
                    <span>Wikidata SPARQL Knowledge Base</span>
                  </span>
                </div>
              </div>

              {/* Author Selector & Live Input */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 rounded-2xl bg-white/10 border border-white/20 focus-within:border-white/40 flex items-center px-3.5 py-2">
                    <Search className="w-4 h-4 text-white/60 ml-2" />
                    <input
                      type="text"
                      value={aiAuthorQuery}
                      onChange={e => setAiAuthorQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSynthesizeAuthorProfile(aiAuthorQuery.trim());
                      }}
                      placeholder="اكتب اسم العلم أو المؤلف (مثل: علي الوردي، بدر شاكر السياب، نازك الملائكة)..."
                      className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/40 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleSynthesizeAuthorProfile(aiAuthorQuery.trim())}
                    disabled={isAiSynthesizing || !aiAuthorQuery.trim()}
                    className="liquid-glass-primary px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isAiSynthesizing ? 'animate-spin' : ''}`} />
                    <span>توليف واستدعاء الملف</span>
                  </button>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/80">
                  <span className="text-[11px] text-white/50">أعلام مقترحة للتجربة الفورية:</span>
                  {['علي الوردي', 'بدر شاكر السياب', 'نازك الملائكة', 'محمد مهدي الجواهري', 'الميرداماد', 'مظفر النواب'].map(name => (
                    <button
                      key={name}
                      onClick={() => {
                        setAiAuthorQuery(name);
                        handleSynthesizeAuthorProfile(name);
                      }}
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold cursor-pointer transition-all ${
                        aiAuthorQuery === name
                          ? 'bg-white/30 border-white/40 text-white font-black'
                          : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Synthesized Author Profile Dossier Card */}
              {synthesizedProfile && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono text-[11px] font-bold">
                          MOON CANONICAL URI
                        </span>
                        {profileSavedSuccess ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>محفوظ ومسجل في النظام (Saved to System)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15 text-[11px]">
                            جاهز للحفظ في مستودع النظام
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm sm:text-base font-black text-amber-200 select-all flex items-center gap-2">
                        <span>{synthesizedProfile.moonUri}</span>
                        <button
                          onClick={() => handleCopy(synthesizedProfile.moonUri, 'رمز MOON URI')}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white cursor-pointer"
                          title="نسخ معرف MOON"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveProfileRecord}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all shadow-lg ${
                          profileSavedSuccess
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400'
                            : 'liquid-glass-primary border-amber-300/40'
                        }`}
                      >
                        {profileSavedSuccess ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>تم الحفظ في النظام</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4 text-amber-300" />
                            <span>حفظ تسجيلة الاستناد في النظام</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl css-glass-card space-y-5 shadow-lg border border-white/20">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white/20 border border-white/30 flex-shrink-0 flex items-center justify-center font-black text-2xl text-white shadow-md">
                          {synthesizedProfile.suggestedNameArabic?.charAt(0) || <User className="w-8 h-8" />}
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-white">
                            {synthesizedProfile.suggestedNameArabic || synthesizedProfile.primarySuggestion}
                          </h3>
                          <div className="text-xs text-white/70 font-mono mt-0.5">
                            {synthesizedProfile.suggestedNameEnglish} • {synthesizedProfile.birthDate} - {synthesizedProfile.deathDate || 'معاصر'}
                          </div>
                          <div className="text-xs text-amber-300 font-semibold mt-1">
                            {synthesizedProfile.affiliation} • {synthesizedProfile.birthCity}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {synthesizedProfile.disciplines?.map((disc, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/90"
                          >
                            {disc}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-white/60">
                        الخلاصة البيوغرافية والاستنادية الموثقة (Scholarly Narrative):
                      </h4>
                      <p className="text-xs sm:text-sm text-white/90 font-medium leading-relaxed bg-black/20 p-4 rounded-2xl border border-white/10">
                        {synthesizedProfile.summaryAr}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                          <span>أهم المصنفات والإنتاج الفكري ({synthesizedProfile.majorWorks?.length || 0}):</span>
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          {synthesizedProfile.majorWorks?.map((work, wIdx) => (
                            <div
                              key={wIdx}
                              className="p-2 rounded-xl bg-white/10 flex items-center justify-between text-white/90"
                            >
                              <span className="font-bold">{work.title}</span>
                              <span className="font-mono text-[10px] text-white/60">{work.year}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>المعرفات الاستنادية الدولية المرتبطة:</span>
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          {synthesizedProfile.authorities?.map((auth, aIdx) => (
                            <div
                              key={aIdx}
                              className="p-2 rounded-xl bg-white/10 flex items-center justify-between"
                            >
                              <span className="font-bold text-white/90">{auth.name}</span>
                              <span className="font-mono text-[10px] text-sky-300 truncate max-w-[180px]" dir="ltr">
                                {auth.identifier || auth.uri}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setIsAiProfileModalOpen(false);
                          navigateTo({ mode: 'person', personIdOrName: synthesizedProfile.suggestedNameArabic || synthesizedProfile.primarySuggestion });
                        }}
                        className="text-sky-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>تصفح كافة أعمال المؤلف في فهرس OPAC</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <span className="text-[11px] text-white/50 font-mono">
                        Generated by Moon Multi-Source AI Engine v3.0
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          7. FOOTER
          ========================================================================= */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/75 backdrop-blur-xl py-6 px-4 text-center text-xs text-slate-600 font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">WOF MOON Unified OPAC</span>
            <span>•</span>
            <span>Share-VDE (svde.org) • LIBRIS XL (libris.kb.se) • VuFind 11.0 • Apache Solr • FOLIO ILS</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            BIBFRAME 2.0 / 3.0.1 • IFLA LRM WEMI • W3C SPARQL • Moon Canonical URI
          </div>
        </div>
      </footer>

    </div>
  );
}

// =========================================================================
// REUSABLE WORK CARD COMPONENT (Share-VDE Cluster + Inline Publications + FOLIO RTA + VuFind Bookbag)
// =========================================================================

function WorkCardComponent({
  work,
  onSelectWork,
  onSelectPerson,
  onSelectSubject,
  onHoverPerson,
  onHoverSubject,
  onLeaveHover,
  isInBookbag = false,
  onToggleBookbag,
  onCirculationAction
}: {
  work: OpacWorkEntity;
  onSelectWork: () => void;
  onSelectPerson: (name: string) => void;
  onSelectSubject: (label: string) => void;
  onHoverPerson: (name: string, e: React.MouseEvent) => void;
  onHoverSubject: (label: string, e: React.MouseEvent) => void;
  onLeaveHover: () => void;
  isInBookbag?: boolean;
  onToggleBookbag?: (e: React.MouseEvent) => void;
  onCirculationAction?: (params: { itemId?: string; instanceId?: string; workId?: string; action: 'checkout' | 'checkin' | 'request' }) => void;
}) {
  const [showInlineEditions, setShowInlineEditions] = useState(false);
  const coverUrl = work.coverUrl || resolveWorkCover(work);
  const authorAvatar = work.primaryCreator?.avatarUrl;
  const isCheckedOut = work.instances.some(i => i.holdingStatus === 'checked_out') || work.holdingItems?.some(it => it.status === 'checked_out');
  const isPaged = work.instances.some(i => i.holdingStatus === 'paged') || work.holdingItems?.some(it => it.status === 'paged');

  return (
    <div className="p-5 rounded-3xl bg-white/85 hover:bg-white backdrop-blur-xl border border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)] transition-all duration-300 flex flex-col justify-between group overflow-hidden">
      <div className="space-y-3">
        {/* Prominent Cover (Real Image or Typographic Book Placeholder) */}
        <div
          onClick={onSelectWork}
          className="relative w-full h-48 sm:h-52 rounded-2xl overflow-hidden cursor-pointer shadow-xs group-hover:shadow-md transition-all duration-500 bg-gradient-to-br from-slate-100 via-indigo-50/40 to-blue-50/50 border border-slate-200/80 flex flex-col justify-between"
        >
          {coverUrl ? (
            <>
              <img
                src={coverUrl}
                alt={work.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="flex flex-col justify-between h-full p-4 select-none">
              <div className="flex items-start justify-between">
                <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-xs">
                  <BookOpen className="w-4 h-4" />
                </span>
                {isCheckedOut ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-bold border border-rose-200">
                    معار — FOLIO
                  </span>
                ) : isPaged ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200">
                    محجوز — FOLIO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200">
                    متاح — FOLIO
                  </span>
                )}
              </div>

              <div className="my-auto py-2">
                <div className="font-serif font-black text-slate-900 text-sm leading-snug line-clamp-3 group-hover:text-blue-700 transition-colors">
                  {work.title}
                </div>
                <div className="text-[11px] text-slate-600 font-semibold mt-1 truncate">
                  {work.primaryCreator?.nameArabic}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-200/60">
                <span>{work.originDate || (work.instances[0]?.publicationYear ? `${work.instances[0].publicationYear} م` : '')}</span>
                <span>{work.instances.length} {work.instances.length === 1 ? 'طبعة' : 'طبعات'}</span>
              </div>
            </div>
          )}

          {/* Floating Badges for Image Covers */}
          {coverUrl && (
            <>
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/85 backdrop-blur-md text-indigo-200 text-[9px] font-mono font-bold border border-indigo-400/40 shadow-xs">
                  bf:Hub • {work.instances.length} {work.instances.length === 1 ? 'طبعة' : 'طبعات'}
                </span>
              </div>
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                {isCheckedOut ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600/95 text-white text-[9px] font-bold shadow-xs">
                    معار FOLIO
                  </span>
                ) : isPaged ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-600/95 text-white text-[9px] font-bold shadow-xs">
                    محجوز FOLIO
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/95 text-white text-[9px] font-bold shadow-xs">
                    متاح FOLIO
                  </span>
                )}
              </div>

              {(work.classificationLcc || work.classificationDdc) && (
                <div className="absolute bottom-2.5 right-2.5 z-10">
                  <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md text-slate-800 font-mono text-[9px] font-bold border border-slate-200 shadow-xs">
                    {work.classificationLcc || `DDC ${work.classificationDdc}`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Title & Bookbag Button */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              onClick={onSelectWork}
              className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 cursor-pointer hover:underline transition-colors leading-snug tracking-tight"
            >
              {work.title}
            </h3>
            {work.subtitle && (
              <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                {work.subtitle}
              </p>
            )}
          </div>

          {onToggleBookbag && (
            <button
              type="button"
              onClick={onToggleBookbag}
              className={`p-2 rounded-xl border flex-shrink-0 cursor-pointer transition-all ${
                isInBookbag
                  ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-2xs'
                  : 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-400 hover:text-amber-600'
              }`}
              title={isInBookbag ? 'إزالة من حقيبة الباحث والمقارنة' : 'إضافة إلى حقيبة الباحث والمقارنة (VuFind Bookbag)'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isInBookbag ? 'fill-amber-500 text-amber-600' : ''}`} />
            </button>
          )}
        </div>

        {/* Match Reason Attribution (Explaining Search Relevance) */}
        {work.matchReason && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200/80 text-[11px] font-bold text-blue-800 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="truncate">{work.matchReason}</span>
          </div>
        )}

        {/* Creator Link with Avatar & Hover / Focus Trigger */}
        <div className="text-xs font-bold text-slate-700 flex items-center justify-between gap-1.5 pt-0.5">
          <div className="flex items-center gap-2 truncate">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={work.primaryCreator.nameArabic}
                className="w-5 h-5 rounded-full object-cover border border-slate-200 flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200 text-slate-600">
                <User className="w-3 h-3 text-slate-500" />
              </div>
            )}
            <button
              onMouseEnter={e => onHoverPerson(work.primaryCreator.nameArabic, e)}
              onMouseLeave={onLeaveHover}
              onFocus={e => onHoverPerson(work.primaryCreator.nameArabic, e as any)}
              onBlur={onLeaveHover}
              onClick={e => {
                e.stopPropagation();
                onSelectPerson(work.primaryCreator.nameArabic);
              }}
              className="text-blue-700 hover:text-blue-900 border-b border-dotted border-blue-400 cursor-pointer font-black truncate focus:ring-2 focus:ring-blue-400 rounded outline-none transition-colors"
              title={`استعراض ملف الكيان: ${work.primaryCreator.nameArabic}`}
            >
              {work.primaryCreator.nameArabic}
            </button>
          </div>

          <span className="text-[10px] font-mono text-slate-400" dir="ltr">
            {work.instances[0]?.callNumber || work.classificationLcc || ''}
          </span>
        </div>

        {/* Subject Pills with Hover & Focus Trigger */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {work.subjects.slice(0, 2).map(s => (
            <button
              key={s.id}
              onMouseEnter={e => onHoverSubject(s.label, e)}
              onMouseLeave={onLeaveHover}
              onFocus={e => onHoverSubject(s.label, e as any)}
              onBlur={onLeaveHover}
              onClick={e => {
                e.stopPropagation();
                onSelectSubject(s.label);
              }}
              className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-[11px] font-semibold text-slate-700 border border-slate-200/80 cursor-pointer truncate max-w-[170px] focus:ring-2 focus:ring-blue-400 outline-none transition-colors"
              title={`تصفح الموضوع: ${s.label}`}
            >
              <span className="flex items-center gap-1"><Tag className="w-3 h-3 text-slate-500" /> {s.label}</span>
            </button>
          ))}
        </div>

        {/* Share-VDE Inline Expandable "Publications of this Work" (طبعات وتجسيدات هذا العمل — bf:Instance) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setShowInlineEditions(v => !v);
            }}
            className="w-full px-3 py-1.5 rounded-xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-200/70 text-[11px] font-bold text-indigo-900 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>طبعات وتجسيدات هذا العمل ({work.instances.length} bf:Instance)</span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-indigo-600 transition-transform ${showInlineEditions ? 'rotate-180' : ''}`} />
          </button>

          {showInlineEditions && (
            <div className="mt-2 space-y-1.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-[11px]">
              {work.instances.map((inst, idx) => (
                <div
                  key={inst.id || idx}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-bold text-slate-900 truncate">
                      {inst.carrierType || 'طبعة'} — {inst.publisher || inst.title}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {inst.publicationYear || 'د.ت'} • {inst.callNumber || inst.shelfLocation || 'B753'}
                    </div>
                  </div>
                  {onCirculationAction && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onCirculationAction({
                          instanceId: inst.folioInstanceId || inst.id,
                          workId: work.id,
                          action: inst.holdingStatus === 'checked_out' ? 'checkin' : 'checkout'
                        });
                      }}
                      className={`px-2 py-1 rounded-lg font-bold text-[10px] cursor-pointer flex-shrink-0 ${
                        inst.holdingStatus === 'checked_out'
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {inst.holdingStatus === 'checked_out' ? 'إرجاع FOLIO' : 'إعارة FOLIO'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="pt-3.5 mt-3.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-600">
        <button
          onClick={onSelectWork}
          className="font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1 cursor-pointer group-hover:translate-x-0.5 transition-all"
        >
          <span>تسجيلة العمل الكاملة</span>
          <ChevronLeft className="w-3.5 h-3.5 text-blue-600" />
        </button>

        {onCirculationAction ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onCirculationAction({
                workId: work.id,
                instanceId: work.instances[0]?.folioInstanceId || work.instances[0]?.id || work.id,
                action: isCheckedOut || isPaged ? 'checkin' : 'checkout'
              });
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
              isCheckedOut || isPaged
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <BookCheck className="w-3 h-3" />
            <span>{isCheckedOut || isPaged ? 'إرجاع FOLIO' : 'إعارة فورية'}</span>
          </button>
        ) : work.originDate ? (
          <span className="text-[10px] text-slate-400 font-mono">
            {work.originDate}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// =========================================================================
// VUFIND VIRTUAL SHELF BROWSE SECTION (Call Number Carousel)
// =========================================================================

function VirtualShelfBrowseSection({
  items,
  onSelectWork,
  onReanchor
}: {
  items: VirtualShelfItem[];
  onSelectWork: (workId: string) => void;
  onReanchor: (workId: string) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-2xl border border-slate-200/90 shadow-xs space-y-4 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Library className="w-5 h-5 text-teal-600" />
            <span>تصفح الرف الافتراضي حسب رقم الاستدعاء (VuFind Virtual Shelf Browse — LCC / DDC)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            استكشف الكتب والمخطوطات المجاورة مكانياً على رفوف المكتبة مرتبةً وفق تصنيف مكتبة الكونغرس (LCC) وديوي (DDC)
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-mono font-bold self-start sm:self-auto">
          VuFind CallNumber Shelf
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {items.map(item => (
          <div
            key={item.workId}
            onClick={() => onSelectWork(item.workId)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
              item.isCurrent
                ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-200 shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px] font-bold truncate" dir="ltr">
                  {item.callNumber}
                </span>
                {item.isCurrent && (
                  <span className="px-1.5 py-0.2 rounded bg-teal-600 text-white text-[9px] font-bold">
                    المحدد
                  </span>
                )}
              </div>

              <div className="h-24 rounded-xl bg-gradient-to-br from-slate-100 to-indigo-50/60 border border-slate-200/80 overflow-hidden flex items-center justify-center p-2 text-center">
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="font-serif font-black text-slate-800 text-[11px] line-clamp-3">{item.title}</span>
                )}
              </div>

              <div className="font-black text-xs text-slate-900 group-hover:text-teal-700 line-clamp-2 leading-snug">
                {item.title}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{item.creator}</div>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span className={`font-bold ${
                item.availability === 'checked_out' ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {item.availability === 'checked_out' ? 'معار' : 'متاح'}
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onReanchor(item.workId);
                }}
                className="text-teal-700 hover:underline font-bold cursor-pointer"
              >
                توسيط الرف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// LIBRIS XL SPLIT-PANE ACADEMIC INSPECTOR VIEW (libris.kb.se style)
// =========================================================================

function LibrisSplitInspectorView({
  works,
  selectedWork,
  inspectorTab,
  onSelectWorkRow,
  onChangeTab,
  onOpenFullWork,
  onSelectPerson,
  onSelectSubject,
  onCirculationAction,
  bookbagIds,
  onToggleBookbag,
  onCopy
}: {
  works: OpacWorkEntity[];
  selectedWork: OpacWorkEntity | null;
  inspectorTab: 'overview' | 'wemi' | 'marc' | 'jsonld' | 'holdings';
  onSelectWorkRow: (w: OpacWorkEntity) => void;
  onChangeTab: (t: 'overview' | 'wemi' | 'marc' | 'jsonld' | 'holdings') => void;
  onOpenFullWork: (id: string) => void;
  onSelectPerson: (name: string) => void;
  onSelectSubject: (label: string) => void;
  onCirculationAction: (params: { itemId?: string; instanceId?: string; workId?: string; action: 'checkout' | 'checkin' | 'request' }) => void;
  bookbagIds: string[];
  onToggleBookbag: (id: string, e?: React.MouseEvent) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const wemiTree = useMemo(() => {
    if (!selectedWork) return null;
    return wolfMoonOpacService.getWemiClusterTree(selectedWork.id);
  }, [selectedWork]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Right Column: High-Density LIBRIS XL Academic Table/List (7 cols) */}
      <div className="lg:col-span-7 bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between text-xs">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <Code className="w-4 h-4 text-blue-600" />
            <span>جدول الفهرس الأكاديمي المكثف (LIBRIS XL National Catalog View)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">اختر أي صف لمعاينة شفرته الببليوغرافية فوراً</span>
        </div>

        <div className="divide-y divide-slate-100">
          {works.map((w, idx) => {
            const isSelected = selectedWork?.id === w.id;
            const isOut = w.instances.some(i => i.holdingStatus === 'checked_out');
            return (
              <div
                key={w.id}
                onClick={() => onSelectWorkRow(w)}
                className={`p-4 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected ? 'bg-blue-50/80 border-r-4 border-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold">
                      #{idx + 1} • bf:Work
                    </span>
                    <span className="font-mono text-[10px] text-blue-700 font-bold" dir="ltr">
                      {w.classificationLcc || w.instances[0]?.callNumber || 'B753'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOut ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isOut ? 'معار FOLIO' : 'متاح FOLIO'}
                    </span>
                  </div>

                  <div className="font-black text-sm text-slate-900 hover:text-blue-700">
                    {w.title}
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectPerson(w.primaryCreator.nameArabic);
                      }}
                      className="font-bold text-blue-700 hover:underline cursor-pointer"
                    >
                      {w.primaryCreator.nameArabic}
                    </button>
                    <span>•</span>
                    <span>{w.originDate || w.instances[0]?.publicationYear}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">{w.instances.length} طبعات (bf:Instance)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={e => onToggleBookbag(w.id, e)}
                    className={`p-2 rounded-xl border text-xs cursor-pointer ${
                      bookbagIds.includes(w.id)
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-amber-700'
                    }`}
                    title="حفظ في حقيبة المقارنة"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenFullWork(w.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                  >
                    فتح
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Left Column: Live Split-Pane Inspector (5 cols) */}
      <div className="lg:col-span-5 sticky top-20 bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-200/90 shadow-md overflow-hidden text-xs">
        {selectedWork ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[10px] font-mono text-blue-600 font-bold uppercase">
                  LIBRIS XL Live Record Inspector
                </div>
                <h3 className="text-base font-black text-slate-900 mt-0.5">{selectedWork.title}</h3>
                <div className="text-slate-600 font-medium">{selectedWork.primaryCreator.nameArabic}</div>
              </div>
              <button
                onClick={() => onOpenFullWork(selectedWork.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <span>صفحة العمل</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inspector Sub-Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 font-bold text-[11px] flex-wrap">
              {[
                { id: 'overview', label: 'ملخص LIBRIS' },
                { id: 'wemi', label: 'شجرة WEMI' },
                { id: 'holdings', label: 'إعارة FOLIO' },
                { id: 'marc', label: 'MARC 21' },
                { id: 'jsonld', label: 'JSON-LD' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => onChangeTab(t.id as any)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                    inspectorTab === t.id ? 'bg-white text-blue-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {inspectorTab === 'overview' && (
              <div className="space-y-3">
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  {selectedWork.summaryArabic}
                </p>
                <div className="space-y-1.5 font-mono text-[11px] bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <div><span className="text-slate-500">URI:</span> <span className="text-blue-700">{selectedWork.canonicalMoonUri}</span></div>
                  <div><span className="text-slate-500">LCC:</span> <span className="text-slate-900 font-bold">{selectedWork.classificationLcc || '—'}</span></div>
                  <div><span className="text-slate-500">DDC:</span> <span className="text-slate-900 font-bold">{selectedWork.classificationDdc || '—'}</span></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedWork.subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onSelectSubject(s.label)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inspectorTab === 'wemi' && wemiTree && (
              <div className="space-y-2 font-mono text-[11px] bg-slate-50 p-3.5 rounded-2xl border border-slate-200 max-h-80 overflow-y-auto" dir="ltr">
                <div className="font-bold text-indigo-800">[Hub] {wemiTree.label} ({wemiTree.uri})</div>
                {wemiTree.children?.map(wNode => (
                  <div key={wNode.id} className="pl-3 border-l-2 border-indigo-400 space-y-1.5">
                    <div className="font-bold text-blue-800">↳ [Work] {wNode.label}</div>
                    {wNode.children?.map(iNode => (
                      <div key={iNode.id} className="pl-3 border-l-2 border-blue-300 space-y-1">
                        <div className="font-semibold text-purple-800">↳ [Instance] {iNode.label} ({iNode.subtitle})</div>
                        {iNode.children?.map(itNode => (
                          <div key={itNode.id} className="pl-3 text-emerald-800">
                            ↳ [Item] {itNode.label} — {itNode.status}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'holdings' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {selectedWork.instances.map((inst, idx) => (
                  <div key={inst.id || idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{inst.carrierType || 'طبعة'} — {inst.publisher}</div>
                      <div className="text-[11px] font-mono text-slate-500">{inst.callNumber || inst.shelfLocation}</div>
                    </div>
                    <button
                      onClick={() => onCirculationAction({
                        workId: selectedWork.id,
                        instanceId: inst.folioInstanceId || inst.id,
                        action: inst.holdingStatus === 'checked_out' ? 'checkin' : 'checkout'
                      })}
                      className={`px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer ${
                        inst.holdingStatus === 'checked_out' ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      {inst.holdingStatus === 'checked_out' ? 'إرجاع FOLIO' : 'إعارة FOLIO'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'marc' && (
              <div className="space-y-2" dir="ltr">
                <div className="flex justify-end">
                  <button
                    onClick={() => onCopy(wolfMoonOpacService.generateMarc21Mapping(selectedWork), 'MARC 21')}
                    className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-mono text-[10px] cursor-pointer"
                  >
                    Copy MARC 21
                  </button>
                </div>
                <pre className="p-3 rounded-2xl bg-slate-900 text-amber-300 font-mono text-[10px] overflow-x-auto max-h-72">
                  {wolfMoonOpacService.generateMarc21Mapping(selectedWork)}
                </pre>
              </div>
            )}

            {inspectorTab === 'jsonld' && (
              <div className="space-y-2" dir="ltr">
                <div className="flex justify-end">
                  <button
                    onClick={() => onCopy(JSON.stringify(wolfMoonOpacService.generateFramedJsonLd(selectedWork), null, 2), 'JSON-LD')}
                    className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-mono text-[10px] cursor-pointer"
                  >
                    Copy JSON-LD
                  </button>
                </div>
                <pre className="p-3 rounded-2xl bg-slate-900 text-sky-300 font-mono text-[10px] overflow-x-auto max-h-72">
                  {JSON.stringify(wolfMoonOpacService.generateFramedJsonLd(selectedWork), null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =========================================================================
// VUFIND 11.0 + APACHE SOLR INTEGRATED DISCOVERY MATRIX VIEW
// =========================================================================

function VuFindIntegratedMatrixView({
  works,
  federatedData,
  shelfItems,
  onSelectWork,
  onReanchorShelf,
  onFilterSubject,
  onCirculationAction,
  bookbagIds,
  onToggleBookbag,
  onOpenFullVuFind
}: {
  works: OpacWorkEntity[];
  federatedData: FederatedDeepSearchResult | null;
  shelfItems: VirtualShelfItem[];
  onSelectWork: (id: string) => void;
  onReanchorShelf: (id: string) => void;
  onFilterSubject: (subject: string) => void;
  onCirculationAction: (params: { itemId?: string; instanceId?: string; workId?: string; action: 'checkout' | 'checkin' | 'request' }) => void;
  bookbagIds: string[];
  onToggleBookbag: (id: string, e?: React.MouseEvent) => void;
  onOpenFullVuFind: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Top VuFind + Solr Live Telemetry Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white border border-teal-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40 font-mono text-[11px] font-bold">
              VuFind 11.0 + Apache Solr 9.x biblio Core
            </span>
            <span className="text-xs text-emerald-300 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>متصل مباشرة بـ FOLIO ILS RTA</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black">
            مصفوفة اكتشاف VuFind وخدمات Solr المدمجة داخل الفهرس الدلالي
          </h2>
        </div>
        <button
          onClick={onOpenFullVuFind}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>فتح واجهة VuFind المستقلة</span>
        </button>
      </div>

      {/* Live Solr Facet Pills */}
      {federatedData?.facets?.subjects && federatedData.facets.subjects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-bold text-slate-600">تصفية فورية عبر واجهات Solr Facets:</span>
          {federatedData.facets.subjects.slice(0, 8).map(f => (
            <button
              key={f.value}
              onClick={() => onFilterSubject(f.value)}
              className="px-3 py-1 rounded-full bg-white hover:bg-teal-50 text-slate-800 hover:text-teal-900 border border-slate-200 hover:border-teal-300 font-semibold cursor-pointer transition-all shadow-2xs"
            >
              <span>{f.label}</span>
              <span className="text-[10px] font-mono text-teal-600 mr-1">({f.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* VuFind Record Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {works.map(w => {
          const isOut = w.instances.some(i => i.holdingStatus === 'checked_out');
          return (
            <div
              key={w.id}
              className="p-5 rounded-3xl bg-white/90 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-mono text-[10px] font-bold" dir="ltr">
                    Solr ID: {w.id} • Call: {w.classificationLcc || w.instances[0]?.callNumber || 'B753'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isOut ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isOut ? 'معار في FOLIO' : 'متاح في FOLIO'}
                  </span>
                </div>

                <h3
                  onClick={() => onSelectWork(w.id)}
                  className="text-base font-black text-slate-900 hover:text-teal-700 cursor-pointer hover:underline"
                >
                  {w.title}
                </h3>

                <div className="text-xs text-slate-600 font-semibold">
                  المؤلف: <span className="text-slate-900 font-bold">{w.primaryCreator.nameArabic}</span> • {w.originDate || w.instances[0]?.publicationYear}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2">{w.summaryArabic}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onCirculationAction({
                      workId: w.id,
                      instanceId: w.instances[0]?.folioInstanceId || w.instances[0]?.id || w.id,
                      action: isOut ? 'checkin' : 'checkout'
                    })}
                    className={`px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer ${
                      isOut ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isOut ? 'إرجاع النسخة (FOLIO)' : 'إعارة فورية (FOLIO)'}
                  </button>
                  <button
                    onClick={e => onToggleBookbag(w.id, e)}
                    className={`px-2.5 py-1.5 rounded-xl border font-bold cursor-pointer ${
                      bookbagIds.includes(w.id)
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {bookbagIds.includes(w.id) ? 'في الحقيبة' : '+ حقيبة الباحث'}
                  </button>
                </div>

                <button
                  onClick={() => onSelectWork(w.id)}
                  className="font-bold text-teal-700 hover:text-teal-900 cursor-pointer flex items-center gap-1"
                >
                  <span>التفاصيل وشجرة WEMI</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Virtual Shelf Browse Carousel inside VuFind Matrix */}
      <VirtualShelfBrowseSection
        items={shelfItems}
        onSelectWork={onSelectWork}
        onReanchor={onReanchorShelf}
      />
    </div>
  );
}

export default WolfMoonStandaloneOpac;

