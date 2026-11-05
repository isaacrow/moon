/**
 * Moon Studio's serialization tabs: W3C JSON-LD, raw JSON-LD, RDF/XML, Turtle and N-Triples.
 * They only show (and copy or download) what the editor has already built from the record.
 */
import { toast } from "sonner";
import { Shield, Copy, Download, Braces, AlertTriangle, Code, FileText, Info } from "lucide-react";
import { toRdfXml } from "../../../services/rdfGraphBuilder";
import { toBibframeJsonLdString } from "../../../services/bibframeNormalizer";
import { BMCard, BMSmallBtn, BMValidationBanner } from "./parts";
import type { BMTheme } from "./theme";

export interface OutputTabsProps {
  activeTab: string;
  BM: BMTheme;
  w3cValidation: any;
  w3cJsonLd: any;
  graphJsonld: any;
  graph: any;
  graphRdfXml: string;
  w3cTurtle: string;
  w3cNTriples: string;
  workData: any;
  instanceData: any;
  recordId: string;
  copyToClipboard: (text: string) => void;
  downloadFile: (content: string, filename: string, type: string) => void;
}

export function OutputTabs({
  activeTab, BM, w3cValidation, w3cJsonLd, graphJsonld, graph, graphRdfXml, w3cTurtle, w3cNTriples,
  workData, instanceData, recordId, copyToClipboard, downloadFile,
}: OutputTabsProps) {
  return (
    <>
        {/* ===== W3C JSON-LD ===== */}
        {activeTab === "w3c-jsonld" && (
          <div className="space-y-4">
            {w3cValidation && <BMValidationBanner validation={w3cValidation} />}
            <BMCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BM.text }}>
                  <Shield className="h-5 w-5" style={{ color: BM.success }} /> W3C-Compliant JSON-LD
                </h3>
                <div className="flex gap-2">
                  <BMSmallBtn onClick={() => copyToClipboard(toBibframeJsonLdString(w3cJsonLd))} icon={<Copy className="h-3.5 w-3.5" />} label="Copy" />
                  <BMSmallBtn onClick={() => downloadFile(toBibframeJsonLdString(w3cJsonLd), `${recordId}-w3c.jsonld`, "application/ld+json")} icon={<Download className="h-3.5 w-3.5" />} label="Download" />
                </div>
              </div>
              <pre className="p-5 rounded-2xl overflow-auto text-sm max-h-[calc(100vh-380px)] font-mono leading-relaxed shadow-inner"
                style={{ background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#a3e635" }}>
                {w3cJsonLd ? toBibframeJsonLdString(w3cJsonLd) : "Fill in the form to generate W3C-compliant JSON-LD..."}
              </pre>
            </BMCard>
          </div>
        )}

        {/* ===== RAW JSON-LD ===== */}
        {activeTab === "jsonld" && (
          <BMCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BM.text }}>
                <Braces className="h-5 w-5" style={{ color: "#0891b2" }} /> Raw JSON-LD (GraphStore)
              </h3>
              <div className="flex gap-2">
                <BMSmallBtn onClick={() => copyToClipboard(JSON.stringify(graphJsonld || graph, null, 2))} icon={<Copy className="h-3.5 w-3.5" />} label="Copy" />
                {/* The raw graph is for inspection only; a downloaded record is always the validated W3C build. */}
                <BMSmallBtn onClick={() => downloadFile(toBibframeJsonLdString(w3cJsonLd || graphJsonld || graph), `${recordId}.jsonld`, "application/ld+json")} icon={<Download className="h-3.5 w-3.5" />} label="Download" />
              </div>
            </div>
            <div className="mb-3 p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: BM.warning }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Raw GraphStore output. For W3C-compliant JSON-LD, use the <strong className="ml-1">W3C JSON-LD</strong> tab.
            </div>
            <pre className="p-5 rounded-2xl overflow-auto text-sm max-h-[calc(100vh-380px)] font-mono leading-relaxed shadow-inner"
              style={{ background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#67e8f9" }}>
              {JSON.stringify(graphJsonld || graph, null, 2)}
            </pre>
          </BMCard>
        )}

        {/* ===== RDF/XML VIEW ===== */}
        {activeTab === "rdf-xml" && (
          <BMCard>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">W3C RDF/XML Serialization</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  application/rdf+xml
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const xml = graphRdfXml || toRdfXml({ "@graph": [workData, instanceData] });
                    navigator.clipboard.writeText(xml);
                    toast.success("Copied RDF/XML to clipboard!");
                  }}
                  className="glass-bubble-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white cursor-pointer hover:bg-white/20"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copy XML</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const xml = graphRdfXml || toRdfXml({ "@graph": [workData, instanceData] });
                    downloadFile(xml, `${recordId}.rdf`, "application/rdf+xml");
                  }}
                  className="glass-bubble-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Download .rdf</span>
                </button>
              </div>
            </div>
            <pre className="p-5 rounded-2xl overflow-auto text-xs max-h-[calc(100vh-380px)] font-mono leading-relaxed shadow-inner" style={{ background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#6ee7b7" }}>
              {graphRdfXml || toRdfXml({ "@graph": [workData, instanceData] })}
            </pre>
          </BMCard>
        )}

        {/* ===== TURTLE ===== */}
        {activeTab === "turtle" && (
          <BMCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BM.text }}>
                <Code className="h-5 w-5" style={{ color: BM.secondary }} /> Turtle RDF (W3C-Compliant)
              </h3>
              <div className="flex gap-2">
                {w3cTurtle && <BMSmallBtn onClick={() => copyToClipboard(w3cTurtle)} icon={<Copy className="h-3.5 w-3.5" />} label="Copy" />}
                {w3cTurtle && <BMSmallBtn onClick={() => downloadFile(w3cTurtle, `${recordId}.ttl`, "text/turtle")} icon={<Download className="h-3.5 w-3.5" />} label=".ttl" />}
              </div>
            </div>
            <pre className="p-5 rounded-2xl overflow-auto text-sm max-h-[calc(100vh-380px)] font-mono leading-relaxed shadow-inner"
              style={{ background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#c4b5fd" }}>
              {w3cTurtle || "Fill in the form to generate Turtle RDF..."}
            </pre>
          </BMCard>
        )}

        {/* ===== N-TRIPLES ===== */}
        {activeTab === "ntriples" && (
          <BMCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BM.text }}>
                <FileText className="h-5 w-5" style={{ color: "#fb923c" }} /> N-Triples (Triple Store Ready)
              </h3>
              <div className="flex gap-2">
                {w3cNTriples && <BMSmallBtn onClick={() => copyToClipboard(w3cNTriples)} icon={<Copy className="h-3.5 w-3.5" />} label="Copy" />}
                {w3cNTriples && <BMSmallBtn onClick={() => downloadFile(w3cNTriples, `${recordId}.nt`, "application/n-triples")} icon={<Download className="h-3.5 w-3.5" />} label=".nt" />}
              </div>
            </div>
            <div className="mb-3 p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: "rgba(0,122,255,0.05)", border: `1px solid rgba(0,122,255,0.12)`, color: BM.accent }}>
              <Info className="h-3.5 w-3.5 shrink-0" /> Directly loadable into Apache Jena/Fuseki, Blazegraph, GraphDB, Virtuoso, or any SPARQL endpoint.
            </div>
            <pre className="p-5 rounded-2xl overflow-auto text-xs max-h-[calc(100vh-380px)] font-mono leading-relaxed shadow-inner"
              style={{ background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#fdba74" }}>
              {w3cNTriples || "Fill in the form to generate N-Triples..."}
            </pre>
            {w3cNTriples && <div className="mt-2 text-xs font-mono" style={{ color: BM.textDim }}>{w3cNTriples.split("\n").filter(Boolean).length} triples</div>}
          </BMCard>
        )}

    </>
  );
}