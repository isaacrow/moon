/**
 * LocNameSearch Component
 * 
 * Searches the Library of Congress Name Authority File (NAF)
 * Returns proper URIs for agents (persons, organizations)
 */

import React, { useState, useEffect } from 'react';
import { OntologyProperty } from '../../../services/standardFields';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Search, Plus, X, User, Building2 } from 'lucide-react';
import { searchLocNames, getRelators } from '../../services/locService';

interface LocNameSearchProps {
  property: OntologyProperty;
  value?: any[];
  onChange: (value: any[]) => void;
  language?: 'en' | 'ar';
}

interface Relator {
  code: string;
  uri: string;
  label: string;
}

export function LocNameSearch({ property, value = [], onChange, language = 'en' }: LocNameSearchProps) {
  // Ensure value is always an array of normalized contributions
  const safeValue = React.useMemo(() => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(item => {
      if (typeof item === 'string') {
        return {
          '@type': 'bf:PrimaryContribution',
          'bf:agent': {
            '@type': 'bf:Person',
            'rdfs:label': item,
          },
          'bf:role': {
            code: 'aut',
            'rdfs:label': 'مؤلف / Author',
          }
        };
      }
      const agentLabel = item['bf:agent']?.['rdfs:label'] || item.agent?.label || item.agent?.name || item.agent || item.label || item.name || '';
      const agentId = item['bf:agent']?.['@id'] || item.agent?.['@id'] || item.agent?.uri || item['@id'] || item.uri || '';
      const roleCode = item['bf:role']?.code || item['bf:role']?.['@id']?.split('/')?.pop() || item.role?.code || (typeof item.role === 'string' ? item.role : 'aut');
      const roleLabel = item['bf:role']?.['rdfs:label'] || item.role?.label || roleCode;

      return {
        ...item,
        'bf:agent': {
          '@type': item['bf:agent']?.['@type'] || 'bf:Agent',
          '@id': agentId,
          'rdfs:label': typeof agentLabel === 'object' ? (agentLabel?.['@value'] || '') : String(agentLabel),
        },
        'bf:role': {
          code: roleCode,
          'rdfs:label': typeof roleLabel === 'object' ? (roleLabel?.['@value'] || '') : String(roleLabel),
        }
      };
    });
  }, [value]);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState('aut');
  const [relators, setRelators] = useState<Relator[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadRelators();
  }, []);

  const loadRelators = async () => {
    const relatorsList = await getRelators();
    setRelators(relatorsList);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setShowResults(true);
    try {
      const data = await searchLocNames(query);
      setResults(data.hits || []);
    } catch (error) {
      console.error('Error searching LOC Names:', error);
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

  const addContribution = (agent: any) => {
    const relator = relators.find(r => r.code === selectedRole);
    
    const contribution = {
      '@type': 'bf:Contribution',
      'bf:agent': {
        '@id': agent.uri,
        'rdfs:label': agent.aLabel || agent.suggestLabel,
        '@type': agent.type || 'bf:Agent'
      },
      'bf:role': {
        '@id': relator?.uri || 'http://id.loc.gov/vocabulary/relators/aut',
        'rdfs:label': relator?.label || 'Author',
        'code': relator?.code || 'aut'
      }
    };

    onChange([...safeValue, contribution]);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const removeContribution = (index: number) => {
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
            placeholder={language === 'ar' ? 'ابحث في ملف الأسماء الاستنادي...' : 'Search LOC Name Authority File...'}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-3 border rounded-md text-sm"
        >
          {relators.map(r => (
            <option key={r.code} value={r.code}>
              {r.label} [{r.code}]
            </option>
          ))}
        </select>

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
              onClick={() => addContribution(result)}
            >
              <div className="flex items-center gap-3">
                {result.type?.includes('Person') ? (
                  <User className="h-4 w-4 text-blue-600" />
                ) : (
                  <Building2 className="h-4 w-4 text-purple-600" />
                )}
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

      {/* Selected Contributions */}
      {safeValue.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selected Contributors:
          </div>
          {safeValue.map((contribution, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {contribution['bf:agent']?.['rdfs:label']}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {contribution['bf:role']?.code}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                  {contribution['bf:agent']?.['@id']}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeContribution(index)}
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
