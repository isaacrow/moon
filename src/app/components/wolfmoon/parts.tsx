// Moved out of WolfMoon.tsx unchanged; see that file for how they are used.
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Save, ChevronDown, 
  
  CheckCircle2, AlertCircle, AlertTriangle,
  Clock, Loader2, 
  
  ExternalLink, X, Info
  
  
  } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  
  JsonLdValidationResult
} from "../../../services/w3cJsonLdBuilder";
import { BM_LEGACY, BM_CLASSIC, useBMTheme } from './theme';

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export function BMCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`liquid-glass-card p-6 shadow-2xl transition-all ${className}`}>
      {children}
    </div>
  );
}

export function BMEntitySection({ title, subtitle, color, icon, uri, expanded, onToggle, children, requiredCount, groupCount }: {
  title: string; subtitle?: string; color: string; icon: React.ReactNode; uri: string;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
  requiredCount?: number; groupCount?: number;
}) {
  const t = useBMTheme();
  const isClassicSec = t === BM_CLASSIC;
  return (
    <div
      className={isClassicSec ? "rounded-2xl bg-white border border-gray-200 shadow-sm" : "glass-luxury-panel"}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between transition-all cursor-pointer rounded-t-2xl hover:bg-white/10"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
            {icon}
          </div>
          <div className="text-start">
            {subtitle && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                {subtitle}
              </p>
            )}
            <h2 className="text-lg font-black text-white">{title}</h2>
            <div className="flex items-center gap-2 text-[10px] text-white/60 font-mono">
              <span>{uri.split("/").pop()}</span>
              {requiredCount !== undefined && (
                <span className="glass-bubble-pill px-2 py-0.5 text-[9px] font-bold text-white">
                  {requiredCount} req.
                </span>
              )}
              {groupCount !== undefined && <span>• {groupCount} groups</span>}
            </div>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-white/70 transition-transform ${expanded ? "" : "-rotate-90"}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}>
            <div className="px-6 pb-6 bg-[#ffffff00]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== FIELD WRAPPER WITH DELETE BUTTON =====
export function BMFieldWrapper({ children, fieldKey, onHide }: { children: React.ReactNode; fieldKey: string; onHide: (key: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative group" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onHide(fieldKey); }}
          className="absolute -top-1 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg"
          style={{
            background: "rgba(255,59,48,0.9)",
            border: "2px solid rgba(255,255,255,0.8)",
            insetInlineEnd: "-4px",
          }}
          title="Hide field"
          type="button"
        >
          <X className="h-3 w-3 text-white" />
        </button>
      )}
    </div>
  );
}

export function BMSaveStatus({ status, neverSaved = false }: { status: SaveStatus; neverSaved?: boolean }) {
  const t = useBMTheme();
  const { t: tr, i18n } = useTranslation();
  // A new record with nothing typed yet is not "saved": it has never been saved.
  if (status === "saved" && neverSaved) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", color: t.textDim }}>
        <Clock className="h-3 w-3" /> {i18n.language === "ar" ? "لم تُحفظ بعد" : "Not saved yet"}
      </div>
    );
  }
  const meta = {
    saved: { bg: "rgba(52,199,89,0.1)", border: "rgba(52,199,89,0.25)", color: t.success, icon: <CheckCircle2 className="h-3 w-3" />, label: tr("saved") },
    unsaved: { bg: "rgba(255,149,0,0.1)", border: "rgba(255,149,0,0.25)", color: t.warning, icon: <Clock className="h-3 w-3" />, label: tr("unsaved") },
    saving: { bg: "rgba(0,122,255,0.1)", border: "rgba(0,122,255,0.25)", color: t.accent, icon: <Loader2 className="h-3 w-3 animate-spin" />, label: tr("savingDots") },
    error: { bg: "rgba(255,59,48,0.1)", border: "rgba(255,59,48,0.25)", color: t.danger, icon: <AlertCircle className="h-3 w-3" />, label: tr("error") },
  }[status];
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
      {meta.icon} {meta.label}
    </div>
  );
}

export function BMSmallBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-bubble-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer hover:scale-105 active:scale-95 shadow-md transition-all"
    >
      {icon} <span>{label}</span>
    </button>
  );
}

export function BMValidationBanner({ validation }: { validation: JsonLdValidationResult }) {
  const t = useBMTheme();
  return (
    <div className="liquid-glass-card p-5 mb-4 shadow-2xl" style={{
      borderLeft: `4px solid ${validation.valid ? "#34d399" : "#f87171"}`,
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 font-black" style={{ color: validation.valid ? t.success : t.danger }}>
          {validation.valid ? <><CheckCircle2 className="h-6 w-6" /> W3C-Compliant JSON-LD</> : <><AlertCircle className="h-6 w-6" /> {validation.errors.length} Compliance Error(s)</>}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: t.textDim }}>
          <span>{validation.stats.nodeCount} nodes</span>
          <span>~{validation.stats.tripleEstimate} triples</span>
          <span>{validation.stats.prefixesUsed.length} prefixes</span>
          <span style={{ color: validation.stats.contextComplete ? t.success : t.danger }}>
            Context: {validation.stats.contextComplete ? "Complete" : "Incomplete"}
          </span>
        </div>
      </div>
      <div className="text-[10px] mb-2" style={{ color: t.textDim }}>
        Passes: <span style={{ color: t.accent }}>json-ld.org/playground</span> | <span style={{ color: t.accent }}>W3C RDF Validator</span> | <span style={{ color: t.accent }}>Apache Jena/Fuseki</span> | <span style={{ color: t.accent }}>Blazegraph</span> | <span style={{ color: t.accent }}>GraphDB</span>
      </div>
      {validation.errors.length > 0 && <div className="mt-2 space-y-1">{validation.errors.map((e, i) => (
        <div key={i} className="text-xs p-2 rounded-lg flex items-start gap-1.5" style={{ background: "rgba(255,59,48,0.05)" }}>
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: t.danger }} /> <span style={{ color: t.danger }}>{e}</span>
        </div>
      ))}</div>}
      {validation.warnings.length > 0 && <div className="mt-2 space-y-1">{validation.warnings.map((w, i) => (
        <div key={i} className="text-xs p-2 rounded-lg flex items-start gap-1.5" style={{ background: "rgba(255,149,0,0.05)" }}>
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: t.warning }} /> <span style={{ color: t.warning }}>{w}</span>
        </div>
      ))}</div>}
      {validation.info.length > 0 && <div className="mt-2 space-y-1">{validation.info.map((inf, i) => (
        <div key={i} className="text-xs p-2 rounded-lg flex items-start gap-1.5" style={{ background: "rgba(0,122,255,0.05)" }}>
          <Info className="h-3 w-3 mt-0.5 shrink-0" style={{ color: t.accent }} /> <span style={{ color: t.accent }}>{inf}</span>
        </div>
      ))}</div>}
      <div className="mt-3 flex gap-2">
        <a href={`https://json-ld.org/playground/#startTab=tab-expanded&json-ld=${encodeURIComponent(JSON.stringify(validation))}`}
          target="_blank" rel="noopener noreferrer"
          className="glass-bubble-pill flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm">
          <ExternalLink className="h-3 w-3 text-cyan-300" /> JSON-LD Playground
        </a>
        <a href="https://www.w3.org/RDF/Validator/" target="_blank" rel="noopener noreferrer"
          className="glass-bubble-pill flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm">
          <ExternalLink className="h-3 w-3 text-cyan-300" /> W3C RDF Validator
        </a>
      </div>
    </div>
  );
}

// ===== SAVE TEMPLATE DIALOG =====
export function BMSaveTemplateDialog({ allFieldKeys, hiddenFields, baseTemplateName, onSave, onClose }: {
  allFieldKeys: string[];
  hiddenFields: Set<string>;
  baseTemplateName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const th = useBMTheme();
  const { t } = useTranslation();
  const isLeg = th === BM_LEGACY;
  const isClsc = th === BM_CLASSIC;
  const [name, setName] = useState("");
  const [showKept, setShowKept] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  const keptFields = allFieldKeys.filter(k => !hiddenFields.has(k));
  const removedFields = allFieldKeys.filter(k => hiddenFields.has(k));

  const formatFieldName = (key: string) => key.replace("ontology:", "").replace("registry:", "").split("/").pop() || key;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: isClsc ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.5)", backdropFilter: isClsc ? undefined : "blur(8px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-[520px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isClsc ? "#ffffff" : isLeg ? "rgba(255,255,255,0.98)" : "rgba(15,23,42,0.98)",
          border: `1px solid ${th.cardBorder}`,
          backdropFilter: isClsc ? undefined : "blur(30px) saturate(180%)",
          boxShadow: isClsc ? "0 8px 30px rgba(0,0,0,0.15)" : "0 25px 80px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${th.cardBorder}` }}>
          <div>
            <h2 className="text-lg font-black flex items-center gap-2" style={{ color: th.text }}>
              <Save className="h-5 w-5" style={{ color: th.accent }} />
              {t("saveTemplate")}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: th.textDim }}>
              {t("basedOn")}: <strong>{baseTemplateName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-all">
            <X className="h-5 w-5" style={{ color: th.textDim }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Template name input */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: th.textDim }}>{t("templateName")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("templateNamePlaceholder")}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none transition-all"
              style={{
                background: th.inputBg, border: `2px solid ${name ? th.accentBorder : th.inputBorder}`,
                color: th.text, caretColor: th.accent,
              }}
              autoFocus
            />
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl text-center"
              style={{ background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)" }}>
              <div className="text-2xl font-black" style={{ color: th.success }}>{keptFields.length}</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: th.success }}>{t("keptFields")}</div>
            </div>
            <div className="p-4 rounded-xl text-center"
              style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)" }}>
              <div className="text-2xl font-black" style={{ color: th.danger }}>{removedFields.length}</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: th.danger }}>{t("removedFields")}</div>
            </div>
          </div>

          {/* Kept fields accordion */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${th.cardBorder}` }}>
            <button onClick={() => setShowKept(!showKept)} className="w-full px-4 py-2.5 flex items-center justify-between transition-all"
              style={{ background: isLeg ? "rgba(255,255,255,0.5)" : "rgba(30,41,59,0.5)" }} type="button">
              <span className="text-xs font-bold flex items-center gap-2" style={{ color: th.success }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("keptFields")} ({keptFields.length})
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showKept ? "" : "-rotate-90"}`} style={{ color: th.textDim }} />
            </button>
            {showKept && (
              <div className="px-4 py-2 max-h-40 overflow-y-auto space-y-0.5">
                {keptFields.map(k => (
                  <div key={k} className="text-[11px] font-mono py-0.5 flex items-center gap-1.5" style={{ color: th.textMuted }}>
                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0" style={{ color: th.success }} />
                    {formatFieldName(k)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Removed fields accordion */}
          {removedFields.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${th.cardBorder}` }}>
              <button onClick={() => setShowRemoved(!showRemoved)} className="w-full px-4 py-2.5 flex items-center justify-between transition-all"
                style={{ background: isLeg ? "rgba(255,255,255,0.5)" : "rgba(30,41,59,0.5)" }} type="button">
                <span className="text-xs font-bold flex items-center gap-2" style={{ color: th.danger }}>
                  <X className="h-3.5 w-3.5" /> {t("removedFields")} ({removedFields.length})
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showRemoved ? "" : "-rotate-90"}`} style={{ color: th.textDim }} />
              </button>
              {showRemoved && (
                <div className="px-4 py-2 max-h-40 overflow-y-auto space-y-0.5">
                  {removedFields.map(k => (
                    <div key={k} className="text-[11px] font-mono py-0.5 flex items-center gap-1.5" style={{ color: th.textMuted }}>
                      <X className="h-2.5 w-2.5 shrink-0" style={{ color: th.danger }} />
                      {formatFieldName(k)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: `1px solid ${th.cardBorder}` }}>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ color: th.textDim }}>
            {t("cancel")}
          </button>
          <button onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2"
            style={{
              background: name.trim() ? "linear-gradient(135deg, #3b82f6, #60a5fa)" : (isLeg ? "rgba(0,0,0,0.05)" : "rgba(59,130,246,0.08)"),
              color: name.trim() ? "#ffffff" : th.textDim,
              boxShadow: name.trim() ? "0 4px 16px rgba(59,130,246,0.3)" : "none",
              opacity: name.trim() ? 1 : 0.5,
            }}>
            <Save className="h-4 w-4" /> {t("saveTemplate")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
