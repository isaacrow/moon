// Moved out of WolfMoon.tsx unchanged; see that file for how they are used.
import React, {  } from "react";
import { toast } from "sonner";
import {
  Download, 
  BookOpen, 
  AlertTriangle,
  
  
  Copy, ExternalLink, 
  Scissors
  } from "lucide-react";
import {
  generateCutter, parseCallNumber, formatCallNumber,
  EXAMPLE_CALL_NUMBERS, EXAMPLE_NAMES,
  type CutterResult, type CallNumberParts,
} from "../LCCutterEngine";
import { BM_DARK } from './theme';

// ============================== BLUE MOON SUB-COMPONENTS ==============================

// ============================== LC CUTTER PANEL ==============================
// Cutter number generator + LC Call Number parser/formatter

export function LCCutterPanel({ theme, isLegacy, isClassic = false }: { theme: typeof BM_DARK; isLegacy: boolean; isClassic?: boolean }) {
  const isLight = isLegacy || isClassic;
  const [mode, setMode] = React.useState<"cutter" | "parser">("cutter");
  // Cutter generator state
  const [cutterInput, setCutterInput] = React.useState("");
  const [cutterDigits, setCutterDigits] = React.useState(3);
  const [cutterResult, setCutterResult] = React.useState<CutterResult | null>(null);
  // Call number parser state
  const [callNumInput, setCallNumInput] = React.useState("");
  const [parsedResult, setParsedResult] = React.useState<CallNumberParts | null>(null);
  const [formattedResult, setFormattedResult] = React.useState("");
  // Cutter history
  const [history, setHistory] = React.useState<CutterResult[]>([]);

  const handleGenerateCutter = React.useCallback(() => {
    if (!cutterInput.trim()) return;
    const result = generateCutter(cutterInput.trim(), cutterDigits);
    setCutterResult(result);
    if (result.cutterNumber) {
      setHistory(prev => {
        const next = [result, ...prev.filter(h => h.input.toLowerCase() !== result.input.toLowerCase())];
        return next.slice(0, 20);
      });
      toast.success(`Cutter: ${result.formatted}`);
    }
  }, [cutterInput, cutterDigits]);

  const handleParseCallNumber = React.useCallback(() => {
    if (!callNumInput.trim()) return;
    const parts = parseCallNumber(callNumInput.trim());
    setParsedResult(parts);
    if (parts.valid) {
      setFormattedResult(formatCallNumber(parts));
      toast.success("Call number parsed");
    } else {
      setFormattedResult("");
    }
  }, [callNumInput]);

  // Live preview for cutter
  const livePreview = React.useMemo(() => {
    if (!cutterInput.trim()) return null;
    try { return generateCutter(cutterInput.trim(), cutterDigits); } catch { return null; }
  }, [cutterInput, cutterDigits]);

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };
  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const cardStyle: React.CSSProperties = {
    background: isClassic ? "#ffffff" : isLegacy ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.6)",
    border: `1px solid ${theme.cardBorder}`,
    backdropFilter: isClassic ? undefined : "blur(20px)",
    boxShadow: isClassic ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
  };

  const inputStyle: React.CSSProperties = {
    background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${theme.cardBorder}`, color: theme.text,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black flex items-center gap-2" style={{ color: theme.text }}>
            <Scissors className="h-5 w-5" style={{ color: "#f472b6" }} />
            LC Cutter Tool
          </h3>
          <a href="https://www.loc.gov/aba/pcc/053/table.html" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-1 transition-all hover:opacity-80"
            style={{ color: theme.textDim, background: "#f472b610", border: "1px solid #f472b620" }}>
            <ExternalLink className="h-3 w-3" /> LC Cutter Table
          </a>
        </div>
        <p className="text-xs mb-4" style={{ color: theme.textDim }}>
          Generate LC Cutter numbers from names/words using the Library of Congress Cutter Table, or parse and format LC Call Numbers into their component parts.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          {([
            { key: "cutter" as const, label: "Cutter Generator", icon: <Scissors className="h-3.5 w-3.5" />, color: "#f472b6" },
            { key: "parser" as const, label: "Call Number Parser", icon: <BookOpen className="h-3.5 w-3.5" />, color: "#06b6d4" },
          ]).map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all flex-1"
              style={{
                background: mode === m.key ? `${m.color}20` : "transparent",
                border: `1px solid ${mode === m.key ? `${m.color}40` : theme.cardBorder}`,
                color: mode === m.key ? m.color : theme.textDim,
              }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* ========== CUTTER GENERATOR ========== */}
        {mode === "cutter" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                  Name / Word
                </label>
                <input
                  type="text" value={cutterInput}
                  onChange={e => setCutterInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleGenerateCutter(); }}
                  placeholder="e.g., Johnson, Shakespeare, Qureshi..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
                {/* Example names */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXAMPLE_NAMES.map(ex => (
                    <button key={ex.value} onClick={() => { setCutterInput(ex.value); }}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-all hover:opacity-80"
                      style={{ background: "#f472b608", color: theme.textDim, border: `1px solid ${theme.cardBorder}` }}>
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                  Digits
                </label>
                <div className="flex gap-1.5">
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setCutterDigits(n)}
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: cutterDigits === n ? "#f472b620" : "transparent",
                        border: `1px solid ${cutterDigits === n ? "#f472b640" : theme.cardBorder}`,
                        color: cutterDigits === n ? "#f472b6" : theme.textDim,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
                {/* Live preview */}
                {livePreview && livePreview.cutterNumber && (
                  <div className="mt-3 p-2.5 rounded-xl text-center" style={{ background: "#f472b608", border: "1px solid #f472b615" }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textDim }}>Preview</span>
                    <span className="text-lg font-black font-mono" style={{ color: "#f472b6" }}>{livePreview.formatted}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Generate button */}
            <button onClick={handleGenerateCutter} disabled={!cutterInput.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-30"
              style={{ background: "linear-gradient(135deg, #f472b6, #ec4899, #db2777)", color: "#fff", boxShadow: "0 4px 15px rgba(244,114,182,0.3)" }}>
              <Scissors className="h-4 w-4" /> Generate Cutter Number
            </button>

            {/* Result */}
            {cutterResult && cutterResult.cutterNumber && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${theme.cardBorder}` }}>
                {/* Main result */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textDim }}>Cutter Number</span>
                    <span className="text-2xl font-black font-mono" style={{ color: "#f472b6" }}>{cutterResult.formatted}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => copyText(cutterResult.formatted)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: "#f472b610", color: "#f472b6", border: "1px solid #f472b620" }}>
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <button onClick={() => downloadText(
                      `LC Cutter Number\nInput: ${cutterResult.input}\nCutter: ${cutterResult.formatted}\nFull: ${cutterResult.cutterNumber}\nRule: ${cutterResult.breakdown.rule}\n`,
                      `LC-Cutter-${cutterResult.input}.txt`
                    )}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: "#06b6d410", color: "#06b6d4", border: "1px solid #06b6d420" }}>
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: theme.textDim }}>Breakdown</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "#f472b615", color: "#f472b6", border: "1px solid #f472b625" }}>
                      {cutterResult.breakdown.initialLetter} <span style={{ color: theme.textDim }}>(initial)</span>
                    </span>
                    {cutterResult.breakdown.digits.map((d, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "#a855f710", color: "#a855f7", border: "1px solid #a855f720" }}>
                        {d.letter} → {d.digit} <span className="text-[9px]" style={{ color: theme.textDim }}>({d.rule})</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: theme.textDim }}>
                    Rule applied: {cutterResult.breakdown.rule}
                  </p>
                </div>
              </div>
            )}

            {cutterResult && !cutterResult.cutterNumber && (
              <div className="p-3 rounded-xl text-center" style={{ background: "#ef444410", border: "1px solid #ef444425" }}>
                <AlertTriangle className="h-4 w-4 mx-auto mb-1" style={{ color: "#ef4444" }} />
                <p className="text-xs font-bold" style={{ color: "#ef4444" }}>
                  Invalid input. Enter a name or word containing only letters.
                </p>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textDim }}>Recent ({history.length})</span>
                  <button onClick={() => setHistory([])} className="text-[9px] font-bold px-2 py-0.5 rounded transition-all hover:opacity-80" style={{ color: theme.textDim }}>
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h, i) => (
                    <button key={i} onClick={() => { setCutterInput(h.input); setCutterResult(h); }}
                      className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                      style={{ background: isClassic ? "#f3f4f6" : isLegacy ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${theme.cardBorder}`, color: theme.text }}>
                      <span style={{ color: theme.textDim }}>{h.input}</span>
                      <span className="font-mono" style={{ color: "#f472b6" }}>{h.formatted}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== CALL NUMBER PARSER ========== */}
        {mode === "parser" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider mb-1.5 block" style={{ color: theme.textDim }}>
                LC Call Number
              </label>
              <input
                type="text" value={callNumInput}
                onChange={e => setCallNumInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleParseCallNumber(); }}
                placeholder="e.g., QA76.73.J38 2018"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                style={inputStyle}
              />
              {/* Example call numbers */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLE_CALL_NUMBERS.map(ex => (
                  <button key={ex.value} onClick={() => { setCallNumInput(ex.value); }}
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-all hover:opacity-80"
                    style={{ background: "#06b6d408", color: theme.textDim, border: `1px solid ${theme.cardBorder}` }}>
                    {ex.label}: <span className="font-mono">{ex.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleParseCallNumber} disabled={!callNumInput.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-30"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2, #0e7490)", color: "#fff", boxShadow: "0 4px 15px rgba(6,182,212,0.3)" }}>
              <BookOpen className="h-4 w-4" /> Parse Call Number
            </button>

            {parsedResult && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: isClassic ? "#f9fafb" : isLegacy ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${theme.cardBorder}` }}>
                {parsedResult.valid ? (
                  <>
                    {/* Formatted result */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: theme.textDim }}>Formatted</span>
                        <span className="text-xl font-black font-mono" style={{ color: "#06b6d4" }}>{formattedResult}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => copyText(formattedResult)}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ background: "#06b6d410", color: "#06b6d4", border: "1px solid #06b6d420" }}>
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <button onClick={() => downloadText(
                          `LC Call Number\nRaw: ${callNumInput}\nFormatted: ${formattedResult}\n\nClass Letters: ${parsedResult.classLetters}\nClass Number: ${parsedResult.classNumber}\nDecimal: ${parsedResult.decimalPart || "(none)"}\nCutters: ${parsedResult.cutters.map(c => "." + c.letter + c.number).join(" ") || "(none)"}\nDate: ${parsedResult.date || "(none)"}\n`,
                          "LC-CallNumber.txt"
                        )}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ background: "#f472b610", color: "#f472b6", border: "1px solid #f472b620" }}>
                          <Download className="h-3 w-3" /> Download
                        </button>
                      </div>
                    </div>

                    {/* Component breakdown */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: theme.textDim }}>Component Breakdown</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-lg" style={{ background: "#3b82f610", border: "1px solid #3b82f620" }}>
                          <span className="text-[9px] font-bold uppercase block" style={{ color: "#3b82f6" }}>Class Letters</span>
                          <span className="text-sm font-black font-mono" style={{ color: theme.text }}>{parsedResult.classLetters || "\u2014"}</span>
                        </div>
                        <div className="p-2.5 rounded-lg" style={{ background: "#8b5cf610", border: "1px solid #8b5cf620" }}>
                          <span className="text-[9px] font-bold uppercase block" style={{ color: "#8b5cf6" }}>Class Number</span>
                          <span className="text-sm font-black font-mono" style={{ color: theme.text }}>{parsedResult.classNumber || "\u2014"}</span>
                        </div>
                        {parsedResult.decimalPart && (
                          <div className="p-2.5 rounded-lg" style={{ background: "#f59e0b10", border: "1px solid #f59e0b20" }}>
                            <span className="text-[9px] font-bold uppercase block" style={{ color: "#f59e0b" }}>Decimal</span>
                            <span className="text-sm font-black font-mono" style={{ color: theme.text }}>.{parsedResult.decimalPart}</span>
                          </div>
                        )}
                        {parsedResult.cutters.map((c, i) => (
                          <div key={i} className="p-2.5 rounded-lg" style={{ background: "#f472b610", border: "1px solid #f472b620" }}>
                            <span className="text-[9px] font-bold uppercase block" style={{ color: "#f472b6" }}>Cutter {i + 1}</span>
                            <span className="text-sm font-black font-mono" style={{ color: theme.text }}>.{c.letter}{c.number}</span>
                          </div>
                        ))}
                        {parsedResult.date && (
                          <div className="p-2.5 rounded-lg" style={{ background: "#10b98110", border: "1px solid #10b98120" }}>
                            <span className="text-[9px] font-bold uppercase block" style={{ color: "#10b981" }}>Date</span>
                            <span className="text-sm font-black font-mono" style={{ color: theme.text }}>{parsedResult.date}</span>
                          </div>
                        )}
                        {parsedResult.remainder && (
                          <div className="p-2.5 rounded-lg" style={{ background: "#06b6d410", border: "1px solid #06b6d420" }}>
                            <span className="text-[9px] font-bold uppercase block" style={{ color: "#06b6d4" }}>Remainder</span>
                            <span className="text-sm font-black font-mono" style={{ color: theme.text }}>{parsedResult.remainder}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2" style={{ color: "#ef4444" }} />
                    {parsedResult.errors.map((e, i) => (
                      <p key={i} className="text-xs font-bold" style={{ color: "#ef4444" }}>{e}</p>
                    ))}
                    <p className="text-[10px] mt-2" style={{ color: theme.textDim }}>
                      Expected format: <span className="font-mono">QA76.73.J38 2018</span> or <span className="font-mono">PS3515.U274 A6 1998</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick info footer */}
        <div className="flex flex-wrap gap-2 pt-3 mt-3" style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#f472b610", color: "#f472b6", border: "1px solid #f472b620" }}>
            LC Cutter Table
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#06b6d410", color: "#06b6d4", border: "1px solid #06b6d420" }}>
            Call Number Formatter
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#a855f710", color: "#a855f7", border: "1px solid #a855f720" }}>
            Live Preview
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#10b98110", color: "#10b981", border: "1px solid #10b98120" }}>
            Copy & Download
          </span>
        </div>
      </div>
    </div>
  );
}
