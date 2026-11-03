/**
 * EntityField Component
 * 
 * Renders a field for complex entity values (objects with @type and @id)
 */

import React, { useState } from 'react';
import { OntologyProperty } from '../../services/bibframeOntologyEngine';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { lookupIsbnDetailed, ISBNData } from '../../../services/authoritySearch';

interface EntityFieldProps {
  property: OntologyProperty;
  value?: any;
  onChange: (value: any) => void;
  language?: 'en' | 'ar';
  type?: string;
}

export function EntityField({ property, value, onChange, language = 'en', type }: EntityFieldProps) {
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const [isLoading, setIsLoading] = useState(false);
  const [isbnData, setIsbnData] = useState<ISBNData | null>(null);
  const [isbnNotice, setIsbnNotice] = useState<{ tone: 'error' | 'warn'; text: string } | null>(null);

  // Handle Title entity (bf:Title)
  if (property.range.includes('bf:Title')) {
    const mainTitleVal = typeof value === 'string'
      ? value
      : (value?.['bf:mainTitle'] || value?.mainTitle || value?.['rdfs:label'] || value?.label || '');
    const subtitleVal = typeof value === 'object' && value ? (value?.['bf:subtitle'] || value?.subtitle || '') : '';

    return (
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-gray-400">Main Title / العنوان الرئيسي</Label>
          <Input
            type="text"
            value={mainTitleVal}
            onChange={(e) => {
              const baseObj = (typeof value === 'object' && value) ? value : {};
              onChange({ ...baseObj, '@type': 'bf:Title', 'bf:mainTitle': e.target.value, mainTitle: e.target.value });
            }}
            placeholder={language === 'ar' ? 'العنوان الرئيسي' : 'Main title of the work'}
            dir={direction}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm text-gray-400">Subtitle (optional) / العنوان الفرعي</Label>
          <Input
            type="text"
            value={subtitleVal}
            onChange={(e) => {
              const baseObj = (typeof value === 'object' && value) ? value : {};
              onChange({ ...baseObj, '@type': 'bf:Title', 'bf:subtitle': e.target.value, subtitle: e.target.value });
            }}
            placeholder={language === 'ar' ? 'العنوان الفرعي' : 'Subtitle if applicable'}
            dir={direction}
            className="mt-1"
          />
        </div>
      </div>
    );
  }

  // Handle Classification entity
  if (property.label.includes('Classification')) {
    const lccVal = typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? (value[0]?.['bf:classificationPortion'] ? `${value[0]['bf:classificationPortion']} ${value[0]['bf:itemPortion'] || ''}`.trim() : (value[0]?.lcc || value[0]?.number || ''))
        : (value?.['bf:classificationPortion'] ? `${value['bf:classificationPortion']} ${value['bf:itemPortion'] || ''}`.trim() : (value?.lcc || value?.classification || ''));

    const ddcVal = typeof value === 'object' && value ? (value?.ddc || '') : '';

    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm text-gray-400">LCC (050)</Label>
          <Input
            type="text"
            value={lccVal}
            onChange={(e) => onChange({ ...((typeof value === 'object' && value) || {}), lcc: e.target.value, '@type': 'bf:ClassificationLcc' })}
            placeholder="e.g., PJ7846 .A46"
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-sm text-gray-400">DDC (082)</Label>
          <Input
            type="text"
            value={ddcVal}
            onChange={(e) => onChange({ ...((typeof value === 'object' && value) || {}), ddc: e.target.value, '@type': 'bf:ClassificationDdc' })}
            placeholder="e.g., 892.7"
            className="mt-1 font-mono"
          />
        </div>
      </div>
    );
  }

  // Handle Identifier entity
  if (property.label.includes('Identifier')) {
    const ar = language === 'ar';
    const handleIsbnLookup = async () => {
      const isbn = value?.isbn?.trim();
      if (!isbn) return;
      setIsLoading(true);
      setIsbnData(null);
      setIsbnNotice(null);
      try {
        const { data, isbn: info, unreachable } = await lookupIsbnDetailed(isbn);
        if (!info.valid) {
          setIsbnNotice({
            tone: 'error',
            text: info.problem === 'checksum'
              ? (ar ? 'رقم الردمك غير صحيح: رقم التحقق لا يطابق. راجع الأرقام.' : 'Not a valid ISBN: the check digit does not match. Please re-check the digits.')
              : (ar ? 'الردمك يجب أن يتكون من 10 أو 13 رقماً.' : 'An ISBN has 10 or 13 digits.'),
          });
          return;
        }
        // Store the ISBN the way LC does: digits only, ISBN-13 when there is one.
        const normalized = info.isbn13 || info.digits;
        if (!data) {
          onChange({ ...value, isbn: normalized, '@type': 'bf:Isbn' });
          setIsbnNotice({
            tone: 'warn',
            text: unreachable.length
              ? (ar ? `لم يتم العثور على الكتاب، وتعذر الوصول إلى: ${unreachable.join('، ')}. حاول لاحقاً.` : `Not found, and ${unreachable.join(' and ')} could not be reached. Try again later.`)
              : (ar ? 'الردمك صحيح لكن الكتاب غير موجود في Open Library أو Google Books. أدخل البيانات يدوياً.' : 'The ISBN is valid but the book is not in Open Library or Google Books. Please enter the details by hand.'),
          });
          return;
        }
        setIsbnData(data);
        // Pass the ISBN value AND the full lookup data through onChange
        // so the editor can fill the empty Work/Instance fields
        onChange({
          ...value,
          isbn: normalized,
          '@type': 'bf:Isbn',
          _isbnLookupData: data,
        });
      } catch (err) {
        console.error('ISBN lookup failed:', err);
        setIsbnNotice({ tone: 'error', text: ar ? 'تعذر البحث عن الردمك.' : 'The ISBN lookup failed.' });
      } finally {
        setIsLoading(false);
      }
    };
    const sourceOf = (field: string) => {
      const s = (isbnData?.sources as any)?.[field];
      return s ? <span className="ml-1 text-[10px] opacity-60">({s})</span> : null;
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm text-gray-600">ISBN</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="text"
                value={value?.isbn || ''}
                onChange={(e) => onChange({ ...value, isbn: e.target.value, '@type': 'bf:Isbn' })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleIsbnLookup(); } }}
                placeholder="978-..."
                className="font-mono flex-1"
              />
              <button
                type="button"
                onClick={handleIsbnLookup}
                disabled={isLoading || !value?.isbn?.trim()}
                className="px-4 py-2 hover:scale-105 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap cursor-pointer"
                style={{
                  borderRadius: '120px',
                  background: 'rgba(255, 255, 255, 0.21)',
                  backdropFilter: 'blur(4.5px) blur(9px) saturate(1.5) brightness(1.1)',
                  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.4)'
                }}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {ar ? 'جارٍ البحث...' : 'Looking up...'}</>
                ) : (
                  <><Search className="h-4 w-4" /> {ar ? 'ملء تلقائي' : 'Auto-Fill'}</>
                )}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-sm text-gray-600">LCCN</Label>
            <Input
              type="text"
              value={value?.lccn || ''}
              onChange={(e) => onChange({ ...value, lccn: e.target.value, '@type': 'bf:Lccn' })}
              placeholder="2024..."
              className="mt-1 font-mono"
            />
          </div>
        </div>

        {isbnNotice && (
          <div className={`p-3 rounded-lg border text-xs ${isbnNotice.tone === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'}`}>
            {isbnNotice.text}
          </div>
        )}

        {/* ISBN Auto-Fill Result Summary */}
        {isbnData && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                {ar ? 'تم العثور على الكتاب' : 'Book found'}
                {isbnData.foundIn?.length ? <span className="font-normal opacity-70"> · {isbnData.foundIn.join(' + ')}</span> : null}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
              {isbnData.isbn13 && (
                <div className="font-mono"><span className="font-semibold font-sans">ISBN-13:</span> {isbnData.isbn13}</div>
              )}
              {isbnData.isbn10 && (
                <div className="font-mono"><span className="font-semibold font-sans">ISBN-10:</span> {isbnData.isbn10}</div>
              )}
              {isbnData.title && (
                <div><span className="font-semibold">{ar ? 'العنوان:' : 'Title:'}</span> {isbnData.title}{sourceOf('title')}</div>
              )}
              {isbnData.subtitle && (
                <div><span className="font-semibold">{ar ? 'العنوان الفرعي:' : 'Subtitle:'}</span> {isbnData.subtitle}{sourceOf('subtitle')}</div>
              )}
              {isbnData.authors && isbnData.authors.length > 0 && (
                <div><span className="font-semibold">{ar ? 'المؤلفون:' : 'Authors:'}</span> {isbnData.authors.join(ar ? '، ' : ', ')}{sourceOf('authors')}</div>
              )}
              {isbnData.publishers && isbnData.publishers.length > 0 && (
                <div><span className="font-semibold">{ar ? 'الناشر:' : 'Publisher:'}</span> {isbnData.publishers.join(', ')}{sourceOf('publisher')}</div>
              )}
              {isbnData.place && (
                <div><span className="font-semibold">{ar ? 'مكان النشر:' : 'Place:'}</span> {isbnData.place}{sourceOf('place')}</div>
              )}
              {isbnData.publishDate && (
                <div><span className="font-semibold">{ar ? 'التاريخ:' : 'Date:'}</span> {isbnData.publishDate}{sourceOf('date')}</div>
              )}
              {isbnData.numberOfPages && (
                <div><span className="font-semibold">{ar ? 'الصفحات:' : 'Pages:'}</span> {isbnData.numberOfPages}{sourceOf('pages')}</div>
              )}
              {isbnData.language && (
                <div><span className="font-semibold">{ar ? 'اللغة:' : 'Language:'}</span> <span className="font-mono">{isbnData.language}</span>{sourceOf('language')}</div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
              <Sparkles className="h-3 w-3" />
              <span>{ar ? 'تم ملء الحقول الفارغة فقط؛ لم يتم تغيير ما أدخلته.' : 'Only empty fields were filled; nothing you entered was changed.'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Handle Extent entity
  if (property.label.includes('Extent')) {
    const extentVal = typeof value === 'string'
      ? value
      : (value?.['rdfs:label'] || value?.value || value?.label || '');

    return (
      <Input
        type="text"
        value={extentVal}
        onChange={(e) => onChange({ value: e.target.value, 'rdfs:label': e.target.value, '@type': 'bf:Extent' })}
        placeholder={language === 'ar' ? 'مثل: 340 صفحة' : 'e.g., 340 pages'}
        dir={direction}
      />
    );
  }

  // Handle Summary entity
  if (property.label.includes('Summary')) {
    const summaryVal = typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.map(v => typeof v === 'string' ? v : v?.['rdfs:label'] || v?.value || '').join('\n')
        : (value?.['rdfs:label'] || value?.value || value?.label || '');

    return (
      <textarea
        value={summaryVal}
        onChange={(e) => onChange({ value: e.target.value, 'rdfs:label': e.target.value, '@type': 'bf:Summary' })}
        placeholder={language === 'ar' ? 'ملخص المحتوى' : 'Summary of the work'}
        dir={direction}
        className="w-full min-h-[100px] p-2 border rounded-md bg-transparent"
      />
    );
  }

  // Handle Note entity
  if (property.label.includes('Note')) {
    const noteVal = typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.map(n => typeof n === 'string' ? n : (n?.['rdfs:label'] || n?.note || n?.value || '')).filter(Boolean).join('\n---\n')
        : (value?.['rdfs:label'] || value?.note || value?.value || '');

    return (
      <textarea
        value={noteVal}
        onChange={(e) => onChange({ value: e.target.value, 'rdfs:label': e.target.value, '@type': 'bf:Note' })}
        placeholder={language === 'ar' ? 'ملاحظة عامة' : 'General note'}
        dir={direction}
        className="w-full min-h-[80px] p-2 border rounded-md bg-transparent"
      />
    );
  }

  // Handle Language entity
  if (type === 'language') {
    const currentLangUri = typeof value === 'string'
      ? (value.includes('ara') || value === 'العربية' ? 'http://id.loc.gov/vocabulary/languages/ara' : value.includes('eng') || value === 'English' ? 'http://id.loc.gov/vocabulary/languages/eng' : value.startsWith('http') ? value : `http://id.loc.gov/vocabulary/languages/${value}`)
      : (value?.['@id'] || '');

    return (
      <select
        value={currentLangUri}
        onChange={(e) => onChange({ 
          '@id': e.target.value, 
          '@type': 'bf:Language',
          'rdfs:label': e.target.options[e.target.selectedIndex].text
        })}
        className="w-full p-2 border rounded-md bg-transparent"
      >
        <option value="" className="text-black">Select language...</option>
        <option value="http://id.loc.gov/vocabulary/languages/ara" className="text-black">Arabic (ara) — العربية</option>
        <option value="http://id.loc.gov/vocabulary/languages/eng" className="text-black">English (eng)</option>
        <option value="http://id.loc.gov/vocabulary/languages/fre" className="text-black">French (fre)</option>
        <option value="http://id.loc.gov/vocabulary/languages/ger" className="text-black">German (ger)</option>
        <option value="http://id.loc.gov/vocabulary/languages/spa" className="text-black">Spanish (spa)</option>
        <option value="http://id.loc.gov/vocabulary/languages/rus" className="text-black">Russian (rus)</option>
        <option value="http://id.loc.gov/vocabulary/languages/chi" className="text-black">Chinese (chi)</option>
      </select>
    );
  }

  // Default entity input
  const defaultVal = typeof value === 'string'
    ? value
    : (value?.value || value?.['rdfs:label'] || value?.label || (typeof value === 'object' && value ? '' : String(value || '')));

  return (
    <Input
      type="text"
      value={defaultVal}
      onChange={(e) => onChange({ value: e.target.value, '@type': property.range[0] })}
      placeholder={`Enter ${property.label.toLowerCase()}...`}
      dir={direction}
    />
  );
}