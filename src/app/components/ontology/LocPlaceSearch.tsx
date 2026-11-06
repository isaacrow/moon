/**
 * LocPlaceSearch Component
 * 
 * Searches the Library of Congress Geographic Names
 * Returns proper bf:Place entities with URIs, not just strings
 */

import React, { useState } from 'react';
import { OntologyProperty } from '../../../services/standardFields';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Search, Plus, X, MapPin } from 'lucide-react';
import { searchLocPlaces } from '../../services/locService';

interface LocPlaceSearchProps {
  property: OntologyProperty;
  value?: any | any[];
  onChange: (value: any | any[]) => void;
  language?: 'en' | 'ar';
}

export function LocPlaceSearch({ property, value, onChange, language = 'en' }: LocPlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Determine if this property is repeatable
  const isRepeatable = property.repeatable !== false;
  const valueArray = isRepeatable ? (Array.isArray(value) ? value : (value ? [value] : [])) : [];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setShowResults(true);
    try {
      const data = await searchLocPlaces(query);
      setResults(data.hits || []);
    } catch (error) {
      console.error('Error searching LOC Places:', error);
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

  const addPlace = (place: any) => {
    const placeEntity = {
      '@type': 'bf:Place',
      '@id': place.uri,
      'rdfs:label': place.aLabel || place.suggestLabel
    };

    if (isRepeatable) {
      onChange([...valueArray, placeEntity]);
    } else {
      onChange(placeEntity);
    }
    
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const removePlace = (index: number) => {
    if (isRepeatable) {
      onChange(valueArray.filter((_, i) => i !== index));
    } else {
      onChange(null);
    }
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
            placeholder={language === 'ar' ? 'ابحث عن مكان...' : 'Search geographic names...'}
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
              onClick={() => addPlace(result)}
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="font-medium text-sm flex items-center gap-1.5" dir="auto">
                    <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold ${result.source === 'Moon' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>{result.source === 'Moon' ? 'Moon' : result.source && result.source !== 'LOC' ? result.source : 'LC'}</span>
                    {result.aLabel || result.suggestLabel}
                  </div>
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

      {/* Selected Places */}
      {isRepeatable ? (
        valueArray.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selected Places:
            </div>
            {valueArray.map((place, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">
                      {place['rdfs:label']}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      LOC
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                    {place['@id']}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removePlace(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )
      ) : (
        value && (
          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm">
                  {value['rdfs:label']}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                {value['@id']}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removePlace(0)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  );
}
