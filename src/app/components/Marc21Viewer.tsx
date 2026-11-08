/**
 * MARC 21 Viewer — Rich Interactive MARC Record Viewer
 * 
 * A glassmorphism-styled MARC 21 viewer with multiple display modes:
 * - Tagged Display: classic tag/ind/subfield table with color coding
 * - Breaker Format: raw text breaker notation (=TAG  IND$aValue...)
 * - Card View: grouped by MARC field categories (Control, Identifier, etc.)
 * 
 * Integrates with BlueMoon's generateMARC service and the existing MarcView component.
 */

import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Database, Copy, Download, Search, ChevronDown, ChevronRight,
  BookOpen, Hash, User, Tag, Globe, FileText, Layers, 
  Maximize2, Minimize2, BarChart3, Zap, List, LayoutGrid, AlignLeft
} from "lucide-react";
import { generateMARC } from "../services/marcGenerator";
import { bibframeToMarc } from "../../services/marc/bibframeToMarc";
import { toIso2709, toMarcXml, toMrk } from "../../services/marc/marcRecord";
import { usePreferredNames } from "../utils/preferredNames";

// ===== MARC Field Category Definitions =====

interface MARCField {
  tag: string;
  ind1: string;
  ind2: string;
  subfields: { code: string; value: string }[];
  raw: string;
}

interface MARCCategory {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
  color: string;
  range: [number, number];
}

const MARC_CATEGORIES: MARCCategory[] = [
  { id: "leader", label: "Leader & Control", labelAr: "\u0627\u0644\u0642\u0627\u0626\u062f \u0648\u0627\u0644\u062a\u062d\u0643\u0645", icon: <Zap className="h-4 w-4" />, color: "#f59e0b", range: [0, 9] },
  { id: "identifiers", label: "Identifiers", labelAr: "\u0627\u0644\u0645\u0639\u0631\u0641\u0627\u062a", icon: <Hash className="h-4 w-4" />, color: "#3b82f6", range: [10, 49] },
  { id: "classification", label: "Classification", labelAr: "\u0627\u0644\u062a\u0635\u0646\u064a\u0641", icon: <Layers className="h-4 w-4" />, color: "#8b5cf6", range: [50, 99] },
  { id: "main-entry", label: "Main Entry", labelAr: "\u0627\u0644\u0645\u062f\u062e\u0644 \u0627\u0644\u0631\u0626\u064a\u0633\u064a", icon: <User className="h-4 w-4" />, color: "#ec4899", range: [100, 199] },
  { id: "title", label: "Title & Edition", labelAr: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u0644\u0637\u0628\u0639\u0629", icon: <BookOpen className="h-4 w-4" />, color: "#10b981", range: [200, 299] },
  { id: "physical", label: "Physical Description", labelAr: "\u0627\u0644\u0648\u0635\u0641 \u0627\u0644\u0645\u0627\u062f\u064a", icon: <BarChart3 className="h-4 w-4" />, color: "#f97316", range: [300, 399] },
  { id: "series", label: "Series", labelAr: "\u0627\u0644\u0633\u0644\u0633\u0644\u0629", icon: <List className="h-4 w-4" />, color: "#06b6d4", range: [400, 499] },
  { id: "notes", label: "Notes", labelAr: "\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a", icon: <FileText className="h-4 w-4" />, color: "#84cc16", range: [500, 599] },
  { id: "subjects", label: "Subject Access", labelAr: "\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u0648\u0636\u0648\u0639\u064a", icon: <Tag className="h-4 w-4" />, color: "#a855f7", range: [600, 699] },
  { id: "added-entries", label: "Added Entries", labelAr: "\u0627\u0644\u0645\u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u064a\u0629", icon: <User className="h-4 w-4" />, color: "#14b8a6", range: [700, 799] },
  { id: "electronic", label: "Electronic Access", labelAr: "\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a", icon: <Globe className="h-4 w-4" />, color: "#6366f1", range: [800, 999] },
];

// ===== MARC Tag Labels (common) =====

const TAG_LABELS: Record<string, string> = {
  LDR: "Leader",
  "001": "Control Number",
  "003": "Control Number ID",
  "005": "Date/Time Modified",
  "008": "Fixed-Length Data",
  "020": "ISBN",
  "022": "ISSN",
  "024": "Other Std Identifier",
  "028": "Publisher Number",
  "035": "System Control No.",
  "040": "Cataloging Source",
  "041": "Language Code",
  "050": "LC Classification",
  "082": "Dewey Classification",
  "100": "Main Entry - Personal",
  "110": "Main Entry - Corporate",
  "111": "Main Entry - Meeting",
  "130": "Main Entry - Uniform Title",
  "245": "Title Statement",
  "246": "Varying Form of Title",
  "250": "Edition Statement",
  "264": "Production/Publication",
  "300": "Physical Description",
  "336": "Content Type",
  "337": "Media Type",
  "338": "Carrier Type",
  "490": "Series Statement",
  "500": "General Note",
  "504": "Bibliography Note",
  "505": "Contents Note",
  "520": "Summary",
  "546": "Language Note",
  "600": "Subject - Personal",
  "610": "Subject - Corporate",
  "650": "Subject - Topical",
  "651": "Subject - Geographic",
  "655": "Genre/Form",
  "700": "Added Entry - Personal",
  "710": "Added Entry - Corporate",
  "856": "Electronic Location",
};

type ViewMode = "tagged" | "breaker" | "cards";

// ===== THEME TYPES =====
interface ViewerTheme {
  cardBg: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentDim: string;
  accentGlow: string;
  accentBorder: string;
  success: string;
  warning: string;
  danger: string;
  inputBg: string;
  inputBorder: string;
}

interface Marc21ViewerProps {
  workData: any;
  instanceData: any;
  theme: ViewerTheme;
  isLegacy: boolean;
  /** The record's validated BIBFRAME graph (the editor's W3C build); the MARC record is made from it. */
  w3cJsonLd?: { "@graph": any[] } | null;
  recordId?: string;
}

export function Marc21Viewer({ workData, instanceData, theme: BM, isLegacy, w3cJsonLd, recordId }: Marc21ViewerProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [viewMode, setViewMode] = useState<ViewMode>("tagged");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(MARC_CATEGORIES.map(c => c.id)));
  const [showFieldLabels, setShowFieldLabels] = useState(true);
  const [highlightSubfields, setHighlightSubfields] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ===== The MARC record: from the validated BIBFRAME graph when the editor has built it =====
  // Linked people named by the forms a cataloguer preferred for the book's script (S10).
  const named = usePreferredNames(w3cJsonLd);
  const marcRecord = useMemo(() => (named?.["@graph"] ? bibframeToMarc(named as any, { recordId }) : null), [named, recordId]);
  const marcText = useMemo(
    () => (marcRecord ? toMrk(marcRecord) : generateMARC(workData || {}, instanceData || {})),
    [marcRecord, workData, instanceData],
  );
  const fileBase = recordId || "record";

  const parsedFields = useMemo((): MARCField[] => {
    const lines = marcText.split("\n").filter(Boolean);
    return lines.map(line => {
      const raw = line;
      // Format: =TAG  IND1IND2$aValue$bValue...
      const tagMatch = line.match(/^=(\w{3})\s{2}(.*)/);
      if (!tagMatch) return { tag: "???", ind1: " ", ind2: " ", subfields: [{ code: "a", value: line }], raw };

      const tag = tagMatch[1];
      const rest = tagMatch[2];

      // Control fields (00X) don't have indicators
      if (tag === "LDR" || parseInt(tag) < 10) {
        return { tag, ind1: " ", ind2: " ", subfields: [{ code: "", value: rest }], raw };
      }

      const ind1 = rest[0] || " ";
      const ind2 = rest[1] || " ";
      const subfieldStr = rest.slice(2);

      // Parse subfields: $aValue$bValue
      const subfields: { code: string; value: string }[] = [];
      const sfParts = subfieldStr.split("$").filter(Boolean);
      sfParts.forEach(part => {
        const code = part[0] || "";
        const value = part.slice(1) || "";
        subfields.push({ code, value });
      });

      if (subfields.length === 0) {
        subfields.push({ code: "", value: subfieldStr });
      }

      return { tag, ind1, ind2, subfields, raw };
    });
  }, [marcText]);

  // ===== Filter by search =====
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return parsedFields;
    const q = searchQuery.toLowerCase();
    return parsedFields.filter(f =>
      f.tag.toLowerCase().includes(q) ||
      f.subfields.some(sf => sf.value.toLowerCase().includes(q)) ||
      (TAG_LABELS[f.tag] || "").toLowerCase().includes(q)
    );
  }, [parsedFields, searchQuery]);

  // ===== Group fields by category =====
  const groupedFields = useMemo(() => {
    const groups: Record<string, MARCField[]> = {};
    MARC_CATEGORIES.forEach(cat => { groups[cat.id] = []; });

    filteredFields.forEach(field => {
      const tagNum = field.tag === "LDR" ? 0 : parseInt(field.tag) || 0;
      const category = MARC_CATEGORIES.find(c => tagNum >= c.range[0] && tagNum <= c.range[1]);
      if (category) {
        groups[category.id].push(field);
      }
    });

    return groups;
  }, [filteredFields]);

  // ===== Stats =====
  const stats = useMemo(() => ({
    totalFields: parsedFields.length,
    totalSubfields: parsedFields.reduce((sum, f) => sum + f.subfields.length, 0),
    categories: MARC_CATEGORIES.filter(c => groupedFields[c.id]?.length > 0).length,
  }), [parsedFields, groupedFields]);

  // ===== Actions =====
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRtl ? "\u062a\u0645 \u0627\u0644\u0646\u0633\u062e!" : "Copied to clipboard!");
  }, [isRtl]);

  const downloadFile = useCallback((content: string | Uint8Array, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(isRtl ? "\u062a\u0645 \u0627\u0644\u062a\u0646\u0632\u064a\u0644!" : "Downloaded!");
  }, [isRtl]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedCategories(new Set(MARC_CATEGORIES.map(c => c.id)));
  const collapseAll = () => setExpandedCategories(new Set());

  // ===== Subfield color =====
  const subfieldColor = (code: string): string => {
    const colors: Record<string, string> = {
      a: "#3b82f6", b: "#10b981", c: "#f59e0b", d: "#ec4899",
      e: "#8b5cf6", f: "#14b8a6", g: "#f97316", h: "#06b6d4",
      i: "#84cc16", j: "#a855f7", k: "#ef4444", l: "#6366f1",
      "0": "#64748b", "2": "#94a3b8",
    };
    return colors[code] || BM.accentDim;
  };

  // ===== Tag color =====
  const tagColor = (tag: string): string => {
    const tagNum = tag === "LDR" ? 0 : parseInt(tag) || 0;
    const cat = MARC_CATEGORIES.find(c => tagNum >= c.range[0] && tagNum <= c.range[1]);
    return cat?.color || BM.accent;
  };

  // ===== RENDER =====

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden"
    : "flex flex-col h-full";

  return (
    <div className={containerClass} style={isFullscreen ? { background: isLegacy ? "#f0f0f5" : "#0f172a" } : undefined}>
      {/* ===== HEADER ===== */}
      <div className="rounded-2xl p-5 mb-4" style={{
        background: BM.cardBg,
        border: `1px solid ${BM.cardBorder}`,
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
      }}>
        {/* Title Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center transition-all"
              style={{
                borderRadius: "120px",
                background: "rgba(255, 255, 255, 0.21)",
                backdropFilter: "blur(4.5px) blur(9px) saturate(1.5) brightness(1.1)",
                WebkitBackdropFilter: "blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.35)",
              }}>
              <Database className="h-5 w-5 text-white drop-shadow-sm" />
            </div>
            <div>
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BM.text }}>
                MARC 21 Viewer
              </h3>
              <p className="text-xs" style={{ color: BM.textDim }}>
                {isRtl ? "\u0639\u0627\u0631\u0636 \u0633\u062c\u0644\u0627\u062a \u0645\u0627\u0631\u0643 21 \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a" : "Interactive MARC 21 Record Display"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats Badges */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: BM.accentGlow, border: `1px solid ${BM.accentBorder}`, color: BM.accent }}>
              {stats.totalFields} {isRtl ? "\u062d\u0642\u0644" : "fields"}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: BM.success }}>
              {stats.totalSubfields} {isRtl ? "\u062d\u0642\u0644 \u0641\u0631\u0639\u064a" : "subfields"}
            </div>

            {/* Copy / Download */}
            <button onClick={() => copyToClipboard(marcText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:shadow-md"
              style={{ background: "rgba(59,130,246,0.12)", border: `1px solid ${BM.accentBorder}`, color: BM.accentDim }}>
              <Copy className="h-3.5 w-3.5" /> {isRtl ? "\u0646\u0633\u062e" : "Copy"}
            </button>
            {marcRecord && <>
              {/* .mrc is real ISO 2709 (what Koha and MarcEdit import); .xml is MARCXML; .mrk is MarcEdit text. */}
              <button onClick={() => downloadFile(toIso2709(marcRecord), `${fileBase}.mrc`, "application/marc")}
                title={isRtl ? "ملف مارك ثنائي (ISO 2709) لكوها ومارك إدت" : "Binary MARC (ISO 2709) for Koha, MarcEdit and other systems"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:shadow-md"
                style={{ background: "rgba(59,130,246,0.12)", border: `1px solid ${BM.accentBorder}`, color: BM.accentDim }}>
                <Download className="h-3.5 w-3.5" /> .mrc
              </button>
              <button onClick={() => downloadFile(toMarcXml([marcRecord]), `${fileBase}.xml`, "application/marcxml+xml")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:shadow-md"
                style={{ background: "rgba(59,130,246,0.12)", border: `1px solid ${BM.accentBorder}`, color: BM.accentDim }}>
                <Download className="h-3.5 w-3.5" /> MARCXML
              </button>
            </>}
            <button onClick={() => downloadFile(marcText, `${fileBase}.mrk`, "text/plain;charset=utf-8")}
              title={isRtl ? "نص مارك إدت" : "MarcEdit text"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:shadow-md"
              style={{ background: "rgba(59,130,246,0.12)", border: `1px solid ${BM.accentBorder}`, color: BM.accentDim }}>
              <Download className="h-3.5 w-3.5" /> .mrk
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:shadow-md"
              style={{ background: "rgba(59,130,246,0.12)", border: `1px solid ${BM.accentBorder}`, color: BM.accentDim }}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${BM.cardBorder}` }}>
            {([
              { key: "tagged" as ViewMode, icon: <List className="h-3.5 w-3.5" />, label: isRtl ? "\u0645\u0648\u0633\u0648\u0645" : "Tagged" },
              { key: "breaker" as ViewMode, icon: <AlignLeft className="h-3.5 w-3.5" />, label: isRtl ? "\u0641\u0627\u0635\u0644" : "Breaker" },
              { key: "cards" as ViewMode, icon: <LayoutGrid className="h-3.5 w-3.5" />, label: isRtl ? "\u0628\u0637\u0627\u0642\u0627\u062a" : "Cards" },
            ]).map(mode => (
              <button key={mode.key} onClick={() => setViewMode(mode.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{
                  background: viewMode === mode.key ? BM.accent : "transparent",
                  color: viewMode === mode.key ? "#fff" : BM.textDim,
                }}>
                {mode.icon} {mode.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: BM.textDim }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "\u0628\u062d\u062b \u0641\u064a \u062d\u0642\u0648\u0644 \u0645\u0627\u0631\u0643..." : "Search MARC fields..."}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs font-medium outline-none"
              style={{
                background: BM.inputBg,
                border: `1px solid ${BM.inputBorder}`,
                color: BM.text,
                backdropFilter: "blur(10px)",
              }}
            />
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer" style={{ color: BM.textMuted }}>
            <input type="checkbox" checked={showFieldLabels} onChange={e => setShowFieldLabels(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500" />
            {isRtl ? "\u0627\u0644\u062a\u0633\u0645\u064a\u0627\u062a" : "Labels"}
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer" style={{ color: BM.textMuted }}>
            <input type="checkbox" checked={highlightSubfields} onChange={e => setHighlightSubfields(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500" />
            {isRtl ? "\u062a\u0644\u0648\u064a\u0646" : "Color"}
          </label>

          {viewMode === "cards" && (
            <div className="flex gap-1">
              <button onClick={expandAll}
                className="px-2 py-1 rounded text-[10px] font-bold"
                style={{ background: BM.accentGlow, color: BM.accent }}>
                {isRtl ? "\u062a\u0648\u0633\u064a\u0639" : "Expand"}
              </button>
              <button onClick={collapseAll}
                className="px-2 py-1 rounded text-[10px] font-bold"
                style={{ background: BM.accentGlow, color: BM.accent }}>
                {isRtl ? "\u0637\u064a" : "Collapse"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="flex-1 overflow-auto rounded-2xl" style={{
        background: BM.cardBg,
        border: `1px solid ${BM.cardBorder}`,
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
      }}>
        {filteredFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Database className="h-12 w-12" style={{ color: BM.textDim }} />
            <p className="text-sm font-medium" style={{ color: BM.textMuted }}>
              {isRtl ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u0642\u0648\u0644 \u0645\u0627\u0631\u0643. \u0627\u0645\u0644\u0623 \u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0644\u062a\u0648\u0644\u064a\u062f \u0633\u062c\u0644 MARC 21." : "No MARC fields. Fill in the form to generate a MARC 21 record."}
            </p>
          </div>
        ) : viewMode === "tagged" ? (
          <TaggedView
            fields={filteredFields}
            BM={BM}
            showFieldLabels={showFieldLabels}
            highlightSubfields={highlightSubfields}
            tagColor={tagColor}
            subfieldColor={subfieldColor}
            isRtl={isRtl}
          />
        ) : viewMode === "breaker" ? (
          <BreakerView
            marcText={marcText}
            searchQuery={searchQuery}
            BM={BM}
            isRtl={isRtl}
          />
        ) : (
          <CardsView
            categories={MARC_CATEGORIES}
            groupedFields={groupedFields}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            BM={BM}
            isLegacy={isLegacy}
            showFieldLabels={showFieldLabels}
            highlightSubfields={highlightSubfields}
            tagColor={tagColor}
            subfieldColor={subfieldColor}
            isRtl={isRtl}
          />
        )}
      </div>
    </div>
  );
}

// ===== TAGGED VIEW =====

function TaggedView({
  fields, BM, showFieldLabels, highlightSubfields, tagColor, subfieldColor, isRtl
}: {
  fields: MARCField[];
  BM: ViewerTheme;
  showFieldLabels: boolean;
  highlightSubfields: boolean;
  tagColor: (tag: string) => string;
  subfieldColor: (code: string) => string;
  isRtl: boolean;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: `2px solid ${BM.cardBorder}` }}>
            <th className="text-left p-3 font-black" style={{ color: BM.textDim, width: "70px" }}>
              {isRtl ? "\u0627\u0644\u0648\u0633\u0645" : "TAG"}
            </th>
            {showFieldLabels && (
              <th className="text-left p-3 font-black" style={{ color: BM.textDim, width: "160px" }}>
                {isRtl ? "\u0627\u0644\u062a\u0633\u0645\u064a\u0629" : "FIELD NAME"}
              </th>
            )}
            <th className="text-left p-3 font-black" style={{ color: BM.textDim, width: "50px" }}>
              {isRtl ? "\u0627\u0644\u0645\u0624\u0634\u0631" : "IND"}
            </th>
            <th className="text-left p-3 font-black" style={{ color: BM.textDim }}>
              {isRtl ? "\u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0641\u0631\u0639\u064a\u0629" : "SUBFIELDS"}
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => (
            <tr key={idx}
              className="transition-colors"
              style={{ borderBottom: `1px solid ${BM.cardBorder}` }}
              onMouseOver={e => (e.currentTarget.style.background = BM.accentGlow)}
              onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
              {/* Tag */}
              <td className="p-3">
                <span className="font-mono font-black text-sm px-2 py-0.5 rounded-md"
                  style={{ color: tagColor(field.tag), background: `${tagColor(field.tag)}15` }}>
                  {field.tag}
                </span>
              </td>
              {/* Field Label */}
              {showFieldLabels && (
                <td className="p-3">
                  <span className="text-[10px] font-semibold" style={{ color: BM.textMuted }}>
                    {TAG_LABELS[field.tag] || ""}
                  </span>
                </td>
              )}
              {/* Indicators */}
              <td className="p-3 font-mono">
                {field.tag !== "LDR" && parseInt(field.tag) >= 10 ? (
                  <span className="flex gap-0.5">
                    <span className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold"
                      style={{ background: BM.inputBg, border: `1px solid ${BM.inputBorder}`, color: BM.text }}>
                      {field.ind1 === " " ? "#" : field.ind1}
                    </span>
                    <span className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold"
                      style={{ background: BM.inputBg, border: `1px solid ${BM.inputBorder}`, color: BM.text }}>
                      {field.ind2 === " " ? "#" : field.ind2}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px]" style={{ color: BM.textDim }}>&mdash;</span>
                )}
              </td>
              {/* Subfields */}
              <td className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {field.subfields.map((sf, sfIdx) => (
                    <span key={sfIdx} className="inline-flex items-baseline gap-0.5">
                      {sf.code && (
                        <span className="font-mono text-[10px] font-black px-1 py-0.5 rounded"
                          style={{
                            color: highlightSubfields ? subfieldColor(sf.code) : BM.textMuted,
                            background: highlightSubfields ? `${subfieldColor(sf.code)}12` : "transparent",
                          }}>
                          ${sf.code}
                        </span>
                      )}
                      <span className="font-mono text-xs" style={{ color: BM.text }}>{sf.value}</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== BREAKER VIEW =====

function BreakerView({
  marcText, searchQuery, BM, isRtl
}: {
  marcText: string;
  searchQuery: string;
  BM: ViewerTheme;
  isRtl: boolean;
}) {
  const lines = marcText.split("\n").filter(Boolean);

  const highlightLine = (line: string): React.ReactNode => {
    // Color-code the breaker format
    const match = line.match(/^(=\w{3})\s{2}(.*)/);
    if (!match) return <span style={{ color: BM.text }}>{line}</span>;

    const tag = match[1];
    const rest = match[2];

    // Split rest by $ delimiters for subfield coloring
    const parts: React.ReactNode[] = [];
    let remaining = rest;
    let partIdx = 0;

    // First two chars might be indicators
    const tagNum = parseInt(tag.slice(1));
    if (tagNum >= 10 && remaining.length >= 2) {
      const ind = remaining.slice(0, 2);
      parts.push(
        <span key={`ind-${partIdx}`} style={{ color: BM.warning, fontWeight: 700 }}>{ind}</span>
      );
      remaining = remaining.slice(2);
    }

    // Split by $ and color subfield codes
    const sfParts = remaining.split(/(\$[a-z0-9])/gi);
    sfParts.forEach((part, i) => {
      if (part.match(/^\$[a-z0-9]$/i)) {
        parts.push(
          <span key={`sf-${partIdx}-${i}`} style={{ color: "#10b981", fontWeight: 800 }}>{part}</span>
        );
      } else {
        // Highlight search matches
        if (searchQuery && part.toLowerCase().includes(searchQuery.toLowerCase())) {
          const idx = part.toLowerCase().indexOf(searchQuery.toLowerCase());
          parts.push(
            <span key={`txt-${partIdx}-${i}`} style={{ color: BM.text }}>
              {part.slice(0, idx)}
              <mark style={{ background: "rgba(251,191,36,0.3)", color: BM.text, borderRadius: "2px", padding: "0 2px" }}>
                {part.slice(idx, idx + searchQuery.length)}
              </mark>
              {part.slice(idx + searchQuery.length)}
            </span>
          );
        } else {
          parts.push(<span key={`txt-${partIdx}-${i}`} style={{ color: BM.text }}>{part}</span>);
        }
      }
    });

    return (
      <>
        <span style={{ color: "#ef4444", fontWeight: 900 }}>{tag}</span>
        <span style={{ color: BM.textDim }}>{"  "}</span>
        {parts}
      </>
    );
  };

  return (
    <div className="p-5 overflow-auto">
      <pre className="font-mono text-xs leading-loose whitespace-pre-wrap">
        {lines.map((line, idx) => (
          <div key={idx} className="py-0.5 px-2 rounded transition-colors hover:bg-white/5 flex items-baseline gap-3"
            style={{ borderBottom: `1px solid ${BM.cardBorder}` }}>
            <span className="text-[10px] font-mono w-6 text-right shrink-0" style={{ color: BM.textDim }}>
              {idx + 1}
            </span>
            <code>{highlightLine(line)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

// ===== CARDS VIEW =====

function CardsView({
  categories, groupedFields, expandedCategories, toggleCategory,
  BM, isLegacy, showFieldLabels, highlightSubfields, tagColor, subfieldColor, isRtl
}: {
  categories: MARCCategory[];
  groupedFields: Record<string, MARCField[]>;
  expandedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  BM: ViewerTheme;
  isLegacy: boolean;
  showFieldLabels: boolean;
  highlightSubfields: boolean;
  tagColor: (tag: string) => string;
  subfieldColor: (code: string) => string;
  isRtl: boolean;
}) {
  return (
    <div className="p-5 space-y-3">
      {categories.map(cat => {
        const fields = groupedFields[cat.id] || [];
        if (fields.length === 0) return null;
        const isExpanded = expandedCategories.has(cat.id);

        return (
          <div key={cat.id} className="rounded-xl overflow-hidden" style={{
            border: `1px solid ${cat.color}25`,
            background: isLegacy ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.3)",
          }}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between p-4 transition-all hover:opacity-80"
              style={{ borderBottom: isExpanded ? `1px solid ${cat.color}20` : "none" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${cat.color}20`, color: cat.color }}>
                  {cat.icon}
                </div>
                <div className="text-left">
                  <span className="text-sm font-black" style={{ color: BM.text }}>
                    {isRtl ? cat.labelAr : cat.label}
                  </span>
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${cat.color}15`, color: cat.color }}>
                    {fields.length}
                  </span>
                </div>
              </div>
              {isExpanded
                ? <ChevronDown className="h-4 w-4" style={{ color: BM.textDim }} />
                : <ChevronRight className="h-4 w-4" style={{ color: BM.textDim }} />}
            </button>

            {/* Category Fields */}
            {isExpanded && (
              <div className="px-4 pb-3">
                {fields.map((field, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2.5"
                    style={{ borderBottom: idx < fields.length - 1 ? `1px solid ${BM.cardBorder}` : "none" }}>
                    {/* Tag Badge */}
                    <span className="font-mono font-black text-xs px-2 py-1 rounded-lg shrink-0"
                      style={{ color: tagColor(field.tag), background: `${tagColor(field.tag)}12`, border: `1px solid ${tagColor(field.tag)}25` }}>
                      {field.tag}
                    </span>

                    {/* Field Label */}
                    {showFieldLabels && TAG_LABELS[field.tag] && (
                      <span className="text-[10px] font-semibold w-28 shrink-0 pt-1" style={{ color: BM.textDim }}>
                        {TAG_LABELS[field.tag]}
                      </span>
                    )}

                    {/* Indicators */}
                    {parseInt(field.tag) >= 10 && (
                      <span className="flex gap-0.5 shrink-0 pt-0.5">
                        <span className="w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold"
                          style={{ background: BM.inputBg, border: `1px solid ${BM.inputBorder}`, color: BM.textMuted }}>
                          {field.ind1 === " " ? "#" : field.ind1}
                        </span>
                        <span className="w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold"
                          style={{ background: BM.inputBg, border: `1px solid ${BM.inputBorder}`, color: BM.textMuted }}>
                          {field.ind2 === " " ? "#" : field.ind2}
                        </span>
                      </span>
                    )}

                    {/* Subfields */}
                    <div className="flex-1 flex flex-wrap gap-1">
                      {field.subfields.map((sf, sfIdx) => (
                        <span key={sfIdx} className="inline-flex items-baseline gap-0.5 text-xs font-mono">
                          {sf.code && (
                            <span className="text-[10px] font-black px-0.5 rounded"
                              style={{
                                color: highlightSubfields ? subfieldColor(sf.code) : BM.textMuted,
                                background: highlightSubfields ? `${subfieldColor(sf.code)}10` : "transparent",
                              }}>
                              ${sf.code}
                            </span>
                          )}
                          <span style={{ color: BM.text }}>{sf.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
