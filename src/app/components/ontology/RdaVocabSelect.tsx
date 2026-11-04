/**
 * RdaVocabSelect Component
 * 
 * Provides dropdowns for RDA vocabularies (Content, Media, Carrier types)
 * Returns proper URIs from LOC RDA vocabularies
 */

import React from 'react';
import { OntologyProperty } from '../../services/bibframeOntologyEngine';
import { getRdaContentTypes, getRdaMediaTypes, getRdaCarrierTypes } from '../../services/locService';

interface RdaVocabSelectProps {
  property: OntologyProperty;
  value?: any;
  onChange: (value: any) => void;
  language?: 'en' | 'ar';
}

export function RdaVocabSelect({ property, value, onChange, language = 'en' }: RdaVocabSelectProps) {
  // Determine which RDA vocabulary to use
  let options: any[] = [];
  let type = '';

  if (property.label.includes('Content')) {
    options = getRdaContentTypes();
    type = 'bf:Content';
  } else if (property.label.includes('Media')) {
    options = getRdaMediaTypes();
    type = 'bf:Media';
  } else if (property.label.includes('Carrier')) {
    options = getRdaCarrierTypes();
    type = 'bf:Carrier';
  }

  const currentUri = typeof value === 'string'
    ? (options.find(opt => opt.uri === value || opt.code === value || opt.label.toLowerCase() === value.toLowerCase() || (value.includes('txt') && opt.code === 'txt') || (value.includes('نص') && opt.code === 'txt') || (value.includes('حاسوب') && opt.code === 'c') || (value.includes('مصدر') && opt.code === 'ck'))?.uri || value)
    : (value?.['@id'] || value?.id || value?.uri || '');
  const hasMatch = options.some(opt => opt.uri === currentUri);
  const fallbackLabel = typeof value === 'object' ? (value?.['rdfs:label'] || value?.label || currentUri) : (value || '');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = options.find(opt => opt.uri === e.target.value);
    
    if (selectedOption) {
      onChange({
        '@type': type,
        '@id': selectedOption.uri,
        'rdfs:label': selectedOption.label,
        'code': selectedOption.code
      });
    } else if (e.target.value) {
      onChange({
        '@type': type,
        '@id': e.target.value,
        'rdfs:label': fallbackLabel || e.target.value
      });
    } else {
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={currentUri || ''}
        onChange={handleChange}
        className="w-full p-2 border rounded-md"
      >
        <option value="">
          {language === 'ar' ? 'اختر...' : `Select ${property.label}...`}
        </option>
        {currentUri && !hasMatch && (
          <option value={currentUri}>
            {fallbackLabel}
          </option>
        )}
        {options.map((option) => (
          <option key={option.uri} value={option.uri}>
            {option.label} [{option.code}]
          </option>
        ))}
      </select>

      {value && (
        <div className="text-xs text-gray-500 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded border">
          <div><span className="font-semibold">URI / Label:</span> {typeof value === 'object' ? (value['@id'] || value['rdfs:label']) : value}</div>
          {typeof value === 'object' && value.code && <div><span className="font-semibold">Code:</span> {value.code}</div>}
        </div>
      )}
    </div>
  );
}
