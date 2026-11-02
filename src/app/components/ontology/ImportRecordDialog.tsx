/**
 * Import Record Dialog
 * 
 * Allows importing BIBFRAME records from XML, RDF, JSON-LD files with Liquid Glass Design
 */

import React, { useState } from 'react';
import { Upload, FileJson, FileCode, FileText, X } from 'lucide-react';
import { importBibframe, ImportFormat } from '../../../services/bibframeImport';

interface ImportRecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (workData: any, instanceData: any, itemData?: any) => void;
}

export function ImportRecordDialog({ isOpen, onClose, onImport }: ImportRecordDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<'jsonld' | 'xml' | 'rdf' | null>(null);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');

    // Determine file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'json' || extension === 'jsonld') {
      setFileType('jsonld');
    } else if (extension === 'xml' || extension === 'rdf' || extension === 'marcxml') {
      setFileType('xml');
    } else if (extension === 'ttl' || extension === 'n3' || extension === 'nt') {
      setFileType('rdf');
    } else {
      setError('Unsupported file type. Please use JSON-LD, Turtle or N-Triples.');
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    try {
      if (fileType === 'xml') {
        setError('RDF/XML and MARCXML import is not available yet. Please export the record as JSON-LD, Turtle or N-Triples.');
        return;
      }
      // Any BIBFRAME description: LC's id.loc.gov records, Moon exports, Turtle or N-Triples.
      const format: ImportFormat = fileType === 'jsonld' ? 'jsonld' : selectedFile?.name.toLowerCase().endsWith('.nt') ? 'ntriples' : 'turtle';
      const record = await importBibframe(fileContent, format);
      if (!record || (Object.keys(record.work).length <= 1 && Object.keys(record.instance).length <= 1)) {
        setError('No BIBFRAME Work or Instance found in file');
        return;
      }
      onImport(record.work, record.instance, record.item);
      onClose();
    } catch (err) {
      setError(`Error parsing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div 
        className="w-full max-w-xl mx-auto rounded-3xl overflow-hidden transition-all text-white border border-white/20"
        style={{
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(30px) saturate(1.8) brightness(1.1)',
          WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.15), 0 20px 50px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white drop-shadow-sm flex items-center gap-2">
            Import BIBFRAME Record
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-white/80">
            Import a BIBFRAME record (JSON-LD, Turtle or N-Triples — including id.loc.gov records) into MOON.
          </p>

          {/* File Upload Drop Area */}
          <div 
            className="border-2 border-dashed border-white/30 rounded-2xl p-8 hover:border-white/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".json,.jsonld,.ttl,.n3,.nt,.xml,.rdf,.marcxml"
              onChange={handleFileSelect}
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center cursor-pointer w-full"
            >
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.21)',
                  backdropFilter: 'blur(4.5px) blur(9px) saturate(1.5) brightness(1.1)',
                  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.25)',
                  borderRadius: '120px'
                }}
              >
                <Upload className="h-7 w-7 text-white" />
              </div>
              <span className="text-base font-semibold text-white drop-shadow">
                Click to upload or drag and drop
              </span>
              <span className="text-xs text-white/60 mt-1 font-mono">
                JSON-LD, XML, RDF, Turtle
              </span>
            </label>
          </div>

          {/* Selected File */}
          {selectedFile && (
            <div 
              className="p-4 rounded-2xl border border-white/20 flex items-center gap-3"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)'
              }}
            >
              {fileType === 'jsonld' && <FileJson className="h-6 w-6 text-cyan-300" />}
              {fileType === 'xml' && <FileText className="h-6 w-6 text-amber-300" />}
              {fileType === 'rdf' && <FileCode className="h-6 w-6 text-purple-300" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="text-xs text-white/70">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Preview */}
          {fileContent && !error && fileType === 'jsonld' && (
            <div>
              <h3 className="text-xs font-semibold text-white/80 mb-1.5 uppercase tracking-wider">
                Preview:
              </h3>
              <pre className="bg-black/40 border border-white/10 text-emerald-300 p-3 rounded-xl overflow-auto max-h-40 text-xs font-mono">
                {fileContent.substring(0, 400)}
                {fileContent.length > 400 && '\n...(truncated)'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer"
            style={{
              borderRadius: '120px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedFile || !!error}
            className="px-6 py-2.5 text-xs font-black text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center gap-2"
            style={{
              borderRadius: '120px',
              background: 'rgba(255, 255, 255, 0.21)',
              backdropFilter: 'blur(4.5px) blur(9px) saturate(1.5) brightness(1.1)',
              WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}
          >
            <Upload className="h-4 w-4" />
            <span>Import Record</span>
          </button>
        </div>
      </div>
    </div>
  );
}
