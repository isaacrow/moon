/**
 * LocSubjectSearch Component
 * 
 * Searches the Library of Congress Subject Headings (LCSH)
 * Returns proper URIs for subject terms
 */

import React, { useState } from 'react';
import { OntologyProperty } from '../../services/bibframeOntologyEngine';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Search, Plus, X, Tag } from 'lucide-react';
import { searchLocSubjects } from '../../services/locService';

interface LocSubjectSearchProps {
  property: OntologyProperty;
  value?: any[];
  onChange: (value: any[]) => void;
  language?: 'en' | 'ar';
}

export function LocSubjectSearch({ property, value = [], onChange, language = 'en' }: LocSubjectSearchProps) {
  // Ensure value is always an array of normalized subjects
  const safeValue = React.useMemo(() => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(item => {
      if (typeof item === 'string') {
        return {
          '@type': 'bf:Topic',
          'rdfs:label': item,
          '@id': ''
        };
      }
      const label = item['rdfs:label'] || item.label || item.name || item['@id'] || '';
      return {
        ...item,
        '@type': item['@type'] || 'bf:Topic',
        'rdfs:label': typeof label === 'object' ? (label?.['@value'] || '') : String(label),
        '@id': item['@id'] || item.uri || ''
      };
    });
  }, [value]);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setShowResults(true);
    try {
      const data = await searchLocSubjects(query);
      setResults(data.hits || []);
    } catch (error) {
      console.error('Error searching LOC Subjects:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const addSubject = (subject: any) => {
    const subjectEntity = {
      '@type': 'bf:Topic',
      '@id': subject.uri,
      'rdfs:label': subject.aLabel || subject.suggestLabel
    };

    onChange([...safeValue, subjectEntity]);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const removeSubject = (index: number) => {
    onChange(safeValue.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Search Interface */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={language === 'ar' ? 'ابحث في LCSH...' : 'Search Library of Congress Subject Headings...'}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        <Button onClick={handleSearch} disabled={searching} size="sm">
          {searching ? 'Searching...' : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search Results */}
      {showResults && results.length > 0 && (
        <div className="border rounded-md max-h-64 overflow-y-auto bg-white dark:bg-gray-800">
          {results.map((result, index) => (
            <div
              key={index}
              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0 cursor-pointer flex items-center justify-between"
              onClick={() => addSubject(result)}
            >
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-green-600" />
                <div>
                  <div className="font-medium text-sm">{result.aLabel || result.suggestLabel}</div>
                  {result.uri && (
                    <div className="text-xs text-gray-500 font-mono truncate max-w-md">
                      {result.uri}
                    </div>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !searching && (
        <div className="text-sm text-gray-500 text-center py-4 border rounded-md">
          No results found. Try a different search term.
        </div>
      )}

      {/* Selected Subjects */}
      {safeValue.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selected Subjects:
          </div>
          {safeValue.map((subject, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">
                    {subject['rdfs:label']}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    LCSH
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                  {subject['@id']}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeSubject(index)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
