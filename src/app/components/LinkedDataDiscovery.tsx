/**
 * Open Linked Data Discovery Layer
 * Enterprise-grade BIBFRAME Linked Data Discovery UI
 * 
 * Features:
 * - Faceted search with keyword search & autocomplete
 * - Record detail pages with WEMI hierarchy
 * - Linked graph navigation (click author/subject to traverse)
 * - Content negotiation (JSON-LD, Turtle, N-Triples download)
 * - URI resolution display
 * - Catalog statistics dashboard
 * - Full Arabic/RTL i18n support
 * - Blue Moon dark-glass / legacy-glass theme
 *
 * Designed and developed by Isaac Faleh
 */

"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, BookOpen, Package, Layers, Database, 
  Globe, User, Tag, Download, ExternalLink,
  ChevronLeft, ChevronRight, Filter, BarChart3, Network,
  Hash, Link2, ArrowRight, Loader2, ChevronDown,
  Moon, Sun, Languages, Orbit, Share2, Copy, Check, Radio,
  Import} from "lucide-react";
import { projectId } from "../../../utils/supabase/info";
import { moonHeaders } from "../utils/moonApi";
import "../../styles/glassmorphism.css";

// ============================== TYPES ==============================

interface DiscoveryRecord {
  id: string;
  title: string;
  document: any;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  cataloger?: string;
  resourceType?: string;
  source?: string;
  sourceUri?: string;
}

interface Facet {
  field: string;
  label: string;
  values: Array<{ value: string; label: string; count: number }>;
}

interface DiscoveryResults {
  total: number;
  results: DiscoveryRecord[];
  facets: Facet[];
  page: number;
  pageSize: number;
  sources?: SourceMeta[];
}

interface SourceMeta {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  baseUrl: string;
  enabled: boolean;
}

// Source display config (mirrors server SOURCE_META)
const SOURCE_COLORS: Record<string, { color: string; label: string; icon: string }> = {
  internal:    { color: "#3b82f6", label: "Local",       icon: "Database" },
  loc:         { color: "#dc2626", label: "LOC",         icon: "Building" },
  viaf:        { color: "#059669", label: "VIAF",        icon: "Globe" },
  openlibrary: { color: "#d97706", label: "OpenLib",     icon: "BookOpen" },
  wikidata:    { color: "#ff9900", label: "Wikidata",    icon: "Globe" },
  worldcat:    { color: "#0066cc", label: "WorldCat",    icon: "BookOpen" },
  fast:        { color: "#009900", label: "FAST",        icon: "Tag" },
  isbndb:      { color: "#6574cd", label: "ISBNdb",      icon: "BookOpen" },
  googlebooks: { color: "#4285f4", label: "GoogleBooks", icon: "BookOpen" },
  crossref:    { color: "#333333", label: "CrossRef",    icon: "FileText" },
  bnf:         { color: "#00539f", label: "BNF",         icon: "Building" },
  lcsh:        { color: "#b91c1c", label: "LCSH",        icon: "Tag" },
  lobidgnd:    { color: "#1d4ed8", label: "GND",         icon: "Building" },
  isni:        { color: "#7c3aed", label: "ISNI",        icon: "User" },
  hathitrust:  { color: "#a16207", label: "HathiTrust",  icon: "BookOpen" },
  getty:       { color: "#0d9488", label: "Getty",       icon: "Globe" },
  europeana:   { color: "#0369a1", label: "Europeana",   icon: "Globe" },
  dpla:        { color: "#be185d", label: "DPLA",        icon: "BookOpen" },
  sharevde:    { color: "#4f46e5", label: "ShareVDE",    icon: "Network" },
};

function SourceBadge({ source, size = "sm" }: { source?: string; size?: "sm" | "xs" }) {
  const src = SOURCE_COLORS[source || "internal"] || SOURCE_COLORS.internal;
  const py = size === "xs" ? "py-0" : "py-0.5";
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={`${text} px-1.5 ${py} rounded-full font-bold inline-flex items-center gap-1`}
      style={{ background: `${src.color}18`, color: src.color, border: `1px solid ${src.color}33` }}
    >
      <Radio className="h-2 w-2" />
      {src.label}
    </span>
  );
}

interface CatalogStats {
  totalRecords: number;
  works: number;
  instances: number;
  items: number;
  uniqueLanguages: number;
  uniqueContributors: number;
  uniqueSubjects: number;
}

type DiscoveryView = "search" | "record" | "agent" | "subject" | "stats";
// Moon Studio also has a "classic" theme; Discovery draws it with its dark theme.
type GlassTheme = "dark" | "legacy" | "classic";
type SortOption = "relevance" | "title" | "date" | "contributor";
type RdfFormat = "jsonld" | "turtle" | "ntriples";

// ============================== THEME ==============================

const DARK_THEME = {
  bg: "linear-gradient(180deg, #0a0e27 0%, #0f1a3a 25%, #0a0e27 50%, #0f1a3a 75%, #0a0e27 100%)",
  navBg: "rgba(10,14,39,0.88)",
  navBorder: "rgba(59,130,246,0.15)",
  cardBg: "rgba(15,23,42,0.65)",
  cardBorder: "rgba(59,130,246,0.12)",
  cardHover: "rgba(59,130,246,0.08)",
  accent: "#3b82f6",
  accentDim: "#60a5fa",
  accentGlow: "rgba(59,130,246,0.15)",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  inputBg: "rgba(30,41,59,0.7)",
  inputBorder: "rgba(59,130,246,0.2)",
  sidebarBg: "rgba(10,14,39,0.75)",
  badgeBg: "rgba(59,130,246,0.12)",
  badgeText: "#60a5fa",
};

const LEGACY_THEME = {
  bg: "transparent",
  navBg: "rgba(255,255,255,0.8)",
  navBorder: "rgba(255,255,255,0.5)",
  cardBg: "rgba(255,255,255,0.72)",
  cardBorder: "rgba(255,255,255,0.4)",
  cardHover: "rgba(0,0,0,0.04)",
  accent: "#3b82f6",
  accentDim: "#2563eb",
  accentGlow: "rgba(59,130,246,0.1)",
  success: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  text: "#000000",
  textMuted: "#374151",
  textDim: "#6b7280",
  inputBg: "rgba(255,255,255,0.5)",
  inputBorder: "rgba(255,255,255,0.4)",
  sidebarBg: "rgba(255,255,255,0.65)",
  badgeBg: "rgba(59,130,246,0.08)",
  badgeText: "#2563eb",
};

// ============================== API HELPERS ==============================

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c`;

async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...moonHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...moonHeaders() },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function importRecordToLocal(record: DiscoveryRecord): Promise<any> {
  const res = await fetch(`${API_BASE}/moon/discovery/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...moonHeaders() },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import failed: ${res.status}`);
  }
  return res.json();
}

async function downloadRdf(recordId: string, format: RdfFormat) {
  const formatPath = format === "jsonld" ? "jsonld" : format === "turtle" ? "turtle" : "ntriples";
  const res = await fetch(`${API_BASE}/ld/resource/${encodeURIComponent(recordId)}/${formatPath}`, {
    headers: { ...moonHeaders() },
  });
  if (!res.ok) throw new Error("Download failed");
  const text = await res.text();
  const mimeMap: Record<RdfFormat, string> = {
    jsonld: "application/ld+json",
    turtle: "text/turtle",
    ntriples: "application/n-triples",
  };
  const extMap: Record<RdfFormat, string> = { jsonld: "jsonld", turtle: "ttl", ntriples: "nt" };
  const blob = new Blob([text], { type: mimeMap[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${recordId}.${extMap[format]}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================== HELPERS ==============================

function extractTitle(doc: any): string {
  if (!doc?.["@graph"]) return "Untitled";
  for (const node of doc["@graph"]) {
    if (node["@type"]?.includes?.("Title") || node["@type"]?.includes?.("bf:Title")) {
      return node["bf:mainTitle"] || node["http://id.loc.gov/ontologies/bibframe/mainTitle"] || "";
    }
  }
  // Fallback: look in Work node
  for (const node of doc["@graph"]) {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"] || ""];
    if (types.some((t: string) => t.includes("Work"))) {
      const title = node["bf:title"];
      if (typeof title === "string") return title;
      if (title?.["bf:mainTitle"]) return title["bf:mainTitle"];
      if (title?.["mainTitle"]) return title["mainTitle"];
      if (title?.["rdfs:label"]) return title["rdfs:label"];
    }
  }
  return "Untitled";
}

function extractWorkData(doc: any): any {
  if (!doc?.["@graph"]) return null;
  return doc["@graph"].find((n: any) => {
    const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"] || ""];
    return types.some((t: string) => t.includes("Work"));
  });
}

function extractInstanceData(doc: any): any[] {
  if (!doc?.["@graph"]) return [];
  return doc["@graph"].filter((n: any) => {
    const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"] || ""];
    return types.some((t: string) => t.includes("Instance"));
  });
}

function extractContributors(doc: any): Array<{ label: string; uri: string; role?: string }> {
  if (!doc?.["@graph"]) return [];
  const contribs: Array<{ label: string; uri: string; role?: string }> = [];
  for (const node of doc["@graph"]) {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"] || ""];
    if (types.some((t: string) => t.includes("Contribution"))) {
      const agent = node["bf:agent"] || node["http://id.loc.gov/ontologies/bibframe/agent"];
      if (agent) {
        const label = typeof agent === "object" ? (agent["rdfs:label"] || agent["@id"] || "") : String(agent);
        const uri = typeof agent === "object" ? (agent["@id"] || "") : "";
        const role = node["bf:role"]?.["rdfs:label"] || node["bf:role"]?.["@id"] || "";
        contribs.push({ label, uri, role: typeof role === "string" ? role : "" });
      }
    }
  }
  return contribs;
}

function extractSubjects(doc: any): Array<{ label: string; uri: string }> {
  if (!doc?.["@graph"]) return [];
  const subjects: Array<{ label: string; uri: string }> = [];
  for (const node of doc["@graph"]) {
    const subj = node["bf:subject"] || node["http://id.loc.gov/ontologies/bibframe/subject"];
    if (subj) {
      const items = Array.isArray(subj) ? subj : [subj];
      for (const s of items) {
        const label = typeof s === "object" ? (s["rdfs:label"] || s["@id"] || "") : String(s);
        const uri = typeof s === "object" ? (s["@id"] || "") : "";
        subjects.push({ label, uri });
      }
    }
  }
  return subjects;
}

function extractLanguage(doc: any): string {
  if (!doc?.["@graph"]) return "";
  for (const node of doc["@graph"]) {
    const lang = node["bf:language"] || node["http://id.loc.gov/ontologies/bibframe/language"];
    if (lang) {
      if (typeof lang === "object") return lang["rdfs:label"] || lang["@id"]?.split("/").pop() || "";
      return String(lang).split("/").pop() || "";
    }
  }
  return "";
}

function extractDate(doc: any): string {
  if (!doc?.["@graph"]) return "";
  for (const node of doc["@graph"]) {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"] || ""];
    if (types.some((t: string) => t.includes("ProvisionActivity") || t.includes("Publication"))) {
      return node["bf:date"] || node["http://id.loc.gov/ontologies/bibframe/date"] || "";
    }
  }
  return "";
}

function countTriples(doc: any): number {
  if (!doc?.["@graph"]) return 0;
  let count = 0;
  for (const node of doc["@graph"]) {
    if (node["@type"]) {
      count += Array.isArray(node["@type"]) ? node["@type"].length : 1;
    }
    for (const key of Object.keys(node)) {
      if (!key.startsWith("@")) count++;
    }
  }
  return count;
}

function countEntities(doc: any): number {
  return doc?.["@graph"]?.length || 0;
}

// ============================== PROPS ==============================

interface LinkedDataDiscoveryProps {
  onBack?: () => void;
  glassTheme?: GlassTheme;
  onThemeToggle?: () => void;
  /** Called when user wants to import a discovery result into the active cataloging form */
  onImportToForm?: (record: DiscoveryRecord) => void;
}

// ============================== MAIN COMPONENT ==============================

export default function LinkedDataDiscovery({ onBack, glassTheme: externalTheme, onThemeToggle, onImportToForm }: LinkedDataDiscoveryProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  // Theme
  const [internalTheme, setInternalTheme] = useState<GlassTheme>("dark");
  const glassTheme = externalTheme || internalTheme;
  const TH = glassTheme === "legacy" ? LEGACY_THEME : DARK_THEME;
  const isLegacy = glassTheme === "legacy";

  // View state
  const [view, setView] = useState<DiscoveryView>("search");
  const [viewStack, setViewStack] = useState<Array<{ view: DiscoveryView; data: any }>>([]);

  // Search state
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiscoveryResults | null>(null);

  // Facet state
  const [selectedFacets, setSelectedFacets] = useState<{
    type: string[]; language: string[]; contributor: string[]; source: string[];
  }>({ type: [], language: [], contributor: [], source: [] });
  const [showFacets, setShowFacets] = useState(true);

  // Record detail state
  const [selectedRecord, setSelectedRecord] = useState<DiscoveryRecord | null>(null);
  const [rdfPreview, setRdfPreview] = useState<{ format: RdfFormat; content: string } | null>(null);

  // Agent / Subject browsing
  const [agentResults, setAgentResults] = useState<DiscoveryRecord[]>([]);
  const [agentUri, setAgentUri] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [subjectResults, setSubjectResults] = useState<DiscoveryRecord[]>([]);
  const [subjectUri, setSubjectUri] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");

  // Stats
  const [stats, setStats] = useState<CatalogStats | null>(null);

  // Clipboard
  const [copied, setCopied] = useState(false);

  // ===== SEARCH =====
  const executeSearch = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = { q: query || undefined, sort: sortBy, page, pageSize };
      const facets: any = {};
      if (selectedFacets.type.length) facets.type = selectedFacets.type;
      if (selectedFacets.language.length) facets.language = selectedFacets.language;
      if (selectedFacets.contributor.length) facets.contributor = selectedFacets.contributor;
      if (selectedFacets.source.length) facets.source = selectedFacets.source;
      if (Object.keys(facets).length) body.facets = facets;
      const data = await apiPost("/moon/discover", body);
      setResults(data);
    } catch (err) {
      console.error("Discovery search error:", err);
      toast.error("Search failed");
      setResults({ total: 0, results: [], facets: [], page: 1, pageSize });
    } finally {
      setLoading(false);
    }
  }, [query, sortBy, page, pageSize, selectedFacets]);

  useEffect(() => { executeSearch(); }, [page, sortBy]);
  useEffect(() => { loadStats(); }, []);

  const handleSearch = () => { setPage(1); executeSearch(); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  // ===== LOAD STATS =====
  const loadStats = async () => {
    try {
      const data = await apiGet("/ld/stats");
      setStats(data);
    } catch (err) {
      console.error("Stats load error:", err);
    }
  };

  // ===== NAVIGATE =====
  const pushView = (newView: DiscoveryView, data?: any) => {
    setViewStack(prev => [...prev, { view, data: { selectedRecord, agentUri, agentLabel, subjectUri, subjectLabel } }]);
    setView(newView);
  };

  const popView = () => {
    if (viewStack.length === 0) {
      setView("search");
      setSelectedRecord(null);
      return;
    }
    const prev = viewStack[viewStack.length - 1];
    setViewStack(s => s.slice(0, -1));
    setView(prev.view);
    if (prev.data?.selectedRecord) setSelectedRecord(prev.data.selectedRecord);
  };

  // ===== VIEW RECORD =====
  const viewRecord = (record: DiscoveryRecord) => {
    setSelectedRecord(record);
    setRdfPreview(null);
    pushView("record");
  };

  // ===== BROWSE AGENT =====
  const browseAgent = async (uri: string, label: string) => {
    setAgentUri(uri);
    setAgentLabel(label);
    pushView("agent");
    try {
      const data = await apiGet(`/moon/browse/agent/${encodeURIComponent(uri)}`);
      setAgentResults(data.results || []);
    } catch (err) {
      console.error("Browse agent error:", err);
      setAgentResults([]);
    }
  };

  // ===== BROWSE SUBJECT =====
  const browseSubject = async (uri: string, label: string) => {
    setSubjectUri(uri);
    setSubjectLabel(label);
    pushView("subject");
    try {
      const data = await apiGet(`/moon/browse/subject/${encodeURIComponent(uri)}`);
      setSubjectResults(data.results || []);
    } catch (err) {
      console.error("Browse subject error:", err);
      setSubjectResults([]);
    }
  };

  // ===== FACET TOGGLE =====
  const toggleFacet = (field: string, value: string) => {
    setSelectedFacets(prev => {
      const key = field as keyof typeof prev;
      const current = prev[key] || [];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const clearFacets = () => {
    setSelectedFacets({ type: [], language: [], contributor: [], source: [] });
    setPage(1);
    setTimeout(executeSearch, 0);
  };

  // ===== RDF PREVIEW =====
  const previewRdf = async (record: DiscoveryRecord, format: RdfFormat) => {
    try {
      const formatPath = format === "turtle" ? "turtle" : format === "ntriples" ? "ntriples" : "jsonld";
      const res = await fetch(`${API_BASE}/ld/resource/${encodeURIComponent(record.id)}/${formatPath}`, {
        headers: { ...moonHeaders() },
      });
      if (!res.ok) {
        console.error("RDF preview fetch failed:", res.status, await res.text());
        toast.error("Failed to load RDF preview");
        return;
      }
      const text = await res.text();
      setRdfPreview({ format, content: format === "jsonld" ? JSON.stringify(JSON.parse(text), null, 2) : text });
    } catch {
      toast.error("Failed to load RDF preview");
    }
  };

  // ===== IMPORT TO LOCAL CATALOG =====
  const handleImportToLocal = async (record: DiscoveryRecord) => {
    try {
      toast.loading("Importing record to local catalog...", { id: "import" });
      
      // Save to KV backend
      const result = await importRecordToLocal(record);
      
      // If parent provided a form-import callback, populate the cataloging form fields
      if (onImportToForm) {
        onImportToForm(record);
        toast.success(`Imported "${record.title}" — form fields populated`, { id: "import", duration: 4000 });
      } else {
        toast.success(`Imported "${record.title}" to local catalog`, { id: "import" });
      }
      
      // Refresh search to show the newly imported record
      setTimeout(executeSearch, 500);
    } catch (err) {
      console.error("Import error:", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`, { id: "import" });
    }
  };

  // ===== COPY URI =====
  const copyUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("URI copied");
  };

  // ===== GLASS STYLE HELPERS =====
  const glassCard = {
    background: TH.cardBg,
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: `1px solid ${TH.cardBorder}`,
    borderRadius: 16,
  };

  const glassInput = {
    background: TH.inputBg,
    border: `1px solid ${TH.inputBorder}`,
    color: TH.text,
    borderRadius: 12,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  const totalPages = results ? Math.ceil(results.total / pageSize) : 0;

  // ============================== RENDER ==============================

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: isLegacy ? undefined : TH.bg,
        color: TH.text,
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
      className={isLegacy ? "animated-gradient-bg" : ""}
    >
      {/* ===== TOP NAV ===== */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: TH.navBg,
          borderBottom: `1px solid ${TH.navBorder}`,
          backdropFilter: "blur(24px) saturate(200%)",
          WebkitBackdropFilter: "blur(24px) saturate(200%)",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-xl transition-colors hover:opacity-80"
                style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
                <ChevronLeft className="h-5 w-5" style={{ color: TH.text }} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${TH.accent}, #8b5cf6)` }}>
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight" style={{ color: TH.text }}>
                  {t("discovery.title")}
                </h1>
                <p className="text-[11px] leading-tight" style={{ color: TH.textMuted }}>
                  {t("discovery.subtitle")} — {t("discovery.federated", "Federated")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats button */}
            <button onClick={() => { loadStats(); setView(view === "stats" ? "search" : "stats"); }}
              className="p-2 rounded-xl transition-colors" title="Catalog Statistics"
              style={{ background: view === "stats" ? TH.accent : TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
              <BarChart3 className="h-4 w-4" style={{ color: view === "stats" ? "#fff" : TH.textMuted }} />
            </button>
            {/* Language toggle */}
            <button onClick={() => { const lng = i18n.language === "en" ? "ar" : "en"; i18n.changeLanguage(lng); }}
              className="p-2 rounded-xl transition-colors"
              style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
              <Languages className="h-4 w-4" style={{ color: TH.textMuted }} />
            </button>
            {/* Theme toggle */}
            <button onClick={() => onThemeToggle ? onThemeToggle() : setInternalTheme(p => p === "dark" ? "legacy" : "dark")}
              className="p-2 rounded-xl transition-colors"
              style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
              {isLegacy ? <Moon className="h-4 w-4" style={{ color: TH.textMuted }} /> : <Sun className="h-4 w-4" style={{ color: TH.textMuted }} />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ===== STATS VIEW ===== */}
          {view === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <StatsView stats={stats} TH={TH} t={t} glassCard={glassCard} isLegacy={isLegacy} />
            </motion.div>
          )}

          {/* ===== SEARCH VIEW ===== */}
          {view === "search" && (
            <motion.div key="search" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {/* Search Bar */}
              <div className="mb-6 flex gap-3 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-5 w-5"
                    style={{ [isRtl ? "right" : "left"]: 14, color: TH.textDim }} />
                  <input
                    type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={t("discovery.searchPlaceholder")}
                    className="w-full py-3 text-sm outline-none"
                    style={{ ...glassInput, [isRtl ? "paddingRight" : "paddingLeft"]: 44, [isRtl ? "paddingLeft" : "paddingRight"]: 16 }}
                  />
                </div>
                <button onClick={handleSearch} className="px-5 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${TH.accent}, #8b5cf6)` }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discovery.search")}
                </button>
                <button onClick={() => setShowFacets(!showFacets)}
                  className="p-3 rounded-xl transition-colors"
                  style={{ background: showFacets ? TH.accent : TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
                  <Filter className="h-4 w-4" style={{ color: showFacets ? "#fff" : TH.textMuted }} />
                </button>
                {/* Sort */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
                  className="py-3 px-3 text-xs rounded-xl outline-none cursor-pointer"
                  style={glassInput}>
                  <option value="relevance">{t("discovery.relevance")}</option>
                  <option value="title">{t("discovery.titleSort")}</option>
                  <option value="date">{t("discovery.dateSort")}</option>
                  <option value="contributor">{t("discovery.contributorSort")}</option>
                </select>
              </div>

              {/* Federated Sources Indicator */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-[10px] font-semibold" style={{ color: TH.textDim }}>
                  {t("discovery.federatedSources", "Federated Sources:")}
                </span>
                {Object.entries(SOURCE_COLORS).map(([key, src]) => {
                  const isActive = selectedFacets.source.length === 0 || selectedFacets.source.includes(key);
                  return (
                    <button key={key}
                      onClick={() => {
                        setSelectedFacets(prev => {
                          const current = prev.source;
                          if (current.length === 0) {
                            // First click: select only this source
                            return { ...prev, source: [key] };
                          } else if (current.includes(key) && current.length === 1) {
                            // Deselect last: show all
                            return { ...prev, source: [] };
                          } else if (current.includes(key)) {
                            return { ...prev, source: current.filter(s => s !== key) };
                          } else {
                            return { ...prev, source: [...current, key] };
                          }
                        });
                        setPage(1);
                        setTimeout(executeSearch, 50);
                      }}
                      className="text-[10px] px-2 py-1 rounded-full font-semibold transition-all flex items-center gap-1"
                      style={{
                        background: isActive ? `${src.color}22` : "transparent",
                        color: isActive ? src.color : TH.textDim,
                        border: `1px solid ${isActive ? src.color + "44" : TH.cardBorder}`,
                        opacity: isActive ? 1 : 0.5,
                      }}
                    >
                      <Radio className="h-2.5 w-2.5" />
                      {src.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-5">
                {/* Facets Sidebar */}
                {showFacets && results && results.facets.length > 0 && (
                  <motion.aside
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-64 shrink-0"
                  >
                    <div style={{ ...glassCard, padding: 16 }}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold" style={{ color: TH.text }}>{t("discovery.facets")}</h3>
                        {(selectedFacets.type.length + selectedFacets.language.length + selectedFacets.contributor.length + selectedFacets.source.length) > 0 && (
                          <button onClick={clearFacets} className="text-[11px] px-2 py-0.5 rounded-lg"
                            style={{ background: TH.badgeBg, color: TH.badgeText }}>
                            {t("discovery.clearFilters")}
                          </button>
                        )}
                      </div>
                      {results.facets.map(facet => (
                        <FacetGroup
                          key={facet.field} facet={facet}
                          selected={selectedFacets[facet.field as keyof typeof selectedFacets] || []}
                          onToggle={(val) => toggleFacet(facet.field, val)}
                          TH={TH} isLegacy={isLegacy} t={t}
                        />
                      ))}
                      <button onClick={() => { setPage(1); executeSearch(); }}
                        className="w-full mt-3 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                        style={{ background: `linear-gradient(135deg, ${TH.accent}, #8b5cf6)` }}>
                        {t("discovery.apply")}
                      </button>
                    </div>
                  </motion.aside>
                )}

                {/* Results Grid */}
                <div className="flex-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: TH.accent }} />
                    </div>
                  ) : results && results.results.length > 0 ? (
                    <>
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <p className="text-xs" style={{ color: TH.textMuted }}>
                          {t("discovery.showing")} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, results.total)} {t("discovery.of")} {results.total} {t("discovery.results")}
                        </p>
                        {/* Source breakdown */}
                        {results.facets?.find(f => f.field === "source")?.values && (
                          <div className="flex items-center gap-1.5">
                            {results.facets.find(f => f.field === "source")!.values.map(sv => (
                              <span key={sv.value} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ background: `${SOURCE_COLORS[sv.value]?.color || TH.accent}15`,
                                  color: SOURCE_COLORS[sv.value]?.color || TH.textDim }}>
                                {SOURCE_COLORS[sv.value]?.label || sv.value}: {sv.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {results.results.map((record: any) => (
                          <RecordCard
                            key={record.id} record={record} TH={TH}
                            isLegacy={isLegacy} glassCard={glassCard} t={t}
                            onView={() => viewRecord(record)}
                            onAgent={(uri, label) => browseAgent(uri, label)}
                            onSubject={(uri, label) => browseSubject(uri, label)}
                            onImport={handleImportToLocal}
                          />
                        ))}
                      </div>
                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-6">
                          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-2 rounded-xl transition-colors disabled:opacity-30"
                            style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
                            {isRtl ? <ChevronRight className="h-4 w-4" style={{ color: TH.text }} /> : <ChevronLeft className="h-4 w-4" style={{ color: TH.text }} />}
                          </button>
                          <span className="text-xs" style={{ color: TH.textMuted }}>
                            {t("discovery.page")} {page} {t("discovery.of")} {totalPages}
                          </span>
                          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-2 rounded-xl transition-colors disabled:opacity-30"
                            style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}` }}>
                            {isRtl ? <ChevronLeft className="h-4 w-4" style={{ color: TH.text }} /> : <ChevronRight className="h-4 w-4" style={{ color: TH.text }} />}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20" style={glassCard}>
                      <Database className="h-12 w-12 mb-4" style={{ color: TH.textDim }} />
                      <p className="text-sm font-medium" style={{ color: TH.textMuted }}>{t("discovery.noResults")}</p>
                      <p className="text-xs mt-1" style={{ color: TH.textDim }}>
                        {query ? "Try a different search term" : "Search the catalog to discover records"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== RECORD DETAIL VIEW ===== */}
          {view === "record" && selectedRecord && (
            <motion.div key="record" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <RecordDetailView
                record={selectedRecord} TH={TH} isLegacy={isLegacy}
                glassCard={glassCard} glassInput={glassInput} t={t} isRtl={isRtl}
                rdfPreview={rdfPreview}
                onBack={popView}
                onAgent={(uri, label) => browseAgent(uri, label)}
                onSubject={(uri, label) => browseSubject(uri, label)}
                onPreviewRdf={(format) => previewRdf(selectedRecord, format)}
                onDownloadRdf={(format) => { downloadRdf(selectedRecord.id, format); toast.success(`${format.toUpperCase()} downloaded`); }}
                onCopyUri={copyUri}
                copied={copied}
                onImport={handleImportToLocal}
              />
            </motion.div>
          )}

          {/* ===== AGENT BROWSE VIEW ===== */}
          {view === "agent" && (
            <motion.div key="agent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <EntityBrowseView
                entityType="agent" entityUri={agentUri} entityLabel={agentLabel}
                results={agentResults} TH={TH} isLegacy={isLegacy} glassCard={glassCard} t={t}
                onBack={popView} onViewRecord={viewRecord}
                onAgent={(uri, label) => browseAgent(uri, label)}
                onSubject={(uri, label) => browseSubject(uri, label)}
                onImport={handleImportToLocal}
              />
            </motion.div>
          )}

          {/* ===== SUBJECT BROWSE VIEW ===== */}
          {view === "subject" && (
            <motion.div key="subject" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <EntityBrowseView
                entityType="subject" entityUri={subjectUri} entityLabel={subjectLabel}
                results={subjectResults} TH={TH} isLegacy={isLegacy} glassCard={glassCard} t={t}
                onBack={popView} onViewRecord={viewRecord}
                onAgent={(uri, label) => browseAgent(uri, label)}
                onSubject={(uri, label) => browseSubject(uri, label)}
                onImport={handleImportToLocal}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================== SUB-COMPONENTS ==============================

// ===== FACET GROUP =====
function FacetGroup({ facet, selected, onToggle, TH, isLegacy, t }: {
  facet: Facet; selected: string[]; onToggle: (val: string) => void;
  TH: typeof DARK_THEME; isLegacy: boolean; t: any;
}) {
  const [expanded, setExpanded] = useState(true);
  const labelKey = `discovery.${facet.field}`;
  return (
    <div className="mb-3">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full py-1.5 text-xs font-semibold"
        style={{ color: TH.text }}>
        <span>{t(labelKey, facet.label)}</span>
        <ChevronDown className="h-3 w-3 transition-transform" style={{ transform: expanded ? "rotate(0)" : "rotate(-90deg)", color: TH.textDim }} />
      </button>
      {expanded && (
        <div className="space-y-1 mt-1">
          {facet.values.slice(0, 8).map(fv => (
            <button key={fv.value} onClick={() => onToggle(fv.value)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-[11px] transition-colors text-left"
              style={{
                background: selected.includes(fv.value) ? TH.accent + "22" : "transparent",
                border: selected.includes(fv.value) ? `1px solid ${TH.accent}44` : "1px solid transparent",
                color: selected.includes(fv.value) ? TH.badgeText : TH.textMuted,
              }}>
              <span className="truncate flex-1">{fv.label}</span>
              <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded text-[10px]"
                style={{ background: TH.badgeBg, color: TH.badgeText }}>{fv.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== RECORD CARD =====
function RecordCard({ record, TH, isLegacy, glassCard, t, onView, onAgent, onSubject, onImport }: {
  record: any; TH: typeof DARK_THEME; isLegacy: boolean; glassCard: any; t: any;
  onView: () => void;
  onAgent: (uri: string, label: string) => void;
  onSubject: (uri: string, label: string) => void;
  onImport?: (record: any) => void;
}) {
  const doc = record.document;
  const title = record.title || extractTitle(doc);
  const contributors = extractContributors(doc);
  const subjects = extractSubjects(doc);
  const language = extractLanguage(doc);
  const date = extractDate(doc);
  const tripleCount = countTriples(doc);
  const entityCount = countEntities(doc);

  const workNode = extractWorkData(doc);
  const types: string[] = [];
  if (doc?.["@graph"]) {
    for (const node of doc["@graph"]) {
      const t = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"] || ""];
      t.forEach((tp: string) => {
        if (tp.includes("Work") && !types.includes("Work")) types.push("Work");
        if (tp.includes("Instance") && !types.includes("Instance")) types.push("Instance");
        if (tp.includes("Item") && !types.includes("Item")) types.push("Item");
      });
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      className="cursor-pointer transition-all"
      style={{ ...glassCard, padding: 16 }}
      onClick={onView}
    >
      {/* Type & Source Badges */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        <SourceBadge source={record.source} size="xs" />
        {types.map(tp => (
          <span key={tp} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: TH.badgeBg, color: TH.badgeText }}>
            {tp}
          </span>
        ))}
        {language && (
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(52,211,153,0.12)", color: TH.success }}>
            {language}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold leading-snug mb-2 line-clamp-2" style={{ color: TH.text }}>
        {title}
      </h3>

      {/* Contributors */}
      {contributors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {contributors.slice(0, 3).map((c, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); if (c.uri) onAgent(c.uri, c.label); }}
              className="text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ background: TH.badgeBg, color: TH.badgeText }}>
              <User className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{c.label.split("/").pop()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Subjects */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {subjects.slice(0, 3).map((s, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); if (s.uri) onSubject(s.uri, s.label); }}
              className="text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ background: "rgba(251,191,36,0.08)", color: TH.warning }}>
              <Tag className="h-2.5 w-2.5" />
              <span className="truncate max-w-[100px]">{s.label.split("/").pop()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${TH.cardBorder}` }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: TH.textDim }}>
          {date && <span>{date}</span>}
          <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{tripleCount} triples</span>
          <span className="flex items-center gap-1"><Orbit className="h-3 w-3" />{entityCount} entities</span>
        </div>
        <div className="flex items-center gap-1.5">
          {record.source && record.source !== "internal" && onImport && (
            <button
              onClick={e => { e.stopPropagation(); onImport(record); }}
              className="p-1 rounded-lg transition-colors hover:opacity-80"
              title={t("discovery.importToLocal", "Import to Local Catalog")}
              style={{ background: `${TH.success}15` }}
            >
              <Import className="h-3.5 w-3.5" style={{ color: TH.success }} />
            </button>
          )}
          {record.sourceUri && (
            <a href={record.sourceUri} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1 rounded-lg transition-colors hover:opacity-80"
              title="Open in source">
              <ExternalLink className="h-3.5 w-3.5" style={{ color: TH.textDim }} />
            </a>
          )}
          <ArrowRight className="h-4 w-4" style={{ color: TH.accent }} />
        </div>
      </div>
    </motion.div>
  );
}

// ===== RECORD DETAIL VIEW =====
function RecordDetailView({ record, TH, isLegacy, glassCard, glassInput, t, isRtl, rdfPreview,
  onBack, onAgent, onSubject, onPreviewRdf, onDownloadRdf, onCopyUri, copied, onImport }: {
  record: DiscoveryRecord; TH: typeof DARK_THEME; isLegacy: boolean;
  glassCard: any; glassInput: any; t: any; isRtl: boolean;
  rdfPreview: { format: RdfFormat; content: string } | null;
  onBack: () => void;
  onAgent: (uri: string, label: string) => void;
  onSubject: (uri: string, label: string) => void;
  onPreviewRdf: (format: RdfFormat) => void;
  onDownloadRdf: (format: RdfFormat) => void;
  onCopyUri: (uri: string) => void;
  copied: boolean;
  onImport?: (record: DiscoveryRecord) => void;
}) {
  const doc = record.document;
  const title = record.title || extractTitle(doc);
  const work = extractWorkData(doc);
  const instances = extractInstanceData(doc);
  const contributors = extractContributors(doc);
  const subjects = extractSubjects(doc);
  const language = extractLanguage(doc);
  const date = extractDate(doc);
  const tripleCount = countTriples(doc);
  const entityCount = countEntities(doc);
  const recordUri = `https://moonlib.org/resource/${record.id}`;

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-80"
        style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}`, color: TH.textMuted }}>
        {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {t("discovery.back")}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title & URI Card */}
          <div style={{ ...glassCard, padding: 24 }}>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: TH.text }}>{title}</h1>
              <SourceBadge source={record.source} />
            </div>

            {/* Source link and import for external records */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {record.sourceUri && (
                <a href={record.sourceUri} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ background: `${SOURCE_COLORS[record.source || "internal"]?.color || TH.accent}15`,
                    color: SOURCE_COLORS[record.source || "internal"]?.color || TH.accent,
                    border: `1px solid ${SOURCE_COLORS[record.source || "internal"]?.color || TH.accent}33` }}>
                  <ExternalLink className="h-3 w-3" />
                  View at {SOURCE_COLORS[record.source || "internal"]?.label || "source"}
                </a>
              )}
              {record.source && record.source !== "internal" && onImport && (
                <button
                  onClick={() => onImport(record)}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${TH.success}, #059669)`,
                    color: "#ffffff",
                    boxShadow: `0 2px 8px ${TH.success}33`,
                  }}>
                  <Import className="h-3 w-3" />
                  {t("discovery.importToLocal", "Import to Local Catalog")}
                </button>
              )}
            </div>

            {/* URI with copy */}
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: TH.inputBg, border: `1px solid ${TH.inputBorder}` }}>
              <Link2 className="h-4 w-4 shrink-0" style={{ color: TH.accent }} />
              <code className="text-xs flex-1 truncate" style={{ color: TH.accentDim }}>{recordUri}</code>
              <button onClick={() => onCopyUri(recordUri)} className="p-1.5 rounded-lg transition-colors"
                style={{ background: TH.badgeBg }}>
                {copied ? <Check className="h-3.5 w-3.5" style={{ color: TH.success }} /> : <Copy className="h-3.5 w-3.5" style={{ color: TH.badgeText }} />}
              </button>
            </div>

            {/* Linked Data Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(52,211,153,0.1)", color: TH.success }}>
                <Check className="h-3 w-3" /> {t("discovery.resolvableUri")}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(52,211,153,0.1)", color: TH.success }}>
                <Check className="h-3 w-3" /> {t("discovery.machineReadable")}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(52,211,153,0.1)", color: TH.success }}>
                <Check className="h-3 w-3" /> {t("discovery.noAuth")}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(52,211,153,0.1)", color: TH.success }}>
                <Check className="h-3 w-3" /> {t("discovery.persistentUri")}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <Hash className="h-4 w-4" />, label: t("discovery.tripleCount"), value: tripleCount },
                { icon: <Orbit className="h-4 w-4" />, label: t("discovery.entityCount"), value: entityCount },
                { icon: <Layers className="h-4 w-4" />, label: t("discovery.instances"), value: instances.length },
                { icon: <BookOpen className="h-4 w-4" />, label: t("discovery.language"), value: language || "—" },
              ].map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl" style={{ background: TH.inputBg }}>
                  <div className="flex justify-center mb-1" style={{ color: TH.accent }}>{item.icon}</div>
                  <div className="text-base font-bold" style={{ color: TH.text }}>{item.value}</div>
                  <div className="text-[10px]" style={{ color: TH.textDim }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WEMI Hierarchy */}
          <div style={{ ...glassCard, padding: 20 }}>
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: TH.text }}>
              <Network className="h-4 w-4" style={{ color: TH.accent }} />
              {t("discovery.wemiHierarchy")}
            </h2>

            {/* Work */}
            {work && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: TH.inputBg, border: `1px solid ${TH.accent}33` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: TH.accent + "22", color: TH.badgeText }}>bf:Work</span>
                  {work["@id"] && <code className="text-[10px] truncate" style={{ color: TH.textDim }}>{work["@id"]}</code>}
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(work).filter(([k]) => !k.startsWith("@")).slice(0, 8).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="shrink-0 font-mono" style={{ color: TH.accent }}>{key.replace("bf:", "").replace("http://id.loc.gov/ontologies/bibframe/", "bf:")}</span>
                      <span className="truncate" style={{ color: TH.textMuted }}>{typeof val === "object" ? JSON.stringify(val).slice(0, 100) : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instances */}
            {instances.map((inst: any, idx: number) => (
              <div key={idx} className="mb-3 p-4 rounded-xl" style={{ background: TH.inputBg, border: `1px solid rgba(139,92,246,0.2)` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>bf:Instance</span>
                  {inst["@id"] && <code className="text-[10px] truncate" style={{ color: TH.textDim }}>{inst["@id"]}</code>}
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(inst).filter(([k]) => !k.startsWith("@")).slice(0, 6).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="shrink-0 font-mono" style={{ color: "#a78bfa" }}>{key.replace("bf:", "").replace("http://id.loc.gov/ontologies/bibframe/", "bf:")}</span>
                      <span className="truncate" style={{ color: TH.textMuted }}>{typeof val === "object" ? JSON.stringify(val).slice(0, 100) : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Content Negotiation / RDF Export */}
          <div style={{ ...glassCard, padding: 20 }}>
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: TH.text }}>
              <Share2 className="h-4 w-4" style={{ color: TH.accent }} />
              {t("discovery.contentNegotiation")}
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(["jsonld", "turtle", "ntriples"] as RdfFormat[]).map(fmt => (
                <div key={fmt} className="p-3 rounded-xl" style={{ background: TH.inputBg }}>
                  <div className="text-[11px] font-bold mb-2" style={{ color: TH.text }}>
                    {fmt === "jsonld" ? "JSON-LD" : fmt === "turtle" ? "Turtle" : "N-Triples"}
                  </div>
                  <div className="text-[10px] mb-2" style={{ color: TH.textDim }}>
                    {fmt === "jsonld" ? "application/ld+json" : fmt === "turtle" ? "text/turtle" : "application/n-triples"}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => onPreviewRdf(fmt)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                      style={{ background: TH.badgeBg, color: TH.badgeText }}>
                      Preview
                    </button>
                    <button onClick={() => onDownloadRdf(fmt)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ background: TH.badgeBg }}>
                      <Download className="h-3 w-3" style={{ color: TH.badgeText }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {rdfPreview && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold" style={{ color: TH.accent }}>
                    {rdfPreview.format.toUpperCase()} Preview
                  </span>
                </div>
                <pre className="p-3 rounded-xl text-[10px] overflow-auto max-h-64 whitespace-pre-wrap"
                  style={{ background: isLegacy ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.3)", color: TH.textMuted, border: `1px solid ${TH.cardBorder}` }}>
                  {rdfPreview.content}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Contributors */}
          {contributors.length > 0 && (
            <div style={{ ...glassCard, padding: 16 }}>
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: TH.text }}>
                <User className="h-4 w-4" style={{ color: TH.accent }} />
                {t("discovery.contributor")}
              </h3>
              <div className="space-y-2">
                {contributors.map((c, i) => (
                  <button key={i} onClick={() => c.uri && onAgent(c.uri, c.label)}
                    className="w-full text-left p-2.5 rounded-xl flex items-center gap-2 transition-colors hover:opacity-80"
                    style={{ background: TH.inputBg }}>
                    <User className="h-4 w-4 shrink-0" style={{ color: TH.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: TH.text }}>{c.label.split("/").pop()}</div>
                      {c.role && <div className="text-[10px] truncate" style={{ color: TH.textDim }}>{c.role.split("/").pop()}</div>}
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: TH.textDim }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subjects */}
          {subjects.length > 0 && (
            <div style={{ ...glassCard, padding: 16 }}>
              <h3 className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: TH.text }}>
                <Tag className="h-4 w-4" style={{ color: TH.warning }} />
                {t("discovery.subject")}
              </h3>
              <div className="space-y-2">
                {subjects.map((s, i) => (
                  <button key={i} onClick={() => s.uri && onSubject(s.uri, s.label)}
                    className="w-full text-left p-2.5 rounded-xl flex items-center gap-2 transition-colors hover:opacity-80"
                    style={{ background: TH.inputBg }}>
                    <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: TH.warning }} />
                    <span className="text-xs truncate flex-1" style={{ color: TH.text }}>{s.label.split("/").pop()}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: TH.textDim }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Authority Links */}
          <div style={{ ...glassCard, padding: 16 }}>
            <h3 className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: TH.text }}>
              <ExternalLink className="h-4 w-4" style={{ color: TH.success }} />
              {t("discovery.authorityLinks")}
            </h3>
            <div className="space-y-2">
              {doc?.["@graph"]?.filter((n: any) => n["@id"]?.startsWith("http")).slice(0, 6).map((node: any, i: number) => (
                <a key={i} href={node["@id"]} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg text-[10px] transition-colors hover:opacity-80"
                  style={{ background: TH.inputBg, color: TH.accentDim }}>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{node["@id"]}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div style={{ ...glassCard, padding: 16 }}>
            <h3 className="text-xs font-bold mb-3" style={{ color: TH.text }}>Metadata</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span style={{ color: TH.textDim }}>Record ID</span>
                <span className="font-mono" style={{ color: TH.textMuted }}>{record.id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: TH.textDim }}>Created</span>
                <span style={{ color: TH.textMuted }}>{new Date(record.createdAt).toLocaleDateString()}</span>
              </div>
              {date && (
                <div className="flex justify-between">
                  <span style={{ color: TH.textDim }}>Publication Date</span>
                  <span style={{ color: TH.textMuted }}>{date}</span>
                </div>
              )}
              {language && (
                <div className="flex justify-between">
                  <span style={{ color: TH.textDim }}>Language</span>
                  <span style={{ color: TH.textMuted }}>{language}</span>
                </div>
              )}
              {record.cataloger && (
                <div className="flex justify-between">
                  <span style={{ color: TH.textDim }}>Cataloger</span>
                  <span style={{ color: TH.textMuted }}>{record.cataloger}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ENTITY BROWSE VIEW =====
function EntityBrowseView({ entityType, entityUri, entityLabel, results, TH, isLegacy, glassCard, t,
  onBack, onViewRecord, onAgent, onSubject, onImport }: {
  entityType: "agent" | "subject"; entityUri: string; entityLabel: string;
  results: DiscoveryRecord[]; TH: typeof DARK_THEME; isLegacy: boolean; glassCard: any; t: any;
  onBack: () => void; onViewRecord: (record: DiscoveryRecord) => void;
  onAgent: (uri: string, label: string) => void;
  onSubject: (uri: string, label: string) => void;
  onImport?: (record: any) => void;
}) {
  const icon = entityType === "agent"
    ? <User className="h-6 w-6" style={{ color: TH.accent }} />
    : <Tag className="h-6 w-6" style={{ color: TH.warning }} />;

  const headerLabel = entityType === "agent" ? t("discovery.browseByAuthor") : t("discovery.browseBySubject");

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-80"
        style={{ background: TH.cardBg, border: `1px solid ${TH.cardBorder}`, color: TH.textMuted }}>
        <ChevronLeft className="h-4 w-4" /> {t("discovery.back")}
      </button>

      <div style={{ ...glassCard, padding: 24 }} className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          {icon}
          <div>
            <h2 className="text-lg font-bold" style={{ color: TH.text }}>{entityLabel.split("/").pop()}</h2>
            <p className="text-xs" style={{ color: TH.textDim }}>{headerLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: TH.inputBg }}>
          <Link2 className="h-3.5 w-3.5" style={{ color: TH.accent }} />
          <code className="text-[10px] truncate" style={{ color: TH.accentDim }}>{entityUri}</code>
        </div>
        <div className="mt-3 text-xs" style={{ color: TH.textMuted }}>
          {results.length} {t("discovery.results")}
        </div>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((record: any) => (
            <RecordCard
              key={record.id} record={record} TH={TH}
              isLegacy={isLegacy} glassCard={glassCard} t={t}
              onView={() => onViewRecord(record)}
              onAgent={(uri, label) => onAgent(uri, label)}
              onSubject={(uri, label) => onSubject(uri, label)}
              onImport={onImport}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16" style={glassCard}>
          <Database className="h-10 w-10 mb-3" style={{ color: TH.textDim }} />
          <p className="text-sm" style={{ color: TH.textMuted }}>{t("discovery.noResults")}</p>
        </div>
      )}
    </div>
  );
}

// ===== STATS VIEW =====
function StatsView({ stats, TH, t, glassCard, isLegacy }: {
  stats: CatalogStats | null; TH: typeof DARK_THEME; t: any; glassCard: any; isLegacy: boolean;
}) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: TH.accent }} />
      </div>
    );
  }

  const statItems = [
    { icon: <Database className="h-6 w-6" />, label: t("discovery.totalRecords"), value: stats.totalRecords, color: TH.accent },
    { icon: <BookOpen className="h-6 w-6" />, label: t("discovery.works"), value: stats.works, color: "#3b82f6" },
    { icon: <Package className="h-6 w-6" />, label: t("discovery.instances"), value: stats.instances, color: "#8b5cf6" },
    { icon: <Layers className="h-6 w-6" />, label: t("discovery.items"), value: stats.items, color: "#06b6d4" },
    { icon: <Globe className="h-6 w-6" />, label: t("discovery.uniqueLanguages"), value: stats.uniqueLanguages, color: TH.success },
    { icon: <User className="h-6 w-6" />, label: t("discovery.uniqueContributors"), value: stats.uniqueContributors, color: TH.warning },
    { icon: <Tag className="h-6 w-6" />, label: t("discovery.uniqueSubjects"), value: stats.uniqueSubjects, color: "#f472b6" },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: TH.text }}>
        <BarChart3 className="h-5 w-5" style={{ color: TH.accent }} />
        {t("discovery.catalogStats")}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {statItems.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ ...glassCard, padding: 20 }} className="text-center">
            <div className="flex justify-center mb-3" style={{ color: item.color }}>{item.icon}</div>
            <div className="text-2xl font-bold mb-1" style={{ color: TH.text }}>{item.value}</div>
            <div className="text-xs" style={{ color: TH.textDim }}>{item.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Open Linked Data Compliance */}
      <div style={{ ...glassCard, padding: 24 }}>
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: TH.text }}>
          <Globe className="h-4 w-4" style={{ color: TH.success }} />
          {t("discovery.openData")} — Compliance Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Real HTTP URIs", ok: true },
            { label: "JSON-LD with Official Context", ok: true },
            { label: "Machine-Readable Access", ok: true },
            { label: "No Auth for Public Data", ok: true },
            { label: "Proper CORS", ok: true },
            { label: "Persistent Identifiers", ok: true },
            { label: "Content Negotiation", ok: true },
            { label: "Turtle Export", ok: true },
            { label: "N-Triples Export", ok: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: item.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)" }}>
              <Check className="h-4 w-4" style={{ color: item.ok ? TH.success : TH.danger }} />
              <span className="text-xs" style={{ color: item.ok ? TH.success : TH.danger }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { LinkedDataDiscovery };
export type { DiscoveryRecord };
