// Moved out of WolfMoon.tsx unchanged; see that file for how they are used.
import React, {  } from "react";
import { toast } from "sonner";
import {
  
  
  AlertTriangle,
  Loader2, 
  
  Copy, ExternalLink, 
  Languages
  
  } from "lucide-react";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";
import {
  fetchLanguageIndex, transliterate as ssTransliterateLocal,
} from "../ScriptShifterEngine";
import { BM_DARK } from './theme';

// ============================== SCRIPTSHIFTER PANEL ==============================
// LC ScriptShifter — dual-mode transliteration
// Primary: Server proxy → bibframe.org/scriptshifter (full Python engine, Arabic S2R works)
// Fallback: Client-side YAML engine from GitHub (character maps only)

export const SS_PROXY = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/scriptshifter`;

export interface SSLangAPI { label: string; has_r2s?: boolean; has_s2r?: boolean; }

export function ScriptShifterPanel({ theme, isLegacy, isClassic = false }: { theme: typeof BM_DARK; isLegacy: boolean; isClassic?: boolean }) {
  const [languages, setLanguages] = React.useState<Record<string, SSLangAPI>>({});
  const [selectedLang, setSelectedLang] = React.useState("");
  const [inputText, setInputText] = React.useState("");
  const [outputText, setOutputText] = React.useState("");
  const [direction, setDirection] = React.useState<"s2r" | "r2s">("s2r");
  const [capitalize, setCapitalize] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingLangs, setIsLoadingLangs] = React.useState(true);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [langSearch, setLangSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [engineMode, setEngineMode] = React.useState<"proxy" | "local" | "offline">("proxy");

  // Fetch languages: try proxy (bibframe.org) first, fall back to GitHub YAML index
  React.useEffect(() => {
    setIsLoadingLangs(true);
    let cancelled = false;

    (async () => {
      // Strategy 1: Server proxy to bibframe.org/scriptshifter
      try {
        const resp = await fetch(`${SS_PROXY}/languages`, {
          headers: { "Authorization": `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setLanguages(data);
        if (data.arabic) setSelectedLang("arabic");
        else { const k = Object.keys(data); if (k.length) setSelectedLang(k[0]); }
        setEngineMode("proxy");
        setError(null);
        console.log(`[ScriptShifter] Proxy OK: ${Object.keys(data).length} languages from bibframe.org`);
        return;
      } catch (proxyErr: any) {
        console.warn("[ScriptShifter] Proxy failed:", proxyErr.message, "— trying GitHub fallback...");
      }

      // Strategy 2: Client-side engine from GitHub YAML
      try {
        const idx = await fetchLanguageIndex();
        if (cancelled) return;
        // Convert SSLanguageIndex to SSLangAPI format
        const apiFormat: Record<string, SSLangAPI> = {};
        for (const [k, v] of Object.entries(idx)) {
          apiFormat[k] = { label: v.name, has_r2s: true, has_s2r: true };
        }
        setLanguages(apiFormat);
        if (apiFormat.arabic) setSelectedLang("arabic");
        else { const k = Object.keys(apiFormat); if (k.length) setSelectedLang(k[0]); }
        setEngineMode("local");
        setError(null);
        console.log(`[ScriptShifter] GitHub fallback OK: ${Object.keys(apiFormat).length} languages`);
      } catch (githubErr: any) {
        console.error("[ScriptShifter] Both sources failed:", githubErr.message);
        if (!cancelled) {
          setEngineMode("offline");
          setError(`Could not connect to ScriptShifter. Proxy: bibframe.org unreachable. GitHub fallback also failed: ${githubErr.message}`);
        }
      }
    })().finally(() => { if (!cancelled) setIsLoadingLangs(false); });

    return () => { cancelled = true; };
  }, []);

  const handleTransliterate = React.useCallback(async () => {
    if (!inputText.trim() || !selectedLang) return;
    setIsLoading(true);
    setWarnings([]);
    setOutputText("");

    if (engineMode === "proxy") {
      // Use server proxy → bibframe.org full Python engine
      try {
        const resp = await fetch(`${SS_PROXY}/trans`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ lang: selectedLang, text: inputText, t_dir: direction, capitalize, options: {} }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setWarnings(data.warnings || [`Server error: ${resp.status}`]);
          setOutputText(data.output || "");
        } else {
          setOutputText(data.output || "");
          if (data.warnings?.length) setWarnings(data.warnings);
          if (data.output) toast.success("Transliterated via bibframe.org");
        }
      } catch (err: any) {
        console.error("[ScriptShifter] Proxy trans failed:", err);
        toast.error(`Proxy error: ${err.message}`);
        setWarnings([`Proxy error: ${err.message}. Try switching to local engine.`]);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Use client-side YAML engine
      try {
        const result = await ssTransliterateLocal(inputText, selectedLang, direction, capitalize);
        setOutputText(result.output);
        if (result.warnings.length) setWarnings(result.warnings);
        if (result.output) toast.success("Transliterated (local engine)");
      } catch (err: any) {
        console.error("[ScriptShifter] Local engine error:", err);
        toast.error(`Local engine error: ${err.message}`);
        setWarnings([`Engine error: ${err.message}`]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [inputText, selectedLang, direction, capitalize, engineMode]);

  const currentLang = languages[selectedLang];
  const supportsS2R = currentLang?.has_s2r !== false;
  const supportsR2S = currentLang?.has_r2s !== false;

  const filteredLangs = React.useMemo(() => {
    const entries = Object.entries(languages);
    if (!langSearch.trim()) return entries.sort((a, b) => a[1].label.localeCompare(b[1].label));
    const q = langSearch.toLowerCase();
    return entries.filter(([k, v]) =>
      v.label.toLowerCase().includes(q) || k.toLowerCase().includes(q)
    ).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [languages, langSearch]);

  const engineBadge = engineMode === "proxy"
    ? { bg: "#10b98110", color: "#10b981", border: "#10b98120", text: "bibframe.org (Full Engine)" }
    : engineMode === "local"
    ? { bg: "#f59e0b10", color: "#f59e0b", border: "#f59e0b20", text: "Local Engine (Character Maps Only)" }
    : { bg: "#ef444410", color: "#ef4444", border: "#ef444420", text: "Offline" };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{
        background: isClassic ? "#ffffff" : isLegacy ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.6)",
        border: `1px solid ${theme.cardBorder}`,
        backdropFilter: isClassic ? undefined : "blur(20px)",
        boxShadow: isClassic ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
      }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black flex items-center gap-2" style={{ color: theme.text }}>
            <Languages className="h-5 w-5" style={{ color: "#a855f7" }} />
            LC ScriptShifter
          </h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: engineBadge.bg, color: engineBadge.color, border: `1px solid ${engineBadge.border}` }}>
              {engineBadge.text}
            </span>
            <a href="https://bibframe.org/scriptshifter/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-1 transition-all hover:opacity-80"
              style={{ color: theme.textDim, background: `${theme.accent}10`, border: `1px solid ${theme.accent}20` }}>
              <ExternalLink className="h-3 w-3" /> bibframe.org
            </a>
          </div>
        </div>
        <p className="text-xs mb-4" style={{ color: theme.textDim }}>
          {engineMode === "proxy"
            ? "Connected to bibframe.org/scriptshifter \u2014 full Python transliteration engine with Arabic (ArabicTransliterator), Chinese, Korean, Hebrew, and 90+ scripts. Identical to the LC online tool."
            : "Using local character-mapping engine from GitHub YAML tables. Arabic Script\u2192Roman and some complex scripts may have limited support. Proxy to bibframe.org is unavailable."
          }
        </p>

        {error ? (
          <div className="p-4 rounded-xl text-center" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
            <AlertTriangle className="h-5 w-5 mx-auto mb-2" style={{ color: "#ef4444" }} />
            <p className="text-xs font-bold" style={{ color: "#ef4444" }}>{error}</p>
            <p className="text-[10px] mt-1" style={{ color: theme.textDim }}>
              Use it directly at{" "}
              <a href="https://bibframe.org/scriptshifter/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#a855f7" }}>bibframe.org/scriptshifter</a>
            </p>
          </div>
        ) : isLoadingLangs ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#a855f7" }} />
            <span className="text-xs font-bold" style={{ color: theme.textDim }}>Connecting to ScriptShifter...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                  Script / Language ({Object.keys(languages).length})
                </label>
                <input
                  type="text" placeholder="Search scripts..." value={langSearch}
                  onChange={e => setLangSearch(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs mb-1.5 outline-none"
                  style={{
                    background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                  }}
                />
                <select
                  value={selectedLang} onChange={e => { setSelectedLang(e.target.value); setOutputText(""); setWarnings([]); }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold outline-none"
                  style={{
                    background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                  }}
                  size={Math.min(8, filteredLangs.length)}
                >
                  {filteredLangs.map(([key, lang]) => (
                    <option key={key} value={key} style={{ color: "#000" }}>
                      {lang.label}
                      {lang.has_s2r === false && lang.has_r2s !== false ? " (R\u2192S only)" : ""}
                      {lang.has_r2s === false && lang.has_s2r !== false ? " (S\u2192R only)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                  Direction
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setDirection("s2r")} disabled={!supportsS2R}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                    style={{
                      background: direction === "s2r" ? "#a855f720" : "transparent",
                      border: `1px solid ${direction === "s2r" ? "#a855f740" : theme.cardBorder}`,
                      color: direction === "s2r" ? "#a855f7" : theme.textDim,
                    }}>
                    Script \u2192 Roman
                  </button>
                  <button
                    onClick={() => setDirection("r2s")} disabled={!supportsR2S}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                    style={{
                      background: direction === "r2s" ? "#06b6d420" : "transparent",
                      border: `1px solid ${direction === "r2s" ? "#06b6d440" : theme.cardBorder}`,
                      color: direction === "r2s" ? "#06b6d4" : theme.textDim,
                    }}>
                    Roman \u2192 Script
                  </button>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold cursor-pointer" style={{ color: theme.textDim }}>
                    <input type="checkbox" checked={capitalize} onChange={e => setCapitalize(e.target.checked)}
                      className="rounded" style={{ accentColor: "#a855f7" }} />
                    Capitalize output
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                  Input ({direction === "s2r" ? "Non-Latin Script" : "Romanized Latin"})
                </label>
                <textarea
                  value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder={direction === "s2r" ? "\u0623\u062F\u062E\u0644 \u0627\u0644\u0646\u0635 \u0647\u0646\u0627..." : "Enter romanized text (e.g. maktabah, Moskva)..."}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none resize-none"
                  style={{
                    background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                    direction: direction === "s2r" ? "rtl" : "ltr",
                  }}
                  dir={direction === "s2r" ? "rtl" : "ltr"}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center justify-between" style={{ color: theme.textDim }}>
                  <span>Output ({direction === "s2r" ? "Romanized Latin" : "Non-Latin Script"})</span>
                  {outputText && (
                    <button onClick={() => { navigator.clipboard.writeText(outputText); toast.success("Copied!"); }}
                      className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded transition-all hover:opacity-80"
                      style={{ background: `${theme.accent}15`, color: theme.accent }}>
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </button>
                  )}
                </label>
                <textarea
                  value={outputText} readOnly rows={6}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none resize-none"
                  style={{
                    background: isClassic ? "#ffffff" : isLegacy ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${outputText ? "#a855f730" : theme.cardBorder}`, color: theme.text,
                    direction: direction === "r2s" ? "rtl" : "ltr",
                  }}
                  dir={direction === "r2s" ? "rtl" : "ltr"}
                  placeholder="Transliterated output will appear here..."
                />
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="p-3 rounded-xl" style={{ background: "#f59e0b10", border: "1px solid #f59e0b25" }}>
                {warnings.map((w, i) => (
                  <p key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: "#f59e0b" }}>
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={handleTransliterate}
              disabled={isLoading || !inputText.trim() || !selectedLang}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-30"
              style={{
                background: "linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)",
                color: "#fff", boxShadow: "0 4px 15px rgba(168,85,247,0.3)",
              }}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Transliterating...</>
              ) : (
                <><Languages className="h-4 w-4" />Transliterate {currentLang?.label || ""}</>
              )}
            </button>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#a855f710", color: "#a855f7", border: "1px solid #a855f720" }}>
                {Object.keys(languages).length} scripts
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: engineBadge.bg, color: engineBadge.color, border: `1px solid ${engineBadge.border}` }}>
                {engineMode === "proxy" ? "Proxied via bibframe.org" : "Local YAML engine"}
              </span>
              {selectedLang && currentLang && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#10b98110", color: "#10b981", border: "1px solid #10b98120" }}>
                  {currentLang.label}: {supportsS2R ? "S\u2192R" : ""}{supportsS2R && supportsR2S ? " + " : ""}{supportsR2S ? "R\u2192S" : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
