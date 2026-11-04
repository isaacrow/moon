// Universal Authority & Resource Search Dialog — Liquid Glass Redesign
// Multi-API Search (LOC, VIAF, Wikidata, OpenAlex, CrossRef, Open Library, Wikipedia, INLA, DOAJ, ISBNdb) + AI Web Suggestion Engine

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, CheckCircle, Loader2, User, Book, Building,
  Tag, Sparkles, Brain, Globe, Calendar, 
  X
} from 'lucide-react';
import { useThemeSafe } from '../hooks/useThemeSafe';
import { getThemeGradients } from '../utils/themeGradients';
import { authorityHub } from '../services/authorityHub/authorityHubService';
import type { AuthoritySearchResult, UnifiedPerson } from '../services/authorityHub/types';
import {
  fetchMultiPageWebResults,
  findAuthors,
  deepSearchAndSuggestWithGemini,
  AISuggestionProfile,
  DEFAULT_GEMINI_API_KEY
} from '../../services/authorFinderService';

// Exact User Liquid Glass Style (Preset 1)
const LIQUID_GLASS_PANEL: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.3)',
  backdropFilter: 'blur(5px) blur(10px) saturate(1.5) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.8) brightness(1.15) contrast(1.05)',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.2)',
  borderRadius: '28px',
  border: '1px solid rgba(255, 255, 255, 0.4)'
};

// Exact User CSS Glass Style (Preset 2 from https://css.glass)
const CSS_GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.46)',
  borderRadius: '16px',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(13.6px)',
  WebkitBackdropFilter: 'blur(13.6px)',
  border: '1px solid rgba(255, 255, 255, 0.65)',
};

interface AuthoritySearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: UnifiedPerson | any) => void;
  initialQuery?: string;
  initialTab?: 'people' | 'books' | 'publishers' | 'subjects';
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    'LOC': 'bg-blue-100/90 text-blue-900 border-blue-200',
    'VIAF': 'bg-indigo-100/90 text-indigo-900 border-indigo-200',
    'Wikidata': 'bg-emerald-100/90 text-emerald-900 border-emerald-200',
    'Wikipedia': 'bg-cyan-100/90 text-cyan-900 border-cyan-200',
    'OpenAlex': 'bg-teal-100/90 text-teal-900 border-teal-200',
    'CrossRef': 'bg-amber-100/90 text-amber-900 border-amber-200',
    'OpenLibrary': 'bg-purple-100/90 text-purple-900 border-purple-200',
    'INLA': 'bg-emerald-200/90 text-emerald-900 border-emerald-300 font-bold',
    'ISBNdb': 'bg-rose-100/90 text-rose-900 border-rose-200'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${colors[source] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
      {source}
    </span>
  );
}

export function AuthoritySearchDialog({ 
  isOpen, 
  onClose, 
  onSelect,
  initialQuery = '',
  initialTab = 'people'
}: AuthoritySearchDialogProps) {
  const { moonEngineTheme } = useThemeSafe();
  const gradients = getThemeGradients(moonEngineTheme);
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<'people' | 'books' | 'publishers' | 'subjects'>(initialTab);
  const [results, setResults] = useState<AuthoritySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<AuthoritySearchResult | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // AI Web Suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestionProfile | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  useEffect(() => {
    if (initialTab) setSearchType(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  // Master Federated Search: All APIs + Open-World AI
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSelectedResult(null);
    setDetails(null);
    setResults([]);
    setAiSuggestion(null);

    const q = query.trim();

    if (searchType === 'people') {
      setIsAiSuggesting(true);

      // 1. Parallel Multi-API Search
      const hubPromise = authorityHub.searchAll(q);
      const federatedPromise = findAuthors(q);
      const webResultsPromise = fetchMultiPageWebResults(q);

      try {
        const [hubRes, fedRes, webRes] = await Promise.allSettled([hubPromise, federatedPromise, webResultsPromise]);
        
        const combinedResults: AuthoritySearchResult[] = [];
        const seenIds = new Set<string>();

        if (hubRes.status === 'fulfilled') {
          hubRes.value.forEach(r => {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              combinedResults.push(r);
            }
          });
        }

        if (fedRes.status === 'fulfilled') {
          fedRes.value.results.forEach(r => {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              combinedResults.push({
                id: r.id,
                source: (r.sources[0]?.name as any) || 'Federated',
                label: r.nameArabic || r.name,
                description: r.description || r.occupation || '',
                score: r.rawScore || 80
              });
            }
          });
        }

        setResults(combinedResults);

        // 2. Trigger Gemini AI Web Suggestion
        const webItems = webRes.status === 'fulfilled' ? webRes.value : [];
        deepSearchAndSuggestWithGemini(q, webItems, DEFAULT_GEMINI_API_KEY)
          .then(sugg => {
            setAiSuggestion(sugg);
            setIsAiSuggesting(false);
          })
          .catch(err => {
            console.error('AI suggestion failed:', err);
            setIsAiSuggesting(false);
          });

      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }

    } else {
      // Books, Publishers, Subjects
      try {
        const isbndb = authorityHub.getIsbndbService();
        let searchResults: AuthoritySearchResult[] = [];

        switch (searchType) {
          case 'books':
            searchResults = await isbndb.searchBooks(q);
            break;
          case 'publishers':
            searchResults = await isbndb.searchPublishers(q);
            break;
          case 'subjects':
            searchResults = await isbndb.searchSubjects(q);
            break;
        }
        setResults(searchResults);
      } catch (err) {
        console.error('ISBNdb search error:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [query, searchType]);

  const handleSelectResult = async (result: AuthoritySearchResult) => {
    setSelectedResult(result);
    setLoadingDetails(true);
    setDetails(null);

    try {
      const isbndb = authorityHub.getIsbndbService();

      if (searchType === 'people') {
        const person = await authorityHub.buildUnifiedPerson(result);
        setDetails(person);
      } else if (searchType === 'books') {
        setDetails({ ...result, type: 'book' });
      } else if (searchType === 'publishers') {
        const pubDetails = await isbndb.getPublisherDetails(result.label);
        setDetails({ ...pubDetails, type: 'publisher', source: 'ISBNdb' });
      } else if (searchType === 'subjects') {
        const subDetails = await isbndb.getSubjectDetails(result.label);
        setDetails({ ...subDetails, type: 'subject', source: 'ISBNdb' });
      }
    } catch (error) {
      console.error('Failed to get details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUseAiSuggestion = (suggestion: AISuggestionProfile) => {
    // An AI suggestion also carries notes, which UnifiedPerson does not declare.
    const person: UnifiedPerson & { notes?: string[] } = {
      id: `ai-${Date.now()}`,
      label: suggestion.suggestedNameArabic || suggestion.primarySuggestion,
      birth: suggestion.birthDate,
      death: suggestion.deathDate,
      description: suggestion.summaryAr,
      occupations: [suggestion.occupation || 'Author'].filter(Boolean),
      nationality: suggestion.nationality,
      // An AI suggestion has no authority identifiers; it was not found in LC, VIAF or Wikidata.
      identifiers: {},
      sourceGraph: [],
      metadata: {
        sources: ['AI suggestion'],
        lastUpdated: new Date().toISOString(),
        confidence: suggestion.confidence === 'high' ? 0.8 : suggestion.confidence === 'medium' ? 0.5 : 0.2
      },
      notes: [`Affiliation: ${suggestion.affiliation || 'N/A'}`, `Movement: ${suggestion.literaryMovement || 'N/A'}`]
    };
    onSelect(person);
    onClose();
  };

  const handleConfirmSelection = () => {
    if (details) {
      onSelect(details);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Liquid Glass Shell */}
      <div
        style={LIQUID_GLASS_PANEL}
        className="w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden text-slate-900 shadow-2xl relative"
      >
        {/* Header Bar */}
        <div className="px-7 py-5 border-b border-white/60 flex items-center justify-between bg-white/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                البحث الشامل في فهارس الاستناد وشبكة الويب
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold">
                  All APIs + AI
                </span>
              </h2>
              <p className="text-xs text-slate-700 font-medium mt-0.5">
                فحص فوري عبر (LOC, VIAF, Wikidata, OpenAlex, CrossRef, Wikipedia, Open Library, ISBNdb) مع مقترح الذكاء الاصطناعي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/70 hover:bg-white text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center shadow-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/60 bg-white/40 px-6 gap-2 text-xs font-bold text-slate-700">
          <button 
            onClick={() => setSearchType('people')}
            className={`py-3 px-4 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              searchType === 'people' ? 'bg-white text-slate-900 shadow-sm border-t border-x border-white/80 font-black' : 'hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-blue-600" /> المؤلفون والأشخاص (People / Agents)
          </button>
          <button 
            onClick={() => setSearchType('books')}
            className={`py-3 px-4 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              searchType === 'books' ? 'bg-white text-slate-900 shadow-sm border-t border-x border-white/80 font-black' : 'hover:text-slate-900'
            }`}
          >
            <Book className="w-4 h-4 text-emerald-600" /> الكتب والمؤلفات (Books / Works)
          </button>
          <button 
            onClick={() => setSearchType('publishers')}
            className={`py-3 px-4 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              searchType === 'publishers' ? 'bg-white text-slate-900 shadow-sm border-t border-x border-white/80 font-black' : 'hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4 text-indigo-600" /> دور النشر (Publishers)
          </button>
          <button 
            onClick={() => setSearchType('subjects')}
            className={`py-3 px-4 rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              searchType === 'subjects' ? 'bg-white text-slate-900 shadow-sm border-t border-x border-white/80 font-black' : 'hover:text-slate-900'
            }`}
          >
            <Tag className="w-4 h-4 text-amber-600" /> رؤوس الموضوعات (Subjects)
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-5 border-b border-white/60 bg-white/20">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={`ابحث في جميع الفهارس والويب عن ${searchType === 'people' ? 'اسم المؤلف أو المفكر...' : 'العنوان أو الناشر...'}`}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/90 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm font-semibold shadow-inner"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-7 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg flex-shrink-0 cursor-pointer active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري البحث الشامل...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  بحث شامل + AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Split (Results + Details + AI Suggestion) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Results List & AI Suggestion */}
          <div className="w-full md:w-5/12 border-r border-white/60 overflow-y-auto p-5 space-y-4">
            
            {/* 🌟 Top AI Suggestion Card */}
            {(aiSuggestion || isAiSuggesting) && searchType === 'people' && (
              <div style={CSS_GLASS_CARD} className="p-4 border border-white shadow-xl animate-in slide-in-from-top-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-black text-slate-900">
                      {isAiSuggesting ? 'جاري تحليل نتائج الويب بالذكاء الاصطناعي...' : 'مقترح الذكاء الاصطناعي عبر الويب'}
                    </span>
                  </div>
                  {isAiSuggesting && <Loader2 className="w-4 h-4 animate-spin text-slate-700" />}
                </div>

                {aiSuggestion && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-white/80 border border-white text-xs leading-relaxed text-slate-800 font-medium whitespace-pre-line shadow-sm" dir="rtl">
                      {aiSuggestion.summaryAr || aiSuggestion.summaryEn}
                    </div>

                    {/* Facts & Confirm Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        {aiSuggestion.nationality && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-xs">
                            {aiSuggestion.nationality}
                          </span>
                        )}
                        {(aiSuggestion.birthDate || aiSuggestion.deathDate) && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-xs">
                            {[aiSuggestion.birthDate, aiSuggestion.deathDate].filter(Boolean).join(' – ')}
                          </span>
                        )}
                        {aiSuggestion.occupation && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-xs">
                            {aiSuggestion.occupation}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleUseAiSuggestion(aiSuggestion)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        اعتماد هذا المقترح
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results Title */}
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                نتائج الفهارس الموحدة ({results.length})
              </h3>
            </div>

            {results.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                <Globe className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold">لا توجد نتائج بحث بعد</p>
                <p className="text-xs mt-1">أدخل الاسم واضغط على "بحث شامل + AI"</p>
              </div>
            )}

            {/* Results List */}
            <div className="space-y-2">
              {results.map((result, idx) => (
                <button
                  key={`${result.source}-${result.id}-${idx}`}
                  onClick={() => handleSelectResult(result)}
                  style={CSS_GLASS_CARD}
                  className={`
                    w-full text-left p-3.5 transition-all cursor-pointer block
                    ${selectedResult?.id === result.id
                      ? 'border-2 border-slate-900 shadow-xl bg-white/90'
                      : 'hover:bg-white/80'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {result.label}
                      </div>
                      {result.description && (
                        <div className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed font-medium">
                          {result.description}
                        </div>
                      )}
                    </div>
                    <SourceBadge source={result.source} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Full Details Panel */}
          <div className="flex-1 overflow-y-auto p-6 bg-white/30">
            {loadingDetails ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
              </div>
            ) : details ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {searchType === 'people' ? (
                  <div style={CSS_GLASS_CARD} className="p-6">
                    <div className="flex gap-5 items-start">
                      {details.image ? (
                        <img
                          src={details.image}
                          alt={details.label}
                          className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                          <User className="w-10 h-10 text-amber-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black text-slate-900 mb-1">
                          {details.label}
                        </h3>
                        {(details.birth || details.death) && (
                          <div className="text-xs text-slate-600 font-bold mb-2 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {[details.birth, details.death].filter(Boolean).join(' – ')}
                          </div>
                        )}
                        {details.description && (
                          <p className="text-xs leading-relaxed text-slate-700 mb-3 font-medium">
                            {details.description}
                          </p>
                        )}
                        {details.nationality && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-300 text-xs font-bold text-slate-800">
                            <Globe className="w-3.5 h-3.5 text-slate-500" /> {details.nationality}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={CSS_GLASS_CARD} className="p-6">
                    <h3 className="text-xl font-black text-slate-900 mb-2">{details.label}</h3>
                    {details.description && <p className="text-xs text-slate-700 font-medium mb-3">{details.description}</p>}
                    <span className="px-3 py-1 rounded-lg bg-white text-xs font-bold border border-slate-300">{details.type || searchType}</span>
                  </div>
                )}

                {/* Confirm Action */}
                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleConfirmSelection}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    اعتماد واستخدام هذا السجل الاستنادي
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Globe className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-bold">حدد أحد السجلات لمعاينة البيانات الموحدة</p>
                  <p className="text-xs mt-1">تجميع موثق عبر جميع الفهارس العالمية</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/60 px-6 py-3.5 flex justify-between items-center bg-white/40 backdrop-blur-md">
          <div className="text-[11px] text-slate-600 font-medium">
            مصادر معتمدة: Library of Congress • VIAF • Wikidata • OpenAlex • CrossRef • Wikipedia • INLA • ISBNdb
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
