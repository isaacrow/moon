"use client";
import { useState, useEffect } from "react";
import {
  Layers, Plus, Search, Link2, Check, 
  Copy} from "lucide-react";
import {
  BibframeHub, searchHubs, saveMoonHub
} from "../../../services/hubService";

interface MarvaHubEditorProps {
  currentHub?: BibframeHub | null;
  onSelectHub?: (hub: BibframeHub) => void;
  onSaveHub?: (hub: BibframeHub) => void;
  isDark?: boolean;
}

export function MarvaHubEditor({
  currentHub,
  onSelectHub,
  onSaveHub,
  isDark = true
}: MarvaHubEditorProps) {
  const [hubList, setHubList] = useState<BibframeHub[]>([]);
  const [activeHub, setActiveHub] = useState<BibframeHub | null>(currentHub || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Moon's own hubs and LC's hubs, searched as the cataloger types.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setHubList([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found = await searchHubs(q);
      if (!cancelled) { setHubList(found); setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);
  const [copiedAAP, setCopiedAAP] = useState(false);

  // New Hub Stub state
  const [newTitle, setNewTitle] = useState("");
  const [newCreator, setNewCreator] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newMedium, setNewMedium] = useState("");
  const [newLang, setNewLang] = useState("");

  const filteredHubs = hubList;

  // Saves the hub in Moon's authority file (permanent https://mooon.site/resource/hub/<id> address).
  const handleCreateHub = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    const res = await saveMoonHub({ title: newTitle, creator: newCreator, keyOrOpus: newKey, language: newLang });
    setSaving(false);
    if (!res.ok) {
      setMessage(res.status === 401 ? "Sign in to create hubs." : `Could not save the hub: ${res.error}`);
      return;
    }
    setHubList((list) => [res.hub, ...list.filter((h) => h.uri !== res.hub.uri)]);
    setActiveHub(res.hub);
    if (onSelectHub) onSelectHub(res.hub);
    if (onSaveHub) onSaveHub(res.hub);
    setNewTitle("");
    setNewCreator("");
    setNewKey("");
    setNewLang("");
    setMessage(res.existing ? `This hub already exists: ${res.hub.aap}` : `Hub saved: ${res.hub.uri}`);
  };

  const handleCopyAAP = (aap: string) => {
    navigator.clipboard.writeText(aap);
    setCopiedAAP(true);
    setTimeout(() => setCopiedAAP(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border border-purple-500/20 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">BIBFRAME Hubs & Expression Collocation</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              LC Marva Specification
            </span>
          </div>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            According to the <strong>BIBFRAME Primer (Appendix A)</strong> and <strong>Marva User Manual</strong>, Hubs are collocation and aggregation resources. They are the functional linked data equivalent of MARC Uniform Titles (130 / 240 / 730 / 830) and Name-Title Authorities, organizing works and expressions via pure HTTP URIs and Authorized Access Points (<code>bflc:aap</code>).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Hub Search & Presets */}
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">Browse & Search Hubs</span>
              <span className="text-[10px] text-purple-400 font-mono">{searching ? "Searching…" : `${filteredHubs.length} Hubs`}</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Moon and LC hubs (creator or title)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {!searching && searchQuery.trim().length >= 2 && filteredHubs.length === 0 && (
                <p className="text-[11px] text-gray-400 px-1">No hubs found. Create one below.</p>
              )}
              {filteredHubs.map((h) => {
                const isSelected = activeHub?.id === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setActiveHub(h);
                      if (onSelectHub) onSelectHub(h);
                    }}
                    className={`w-full p-3 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "bg-purple-600/20 border-purple-500 text-white shadow-lg"
                        : "bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{h.title}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className={`text-[9px] font-bold px-1.5 rounded-full ${h.source === "Moon" ? "bg-indigo-500/30 text-indigo-200" : "bg-blue-500/30 text-blue-200"}`}>{h.source || "LC"}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </span>
                    </div>
                    {h.creator && <span className="text-[11px] text-gray-400 block truncate mt-0.5">{h.creator}</span>}
                    <span className="text-[10px] font-mono text-purple-300/80 block mt-1 truncate">
                      {h.aap}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Hub Creator */}
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <Plus className="w-4 h-4" />
              <span>Create Quick Hub (Marva Stub)</span>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Hub Preferred Title *"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
              />
              <input
                type="text"
                placeholder="Hub Creator (Name, Dates)"
                value={newCreator}
                onChange={(e) => setNewCreator(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Key / Opus (e.g. op. 42)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                />
                <input
                  type="text"
                  placeholder="Language (e.g. Arabic)"
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateHub}
                disabled={!newTitle.trim() || saving}
                className="w-full py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? "Saving…" : "Save Hub in Moon"}
              </button>
              {message && <p className="text-[11px] text-purple-200 break-all">{message}</p>}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Active Hub Inspector & Metadata */}
        <div className="lg:col-span-2 space-y-4">
          {activeHub ? (
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-purple-500/20 space-y-5">
              {/* Hub Title Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
                      bf:Hub
                    </span>
                    <h2 className="text-lg font-bold text-white">{activeHub.title}</h2>
                  </div>
                  <span className="text-xs font-mono text-gray-400 mt-1 block select-all">
                    URI: {activeHub.uri}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyAAP(activeHub.aap)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40 transition-colors self-start"
                >
                  {copiedAAP ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAAP ? "AAP Copied!" : "Copy bflc:aap"}
                </button>
              </div>

              {/* AAP Displays */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                    bflc:aap (Authorized Access Point)
                  </span>
                  <p className="text-sm font-semibold text-white">{activeHub.aap}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    bflc:aap-normalized (Normalized for Collocation & Search)
                  </span>
                  <p className="text-xs font-mono text-gray-300">{activeHub.aapNormalized}</p>
                </div>
              </div>

              {/* Properties Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-gray-400 font-semibold">Creator / Agent:</span>
                  <p className="text-white font-medium">{activeHub.creator || "Anonymous / Unattributed"}</p>
                  {activeHub.creatorUri && (
                    <span className="text-[10px] font-mono text-purple-400 block truncate">{activeHub.creatorUri}</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-gray-400 font-semibold">Expression / Work Language:</span>
                  <p className="text-white font-medium">{activeHub.language || "Original language"}</p>
                </div>

                {activeHub.keyOrOpus && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-gray-400 font-semibold">Key or Opus Number:</span>
                    <p className="text-white font-medium">{activeHub.keyOrOpus}</p>
                  </div>
                )}

                {activeHub.mediumOfPerformance && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-gray-400 font-semibold">Medium of Performance:</span>
                    <p className="text-white font-medium">{activeHub.mediumOfPerformance}</p>
                  </div>
                )}
              </div>

              {/* RDF/XML Serialization Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400">Hub RDF/XML Representation (Primer Spec):</span>
                <pre className="p-3.5 rounded-2xl bg-black/60 border border-white/10 text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre">
{`<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:bf="http://id.loc.gov/ontologies/bibframe/"
  xmlns:bflc="http://id.loc.gov/ontologies/bflc/">
  
  <bf:Hub rdf:about="${activeHub.uri}">
    <bf:title>
      <bf:Title>
        <bf:mainTitle>${activeHub.title}</bf:mainTitle>
      </bf:Title>
    </bf:title>
    <bflc:aap>${activeHub.aap}</bflc:aap>
    <bflc:aap-normalized>${activeHub.aapNormalized}</bflc:aap-normalized>
  </bf:Hub>
</rdf:RDF>`}
                </pre>
              </div>

              {/* Action Link Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectHub) onSelectHub(activeHub);
                    setMessage(`This Work is now an expression of: ${activeHub.aap}`);
                  }}
                  className="w-full py-3 rounded-2xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  Link Current Work to this Hub (bf:expressionOf)
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              Select or create a Hub on the left to inspect its Authorized Access Point.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
