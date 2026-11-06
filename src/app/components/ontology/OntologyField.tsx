/**
 * OntologyField Component
 * 
 * Dynamically renders a field based on its BIBFRAME ontology property definition.
 * Determines the appropriate component to use based on:
 * - valueType (literal vs entity)
 * - API (which LOC service to query)
 * - controlledVocabulary (whether it requires URI linking)
 */

import { useState } from 'react';
import { OntologyProperty } from '../../../services/standardFields';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { LocNameSearch } from './LocNameSearch';
import { LocSubjectSearch } from './LocSubjectSearch';
import { LocPlaceSearch } from './LocPlaceSearch';
import { RdaVocabSelect } from './RdaVocabSelect';
import { LiteralField } from './LiteralField';
import { EntityField } from './EntityField';
import { ClassificationField } from './ClassificationField';
import { HelpCircle } from 'lucide-react';

interface OntologyFieldProps {
  property: OntologyProperty;
  value?: any;
  onChange: (value: any) => void;
  language?: 'en' | 'ar';
  theme?: 'glass' | 'neon' | 'classic' | 'clean' | 'blur';
}

export function OntologyField({ property, value, onChange, language = 'en', theme = 'glass' }: OntologyFieldProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Determine which component to render based on the property configuration
  const renderField = () => {
    // Classification fields (LCC/DDC)
    if (property.label.includes('Classification')) {
      return <ClassificationField property={property} value={value} onChange={onChange} language={language} />;
    }

    // API-based fields (controlled vocabularies from LOC)
    if (property.api === 'loc-names') {
      return <LocNameSearch property={property} value={value} onChange={onChange} language={language} />;
    }

    if (property.api === 'loc-subjects') {
      return <LocSubjectSearch property={property} value={value} onChange={onChange} language={language} />;
    }

    if (property.api === 'loc-places' || property.api === 'loc-countries' || property.api === 'loc-geographicAreas') {
      return <LocPlaceSearch property={property} value={value} onChange={onChange} language={language} />;
    }

    if (property.api === 'rda-vocab') {
      return <RdaVocabSelect property={property} value={value} onChange={onChange} language={language} />;
    }

    if (property.api === 'iso639') {
      return <EntityField property={property} value={value} onChange={onChange} language={language} type="language" />;
    }

    // Entity fields (complex objects)
    if (property.valueType === 'entity') {
      return <EntityField property={property} value={value} onChange={onChange} language={language} />;
    }

    // Literal fields (simple text)
    return <LiteralField property={property} value={value} onChange={onChange} language={language} />;
  };

  const label = language === 'ar' && property.labelAr ? property.labelAr : property.label;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={property.uri} className="text-sm font-medium [.animated-gradient-bg-blue_&]:text-slate-100">
            {label}
            {property.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {/* MARC Tag Badge */}
          {property.marc.length > 0 && (
            <Badge variant="outline" className="text-xs font-mono [.animated-gradient-bg-blue_&]:text-slate-200 [.animated-gradient-bg-blue_&]:border-slate-500">
              {property.marc[0]}
            </Badge>
          )}

          {/* API Badge */}
          {property.api && (
            <Badge variant="secondary" className="text-xs [.animated-gradient-bg-blue_&]:bg-slate-700 [.animated-gradient-bg-blue_&]:text-slate-200">
              {property.api.toUpperCase()}
            </Badge>
          )}

          {/* Controlled Vocabulary Badge */}
          {property.controlledVocabulary && (
            <Badge className="text-xs bg-blue-600 [.animated-gradient-bg-blue_&]:text-white">
              LOD
            </Badge>
          )}
        </div>

        {/* Help Icon */}
        {property.description && (
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-gray-600"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Ontology URI Display */}
      <div className="text-gray-500 font-mono truncate text-[12px]" title={property.uri}>
        {property.uri.replace('http://id.loc.gov/ontologies/bibframe/', 'bf:')}
      </div>

      {/* Help Text */}
      {showHelp && property.description && (
        <div className="text-xs text-gray-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
          {property.description}
        </div>
      )}

      {/* Domain/Range Info */}
      {showHelp && (
        <div className="text-xs text-gray-500 space-y-1">
          <div><span className="font-semibold">Domain:</span> {property.domain.join(', ')}</div>
          <div><span className="font-semibold">Range:</span> {property.range.join(', ')}</div>
          {property.marc.length > 0 && (
            <div><span className="font-semibold">MARC:</span> {property.marc.join(', ')}</div>
          )}
        </div>
      )}

      {/* The Field Component */}
      {renderField()}
    </div>
  );
}