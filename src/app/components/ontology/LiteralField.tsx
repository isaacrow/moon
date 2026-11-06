/**
 * LiteralField Component
 * 
 * Renders a simple text input for literal values (strings, numbers, dates)
 */

import { OntologyProperty } from '../../../services/standardFields';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

interface LiteralFieldProps {
  property: OntologyProperty;
  value?: any;
  onChange: (value: string) => void;
  language?: 'en' | 'ar';
}

export function LiteralField({ property, value, onChange, language = 'en' }: LiteralFieldProps) {
  // Determine if this should be a textarea (for longer content)
  const isLongText = property.label.toLowerCase().includes('summary') ||
                     property.label.toLowerCase().includes('note') ||
                     property.label.toLowerCase().includes('contents') ||
                     property.label.toLowerCase().includes('description');

  const placeholder = language === 'ar' 
    ? `أدخل ${property.labelAr || property.label}...`
    : `Enter ${property.label.toLowerCase()}...`;

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const displayVal = typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(v => typeof v === 'string' ? v : (v?.['rdfs:label'] || v?.label || v?.value || v?.['@value'] || '')).filter(Boolean).join('\n')
      : value
        ? (value['bf:mainTitle'] || value.mainTitle || value['rdfs:label'] || value.label || value.value || value['@value'] || (typeof value === 'object' ? '' : String(value)))
        : '';

  if (isLongText) {
    return (
      <Textarea
        id={property.uri}
        value={displayVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px]"
        dir={direction}
      />
    );
  }

  return (
    <Input
      id={property.uri}
      type="text"
      value={displayVal}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={direction}
    />
  );
}
