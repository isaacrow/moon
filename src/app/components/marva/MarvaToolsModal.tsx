"use client";
import { useState } from "react";
import {
  X, QrCode, Hash, Replace, UserCheck, RefreshCw,
  Clock, Check, Copy, Sparkles} from "lucide-react";
import {
  generateMLCNumber, MLCNumberResult,
  generateNAR, NARRecordResult,
  simulateFolioSync, FolioSyncRecord,
  executeFindReplace, FindReplaceMatch,
  MarvaHistoryEntry
} from "../../../services/marvaService";

interface MarvaToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workData: any;
  instanceData: any;
  itemData?: any;
  hubData?: any;
  onUpdateData?: (updated: { work: any; instance: any; item?: any; hub?: any }) => void;
  historyEntries?: MarvaHistoryEntry[];
  onRevertHistory?: (entry: MarvaHistoryEntry) => void;
  isDark?: boolean;
}

export function MarvaToolsModal({
  isOpen,
  onClose,
  workData,
  instanceData,
  itemData,
  hubData,
  onUpdateData,
  historyEntries = [],
  onRevertHistory,
  isDark = true
}: MarvaToolsModalProps) {
  const [activeTab, setActiveTab] = useState<'scan' | 'mlc' | 'find-replace' | 'nar' | 'folio' | 'history'>('scan');

  // SCAN STATE
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);

  // MLC STATE
  const [mlcDimensions, setMlcDimensions] = useState(instanceData?.dimensions || '24 cm');
  const [mlcResult, setMlcResult] = useState<MLCNumberResult | null>(null);

  // FIND & REPLACE STATE
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [replaceMatches, setReplaceMatches] = useState<FindReplaceMatch[]>([]);
  const [replacedSuccess, setReplacedSuccess] = useState(false);

  // NAR STATE
  const [narName, setNarName] = useState(workData?.creator || '');
  const [narType, setNarType] = useState<'personal' | 'corporate'>('personal');
  const [narBirth, setNarBirth] = useState('');
  const [narDeath, setNarDeath] = useState('');
  const [narVariants, setNarVariants] = useState('');
  const [narResult, setNarResult] = useState<NARRecordResult | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<'marc' | 'mads' | null>(null);

  // FOLIO STATE
  const [folioRecord, setFolioRecord] = useState<FolioSyncRecord | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  // Scan simulation handler
  const handleSimulateScan = () => {
    if (!scanInput.trim()) return;
    const isIsbn = scanInput.replace(/[- ]/g, '').length >= 10;
    setScanResult({
      code: scanInput,
      type: isIsbn ? 'ISBN-13 / EAN' : 'LC Item Barcode',
      matchedTitle: workData?.mainTitle || 'Scanned Bibliographic Resource',
      scannedAt: new Date().toLocaleTimeString(),
      status: 'Verified against LC BFDB'
    });
  };

  // Generate MLC Number handler
  const handleGenerateMLC = () => {
    const res = generateMLCNumber({
      dimensions: mlcDimensions
    });
    setMlcResult(res);
  };

  const handleApplyMLC = () => {
    if (!mlcResult || !onUpdateData) return;
    const updatedInstance = {
      ...instanceData,
      lccn: mlcResult.lccn,
      shelfMark: mlcResult.callNumber
    };
    onUpdateData({
      work: workData,
      instance: updatedInstance,
      item: itemData,
      hub: hubData
    });
    alert(`Applied MLC Call Number: ${mlcResult.callNumber} to Instance!`);
  };

  // Find & Replace Handler
  const handleExecuteReplace = () => {
    if (!findText.trim() || !onUpdateData) return;
    const { updatedData, matches } = executeFindReplace(
      { work: workData, instance: instanceData, item: itemData, hub: hubData },
      findText,
      replaceText,
      matchCase
    );
    setReplaceMatches(matches);
    if (matches.length > 0) {
      onUpdateData(updatedData);
      setReplacedSuccess(true);
      setTimeout(() => setReplacedSuccess(false), 2000);
    }
  };

  // NAR Generation Handler
  const handleGenerateNAR = () => {
    if (!narName.trim()) return;
    const variants = narVariants.split('\n').map(s => s.trim()).filter(Boolean);
    const res = generateNAR({
      authorizedHeading: narName,
      type: narType,
      birthDate: narBirth,
      deathDate: narDeath,
      variantNames: variants,
      sourceTitle: workData?.mainTitle,
      sourceUri: workData?.uri
    });
    setNarResult(res);
  };

  const copyToClipboard = (text: string, format: 'marc' | 'mads') => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 1500);
  };

  // Folio Sync Handler
  const handleFolioSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const res = simulateFolioSync(workData?.mainTitle, instanceData?.lccn);
      setFolioRecord(res);
      setIsSyncing(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border ${
          isDark ? "bg-[#0c121e]/95 border-white/10 text-white" : "bg-white/95 border-gray-200 text-gray-900"
        }`}
        style={{ backdropFilter: "blur(20px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Marva Tools Suite</h2>
              <p className="text-xs text-gray-400">Library of Congress Operational Cataloging Toolkit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-6 bg-white/[0.02] overflow-x-auto">
          {[
            { id: 'scan', label: 'Marva Scan', icon: QrCode },
            { id: 'mlc', label: 'MLC Numbers', icon: Hash },
            { id: 'find-replace', label: 'Find & Replace', icon: Replace },
            { id: 'nar', label: 'Create NAR', icon: UserCheck },
            { id: 'folio', label: 'FOLIO Sync', icon: RefreshCw },
            { id: 'history', label: 'History Log', icon: Clock }
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                  active
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6">
          {/* TAB 1: MARVA SCAN */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <QrCode className="w-4 h-4" />
                  <span>Barcode & ISBN Optical Scanner (Marva Scan)</span>
                </div>
                <p className="text-xs text-gray-400">
                  Scan or paste a physical item barcode or ISBN-10/13 to query the Library of Congress catalog and populate item inventory.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter ISBN or Item Barcode (e.g. 9780140449136 or 300010482910)"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:border-sky-500 outline-none font-mono"
                  />
                  <button
                    onClick={handleSimulateScan}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                  >
                    Scan / Lookup
                  </button>
                </div>
              </div>

              {scanResult && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">Scan Match Found</span>
                    <span className="text-[10px] text-gray-400">{scanResult.scannedAt}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">Code:</span> <span className="font-mono text-white">{scanResult.code}</span></div>
                    <div><span className="text-gray-400">Format:</span> <span className="text-white">{scanResult.type}</span></div>
                    <div className="col-span-2"><span className="text-gray-400">Resource:</span> <span className="text-emerald-300 font-semibold">{scanResult.matchedTitle}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MLC NUMBERS */}
          {activeTab === 'mlc' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                  <Hash className="w-4 h-4" />
                  <span>Library of Congress Minimal Level Cataloging (MLC) Numbers</span>
                </div>
                <p className="text-xs text-gray-400">
                  Assign official LC MLC shelf numbers and sequential LCCNs. Evaluates item dimensions for oversize/folio classification.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Dimensions (e.g. 24 cm, 32 cm)</label>
                    <input
                      type="text"
                      value={mlcDimensions}
                      onChange={(e) => setMlcDimensions(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateMLC}
                      className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      Generate MLC Number
                    </button>
                  </div>
                </div>
              </div>

              {mlcResult && (
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">Generated LC Classification Number</span>
                    {mlcResult.isOversize && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Oversize / Folio
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Call Number:</span>
                      <span className="text-white font-bold">{mlcResult.callNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sequential LCCN:</span>
                      <span className="text-indigo-400 font-bold">{mlcResult.lccn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Shelving:</span>
                      <span className="text-gray-300">{mlcResult.shelfLocation}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleApplyMLC}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply MLC Number to Record
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FIND & REPLACE */}
          {activeTab === 'find-replace' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <Replace className="w-4 h-4" />
                  <span>Global Record Find & Replace</span>
                </div>
                <p className="text-xs text-gray-400">
                  Searches all literals across Work, Instance, Item, and Hub entities simultaneously.
                </p>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Find text:</label>
                    <input
                      type="text"
                      placeholder="String to find..."
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Replace with:</label>
                    <input
                      type="text"
                      placeholder="Replacement text..."
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={matchCase}
                        onChange={(e) => setMatchCase(e.target.checked)}
                        className="rounded accent-sky-500"
                      />
                      Match case exactly
                    </label>
                    <button
                      onClick={handleExecuteReplace}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                    >
                      Execute Replace All
                    </button>
                  </div>
                </div>
              </div>

              {replacedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold animate-fadeIn">
                  Replaced {replaceMatches.length} occurrence(s) successfully across record graph!
                </div>
              )}

              {replaceMatches.length > 0 && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs max-h-40 overflow-y-auto">
                  <span className="text-gray-400 font-bold block mb-1">Changes Applied:</span>
                  {replaceMatches.map((m, i) => (
                    <div key={i} className="text-[11px] text-gray-300 border-b border-white/5 pb-1">
                      <span className="uppercase text-sky-400 font-bold font-mono">[{m.entity}::{m.field}]</span>: "{m.currentValue}" → <span className="text-emerald-400 font-semibold">"{m.replacedValue}"</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CREATE NAR */}
          {activeTab === 'nar' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                  <UserCheck className="w-4 h-4" />
                  <span>Name Authority Record (NAR) Creator (NACO Compliant)</span>
                </div>
                <p className="text-xs text-gray-400">
                  Generate a complete LCNAF MARC 21 Authority record (tag 100/110) and MADS/RDF entity directly from this record's creator.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Authorized Name Heading</label>
                    <input
                      type="text"
                      value={narName}
                      onChange={(e) => setNarName(e.target.value)}
                      placeholder="e.g. Al-Jawahiri, Muhammad Mahdi"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Entity Type</label>
                    <select
                      value={narType}
                      onChange={(e) => setNarType(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    >
                      <option value="personal">Personal Name (100)</option>
                      <option value="corporate">Corporate Body (110)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Birth Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 1899"
                      value={narBirth}
                      onChange={(e) => setNarBirth(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Death Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 1997"
                      value={narDeath}
                      onChange={(e) => setNarDeath(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Variant Names (400 see-from references, 1 per line)</label>
                    <textarea
                      rows={2}
                      placeholder="Jawahiri, Mahdi&#10;الجواهري، محمد مهدي"
                      value={narVariants}
                      onChange={(e) => setNarVariants(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleGenerateNAR}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  Generate NACO Authority Record
                </button>
              </div>

              {narResult && (
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">Authorized Access Point: {narResult.authorizedAccessPoint}</span>
                    <span className="text-[10px] font-mono text-gray-400">LCCN: {narResult.lccn}</span>
                  </div>

                  {/* MARC21 Authority Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-semibold">MARC 21 Authority View:</span>
                      <button
                        onClick={() => copyToClipboard(narResult.marc21Text, 'marc')}
                        className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedFormat === 'marc' ? 'Copied!' : 'Copy MARC'}
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre">
                      {narResult.marc21Text}
                    </pre>
                  </div>

                  {/* MADS/RDF Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-semibold">MADS/RDF Linked Data View:</span>
                      <button
                        onClick={() => copyToClipboard(narResult.madsRdfXml, 'mads')}
                        className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedFormat === 'mads' ? 'Copied!' : 'Copy MADS/RDF'}
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/50 border border-white/10 text-[10px] font-mono text-gray-300 max-h-36 overflow-y-auto whitespace-pre">
                      {narResult.madsRdfXml}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FOLIO SYNC */}
          {activeTab === 'folio' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <RefreshCw className="w-4 h-4" />
                  <span>FOLIO ILS Inventory Synchronization (Marva FOLIO Sync)</span>
                </div>
                <p className="text-xs text-gray-400">
                  Simulates bidirectional syncing between the Marva BIBFRAME editor and the Library of Congress FOLIO Inventory database.
                </p>

                <button
                  onClick={handleFolioSync}
                  disabled={isSyncing}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Synchronizing with FOLIO Inventory...' : 'Sync Current Record to FOLIO'}
                </button>
              </div>

              {folioRecord && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">FOLIO Inventory Status</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {folioRecord.syncStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-black/40 border border-white/10 font-mono">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Instance HRID:</span>
                      <span className="text-amber-400 font-bold">{folioRecord.instanceHrid}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Holdings HRID:</span>
                      <span className="text-white font-bold">{folioRecord.holdingsHrid}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Item Barcode:</span>
                      <span className="text-white">{folioRecord.itemBarcode}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Item Status:</span>
                      <span className="text-emerald-300">{folioRecord.status}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 block text-[10px]">Effective Shelving Location:</span>
                      <span className="text-gray-200">{folioRecord.effectiveLocation}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: HISTORY LOG */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <Clock className="w-4 h-4" />
                  <span>Marva Cataloging History & Audit Trail</span>
                </div>
                <span className="text-[11px] text-gray-400">{historyEntries.length} logged events</span>
              </div>

              {historyEntries.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-500">
                  No cataloging edits logged yet in this session. Edits to fields will automatically appear here with 1-click restore.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-gray-400">{entry.timestamp}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 uppercase">
                            {entry.entity}::{entry.field}
                          </span>
                        </div>
                        <p className="text-gray-300 text-xs">{entry.description}</p>
                      </div>
                      {onRevertHistory && (
                        <button
                          onClick={() => onRevertHistory(entry)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
