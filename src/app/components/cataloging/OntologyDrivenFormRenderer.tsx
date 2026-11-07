/**
 * 🧠 Ontology-Driven Form Renderer
 * Registry-powered, no templates, pure semantic rendering
 */

import React, { useState, useRef, useContext } from 'react';
import { FieldComments } from '../FieldComments';
import { ChevronDown, ChevronUp, Plus, X, Edit2, Link as LinkIcon, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import { 
  getCategoriesForDomain, 
  getPropertiesByCategory,
  OntologyProperty 
} from '../../../services/ontologyRegistry';
import { GraphStore } from '../../../services/graphStore';
import { AuthoritySelect } from './AuthoritySelect';
import {
  searchAllAuthorities,
  searchLanguages,
  searchCarriers,
  searchMediaTypes,
  searchCountries,
  searchRelators,
  searchAccessibilityContent,
  searchNotationTypes,
  searchGovernmentPub,
  searchDescriptionAuth,
  searchLOCAuthorities,
  searchIssuance
} from '../../../services/authoritySearch';
import {
  TitleEditorModal,
  ContributionEditorModal,
  ProvisionActivityEditorModal,
  IdentifierEditorModal,
  ClassificationEditorModal,
  DissertationEditorModal,
  TemporalCoverageEditorModal,
  SeriesEditorModal,
  AcquisitionEditorModal,
  ImmediateAcquisitionEditorModal
} from './BlankNodeEditors';

// Links between this record's own entities (built by Moon) and links to other works/instances.
const RECORD_LINK_FIELDS = new Set(['instanceOf', 'itemOf', 'expressionOf', 'hasInstance', 'hasExpression', 'hasItem']);
const RELATED_RESOURCE_FIELDS = new Set(['relatedTo', 'hasPart', 'partOf', 'translationOf', 'translation', 'hasDerivative', 'derivativeOf', 'originalVersion', 'otherEdition', 'precededBy', 'succeededBy', 'hasSeries', 'seriesOf']);

// i18n-aware label mapping for ontology properties and categories
const CATEGORY_I18N_MAP: Record<string, string> = {
  'Title Information': 'cat.titleInformation',
  'Contributors': 'cat.contributors',
  'Subject Access': 'cat.subjectAccess',
  'Subject & Classification': 'cat.subjectAccess',
  'Classification Numbers': 'cat.classificationNumbers',
  'Language & Script': 'cat.languageScript',
  'Language & Content': 'cat.languageContent',
  'Content Description': 'cat.contentDescription',
  'Publication & Distribution': 'cat.publicationDistribution',
  'Publication Information': 'cat.publicationInformation',
  'Edition & Publication': 'cat.editionPublication',
  'Identifiers': 'cat.identifiers',
  'Physical Description': 'cat.physicalDescription',
  'Series Area': 'cat.seriesArea',
  'Series Information': 'cat.seriesInformation',
  'Notes & Annotations': 'cat.notesAnnotations',
  'Holdings & Access': 'cat.holdingsAccess',
  'Holdings': 'cat.holdings',
  'Electronic Access': 'cat.electronicAccess',
  'Relationships': 'cat.relationships',
  'Administrative Metadata': 'cat.adminMetadata',
  'Academic Information': 'cat.academicInformation',
  'Accessibility': 'cat.accessibility',
  'Work Metadata': 'cat.workMetadata',
  'Acquisition Information': 'cat.acquisitionInformation',
  'Dates': 'cat.dates',
};

const PROPERTY_I18N_MAP: Record<string, string> = {
  'Title': 'ont.title',
  'Main Title': 'ont.mainTitle',
  'Subtitle': 'ont.subtitle',
  'Part Number': 'ont.partNumber',
  'Part Name': 'ont.partName',
  'Contribution': 'ont.contribution',
  'Agent': 'ont.agent',
  'Subject': 'ont.subject',
  'Genre/Form': 'ont.genreForm',
  'Classification': 'ont.classification',
  'Language': 'ont.language',
  'Content Type': 'ont.contentType',
  'Summary': 'ont.summary',
  'Note': 'ont.note',
  'Provision Activity': 'ont.provisionActivity',
  'Identifier': 'ont.identifier',
  'Carrier Type': 'ont.carrier',
  'Media Type': 'ont.media',
  'Extent': 'ont.extent',
  'Dimensions': 'ont.dimensions',
  'Mode of Issuance': 'ont.issuance',
  'Statement of Responsibility': 'ont.responsibilityStatement',
  'Edition Statement': 'ont.editionStatement',
  'Origin Place': 'ont.originPlace',
  'Origin Date': 'ont.originDate',
  'Intended Audience': 'ont.intendedAudience',
  'Table of Contents': 'ont.tableOfContents',
  'Illustrative Content': 'ont.illustrativeContent',
  'Color Content': 'ont.colorContent',
  'Supplementary Content': 'ont.supplementaryContent',
  'Series Statement': 'ont.seriesStatement',
  'Frequency': 'ont.frequencyNote',
  'Copyright Date': 'ont.copyrightDate',
  'Acquisition Source': 'ont.acquisitionSource',
  'Shelf Mark': 'ont.shelfMark',
  'Electronic Locator': 'ont.electronicLocator',
  'Held By': 'ont.heldBy',
  'Item Of': 'ont.itemOf',
  'Instance Of': 'ont.instanceOf',
  'Publication': 'ont.provisionActivity',
};


const ARABIC_CATEGORY_FALLBACKS: Record<string, string> = {
  'Title Information': 'بيانات العنوان والتسمية',
  'Contributors': 'المؤلفون والمساهمون والمسؤولية',
  'Subject Access': 'رؤوس الموضوعات والمداخل الاستنادية',
  'Subject & Classification': 'الموضوعات والتصنيف',
  'Classification Numbers': 'أرقام التصنيف (ديوي والكونغرس)',
  'Language & Script': 'اللغات ونظم الكتابة',
  'Language & Content': 'لغات الوعاء والمحتوى',
  'Content Description': 'وصف المحتوى والشكل',
  'Publication & Distribution': 'بيانات النشر والتوزيع والإصدار',
  'Publication Information': 'بيانات النشر',
  'Edition & Publication': 'الطبعة والنشر',
  'Identifiers': 'المعرفات المعيارية والأرقام القياسية',
  'Physical Description': 'الوصف المادي والامتداد',
  'Series Area': 'منطقة السلسلة',
  'Series Information': 'بيانات السلسلة',
  'Notes & Annotations': 'الملاحظات والتبصرات',
  'Holdings & Access': 'المقتنيات والإتاحة',
  'Holdings': 'المقتنيات والنسخ',
  'Electronic Access': 'الإتاحة الإلكترونية والروابط',
  'Relationships': 'العلاقات الببليوغرافية',
  'Administrative Metadata': 'البيانات الإدارية والاستناد',
  'Academic Information': 'البيانات الأكاديمية والرسائل',
  'Accessibility': 'إمكانية الوصول والخدمات الخاصة',
  'Work Metadata': 'بيانات العمل المرجعية',
  'Acquisition Information': 'بيانات التزويد والاقتناء',
  'Dates': 'التواريخ والأزمنة',
};


const ARABIC_DESC_FALLBACKS: Record<string, string> = {
  'Name given to a resource': 'اسم أو عنوان مصدر المعلومات',
  'Agent and their role in relation to the resource': 'المسؤول الاستنادي ودوره بالنسبة للوعاء (مؤلف، محقق، مترجم...)',
  'Classification number or code': 'رقم أو رمز التصنيف المخصص للوعاء',
  'Language of the content': 'لغة المحتوى أو الوعاء المكتوب بها',
  'Categorization reflecting the fundamental form of communication': 'شكل ونوع المحتوى (نص، صورة، تسجيل صوتي...)',
  'Index term, subject term, or descriptor': 'رأس الموضوع الاستنادي أو الواصفة الموضوعية',
};

const ARABIC_PROPERTY_FALLBACKS: Record<string, string> = {
  'Title': 'العنوان',
  'Main Title': 'العنوان الرئيسي',
  'Subtitle': 'العنوان الفرعي',
  'Part Number': 'رقم الجزء',
  'Part Name': 'اسم الجزء',
  'Contribution': 'المساهمة',
  'Agent': 'الاسم الاستنادي / الفاعل',
  'Role': 'الدور الاستنادي',
  'Subject': 'الموضوع',
  'Genre/Form': 'الشكل / النوع الأدبي',
  'Classification': 'التصنيف',
  'Language': 'اللغة',
  'Content Type': 'نوع المحتوى',
  'Media Type': 'نوع الوسيط',
  'Carrier Type': 'نوع الحامل',
  'Summary': 'ملخص المحتوى',
  'Note': 'الملاحظة والتبصرة',
  'Provision Activity': 'بيانات النشر والإنتاج',
  'Identifier': 'المعرف القياسي',
  'Extent': 'الامتداد وعدد الصفحات',
  'Dimensions': 'الأبعاد والقياسات',
  'Mode of Issuance': 'طريقة الإصدار',
  'Statement of Responsibility': 'بيان المسؤولية (المؤلفون والمحققون)',
  'Edition Statement': 'بيان الطبعة',
  'Origin Place': 'مكان المنشأ / النشر',
  'Origin Date': 'تاريخ المنشأ / النشر',
  'Intended Audience': 'الجمهور المستهدف',
  'Table of Contents': 'قائمة المحتويات والفهارس',
  'Illustrative Content': 'المحتوى الإيضاحي والصور',
  'Supplementary Content': 'المواد الإضافية والملحقات',
  'Issuing Body': 'الجهة المصدرة',
  'Dissertation': 'الأطروحة والرسالة الجامعية',
  'Degree': 'الدرجة العلمية',
  'Granting Institution': 'الجامعة المانحة',
  'Year': 'السنة',
  'Electronic Location': 'الرابط الإلكتروني',
  'Electronic Locator': 'الرابط الإلكتروني (URL)',
  'Geographic Coverage': 'التغطية الجغرافية',
  'Color Content': 'المحتوى اللوني',
  'Item Of': 'نسخة من التجسيدة',
  'Instance Of': 'تجسيدة للعمل',
  'Publication': 'النشر والتوزيع',
};

// Helper to translate a label with i18n fallback
function useTranslatedLabel() {
  const { t, i18n: i18nInstance } = useTranslation();
  return (label: string) => {
    const key = PROPERTY_I18N_MAP[label];
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated;
    }
    // Labels without an i18n key still get their Arabic name in the Arabic interface.
    if (i18nInstance.language === 'ar' && ARABIC_PROPERTY_FALLBACKS[label]) return ARABIC_PROPERTY_FALLBACKS[label];
    return label;
  };
}

function useTranslatedCategory() {
  const { t } = useTranslation();
  return (category: string) => {
    const key = CATEGORY_I18N_MAP[category];
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated;
    }
    return category;
  };
}

function getTitleString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return getTitleString(val[0]);
  }
  const main = val['bf:mainTitle'] || val.mainTitle || val['rdfs:label'] || '';
  const mainStr = typeof main === 'object' ? (main['@value'] || '') : String(main);
  const sub = val['bf:subtitle'] || val.subtitle || '';
  const subStr = typeof sub === 'object' ? (sub['@value'] || '') : String(sub);
  if (mainStr && subStr) return `${mainStr}: ${subStr}`;
  return mainStr || subStr || (typeof val === 'object' ? (val['@value'] || '') : String(val));
}

function getFieldValue(node: any, shortName: string): any {
  if (!node) return undefined;
  if (node[shortName] !== undefined && node[shortName] !== null && node[shortName] !== '') return node[shortName];
  const unprefixed = shortName.replace(/^bf:/, '');
  if (node[unprefixed] !== undefined && node[unprefixed] !== null && node[unprefixed] !== '') return node[unprefixed];
  if (shortName === 'bf:title') return node['bf:title'] || node['mainTitle'] || node['title'];
  if (shortName === 'bf:contribution') return node['bf:contribution'] || node['creator'] || node['contribution'];
  if (shortName === 'bf:subject') return node['bf:subject'] || node['subject'];
  if (shortName === 'bf:classification') return node['bf:classification'] || node['classification'] || node['shelfMark'] || node['callNumber'];
  if (shortName === 'bf:language') return node['bf:language'] || node['language'];
  if (shortName === 'bf:provisionActivity') return node['bf:provisionActivity'] || node['publicationDate'] || node['provisionActivity'] || node['publisher'] || node['publication'];
  if (shortName === 'bf:extent') return node['bf:extent'] || node['extent'];
  if (shortName === 'bf:summary') return node['bf:summary'] || node['summary'] || node['description'];
  if (shortName === 'bf:note') return node['bf:note'] || node['note'] || node['notes'];
  if (shortName === 'bf:originDate') return node['bf:originDate'] || node['originDate'] || node['date'];
  if (shortName === 'bf:originPlace') return node['bf:originPlace'] || node['originPlace'] || node['place'] || node['placeOfPublication'];
  if (shortName === 'bf:genreForm') return node['bf:genreForm'] || node['genreForm'];
  if (shortName === 'bf:content') return node['bf:content'] || node['contentType'] || node['content'];
  if (shortName === 'bf:carrier') return node['bf:carrier'] || node['carrierType'] || node['carrier'];
  if (shortName === 'bf:media') return node['bf:media'] || node['mediaType'] || node['media'];
  if (shortName === 'bf:identifiedBy') return node['bf:identifiedBy'] || node['identifiedBy'] || node['identifier'] || node['lccn'] || node['isbn'];
  if (shortName === 'bf:editionStatement') return node['bf:editionStatement'] || node['editionStatement'] || node['edition'];
  if (shortName === 'bf:dimensions') return node['bf:dimensions'] || node['dimensions'];
  if (shortName === 'bf:shelfMark') return node['bf:shelfMark'] || node['shelfMark'] || node['callNumber'];
  if (shortName === 'bf:tableOfContents') return node['bf:tableOfContents'] || node['tableOfContents'] || node['contents'];
  if (shortName === 'bf:adminMetadata') return node['bf:adminMetadata'] || node['adminMetadata'];
  if (shortName === 'bf:hasSeries') return node['bf:hasSeries'] || node['hasSeries'] || node['series'];
  if (shortName === 'bf:copyrightDate') return node['bf:copyrightDate'] || node['copyrightDate'];
  if (shortName === 'bf:supplementaryContent') return node['bf:supplementaryContent'] || node['supplementaryContent'];
  if (shortName === 'bf:accessibilityContent') return node['bf:accessibilityContent'] || node['accessibilityContent'];
  if (shortName === 'bf:notation') return node['bf:notation'] || node['notation'];
  if (shortName === 'bf:governmentPublication') return node['bf:governmentPublication'] || node['governmentPublication'];
  if (shortName === 'bf:dissertation') return node['bf:dissertation'] || node['dissertation'];
  if (shortName === 'bf:temporalCoverage') return node['bf:temporalCoverage'] || node['temporalCoverage'];
  if (shortName === 'bf:acquisitionSource') return node['bf:acquisitionSource'] || node['acquisitionSource'];
  if (shortName === 'bf:immediateAcquisition') return node['bf:immediateAcquisition'] || node['immediateAcquisition'];
  if (shortName === 'bf:instanceOf') return node['bf:instanceOf'] || node['instanceOf'];
  if (shortName === 'bf:hasInstance') return node['bf:hasInstance'] || node['hasInstance'];
  if (shortName === 'bf:expressionOf') return node['bf:expressionOf'] || node['expressionOf'];
  if (shortName === 'bf:hasExpression') return node['bf:hasExpression'] || node['hasExpression'];
  if (shortName === 'bf:partOf') return node['bf:partOf'] || node['partOf'];
  if (shortName === 'bf:hasPart') return node['bf:hasPart'] || node['hasPart'];
  if (shortName === 'bf:relatedTo') return node['bf:relatedTo'] || node['relatedTo'];
  if (shortName === 'bf:translationOf') return node['bf:translationOf'] || node['translationOf'];
  if (shortName === 'bf:hasDerivative') return node['bf:hasDerivative'] || node['hasDerivative'];
  if (shortName === 'bf:originalVersion') return node['bf:originalVersion'] || node['originalVersion'];
  if (shortName === 'bf:heldBy') return node['bf:heldBy'] || node['heldBy'];
  if (shortName === 'bf:projectedProvisionDate') return node['bf:projectedProvisionDate'] || node['projectedProvisionDate'];
  if (shortName === 'bf:descriptionAuthentication') return node['bf:descriptionAuthentication'] || node['descriptionAuthentication'];
  return undefined;
}

function getLiteralString(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(v => getLiteralString(v)).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    return value['rdfs:label'] || value['@value'] || value.value || value.label || value.mainTitle || value['bf:mainTitle'] || '';
  }
  return String(value);
}

interface FormTheme {
  isLight: boolean;
  textColor: string;
  textDimColor: string;
  textMutedColor: string;
  inputBg: string;
  inputBorder: string;
  inputColor: string;
}

const FormThemeContext = React.createContext<FormTheme>({
  isLight: false,
  textColor: "#f8fafc",
  textDimColor: "#cbd5e1",
  textMutedColor: "#94a3b8",
  inputBg: "rgba(255,255,255,0.08)",
  inputBorder: "1px solid rgba(255,255,255,0.2)",
  inputColor: "#ffffff",
});

function useFormTheme() {
  return React.useContext(FormThemeContext);
}

/**
 * URIs of values the editor pre-filled from LC's profile and nobody has changed yet. A field holding
 * one shows "LC default", so a new record's starting values aren't mistaken for someone's data.
 */
export const PrefilledDefaultsContext = React.createContext<ReadonlySet<string>>(new Set());

interface OntologyDrivenFormRendererProps {
  entityType: string; // 'Work', 'Expression', 'Instance', 'Item'
  nodeUri: string;
  graphStore: GraphStore;
  data?: any;
  onChange: (nodeUri: string, property: string, value: any) => void;
  isLight?: boolean;
  hiddenFields?: Set<string>;
  onHideField?: (fieldKey: string) => void;
}

export function OntologyDrivenFormRenderer({ 
  entityType, 
  nodeUri, 
  graphStore,
  data,
  onChange,
  isLight = false,
  hiddenFields,
  onHideField,
}: OntologyDrivenFormRendererProps) {
  const formTheme: FormTheme = React.useMemo(() => {
    if (isLight) {
      return {
        isLight: true,
        textColor: "rgba(15,23,42,0.92)",
        textDimColor: "rgba(15,23,42,0.65)",
        textMutedColor: "rgba(15,23,42,0.45)",
        inputBg: "rgba(255,255,255,0.9)",
        inputBorder: "1px solid rgba(0,0,0,0.15)",
        inputColor: "#0f172a",
      };
    }
    return {
      isLight: false,
      textColor: "#f8fafc",
      textDimColor: "#cbd5e1",
      textMutedColor: "#94a3b8",
      inputBg: "rgba(255,255,255,0.08)",
      inputBorder: "1px solid rgba(255,255,255,0.2)",
      inputColor: "#ffffff",
    };
  }, [isLight]);

  const categories = getCategoriesForDomain(entityType);
  const storeNode = graphStore.getNode(nodeUri) || {};
  const node = { ...storeNode, ...(data || {}) };

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    categories.forEach(cat => {
      const props = getPropertiesByCategory(entityType, cat);
      const hasVal = props.some(p => {
        const val = getFieldValue(node, p.shortName);
        return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
      });
      if (hasVal) initial.add(cat);
    });
    categories.slice(0, 4).forEach(c => initial.add(c));
    return initial;
  });

  React.useEffect(() => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      categories.forEach(cat => {
        const props = getPropertiesByCategory(entityType, cat);
        const hasVal = props.some(p => {
          const val = getFieldValue(node, p.shortName);
          return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
        });
        if (hasVal) next.add(cat);
      });
      return next;
    });
  }, [data]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const expandAll = () => setExpandedCategories(new Set(categories));
  const collapseAll = () => setExpandedCategories(new Set());
  return (
    <FormThemeContext.Provider value={formTheme}>
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: formTheme.textDimColor }}>
            {entityType} Categories ({categories.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-0.5 rounded-md hover:opacity-80 transition-opacity font-medium cursor-pointer"
              style={{ color: formTheme.isLight ? '#2563eb' : '#93c5fd' }}
            >
              Expand All
            </button>
            <span style={{ color: formTheme.textMutedColor }}>•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-0.5 rounded-md hover:opacity-80 transition-opacity font-medium cursor-pointer"
              style={{ color: formTheme.textDimColor }}
            >
              Collapse All
            </button>
          </div>
        </div>
        {categories.map((category, index) => (
          <div
            key={category}
            className="rounded-[20px] overflow-visible"
            style={{
              position: 'relative',
              zIndex: categories.length - index,
              background: isLight 
                ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.85) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
              border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <CategorySection
              category={category}
              entityType={entityType}
              nodeUri={nodeUri}
              node={node}
              expanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              onChange={onChange}
              hiddenFields={hiddenFields}
              onHideField={onHideField}
            />
          </div>
        ))}
      </div>
    </FormThemeContext.Provider>
  );
}

function CategorySection({
  category,
  entityType,
  nodeUri,
  node,
  expanded,
  onToggle,
  onChange,
  hiddenFields,
  onHideField,
}: {
  category: string;
  entityType: string;
  nodeUri: string;
  node: any;
  expanded: boolean;
  onToggle: () => void;
  onChange: (nodeUri: string, property: string, value: any) => void;
  hiddenFields?: Set<string>;
  onHideField?: (fieldKey: string) => void;
}) {
  const allProperties = getPropertiesByCategory(entityType, category);
  const properties = hiddenFields
    ? allProperties.filter(p => !hiddenFields.has(`registry:${p.shortName}`))
    : allProperties;
  const requiredCount = properties.filter(p => p.required).length;

  if (properties.length === 0) return null;

  const translateCategory = useTranslatedCategory();
  const { i18n: i18nInstance } = useTranslation();
  const currentLang = i18nInstance?.language || i18n.language;
  const { textColor, textDimColor } = useFormTheme();

  return (
    <div className="rounded-[20px] overflow-visible">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between transition-all"
        style={{
          background: "linear-gradient(to right, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.1)" : "none",
        }}
        type="button"
      >
        <div className="text-start">
          <h3 className="text-lg font-bold" style={{ color: textColor }}>{translateCategory(category)}</h3>
          <p className="text-sm mt-1" style={{ color: textDimColor }}>
            {properties.length} {i18n.language === 'ar' ? 'خاصية' : 'properties'}
            {requiredCount > 0 && ` • ${requiredCount} ${i18n.language === 'ar' ? 'مطلوب' : 'required'}`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5" style={{ color: textDimColor }} />
        ) : (
          <ChevronDown className="h-5 w-5" style={{ color: textDimColor }} />
        )}
      </button>

      {/* Category Content */}
      {expanded && (
        <div
          className="p-6 space-y-6 overflow-visible"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.1) 100%)",
          }}
        >
          {properties.map((property) => (
            <div key={property.shortName} data-live-field={`${entityType}:${property.shortName}`} className="relative group overflow-visible">
              <PropertyRenderer
                property={property}
                value={getFieldValue(node, property.shortName)}
                onChange={(value) => onChange(nodeUri, property.shortName, value)}
              />
              <FieldComments field={`${entityType}:${property.shortName}`} label={property.label} />
              {onHideField && (
                <button
                  onClick={() => onHideField(`registry:${property.shortName}`)}
                  className="absolute -top-1 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg opacity-0 group-hover:opacity-100"
                  style={{
                    background: "rgba(255,59,48,0.9)",
                    border: "2px solid rgba(255,255,255,0.8)",
                    insetInlineEnd: "-4px",
                  }}
                  title={`Hide ${property.label}`}
                  type="button"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyRenderer({
  property,
  value,
  onChange
}: {
  property: OntologyProperty;
  value: any;
  onChange: (value: any) => void;
}) {
  // Handle repeatable properties
  if (property.repeatable && property.rangeType !== 'BlankNode') {
    return (
      <RepeatablePropertyRenderer
        property={property}
        values={Array.isArray(value) ? value : value ? [value] : []}
        onChange={onChange}
      />
    );
  }

  // Handle BlankNode properties
  if (property.rangeType === 'BlankNode') {
    return (
      <BlankNodePropertyRenderer
        property={property}
        value={value}
        onChange={onChange}
      />
    );
  }

  // Single value property
  return (
    <SinglePropertyRenderer
      property={property}
      value={value}
      onChange={onChange}
    />
  );
}

function SinglePropertyRenderer({
  property,
  value,
  onChange
}: {
  property: OntologyProperty;
  value: any;
  onChange: (value: any) => void;
}) {
  const { isLight, textColor, textDimColor, textMutedColor, inputBg, inputBorder, inputColor } = useFormTheme();
  const prefilled = useContext(PrefilledDefaultsContext);
  const isPrefilled = typeof value?.['@id'] === 'string' && prefilled.has(value['@id']);

  const getAuthoritySearch = () => {
    if (property.controlledVocab === 'languages') return searchLanguages;
    if (property.controlledVocab === 'carriers') return searchCarriers;
    if (property.controlledVocab === 'mediaTypes') return searchMediaTypes;
    if (property.controlledVocab === 'countries') return searchCountries;
    if (property.controlledVocab === 'relators') return searchRelators;
    if (property.controlledVocab === 'accessibilityContent') return searchAccessibilityContent;
    if (property.controlledVocab === 'notationTypes') return searchNotationTypes;
    if (property.controlledVocab === 'governmentPub') return searchGovernmentPub;
    if (property.controlledVocab === 'descriptionAuth' || property.controlledVocab === 'descriptionAuthentication') return searchDescriptionAuth;
    if (property.controlledVocab === 'governmentPublication') return searchGovernmentPub;
    // Each remaining field searches the vocabulary its BIBFRAME property points to (it used to fall back
    // to subject headings for all of them).
    if (property.controlledVocab === 'contentTypes') return (q: string) => searchLOCAuthorities(q, 'contentTypes');
    if (property.controlledVocab === 'issuance') return searchIssuance;
    if (property.controlledVocab === 'audience') return (q: string) => searchLOCAuthorities(q, 'audience');
    if (property.controlledVocab === 'illustrativeContent') return (q: string) => searchLOCAuthorities(q, 'illustrativeContent');
    if (property.controlledVocab === 'colorContent') return (q: string) => searchLOCAuthorities(q, 'colorContent');
    if (property.controlledVocab === 'supplementaryContent') return (q: string) => searchLOCAuthorities(q, 'supplementaryContent');
    if (property.controlledVocab === 'geographicAreas') return (q: string) => searchLOCAuthorities(q, 'geographicAreas');
    if (property.controlledVocab === 'genreForms') return (q: string) => searchAllAuthorities(q, 'genre');
    if (property.controlledVocab === 'organizations') return (q: string) => searchAllAuthorities(q, 'holder');
    const name = property.shortName.replace(/^bf:/, '');
    if (name === 'agent') return (q: string) => searchAllAuthorities(q, 'person');
    if (name === 'heldBy') return (q: string) => searchAllAuthorities(q, 'holder');
    if (RELATED_RESOURCE_FIELDS.has(name)) return (q: string) => searchAllAuthorities(q, 'work');

    return (q: string) => searchAllAuthorities(q, 'subject');
  };

  // Which kind of Moon entity a name typed here becomes when it is not found (fields that pick from a fixed
  // list, such as languages or carriers, make none).
  const entityKindOf = (): { kind: 'agent' | 'topic' | 'genre' | 'hub' | 'place'; agentType?: 'person' | 'organization' } | null => {
    const name = property.shortName.replace(/^bf:/, '');
    if (property.controlledVocab === 'genreForms') return { kind: 'genre' };
    if (property.controlledVocab === 'organizations' || name === 'heldBy') return { kind: 'agent', agentType: 'organization' };
    if (name === 'agent') return { kind: 'agent', agentType: 'person' };
    if (RELATED_RESOURCE_FIELDS.has(name)) return { kind: 'hub' };
    if (name === 'subject') return { kind: 'topic' };
    if (name === 'originPlace' || name === 'place') return { kind: 'place' };
    return null;
  };
  const newEntity = entityKindOf();

  const translateLabel = useTranslatedLabel();

  // The links between this record's own Work, Instance and Item are made by Moon itself; editing them here
  // had no effect on the record, and new records showed placeholder example.org links in them.
  if (RECORD_LINK_FIELDS.has(property.shortName.replace(/^bf:/, ''))) {
    return (
      <div className="space-y-1">
        <div className="text-sm font-semibold" style={{ color: textColor }}>{translateLabel(property.label)}</div>
        <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textDimColor }}>
          <LinkIcon className="h-3 w-3 shrink-0" />
          {i18n.language === 'ar' ? 'يُربط تلقائياً بكيانات هذه التسجيلة' : 'Linked automatically within this record'}
        </div>
      </div>
    );
  }

  // Authority-based URI input
  if (property.rangeType === 'URI' || property.inputComponent === 'AuthoritySelect') {
    return (
      <div className="space-y-2">
        <AuthoritySelect
          label={translateLabel(property.label)}
          value={value}
          onChange={onChange}
          onSearch={async (q: string) => {
            // Local vocabulary lists ({ code, label, uri }) have no source; they are Moon's own.
            const results: any[] = await getAuthoritySearch()(q);
            return results.map(r => ({ source: 'Local' as const, ...r }));
          }}
          placeholder={property.inputHint || `Search ${property.label.toLowerCase()}...`}
          required={property.required}
          allowCustom
          entityKind={newEntity?.kind}
          agentType={newEntity?.agentType}
          isLight={isLight}
          note={isPrefilled ? (i18n.language === 'ar' ? 'افتراضي من LC' : 'LC default') : undefined}
          noteTitle={isPrefilled ? (i18n.language === 'ar'
            ? 'قيمة ملأها المحرر مسبقًا من ملف مكتبة الكونغرس لهذا القالب. غيّرها أو احذفها إن لم تناسب المادة.'
            : "Pre-filled from LC's profile for this template. Change or remove it if it doesn't fit the item.") : undefined}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{i18n.language === 'ar' ? (ARABIC_DESC_FALLBACKS[property.description] || property.description) : property.description}</p>
        )}
        {value && typeof value === 'object' && value.uri && (
          <div className="flex items-center gap-1 text-xs" style={{ color: isLight ? "rgba(30,80,180,0.85)" : "#93c5fd" }}>
            <LinkIcon className="h-3 w-3" />
            <span className="font-mono">{value.uri}</span>
          </div>
        )}
      </div>
    );
  }

  // Text area
  if (property.inputComponent === 'TextArea') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <textarea
          value={getLiteralString(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.inputHint || property.description}
          rows={4}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
        <div className="flex items-center gap-1 text-xs" style={{ color: textMutedColor }}>
          <FileText className="h-3 w-3" />
          <span>Literal value</span>
        </div>
      </div>
    );
  }

  // Year input
  if (property.inputComponent === 'YearInput') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YYYY"
          pattern="\d{4}"
          maxLength={4}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // Date input
  if (property.inputComponent === 'DateInput') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // EDTF Date Input (for originDate, temporalCoverage dates)
  if (property.inputComponent === 'EDTFDateInput') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.inputHint || "YYYY, YYYY-MM-DD, or YYYY/YYYY"}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
        <div className="text-xs" style={{ color: textMutedColor }}>
          <span className="font-semibold">EDTF Format:</span> Use Extended Date/Time Format (e.g., <code className="px-1 py-0.5 bg-black/10 rounded">2024</code>, <code className="px-1 py-0.5 bg-black/10 rounded">2024-03-07</code>, <code className="px-1 py-0.5 bg-black/10 rounded">2020/2024</code>)
        </div>
      </div>
    );
  }

  // Projected Date Input (YYMM format for 263 field)
  if (property.inputComponent === 'ProjectedDateInput') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YYMM (e.g., 2603 for March 2026)"
          maxLength={4}
          pattern="\d{4}"
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // Accessibility Content Multi-Select
  if (property.inputComponent === 'AccessibilitySelect') {
    const options = [
      { value: 'Large print', label: 'Large print' },
      { value: 'Braille', label: 'Braille' },
      { value: 'Audio description', label: 'Audio description' },
      { value: 'Captions', label: 'Captions' },
      { value: 'Sign language', label: 'Sign language' },
      { value: 'Tactile graphics', label: 'Tactile graphics' },
      { value: 'Screen reader compatible', label: 'Screen reader compatible' },
      { value: 'High contrast', label: 'High contrast' },
      { value: 'Accessible PDF', label: 'Accessible PDF' }
    ];

    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const isSelected = Array.isArray(value) && value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  if (isSelected) {
                    onChange(current.filter(v => v !== option.value));
                  } else {
                    onChange([...current, option.value]);
                  }
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all text-left"
                style={{
                  background: isSelected ? "rgba(59,130,246,0.18)" : inputBg,
                  border: isSelected ? "2px solid rgba(59,130,246,0.5)" : inputBorder,
                  color: isSelected ? "#38bdf8" : textColor
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
        {Array.isArray(value) && value.length > 0 && (
          <div className="text-xs font-semibold text-blue-400">
            {value.length} feature(s) selected
          </div>
        )}
      </div>
    );
  }

  // Notation Select (Braille, Music, etc.)
  if (property.inputComponent === 'NotationSelect') {
    const options = [
      { value: 'Braille code', label: 'Braille code' },
      { value: 'Music notation', label: 'Music notation' },
      { value: 'Mathematical notation', label: 'Mathematical notation' },
      { value: 'Movement notation', label: 'Movement notation' },
      { value: 'Tactile notation', label: 'Tactile notation' }
    ];

    const stringVal = typeof value === 'string' ? value : (value?.['rdfs:label'] || value?.['@value'] || value?.value || (typeof value === 'object' ? '' : String(value || '')));
    const hasMatch = options.some(o => o.value === stringVal || o.label === stringVal);

    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          value={stringVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        >
          <option value="" className="text-black">Select notation type...</option>
          {stringVal && !hasMatch && (
            <option value={stringVal} className="text-black">{stringVal}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-black">{option.label}</option>
          ))}
        </select>
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // Government Publication Select
  if (property.inputComponent === 'GovernmentPubSelect') {
    const options = [
      { value: 'Federal/national', label: 'Federal/national' },
      { value: 'Multilocal', label: 'Multilocal' },
      { value: 'State, provincial, territorial', label: 'State, provincial, territorial, dependent, etc.' },
      { value: 'Local', label: 'Local' },
      { value: 'Intergovernmental', label: 'Intergovernmental' },
      { value: 'Government publication-level undetermined', label: 'Government publication-level undetermined' },
      { value: 'Not a government publication', label: 'Not a government publication' }
    ];
    const stringVal = typeof value === 'string' ? value : (value?.['rdfs:label'] || value?.['@value'] || value?.value || (typeof value === 'object' ? '' : String(value || '')));
    const hasMatch = options.some(o => o.value === stringVal || o.label === stringVal);

    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          value={stringVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        >
          <option value="" className="text-black">Select type...</option>
          {stringVal && !hasMatch && (
            <option value={stringVal} className="text-black">{stringVal}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-black">{option.label}</option>
          ))}
        </select>
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // Description Authentication Select (for Admin Metadata)
  if (property.inputComponent === 'AuthenticationSelect') {
    const options = [
      { value: 'pcc', label: 'PCC (Program for Cooperative Cataloging)' },
      { value: 'nsdp', label: 'NSDP (National Serials Data Program)' },
      { value: 'authenticated', label: 'Authenticated' },
      { value: 'non-authenticated', label: 'Non-authenticated' },
      { value: 'rda', label: 'RDA (Resource Description & Access)' }
    ];
    const stringVal = typeof value === 'string' ? value : (value?.['rdfs:label'] || value?.['@value'] || value?.value || (typeof value === 'object' ? '' : String(value || '')));
    const hasMatch = options.some(o => o.value === stringVal || o.label === stringVal);

    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          value={stringVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        >
          <option value="" className="text-black">Select authentication...</option>
          {stringVal && !hasMatch && (
            <option value={stringVal} className="text-black">{stringVal}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-black">{option.label}</option>
          ))}
        </select>
        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}
      </div>
    );
  }

  // Default text input
  return (
    <div className="relative space-y-2">
      <label className="block text-sm font-semibold" style={{ color: textColor }}>
        {translateLabel(property.label)}
        {property.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={getLiteralString(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={property.inputHint || property.description}
        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{
          background: inputBg,
          border: inputBorder,
          backdropFilter: "blur(10px)",
          color: inputColor,
        }}
      />
      {property.description && (
        <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
      )}
    </div>
  );
}

function RepeatablePropertyRenderer({
  property,
  values,
  onChange
}: {
  property: OntologyProperty;
  values: any[];
  onChange: (values: any[]) => void;
}) {
  const addValue = () => {
    onChange([...values, '']);
  };

  const updateValue = (index: number, newValue: any) => {
    const updated = [...values];
    updated[index] = newValue;
    onChange(updated);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const translateLabel = useTranslatedLabel();
  const { isLight, textColor, textDimColor, inputBg, inputBorder, inputColor } = useFormTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold" style={{ color: textColor }}>
          {translateLabel(property.label)}
          {property.required && <span className="ml-1 text-red-500">*</span>}
          <span className="text-xs ml-2" style={{ color: textDimColor }}>{i18n.language === 'ar' ? '(متكرر)' : '(Repeatable)'}</span>
        </label>
        <button
          onClick={addValue}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          style={{
            background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
            border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
            color: isLight ? "#2563eb" : "#93c5fa",
          }}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {values.length === 0 && (
        <div className="text-xs italic py-2" style={{ color: textDimColor }}>{i18n.language === 'ar' ? 'لم تتم إضافة قيم بعد' : 'No values added yet'}</div>
      )}

      {values.map((val, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex-1">
            <SinglePropertyRenderer
              property={{ ...property, label: `${property.label} ${index + 1}`, required: false }}
              value={val}
              onChange={(newVal) => updateValue(index, newVal)}
            />
          </div>
          <button
            onClick={() => removeValue(index)}
            className="p-2.5 rounded-xl transition-all mt-7 flex items-center justify-center shrink-0 cursor-pointer"
            style={{
              background: isLight ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.2)",
              border: isLight ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(239,68,68,0.4)",
              color: isLight ? "#dc2626" : "#fca5a5",
            }}
            type="button"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function BlankNodePropertyRenderer({
  property,
  value,
  onChange
}: {
  property: OntologyProperty;
  value: any;
  onChange: (value: any) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const translateLabel = useTranslatedLabel();
  const { isLight, textColor, textDimColor, textMutedColor, inputBg, inputBorder, inputColor } = useFormTheme();

  const handleOpenEditor = () => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
    setShowModal(true);
  };

  const handleSave = (newValue: any) => {
    onChange(newValue);
    setShowModal(false);
  };

  // 1. TITLE EDITOR - Inline editable input + details modal button
  if (property.inputComponent === 'TitleEditor') {
    const currentTitle = getTitleString(value);
    const handleTitleChange = (newTitle: string) => {
      if (Array.isArray(value)) {
        const first = value[0] || {};
        const updated = [{ ...first, '@type': first['@type'] || 'bf:Title', 'bf:mainTitle': newTitle, mainTitle: newTitle, 'rdfs:label': newTitle }, ...value.slice(1)];
        onChange(updated);
      } else if (typeof value === 'object' && value !== null) {
        onChange({ ...value, '@type': value['@type'] || 'bf:Title', 'bf:mainTitle': newTitle, mainTitle: newTitle, 'rdfs:label': newTitle });
      } else {
        onChange({ '@type': 'bf:Title', 'bf:mainTitle': newTitle, mainTitle: newTitle, 'rdfs:label': newTitle });
      }
    };

    return (
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold" style={{ color: textColor }}>
            {translateLabel(property.label)}
            {property.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
              color: isLight ? "#2563eb" : "#93c5fa",
            }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{i18n.language === 'ar' ? 'تفاصيل العنوان / العنوان الفرعي' : 'Title Details / Subtitle'}</span>
          </button>
        </div>

        <input
          type="text"
          value={currentTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={property.inputHint || "Enter title / أدخل العنوان..."}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />

        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}

        {showModal && (
          <TitleEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
        )}
      </div>
    );
  }

  // 2. CLASSIFICATION EDITOR - Inline editable input + details modal button
  if (property.inputComponent === 'ClassificationEditor') {
    const v = Array.isArray(value) ? value[0] : value;
    const portion = v?.['bf:classificationPortion'] || v?.classificationPortion || v?.number || (typeof v === 'string' ? v : '');
    const item = v?.['bf:itemPortion'] || v?.itemPortion || '';
    const classNum = [portion, item].filter(Boolean).join(' ');

    const handleClassChange = (newVal: string) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        onChange({ ...value, 'bf:classificationPortion': newVal, classificationPortion: newVal, number: newVal });
      } else {
        onChange({ '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': newVal, classificationPortion: newVal, number: newVal });
      }
    };

    return (
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold" style={{ color: textColor }}>
            {translateLabel(property.label)}
            {property.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
              color: isLight ? "#2563eb" : "#93c5fa",
            }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{i18n.language === 'ar' ? 'خطة التصنيف والتفاصيل' : 'Scheme & Details'}</span>
          </button>
        </div>

        <input
          type="text"
          value={classNum}
          onChange={(e) => handleClassChange(e.target.value)}
          placeholder={property.inputHint || "e.g. B753.D363 Q23 1650 / QA76.73"}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />

        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}

        {showModal && (
          <ClassificationEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
        )}
      </div>
    );
  }

  // 3. PROVISION ACTIVITY EDITOR - Inline editable imprint/date + details modal button
  if (property.inputComponent === 'ProvisionActivityEditor') {
    const v = Array.isArray(value) ? value[0] : value;
    const date = v?.['bflc:simpleDate'] || v?.['bf:date'] || v?.date || v?.publicationDate || '';
    const place = v?.['bf:place']?.['rdfs:label'] || v?.place?.label || v?.place || '';
    const agent = v?.['bf:agent']?.['rdfs:label'] || v?.agent?.label || v?.agent || '';
    const summary = [place, agent, date].filter(Boolean).join(' : ') || (typeof v === 'string' ? v : '');

    const handleDateChange = (newVal: string) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        onChange({ ...value, 'bflc:simpleDate': newVal, 'bf:date': newVal, publicationDate: newVal });
      } else {
        onChange({ '@type': 'bf:Publication', 'bflc:simpleDate': newVal, 'bf:date': newVal, publicationDate: newVal });
      }
    };

    return (
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold" style={{ color: textColor }}>
            {translateLabel(property.label)}
            {property.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
              color: isLight ? "#2563eb" : "#93c5fa",
            }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Place / Agent / Date Details</span>
          </button>
        </div>

        <input
          type="text"
          value={summary || date}
          onChange={(e) => handleDateChange(e.target.value)}
          placeholder={property.inputHint || "e.g. 1061 هـ. = [1650] / London : Faber, 1974"}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />

        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}

        {showModal && (
          <ProvisionActivityEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
        )}
      </div>
    );
  }

  // 4. CONTRIBUTION EDITOR - Visible contributor chips/cards + modal button
  if (property.inputComponent === 'ContributionEditor') {
    const contribList = Array.isArray(value) ? value : (value ? [value] : []);

    const removeContrib = (index: number) => {
      onChange(contribList.filter((_, i) => i !== index));
    };

    return (
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold" style={{ color: textColor }}>
            {translateLabel(property.label)}
            {property.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
              color: isLight ? "#2563eb" : "#93c5fa",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{i18n.language === 'ar' ? 'إضافة / تعديل المساهمين' : 'Add / Edit Contributors'}</span>
          </button>
        </div>

        {contribList.length === 0 ? (
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="w-full px-4 py-3 rounded-xl text-left transition-all border border-dashed flex items-center justify-between cursor-pointer"
            style={{
              background: inputBg,
              borderColor: isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
              color: textDimColor,
            }}
          >
            <span className="text-sm">{i18n.language === 'ar' ? '+ إضافة مساهم (مؤلف، محقق، مترجم...)' : '+ Add Contributor (Author, Editor, etc.)'}</span>
            <Edit2 className="w-4 h-4 opacity-50" />
          </button>
        ) : (
          <div className="space-y-2">
            {contribList.map((c: any, idx: number) => {
              const label = c?.['bf:agent']?.['rdfs:label'] || c?.agent?.label || c?.agent || (typeof c === 'string' ? c : 'Unknown Agent');
              const role = c?.['bf:role']?.['rdfs:label'] || c?.role?.label || c?.role || 'Author / مؤلف';
              const uri = c?.['bf:agent']?.['@id'] || c?.agent?.uri;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm"
                  style={{
                    background: isLight ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.12)",
                    border: isLight ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(59,130,246,0.25)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: isLight ? "#dbeafe" : "rgba(59,130,246,0.25)",
                        color: isLight ? "#1d4ed8" : "#93c5fd",
                      }}
                    >
                      {String(label).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate" style={{ color: textColor }}>{label}</div>
                      <div className="text-xs flex items-center gap-2" style={{ color: textDimColor }}>
                        <span>{role}</span>
                        {uri && <span className="font-mono text-[10px] opacity-70 truncate">{uri}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={handleOpenEditor}
                      type="button"
                      className="p-1 rounded hover:opacity-80 cursor-pointer"
                      style={{ color: textDimColor }}
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeContrib(idx)}
                      type="button"
                      className="p-1 rounded hover:opacity-80 cursor-pointer"
                      style={{ color: "#ef4444" }}
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}

        {showModal && (
          <ContributionEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
        )}
      </div>
    );
  }

  // 5. IDENTIFIER EDITOR - Inline editable value + modal button
  if (property.inputComponent === 'IdentifierEditor') {
    const first = Array.isArray(value) ? value[0] : value;
    const idVal = first?.['rdf:value'] || first?.value || (typeof first === 'string' ? first : '');

    const handleIdChange = (newVal: string) => {
      if (Array.isArray(value)) {
        const updated = [{ ...first, '@type': first?.['@type'] || 'bf:Identifier', 'rdf:value': newVal, value: newVal }, ...value.slice(1)];
        onChange(updated);
      } else if (typeof value === 'object' && value !== null) {
        onChange({ ...value, 'rdf:value': newVal, value: newVal });
      } else {
        onChange({ '@type': 'bf:Identifier', 'rdf:value': newVal, value: newVal });
      }
    };

    return (
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold" style={{ color: textColor }}>
            {translateLabel(property.label)}
            {property.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            ref={triggerRef}
            onClick={handleOpenEditor}
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              background: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              border: isLight ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(59,130,246,0.4)",
              color: isLight ? "#2563eb" : "#93c5fa",
            }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Identifier Details</span>
          </button>
        </div>

        <input
          type="text"
          value={idVal}
          onChange={(e) => handleIdChange(e.target.value)}
          placeholder={property.inputHint || "e.g. ISBN, LCCN, Sirsi ID"}
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          style={{
            background: inputBg,
            border: inputBorder,
            backdropFilter: "blur(10px)",
            color: inputColor,
          }}
        />

        {property.description && (
          <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
        )}

        {showModal && (
          <IdentifierEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
        )}
      </div>
    );
  }

  // 6. DEFAULT BLANK NODE EDITOR - Visible card + Modal
  const renderSummary = () => {
    if (!value) return <span style={{ color: textDimColor }}>Not configured</span>;
    if (property.inputComponent === 'DissertationEditor') {
      return <span>{value.degree || value['bf:degree'] || ''}: {value.name || value['rdfs:label'] || ''}</span>;
    }
    if (property.inputComponent === 'TemporalCoverageEditor') {
      return <span>{value.start || ''} - {value.end || ''}</span>;
    }
    if (property.inputComponent === 'SeriesEditor') {
      return <span>{value.title || value['bf:title'] || ''}: {value.number || ''}</span>;
    }
    if (property.inputComponent === 'AcquisitionEditor' || property.inputComponent === 'ImmediateAcquisitionEditor') {
      return <span>{value.source || value['rdfs:label'] || (typeof value === 'string' ? value : '')}</span>;
    }
    const simple = typeof value === 'string' ? value : value?.['rdfs:label'] || value?.label || value?.value;
    if (simple) return <span>{String(simple)}</span>;
    return <span className="font-mono text-xs">{JSON.stringify(value).substring(0, 50)}...</span>;
  };

  return (
    <div className="relative space-y-2">
      <label className="block text-sm font-semibold" style={{ color: textColor }}>
        {translateLabel(property.label)}
        {property.required && <span className="ml-1 text-red-500">*</span>}
        <span className="text-xs ml-2" style={{ color: textDimColor }}>(Structured)</span>
      </label>

      <button
        ref={triggerRef}
        onClick={handleOpenEditor}
        className="w-full px-4 py-3 rounded-xl text-left transition-all group cursor-pointer"
        style={{
          background: inputBg,
          border: inputBorder,
        }}
        type="button"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit2 className="h-4 w-4" style={{ color: textDimColor }} />
            <span style={{ color: textColor }}>{renderSummary()}</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: isLight ? "#2563eb" : "#93c5fa" }}>
            Edit →
          </span>
        </div>
      </button>

      {property.description && (
        <p className="text-xs" style={{ color: textDimColor }}>{property.description}</p>
      )}

      {showModal && property.inputComponent === 'DissertationEditor' && (
        <DissertationEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
      )}
      {showModal && property.inputComponent === 'TemporalCoverageEditor' && (
        <TemporalCoverageEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
      )}
      {showModal && property.inputComponent === 'SeriesEditor' && (
        <SeriesEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
      )}
      {showModal && property.inputComponent === 'AcquisitionEditor' && (
        <AcquisitionEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
      )}
      {showModal && property.inputComponent === 'ImmediateAcquisitionEditor' && (
        <ImmediateAcquisitionEditorModal value={value} onChange={handleSave} onClose={() => setShowModal(false)} triggerRect={triggerRect} />
      )}
    </div>
  );
}
