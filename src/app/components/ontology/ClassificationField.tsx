/**
 * ClassificationField Component
 * 
 * Handles both LCC and DDC classification with all subfields
 */

import React from 'react';
import { OntologyProperty } from '../../services/bibframeOntologyEngine';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';

interface ClassificationFieldProps {
  property: OntologyProperty;
  value?: any[];
  onChange: (value: any[]) => void;
  language?: 'en' | 'ar';
}

export function ClassificationField({ property, value = [], onChange, language = 'en' }: ClassificationFieldProps) {
  const isLCC = property.label.includes('Library of Congress');
  const isDDC = property.label.includes('Dewey');

  // Ensure value is always an array of normalized classification objects
  const safeValue = React.useMemo(() => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(item => {
      if (typeof item === 'string') {
        const parts = item.trim().split(' ');
        return {
          '@type': isLCC ? 'bf:ClassificationLcc' : 'bf:ClassificationDdc',
          'bf:classificationPortion': parts[0] || item,
          'bf:itemPortion': parts.slice(1).join(' ') || ''
        };
      }
      return {
        ...item,
        'bf:classificationPortion': item['bf:classificationPortion'] || item.classificationPortion || item.number || '',
        'bf:itemPortion': item['bf:itemPortion'] || item.itemPortion || ''
      };
    });
  }, [value, isLCC]);

  const addClassification = () => {
    const newClassification = isLCC 
      ? {
          '@type': 'bf:ClassificationLcc',
          'bf:classificationPortion': '',
          'bf:itemPortion': ''
        }
      : {
          '@type': 'bf:ClassificationDdc',
          'bf:classificationPortion': '',
          'bf:edition': ''
        };
    
    onChange([...safeValue, newClassification]);
  };

  const updateClassification = (index: number, field: string, val: any) => {
    const updated = [...safeValue];
    updated[index] = { ...updated[index], [field]: val };
    // An emptied box removes the property instead of publishing an empty value.
    if (val === '' || (val && typeof val === 'object' && !val['@id'])) delete updated[index][field];
    onChange(updated);
  };

  const removeClassification = (index: number) => {
    onChange(safeValue.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {safeValue.map((classification, index) => (
        <div key={index} className="p-5 rounded-2xl space-y-3 transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(16px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.25), inset 0 0 12px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.25)',
          }}>
          <div className="flex items-center justify-between mb-2">
            <span
              style={{
                borderRadius: '120px',
                background: 'rgba(255, 255, 255, 0.21)',
                backdropFilter: 'blur(4.5px) blur(9px) saturate(1.5) brightness(1.1)',
                WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
              className="px-3.5 py-1 text-xs font-bold text-white tracking-wide"
            >
              {isLCC ? 'LCC' : 'DDC'} #{index + 1}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeClassification(index)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isLCC ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">
                    {language === "ar" ? "رقم التصنيف" : "Classification number"}
                    <Badge variant="outline" className="ml-2 text-xs">050 $a</Badge>
                  </Label>
                  <Input
                    value={classification['bf:classificationPortion'] || classification.classificationPortion || classification.number || ''}
                    onChange={(e) => updateClassification(index, 'bf:classificationPortion', e.target.value)}
                    placeholder="e.g., TT820"
                    className="mt-1 font-mono"
                  />
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "رقم تصنيف الكونغرس الرئيسي" : "Main LCC class number"}</div>
                </div>

                <div>
                  <Label className="text-sm">
                    {language === "ar" ? "رقم كتر / المادة" : "Cutter / item number"}
                    <Badge variant="outline" className="ml-2 text-xs">050 $b</Badge>
                  </Label>
                  <Input
                    value={classification['bf:itemPortion'] || ''}
                    onChange={(e) => updateClassification(index, 'bf:itemPortion', e.target.value)}
                    placeholder="e.g., .B877 2002"
                    className="mt-1 font-mono"
                  />
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "رقم كتر وتاريخ النشر" : "Cutter number and date"}</div>
                </div>
              </div>

              <div>
                <Label className="text-sm">{language === "ar" ? "جهة تعيين التصنيف" : "Classification assigner"}</Label>
                <Input
                  value={(classification['bf:assigner'] ?? classification['bf:source'])?.['@id'] || ''}
                  // The agency that assigned the number is bf:assigner (LC: organizations/dlc); bf:source is the scheme.
                  onChange={(e) => updateClassification(index, 'bf:assigner', { '@id': e.target.value.trim() })}
                  placeholder="Search organizations... (id.loc.gov/vocabulary/organizations)"
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {language === "ar" ? "المؤسسة أو المكتبة المسندة للتصنيف" : "Organization that assigned the classification"}
                </div>
              </div>

              <div>
                <Label className="text-sm">{language === "ar" ? "حالة التصنيف" : "Classification status"}</Label>
                <select
                  value={classification['bf:status'] || ''}
                  onChange={(e) => updateClassification(index, 'bf:status', e.target.value)}
                  className="w-full p-2 border rounded-md mt-1"
                >
                  <option value="">{language === "ar" ? "اختر الحالة..." : "Select status..."}</option>
                  <option value="used">{language === "ar" ? "مستخدم لدى الوكالة المسندة" : "Used by assigning agency"}</option>
                  <option value="assigned">{language === "ar" ? "معين من قبل مكتبة الكونغرس" : "Assigned by LC"}</option>
                  <option value="obsolete">{language === "ar" ? "ملغى / قديم" : "Obsolete"}</option>
                  <option value="canceled">{language === "ar" ? "باطل / غير صالح" : "Canceled/invalid"}</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">
                    {language === "ar" ? "تصنيف ديوي" : "Dewey number"}
                    <Badge variant="outline" className="ml-2 text-xs">082 $a</Badge>
                  </Label>
                  <Input
                    value={classification['bf:classificationPortion'] || classification.classificationPortion || classification.number || ''}
                    onChange={(e) => updateClassification(index, 'bf:classificationPortion', e.target.value)}
                    placeholder="e.g., 746.43/2041"
                    className="mt-1 font-mono"
                  />
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "رقم تصنيف ديوي العشري" : "DDC classification number"}</div>
                </div>

                <div>
                  <Label className="text-sm">
                    {language === "ar" ? "الطبعة" : "Edition"}
                    <Badge variant="outline" className="ml-2 text-xs">082 $2</Badge>
                  </Label>
                  <Input
                    value={classification['bf:edition'] || ''}
                    onChange={(e) => updateClassification(index, 'bf:edition', e.target.value)}
                    placeholder="e.g., 21, 22, 23"
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "رقم طبعة ديوي" : "DDC edition number"}</div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addClassification}
        className="w-full py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        style={{
          borderRadius: '120px',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
          WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.4), inset 0 0 12px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <Plus className="h-4 w-4" />
        <span>Add {isLCC ? 'LCC' : 'DDC'} Classification</span>
      </button>
    </div>
  );
}
