/**
 * BlueMoon AI Panel — Enterprise AI Engine integrated as a BlueMoon sub-tab
 * Inherits theme from BlueMoon (Dark Glass / Legacy Glass / Simple Classic)
 * Full AR/EN i18n, multi-source federated lookup, 5-phase AI
 */

"use client";
import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Brain, Sparkles, Search, Code2, Wand2, 
  CheckCircle2, XCircle, Clock, AlertTriangle, Copy, 
  BookOpen, Users, Languages, Calendar, Tag, FileText, Loader2, Database,
  Layers, BarChart3, RefreshCw, ThumbsUp, ThumbsDown, History, Zap
} from "lucide-react";
import { projectId } from "../../../utils/supabase/info";
import { moonHeaders } from "../utils/moonApi";

const API = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c`;
// Read on every call: the AI routes need the cataloger's current session.
const hdrs = () => moonHeaders({ "Content-Type": "application/json" });

// ─── Types for the theme prop ────────────────────────────────────
interface BMTheme {
  bg: string; navBg: string; navBorder: string; cardBg: string; cardBorder: string;
  cardHover: string; accent: string; accentDim: string; accentGlow: string; accentBorder: string;
  secondary: string; success: string; warning: string; danger: string;
  text: string; textMuted: string; textDim: string; inputBg: string; inputBorder: string;
}

interface BlueMoonAIPanelProps {
  theme: BMTheme;
  isLegacy: boolean;
  isClassic?: boolean;
  /** Pre-fill from the current editor record */
  currentTitle?: string;
  currentAuthor?: string;
  currentIsbn?: string;
}

// ─── Sub-phase navigation ────────────────────────────────────────
type AIPhase = "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | "audit";

// ─── Helpers ─────────────────────────────────────────────────────
function ConfBadge({ v, theme }: { v: number; theme: BMTheme }) {
  const pct = Math.round(v * 100);
  const color = v >= 0.8 ? theme.success : v >= 0.6 ? theme.warning : theme.danger;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
      {pct}%
    </span>
  );
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function BlueMoonAIPanel({ theme: BM, isLegacy, isClassic = false, currentTitle, currentAuthor, currentIsbn }: BlueMoonAIPanelProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isLight = isLegacy || isClassic;
  const hasGlass = !isClassic;

  const [activePhase, setActivePhase] = useState<AIPhase>("phase1");
  const glassStyle = {
    background: BM.cardBg,
    border: `1px solid ${BM.cardBorder}`,
    backdropFilter: hasGlass ? "blur(20px) saturate(160%)" : undefined,
    WebkitBackdropFilter: hasGlass ? "blur(20px) saturate(160%)" : undefined,
  };

  const inputStyle = {
    background: BM.inputBg,
    border: `1px solid ${BM.inputBorder}`,
    color: BM.text,
    backdropFilter: hasGlass ? "blur(8px)" : undefined,
  };

  const phases: { id: AIPhase; icon: any; labelKey: string; color: string }[] = [
    { id: "phase1", icon: Sparkles, labelKey: "ai.phase1", color: BM.accent },
    { id: "phase2", icon: Layers, labelKey: "ai.phase2", color: BM.warning },
    { id: "phase3", icon: Search, labelKey: "ai.phase3", color: "#10b981" },
    { id: "phase4", icon: Code2, labelKey: "ai.phase4", color: "#a855f7" },
    { id: "phase5", icon: Wand2, labelKey: "ai.phase5", color: BM.success },
    { id: "audit", icon: History, labelKey: "ai.auditLog", color: BM.textMuted },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${BM.accent}15`, border: `1px solid ${BM.accent}30` }}>
          <Brain className="h-5 w-5" style={{ color: BM.accent }} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: BM.text }}>{t("ai.title")}</h2>
          <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.subtitle")}</p>
        </div>
      </div>

      {/* Phase Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {phases.map(ph => {
          const Icon = ph.icon;
          const active = activePhase === ph.id;
          return (
            <button key={ph.id} onClick={() => setActivePhase(ph.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-[11px] font-bold transition-all shrink-0"
              style={{
                background: active ? `${ph.color}18` : "transparent",
                border: `1px solid ${active ? `${ph.color}35` : "transparent"}`,
                color: active ? ph.color : BM.textDim,
              }}>
              <Icon className="h-3.5 w-3.5" />
              {t(ph.labelKey).replace(/المرحلة \d+ — |Phase \d+ — /g, "")}
            </button>
          );
        })}
      </div>

      {/* Phase Content */}
      <div className="rounded-xl p-5" style={glassStyle}>
        {activePhase === "phase1" && (
          <P1MetadataSuggestions BM={BM} isLight={isLight} hasGlass={hasGlass} inputStyle={inputStyle}
            t={t} lang={lang} prefillTitle={currentTitle} prefillAuthor={currentAuthor} prefillIsbn={currentIsbn} />
        )}
        {activePhase === "phase2" && (
          <P2DuplicateDetection BM={BM} isLight={isLight} inputStyle={inputStyle} t={t}
            prefillTitle={currentTitle} prefillAuthor={currentAuthor} prefillIsbn={currentIsbn} />
        )}
        {activePhase === "phase3" && (
          <P3NaturalLanguage BM={BM} isLight={isLight} inputStyle={inputStyle} t={t} lang={lang} />
        )}
        {activePhase === "phase4" && (
          <P4SPARQLTranslator BM={BM} isLight={isLight} inputStyle={inputStyle} t={t} lang={lang} />
        )}
        {activePhase === "phase5" && (
          <P5AutoFill BM={BM} isLight={isLight} inputStyle={inputStyle} t={t}
            prefillTitle={currentTitle} prefillAuthor={currentAuthor} prefillIsbn={currentIsbn} />
        )}
        {activePhase === "audit" && (
          <AuditPanel BM={BM} isLight={isLight} t={t} />
        )}
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────
function BtnAction({ onClick, loading, children, color, BM }: {
  onClick: () => void; loading: boolean; children: React.ReactNode; color: string; BM: BMTheme;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
      style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

function SLabel({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>
      <Icon className="h-3 w-3" /> {label}
    </div>
  );
}

function InputField({ value, onChange, placeholder, style, multiline, dir }: {
  value: string; onChange: (v: string) => void; placeholder: string; style: any;
  multiline?: boolean; dir?: string;
}) {
  const cls = "w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all";
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={3} className={cls} style={style} dir={dir} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={cls} style={style} dir={dir} />;
}


// ═══════════════════════════════════════════════════════════
// PHASE 1
// ═══════════════════════════════════════════════════════════

function P1MetadataSuggestions({ BM, isLight, hasGlass, inputStyle, t, lang, prefillTitle, prefillAuthor, prefillIsbn }: {
  BM: BMTheme; isLight: boolean; hasGlass: boolean; inputStyle: any; t: any; lang: string;
  prefillTitle?: string; prefillAuthor?: string; prefillIsbn?: string;
}) {
  const [title, setTitle] = useState(prefillTitle || "");
  const [author, setAuthor] = useState(prefillAuthor || "");
  const [isbn, setIsbn] = useState(prefillIsbn || "");
  const [publisher, setPublisher] = useState("");
  const [abstract, setAbstract] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Update from current record when props change
  useEffect(() => { if (prefillTitle && !title) setTitle(prefillTitle); }, [prefillTitle]);
  useEffect(() => { if (prefillAuthor && !author) setAuthor(prefillAuthor); }, [prefillAuthor]);
  useEffect(() => { if (prefillIsbn && !isbn) setIsbn(prefillIsbn); }, [prefillIsbn]);

  const analyze = useCallback(async () => {
    if (!title && !author && !isbn) { toast.error("Enter at least a title, author, or ISBN"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/ai/suggest-metadata`, { method: "POST", headers: hdrs(),
        body: JSON.stringify({ title, author, isbn, publisher, abstract }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setResult(data);
      toast.success(t("ai.approved"));
    } catch (err: any) {
      console.error("Phase 1 error:", err);
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [title, author, isbn, publisher, abstract]);

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.phase1Desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <InputField value={title} onChange={setTitle} placeholder={t("ai.enterTitle")} style={inputStyle} />
        <InputField value={author} onChange={setAuthor} placeholder={t("ai.enterAuthor")} style={inputStyle} />
        <InputField value={isbn} onChange={setIsbn} placeholder={t("ai.enterISBN")} style={inputStyle} />
        <InputField value={publisher} onChange={setPublisher} placeholder={t("ai.enterPublisher")} style={inputStyle} />
      </div>
      <InputField value={abstract} onChange={setAbstract} placeholder={t("ai.enterAbstract")} style={inputStyle} multiline />
      <BtnAction onClick={analyze} loading={loading} color={BM.accent} BM={BM}>
        <Sparkles className="h-3.5 w-3.5" /> {t("ai.analyze")}
      </BtnAction>

      {error && (
        <div className="p-3 rounded-xl text-xs flex items-start gap-2"
          style={{ background: `${BM.danger}12`, border: `1px solid ${BM.danger}30`, color: BM.danger }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Subjects */}
          {result.suggestedSubjects?.length > 0 && (
            <div>
              <SLabel icon={Tag} label={t("ai.subjects")} color={BM.accent} />
              <div className="flex flex-wrap gap-1.5">
                {result.suggestedSubjects.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
                    style={{ background: `${BM.accent}10`, border: `1px solid ${BM.accent}25`, color: BM.text }}>
                    {s.label} <ConfBadge v={s.confidence} theme={BM} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Genre */}
          {result.suggestedGenre?.length > 0 && (
            <div>
              <SLabel icon={BookOpen} label={t("ai.genres")} color="#a855f7" />
              <div className="flex flex-wrap gap-1.5">
                {result.suggestedGenre.map((g: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
                    style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: BM.text }}>
                    {g.label} <ConfBadge v={g.confidence} theme={BM} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          {result.suggestedRelatorRoles?.length > 0 && (
            <div>
              <SLabel icon={Users} label={t("ai.relatorRoles")} color={BM.warning} />
              <div className="flex flex-wrap gap-1.5">
                {result.suggestedRelatorRoles.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
                    style={{ background: `${BM.warning}10`, border: `1px solid ${BM.warning}25`, color: BM.text }}>
                    {r.label} {r.source && <span className="opacity-50">({r.source})</span>}
                    <ConfBadge v={r.confidence} theme={BM} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language + Year row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.detectedLanguage && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: `${BM.success}08`, border: `1px solid ${BM.success}20` }}>
                <Languages className="h-4 w-4" style={{ color: BM.success }} />
                <div className="flex-1">
                  <div className="text-[10px] font-bold" style={{ color: BM.success }}>{t("ai.language")}</div>
                  <div className="text-xs" style={{ color: BM.text }}>{result.detectedLanguage.label} ({result.detectedLanguage.code})</div>
                </div>
                <ConfBadge v={result.detectedLanguage.confidence} theme={BM} />
              </div>
            )}
            {result.extractedYear && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: `${BM.warning}08`, border: `1px solid ${BM.warning}20` }}>
                <Calendar className="h-4 w-4" style={{ color: BM.warning }} />
                <div className="flex-1">
                  <div className="text-[10px] font-bold" style={{ color: BM.warning }}>{t("ai.year")}</div>
                  <div className="text-xs" style={{ color: BM.text }}>{result.extractedYear.year}</div>
                </div>
                <ConfBadge v={result.extractedYear.confidence} theme={BM} />
              </div>
            )}
          </div>

          {/* Summary */}
          {result.generatedSummary && (
            <div>
              <SLabel icon={FileText} label={t("ai.summary")} color={BM.accentDim} />
              <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: `${BM.accent}08`, border: `1px solid ${BM.accent}20`, color: BM.text }}>
                {result.generatedSummary}
              </div>
            </div>
          )}

          {/* Authority Candidates */}
          {result.authorityCandidates?.length > 0 && (
            <div>
              <SLabel icon={Database} label={t("ai.authorities")} color={BM.success} />
              <div className="space-y-1">
                {result.authorityCandidates.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg"
                    style={{ background: `${BM.success}08`, border: `1px solid ${BM.success}18` }}>
                    <span className="text-xs" style={{ color: BM.text }}>{a.label}</span>
                    <ConfBadge v={a.confidence} theme={BM} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// PHASE 2
// ═══════════════════════════════════════════════════════════

function P2DuplicateDetection({ BM, isLight, inputStyle, t, prefillTitle, prefillAuthor, prefillIsbn }: {
  BM: BMTheme; isLight: boolean; inputStyle: any; t: any;
  prefillTitle?: string; prefillAuthor?: string; prefillIsbn?: string;
}) {
  const [title, setTitle] = useState(prefillTitle || "");
  const [author, setAuthor] = useState(prefillAuthor || "");
  const [isbn, setIsbn] = useState(prefillIsbn || "");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (!title) { toast.error("Title required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/ai/detect-duplicates`, { method: "POST", headers: hdrs(),
        body: JSON.stringify({ title, author, isbn }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setCandidates(data.candidates || []);
      toast.success(`${(data.candidates || []).length} candidate(s)`);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [title, author, isbn]);

  const mergeCol = (r: string) => r === "Auto-Merge" ? BM.success : r === "Review Required" ? BM.warning : BM.danger;

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.phase2Desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <InputField value={title} onChange={setTitle} placeholder={t("ai.enterTitle")} style={inputStyle} />
        <InputField value={author} onChange={setAuthor} placeholder={t("ai.enterAuthor")} style={inputStyle} />
        <InputField value={isbn} onChange={setIsbn} placeholder={t("ai.enterISBN")} style={inputStyle} />
      </div>
      <BtnAction onClick={detect} loading={loading} color={BM.warning} BM={BM}>
        <Layers className="h-3.5 w-3.5" /> {loading ? t("ai.detecting") : t("ai.analyze")}
      </BtnAction>

      {error && (
        <div className="p-3 rounded-xl text-xs" style={{ background: `${BM.danger}12`, border: `1px solid ${BM.danger}30`, color: BM.danger }}>
          <AlertTriangle className="h-4 w-4 inline mr-1" /> {error}
        </div>
      )}

      {candidates !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {candidates.length === 0 ? (
            <div className="text-center py-6 rounded-xl" style={{ background: `${BM.success}08`, border: `1px solid ${BM.success}20` }}>
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1" style={{ color: BM.success }} />
              <p className="text-xs font-semibold" style={{ color: BM.success }}>{t("ai.noCandidates")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <div key={i} className="p-3 rounded-xl space-y-2" style={{ background: `${mergeCol(c.mergeRecommendation)}06`, border: `1px solid ${mergeCol(c.mergeRecommendation)}25` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: BM.text }}>{c.candidateTitle || c.candidateId}</span>
                    <ConfBadge v={c.similarityScore} theme={BM} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase font-bold" style={{ color: BM.textMuted }}>{t("ai.mergeRec")}:</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: `${mergeCol(c.mergeRecommendation)}12`, color: mergeCol(c.mergeRecommendation) }}>
                      {c.mergeRecommendation}
                    </span>
                  </div>
                  {c.matchReasons?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.matchReasons.map((r: string, j: number) => (
                        <span key={j} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: `${BM.accent}10`, color: BM.accentDim }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// PHASE 3
// ═══════════════════════════════════════════════════════════

const NL_EXAMPLES = [
  "Arabic books about irrigation before 1950 held in Baghdad",
  "كتب عربية عن الري قبل 1950",
  "English manuscripts about astronomy",
  "Islamic philosophy texts published in Cairo",
];

function P3NaturalLanguage({ BM, isLight, inputStyle, t, lang }: {
  BM: BMTheme; isLight: boolean; inputStyle: any; t: any; lang: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) { toast.error("Enter a query"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/ai/natural-search`, { method: "POST", headers: hdrs(),
        body: JSON.stringify({ query }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setResult(data);
      toast.success("Query parsed");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.phase3Desc")}</p>
      <InputField value={query} onChange={setQuery} placeholder={t("ai.enterQuery")} style={inputStyle} dir={lang === "ar" ? "rtl" : "ltr"} />
      <div className="flex flex-wrap gap-1">
        {NL_EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setQuery(ex)}
            className="px-2 py-1 rounded-lg text-[10px] transition-all hover:scale-105"
            style={{ background: `${BM.success}10`, border: `1px solid ${BM.success}20`, color: BM.success }}>
            {ex.length > 35 ? ex.slice(0, 35) + "…" : ex}
          </button>
        ))}
      </div>
      <BtnAction onClick={search} loading={loading} color={BM.success} BM={BM}>
        <Search className="h-3.5 w-3.5" /> {t("ai.search")}
      </BtnAction>
      {error && <div className="p-2 rounded-lg text-xs" style={{ background: `${BM.danger}12`, color: BM.danger }}><AlertTriangle className="h-3 w-3 inline mr-1" />{error}</div>}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-xl overflow-hidden" style={{ background: isLight ? "#f9fafb" : "rgba(15,23,42,0.7)", border: `1px solid ${BM.success}20` }}>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BM.success}15` }}>
              <span className="text-[9px] font-bold uppercase" style={{ color: BM.success }}>{t("ai.structuredQuery")}</span>
              <button onClick={() => copyText(JSON.stringify(result, null, 2))} className="text-[9px] flex items-center gap-1" style={{ color: BM.textMuted }}>
                <Copy className="h-2.5 w-2.5" /> Copy
              </button>
            </div>
            <pre className="p-3 text-[10px] overflow-auto max-h-48" style={{ color: BM.text }} dir="ltr">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// PHASE 4
// ═══════════════════════════════════════════════════════════

const SQ_EXAMPLES = [
  "Show all works about irrigation by Iraqi authors",
  "Find books published before 1900 in Arabic",
  "List works with subject 'Islamic art'",
];

function P4SPARQLTranslator({ BM, isLight, inputStyle, t, lang }: {
  BM: BMTheme; isLight: boolean; inputStyle: any; t: any; lang: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(async () => {
    if (!query.trim()) { toast.error("Enter a query"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/ai/sparql-translate`, { method: "POST", headers: hdrs(),
        body: JSON.stringify({ query }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setResult(data);
      toast.success("SPARQL generated");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.phase4Desc")}</p>
      <InputField value={query} onChange={setQuery} placeholder={t("ai.enterSparql")} style={inputStyle} dir={lang === "ar" ? "rtl" : "ltr"} />
      <div className="flex flex-wrap gap-1">
        {SQ_EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setQuery(ex)}
            className="px-2 py-1 rounded-lg text-[10px] transition-all hover:scale-105"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>
            {ex.length > 35 ? ex.slice(0, 35) + "…" : ex}
          </button>
        ))}
      </div>
      <BtnAction onClick={translate} loading={loading} color="#a855f7" BM={BM}>
        <Code2 className="h-3.5 w-3.5" /> {t("ai.translate")}
      </BtnAction>
      {error && <div className="p-2 rounded-lg text-xs" style={{ background: `${BM.danger}12`, color: BM.danger }}><AlertTriangle className="h-3 w-3 inline mr-1" />{error}</div>}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2">
            {result.isSafe ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                style={{ background: `${BM.success}12`, border: `1px solid ${BM.success}25`, color: BM.success }}>
                <CheckCircle2 className="h-3 w-3" /> {t("ai.safe")}
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                style={{ background: `${BM.danger}12`, border: `1px solid ${BM.danger}25`, color: BM.danger }}>
                <XCircle className="h-3 w-3" /> {t("ai.unsafe")}
              </span>
            )}
          </div>
          {result.explanation && (
            <div className="p-2.5 rounded-xl text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: BM.text }}>
              <span className="text-[10px] font-bold" style={{ color: "#a855f7" }}>{t("ai.explanation")}:</span> {result.explanation}
            </div>
          )}
          <div className="rounded-xl overflow-hidden" style={{ background: isLight ? "#f9fafb" : "rgba(15,23,42,0.7)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
              <span className="text-[9px] font-bold uppercase" style={{ color: "#a855f7" }}>SPARQL</span>
              <button onClick={() => copyText(result.sparqlQuery)} className="text-[9px] flex items-center gap-1" style={{ color: BM.textMuted }}>
                <Copy className="h-2.5 w-2.5" /> Copy
              </button>
            </div>
            <pre className="p-3 text-[10px] overflow-auto max-h-48 whitespace-pre-wrap" style={{ color: isLight ? "#1e40af" : "#93c5fd" }} dir="ltr">
              {result.sparqlQuery}
            </pre>
          </div>
          {result.warnings?.length > 0 && result.warnings.map((w: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg text-[10px]"
              style={{ background: `${BM.warning}08`, border: `1px solid ${BM.warning}20`, color: BM.warning }}>
              <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// PHASE 5 — MULTI-SOURCE
// ═══════════════════════════════════════════════════════════

function P5AutoFill({ BM, isLight, inputStyle, t, prefillTitle, prefillAuthor, prefillIsbn }: {
  BM: BMTheme; isLight: boolean; inputStyle: any; t: any;
  prefillTitle?: string; prefillAuthor?: string; prefillIsbn?: string;
}) {
  const [isbn, setIsbn] = useState(prefillIsbn || "");
  const [title, setTitle] = useState(prefillTitle || "");
  const [author, setAuthor] = useState(prefillAuthor || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fill = useCallback(async () => {
    if (!isbn && !title && !author) { toast.error("Enter an ISBN, title, or author"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/ai/autofill`, { method: "POST", headers: hdrs(),
        body: JSON.stringify({ isbn, title, author }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setResult(data);
      toast.success("Auto-fill complete");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, [isbn, title, author]);

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.phase5Desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <InputField value={isbn} onChange={setIsbn} placeholder={t("ai.enterISBN")} style={inputStyle} />
        <InputField value={title} onChange={setTitle} placeholder={t("ai.enterTitle")} style={inputStyle} />
        <InputField value={author} onChange={setAuthor} placeholder={t("ai.enterAuthor")} style={inputStyle} />
      </div>
      <BtnAction onClick={fill} loading={loading} color={BM.success} BM={BM}>
        <Wand2 className="h-3.5 w-3.5" /> {t("ai.autoFill")}
      </BtnAction>
      {error && <div className="p-2 rounded-lg text-xs" style={{ background: `${BM.danger}12`, color: BM.danger }}><AlertTriangle className="h-3 w-3 inline mr-1" />{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Sources bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold" style={{ color: BM.textMuted }}>{t("ai.source")}:</span>
            {(result.sources || [result.source || "AI"]).map((s: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: `${BM.success}12`, border: `1px solid ${BM.success}25`, color: BM.success }}>
                {s}
              </span>
            ))}
            {result.confidence != null && <ConfBadge v={result.confidence} theme={BM} />}
          </div>

          {/* Mapped Fields */}
          {result.mappedFields && Object.keys(result.mappedFields).length > 0 && (
            <div>
              <SLabel icon={CheckCircle2} label={t("ai.mappedFields")} color={BM.success} />
              <div className="rounded-xl overflow-hidden" style={{ background: isLight ? "#f9fafb" : "rgba(15,23,42,0.7)", border: `1px solid ${BM.success}20` }}>
                <pre className="p-3 text-[10px] overflow-auto max-h-60" style={{ color: BM.text }} dir="ltr">
                  {JSON.stringify(result.mappedFields, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Triples */}
          {result.bibframeTriples?.length > 0 && (
            <div>
              <SLabel icon={Layers} label={t("ai.bibframeTriples")} color={BM.accent} />
              <div className="space-y-1">
                {result.bibframeTriples.map((triple: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-[10px]"
                    style={{ background: `${BM.accent}08`, border: `1px solid ${BM.accent}18` }}>
                    <span className="font-mono font-bold shrink-0" style={{ color: BM.accent }}>{triple.predicate}</span>
                    <span className="truncate" style={{ color: BM.text }}>{typeof triple.value === 'string' ? triple.value : JSON.stringify(triple.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmapped */}
          {result.unmappedFields?.length > 0 && (
            <div>
              <SLabel icon={AlertTriangle} label={t("ai.unmappedFields")} color={BM.warning} />
              <div className="flex flex-wrap gap-1">
                {result.unmappedFields.map((f: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: `${BM.warning}10`, color: BM.warning }}>{f}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════

function AuditPanel({ BM, isLight, t }: { BM: BMTheme; isLight: boolean; t: any }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/ai/audit-log?limit=50`, { headers: hdrs() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setEntries(data.entries || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const approve = async (id: string, approved: boolean) => {
    try {
      await fetch(`${API}/ai/audit/${id}/approve`, { method: "POST", headers: hdrs(), body: JSON.stringify({ approved }) });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, approved } : e));
      toast.success(approved ? t("ai.approved") : t("ai.rejected"));
    } catch (err: any) { toast.error(err.message); }
  };

  const phaseColor = (p: string) => {
    if (p.includes("phase1")) return BM.accent;
    if (p.includes("phase2")) return BM.warning;
    if (p.includes("phase3")) return BM.success;
    if (p.includes("phase4")) return "#a855f7";
    if (p.includes("phase5")) return BM.success;
    return BM.textMuted;
  };
  const phaseLabel = (p: string) => p.includes("phase1") ? "P1" : p.includes("phase2") ? "P2" : p.includes("phase3") ? "P3" : p.includes("phase4") ? "P4" : p.includes("phase5") ? "P5" : "?";

  const total = entries.length;
  const approvedCount = entries.filter(e => e.approved === true).length;
  const approvalRate = total > 0 ? Math.round((approvedCount / total) * 100) : 0;
  const avgTime = total > 0 ? Math.round(entries.reduce((s, e) => s + (e.processingTimeMs || 0), 0) / total) : 0;

  return (
    <div className="space-y-4">
      <p className="text-[11px]" style={{ color: BM.textMuted }}>{t("ai.auditLogDesc")}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("ai.totalInteractions"), value: total, color: BM.accent, icon: BarChart3 },
          { label: t("ai.approvalRate"), value: `${approvalRate}%`, color: BM.success, icon: ThumbsUp },
          { label: t("ai.avgProcessingTime"), value: `${avgTime}ms`, color: "#a855f7", icon: Zap },
        ].map((s, i) => (
          <div key={i} className="p-2.5 rounded-xl text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
            <s.icon className="h-3.5 w-3.5 mx-auto mb-0.5" style={{ color: s.color }} />
            <div className="text-base font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px]" style={{ color: BM.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: BM.text }}>{total} entries</span>
        <button onClick={load} className="p-1.5 rounded-lg" style={{ color: BM.textMuted }}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-6 text-xs" style={{ color: BM.textMuted }}>{t("ai.noResults")}</div>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: isLight ? "#f9fafb" : "rgba(15,23,42,0.5)", border: `1px solid ${phaseColor(entry.featurePhase)}15` }}>
              <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="w-full px-3 py-2 flex items-center gap-2 text-start">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: `${phaseColor(entry.featurePhase)}15`, color: phaseColor(entry.featurePhase) }}>
                  {phaseLabel(entry.featurePhase)}
                </span>
                <span className="text-[10px] flex-1 truncate" style={{ color: BM.text }}>
                  {typeof entry.input === 'object' ? (entry.input.title || entry.input.query || entry.input.isbn || "...") : String(entry.input).slice(0, 50)}
                </span>
                <span className="text-[9px]" style={{ color: BM.textDim }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                {entry.approved === true && <CheckCircle2 className="h-3 w-3" style={{ color: BM.success }} />}
                {entry.approved === false && <XCircle className="h-3 w-3" style={{ color: BM.danger }} />}
                {entry.approved == null && <Clock className="h-3 w-3" style={{ color: BM.textDim }} />}
              </button>

              {expandedId === entry.id && (
                <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${BM.cardBorder}` }}>
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: BM.textMuted }}>Input</div>
                      <pre className="p-1.5 rounded-lg text-[9px] overflow-auto max-h-32" style={{ background: BM.inputBg, color: BM.text }} dir="ltr">
                        {JSON.stringify(entry.input, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: BM.textMuted }}>Output</div>
                      <pre className="p-1.5 rounded-lg text-[9px] overflow-auto max-h-32" style={{ background: BM.inputBg, color: BM.text }} dir="ltr">
                        {JSON.stringify(entry.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(entry.id, true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                      style={{ background: `${BM.success}12`, border: `1px solid ${BM.success}25`, color: BM.success }}>
                      <ThumbsUp className="h-2.5 w-2.5" /> {t("ai.approve")}
                    </button>
                    <button onClick={() => approve(entry.id, false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                      style={{ background: `${BM.danger}12`, border: `1px solid ${BM.danger}25`, color: BM.danger }}>
                      <ThumbsDown className="h-2.5 w-2.5" /> {t("ai.reject")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}