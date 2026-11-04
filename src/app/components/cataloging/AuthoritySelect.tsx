/**
 * AuthoritySelect Component
 * Autocomplete search for LOC, VIAF, and Wikidata authorities
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Globe, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthorityResult } from '../../../services/authoritySearch';

interface AuthoritySelectProps {
  label: string;
  value: any;
  onChange: (value: AuthorityResult | null) => void;
  // Local vocabularies answer at once; LC and other services answer with a promise.
  onSearch: (query: string) => Promise<AuthorityResult[]> | AuthorityResult[];
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
  isLight?: boolean;
  /** A short tag beside the selected value, e.g. that it was pre-filled from LC's profile; `noteTitle` explains it on hover. */
  note?: string;
  noteTitle?: string;
}

export function AuthoritySelect({
  label,
  value,
  onChange,
  onSearch,
  placeholder = 'Search authorities...',
  required = false,
  allowCustom = false,
  isLight = false,
  note,
  noteTitle,
}: AuthoritySelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AuthorityResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; inputHeight: number } | null>(null);

  // Update dropdown position when open
  useEffect(() => {
    if (!isOpen || !inputRef.current) {
      setDropdownPos(null);
      return;
    }
    const updatePos = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        inputHeight: rect.height,
      });
    };
    updatePos();
    // Update on scroll/resize since we use fixed positioning
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isOpen, results.length, query]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await onSearch(query);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Authority search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: AuthorityResult) => {
    onChange(result);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'LOC':
        return <Database className="h-3 w-3" />;
      case 'VIAF':
        return <Globe className="h-3 w-3" />;
      case 'Wikidata':
        return <Globe className="h-3 w-3" />;
      default:
        return <Database className="h-3 w-3" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'LOC':
        return 'bg-blue-500';
      case 'VIAF':
        return 'bg-green-500';
      case 'Wikidata':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const { t } = useTranslation();

  const displayValue = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'string') {
      return {
        label: value,
        uri: value.startsWith('http') ? value : '',
        source: value.includes('loc.gov') ? 'LOC' : 'Custom',
        description: undefined
      };
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      const first = value[0];
      const allLabels = value.map(v => typeof v === 'string' ? v : (v?.label || v?.['rdfs:label'] || v?.name || v?.['@id'] || '')).filter(Boolean);
      return {
        label: allLabels.join(', ') || 'Selected',
        uri: typeof first === 'string' ? (first.startsWith('http') ? first : '') : (first?.uri || first?.['@id'] || ''),
        source: (typeof first === 'object' && first?.source) || 'LOC',
        description: undefined
      };
    }
    const label = value.label || value['rdfs:label'] || value.name || (value['@id'] ? value['@id'].split('/').pop() : '');
    const uri = value.uri || value['@id'] || '';
    if (!label && !uri) return null;
    return {
      label: label || uri,
      uri: uri,
      source: value.source || (uri.includes('loc.gov') ? 'LOC' : 'Custom'),
      description: value.description
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold" style={{ color: isLight ? "rgba(15,23,42,0.9)" : "#f8fafc" }}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Selected Value Display */}
      {displayValue ? (
        <div
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{
            background: isLight ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.18)",
            border: isLight ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(59,130,246,0.4)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: isLight ? "rgba(15,23,42,0.92)" : "#ffffff" }}>{displayValue.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs text-white flex items-center gap-1 ${getSourceColor(displayValue.source)}`}>
                {getSourceIcon(displayValue.source)}
                {displayValue.source}
              </span>
              {note && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  title={noteTitle}
                  style={{ color: isLight ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.75)", border: isLight ? "1px dashed rgba(15,23,42,0.3)" : "1px dashed rgba(255,255,255,0.4)" }}
                >
                  {note}
                </span>
              )}
            </div>
            {displayValue.uri && <div className="text-xs mt-1 font-mono" style={{ color: isLight ? "rgba(30,64,175,0.85)" : "#93c5fd" }}>{displayValue.uri}</div>}
            {displayValue.description && (
              <div className="text-xs mt-1" style={{ color: isLight ? "rgba(15,23,42,0.55)" : "#cbd5e1" }}>{displayValue.description}</div>
            )}
          </div>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
            style={{ color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)" }}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{
                background: isLight ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)",
                border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                color: isLight ? "#0f172a" : "#ffffff",
              }}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* Results Dropdown — rendered via portal to escape overflow clipping */}
          {isOpen && results.length > 0 && dropdownPos && createPortal(
            <>
              <div className="fixed inset-0" style={{ zIndex: 1000001 }} onClick={() => setIsOpen(false)} />
              <div
                ref={dropdownRef}
                className="rounded-xl max-h-80 overflow-y-auto"
                style={{
                  position: 'fixed',
                  top: dropdownPos.top + dropdownPos.inputHeight + 4,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 1000002,
                }}
              >
                {results.map((result, index) => (
                  <button
                    key={`${result.source}-${result.uri || index}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className="w-full text-left px-4 py-3 transition-colors last:rounded-b-xl first:rounded-t-xl"
                    style={{
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      background: index === selectedIndex ? "rgba(59,130,246,0.08)" : "transparent",
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: "rgba(0,0,0,0.85)" }}>{result.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs text-white flex items-center gap-1 ${getSourceColor(result.source)}`}>
                            {getSourceIcon(result.source)}
                            {result.source}
                          </span>
                        </div>
                        {result.description && (
                          <div className="text-sm mt-1" style={{ color: "rgba(0,0,0,0.55)" }}>{result.description}</div>
                        )}
                        <div className="text-xs mt-1 font-mono truncate" style={{ color: "rgba(0,0,0,0.35)" }}>{result.uri}</div>
                      </div>
                      {index === selectedIndex && (
                        <Check className="h-5 w-5 flex-shrink-0" style={{ color: "rgba(59,130,246,0.8)" }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}

          {/* No Results — rendered via portal */}
          {isOpen && !loading && query.length >= 2 && results.length === 0 && dropdownPos && createPortal(
            <>
              <div className="fixed inset-0" style={{ zIndex: 1000001 }} onClick={() => setIsOpen(false)} />
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  position: 'fixed',
                  top: dropdownPos.top + dropdownPos.inputHeight + 4,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)",
                  color: "rgba(0,0,0,0.5)",
                  zIndex: 1000002,
                }}
              >
                {t('editor.noAuthoritiesFound')} "{query}"
                {allowCustom && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        onChange({
                          label: query,
                          uri: '', // a local entry is a labelled value, not a link to a page that does not exist
                          source: 'Local'
                        });
                        setQuery('');
                        setIsOpen(false);
                      }}
                      className="text-sm font-semibold"
                      style={{ color: "rgba(59,130,246,0.85)" }}
                      type="button"
                    >
                      {t('editor.createLocalAuthority')}: "{query}"
                    </button>
                  </div>
                )}
              </div>
            </>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-Select Authority Component
 */
interface AuthorityMultiSelectProps {
  label: string;
  values: AuthorityResult[];
  onChange: (values: AuthorityResult[]) => void;
  // Local vocabularies answer at once; LC and other services answer with a promise.
  onSearch: (query: string) => Promise<AuthorityResult[]> | AuthorityResult[];
  placeholder?: string;
  maxItems?: number;
}

export function AuthorityMultiSelect({
  label,
  values,
  onChange,
  onSearch,
  placeholder = 'Search and add...',
  maxItems = 10
}: AuthorityMultiSelectProps) {
  const [tempValue, setTempValue] = useState<AuthorityResult | null>(null);

  const handleAdd = (value: AuthorityResult | null) => {
    if (!value) return;
    
    // Check if already exists
    if (values.some(v => v.uri === value.uri)) {
      setTempValue(null);
      return;
    }

    // Check max items
    if (values.length >= maxItems) {
      setTempValue(null);
      return;
    }

    onChange([...values, value]);
    setTempValue(null);
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>

      {/* Selected Values */}
      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((value, index) => (
            <div key={`${value.uri}-${index}`} className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{value.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs text-white ${
                    value.source === 'LOC' ? 'bg-blue-500' :
                    value.source === 'VIAF' ? 'bg-green-500' :
                    value.source === 'Wikidata' ? 'bg-orange-500' : 'bg-gray-500'
                  }`}>
                    {value.source}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono truncate">{value.uri}</div>
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New */}
      {values.length < maxItems && (
        <AuthoritySelect
          label=""
          value={tempValue}
          onChange={handleAdd}
          onSearch={onSearch}
          placeholder={placeholder}
          allowCustom
        />
      )}
    </div>
  );
}