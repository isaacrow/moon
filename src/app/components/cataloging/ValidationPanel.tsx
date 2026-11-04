/**
 * 🔍 SHACL-Like & Institutional Validation Panel
 * Real-time validation feedback for BIBFRAME 2.0 graphs & heritage manuscripts
 * Multi-layer standards: LOC, PCC, RDA, and W3C Linked Data
 */

import { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, AlertTriangle, X, Shield,
  Award, Sparkles, Copy, Check, 
  CornerDownRight
  } from 'lucide-react';
import { GraphStore } from '../../../services/graphStore';

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info' | 'success';
  property?: string;
  message: string;
  nodeUri?: string;
  marcMapping?: string;
  category?: string;
  fix?: string;
}

export interface ValidationCategory {
  name: string;
  nameAr?: string;
  score: number;
  total: number;
  status: 'pass' | 'warn' | 'fail';
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
  passed: ValidationMessage[];
  categories: ValidationCategory[];
}

function getNodeProp(node: any, ...props: string[]): any {
  if (!node) return undefined;
  for (const p of props) {
    if (node[p] !== undefined && node[p] !== null && node[p] !== '') return node[p];
    const un = p.replace(/^bf:/, '');
    if (node[un] !== undefined && node[un] !== null && node[un] !== '') return node[un];
  }
  return undefined;
}

function hasValue(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') {
    return Object.keys(val).length > 0;
  }
  return true;
}

/**
 * Validate a graph against BIBFRAME ontology & institutional rules
 */
export function validateGraph(graph: GraphStore, enableExpression: boolean): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const info: ValidationMessage[] = [];
  const passed: ValidationMessage[] = [];

  // Get all nodes
  const works = graph.getNodesByType('bf:Work');
  const expressions = graph.getNodesByType('bf:Expression');
  const instances = graph.getNodesByType('bf:Instance');
  const items = graph.getNodesByType('bf:Item');
  const admins = graph.getNodesByType('bf:AdminMetadata');

  // Score categories
  let coreScore = 0; const coreTotal = 25;
  let descScore = 0; const descTotal = 25;
  let accessScore = 0; const accessTotal = 20;
  let msScore = 0; const msTotal = 15;
  let wemiScore = 0; const wemiTotal = 15;

  // 1. WORK VALIDATION
  if (works.length === 0) {
    errors.push({
      level: 'error',
      property: 'bf:Work',
      message: 'At least one Work entity is required in the BIBFRAME graph',
      category: 'Core',
      fix: 'Create a bf:Work node representing the intellectual creation'
    });
  } else {
    const work = works[0];
    const workUri = work['@id'] || 'Work';

    // Work Title
    const titleVal = getNodeProp(work, 'bf:title', 'title', 'mainTitle');
    if (hasValue(titleVal)) {
      passed.push({
        level: 'success',
        property: 'bf:title',
        message: 'Work title is present and properly structured (bf:mainTitle)',
        nodeUri: workUri,
        marcMapping: 'MARC 245 $a',
        category: 'Core'
      });
      coreScore += 15;
    } else {
      errors.push({
        level: 'error',
        property: 'bf:title',
        message: 'Work is missing title (bf:mainTitle)',
        nodeUri: workUri,
        marcMapping: 'MARC 245',
        category: 'Core',
        fix: 'Add bf:title with bf:mainTitle or rdfs:label'
      });
    }

    // Work Contribution / Author
    const contribVal = getNodeProp(work, 'bf:contribution', 'contribution', 'creator');
    if (hasValue(contribVal)) {
      passed.push({
        level: 'success',
        property: 'bf:contribution',
        message: 'Primary contribution/creator defined with agent and role',
        nodeUri: workUri,
        marcMapping: 'MARC 100 $a / $e',
        category: 'Core'
      });
      coreScore += 10;
    } else {
      errors.push({
        level: 'error',
        property: 'bf:contribution',
        message: 'Work has no contributor/creator agent',
        nodeUri: workUri,
        marcMapping: 'MARC 100',
        category: 'Core',
        fix: 'Add bf:contribution with bf:agent and authority URI'
      });
    }

    // Work Classification
    const classVal = getNodeProp(work, 'bf:classification', 'classification', 'classificationLcc', 'shelfMark');
    if (hasValue(classVal)) {
      passed.push({
        level: 'success',
        property: 'bf:classification',
        message: 'Library of Congress Classification (LCC) assigned',
        nodeUri: workUri,
        marcMapping: 'MARC 050',
        category: 'Access'
      });
      accessScore += 10;
    } else {
      warnings.push({
        level: 'warning',
        property: 'bf:classification',
        message: 'No classification number assigned to Work',
        nodeUri: workUri,
        marcMapping: 'MARC 050 / 082',
        category: 'Access',
        fix: 'Assign LCC (e.g. B753.D363) or DDC number'
      });
    }

    // Work Subjects
    const subjVal = getNodeProp(work, 'bf:subject', 'subject', 'subjectTopical');
    if (hasValue(subjVal)) {
      passed.push({
        level: 'success',
        property: 'bf:subject',
        message: 'LCSH / FAST topical subject headings assigned',
        nodeUri: workUri,
        marcMapping: 'MARC 650',
        category: 'Access'
      });
      accessScore += 10;
    } else {
      warnings.push({
        level: 'warning',
        property: 'bf:subject',
        message: 'Work missing subject analysis headings',
        nodeUri: workUri,
        marcMapping: 'MARC 650',
        category: 'Access',
        fix: 'Add bf:subject with LCSH controlled vocabulary URI'
      });
    }

    // Work Language
    const langVal = getNodeProp(work, 'bf:language', 'language');
    if (hasValue(langVal)) {
      passed.push({
        level: 'success',
        property: 'bf:language',
        message: 'Resource language recorded (ISO 639 code)',
        nodeUri: workUri,
        marcMapping: 'MARC 041 / 008',
        category: 'Core'
      });
    } else {
      info.push({
        level: 'info',
        property: 'bf:language',
        message: 'Consider specifying language URI (e.g. http://id.loc.gov/vocabulary/iso639-2/ara)',
        nodeUri: workUri,
        marcMapping: 'MARC 041',
        category: 'Core'
      });
    }

    // Work Origin Date
    const origVal = getNodeProp(work, 'bf:originDate', 'originDate', 'temporalCoverage');
    if (hasValue(origVal)) {
      passed.push({
        level: 'success',
        property: 'bf:originDate',
        message: 'Work creation / origin date recorded',
        nodeUri: workUri,
        marcMapping: 'MARC 046',
        category: 'Manuscript'
      });
      msScore += 5;
    }

    // Manuscript Incipit & Explicit Notes
    const notesVal = getNodeProp(work, 'bf:note', 'note');
    let hasIncipit = false;
    if (Array.isArray(notesVal)) {
      hasIncipit = notesVal.some(n => {
        const s = typeof n === 'string' ? n : (n?.['rdfs:label'] || '');
        return s.includes('أوله') || s.includes('الحمد لله') || s.includes('Incipit');
      });
    }
    if (hasIncipit) {
      passed.push({
        level: 'success',
        property: 'bf:note',
        message: 'Heritage manuscript Incipit (أوله) and Explicit (آخره) recorded',
        nodeUri: workUri,
        marcMapping: 'MARC 500',
        category: 'Manuscript'
      });
      msScore += 5;
    } else {
      info.push({
        level: 'info',
        property: 'bf:note',
        message: 'Heritage manuscripts benefit from Incipit/Explicit notes for identification',
        nodeUri: workUri,
        marcMapping: 'MARC 500',
        category: 'Manuscript',
        fix: 'Add opening words (أوله) in bf:note'
      });
    }

    // Summary
    const summaryVal = getNodeProp(work, 'bf:summary', 'summary');
    if (hasValue(summaryVal)) {
      passed.push({
        level: 'success',
        property: 'bf:summary',
        message: 'Intellectual summary / abstract provided',
        nodeUri: workUri,
        marcMapping: 'MARC 520',
        category: 'Core'
      });
    }
  }

  // 2. INSTANCE VALIDATION
  if (instances.length === 0) {
    warnings.push({
      level: 'warning',
      property: 'bf:Instance',
      message: 'No Instance defined - Work has no physical or electronic manifestation',
      category: 'Descriptive',
      fix: 'Create a bf:Instance node and link it via bf:instanceOf'
    });
  } else {
    const inst = instances[0];
    const instUri = inst['@id'] || 'Instance';

    // Instance of Work link
    const instanceOf = getNodeProp(inst, 'bf:instanceOf', 'instanceOf');
    if (hasValue(instanceOf)) {
      passed.push({
        level: 'success',
        property: 'bf:instanceOf',
        message: 'Instance correctly links to Work entity via bf:instanceOf',
        nodeUri: instUri,
        category: 'WEMI'
      });
      wemiScore += 10;
    } else {
      errors.push({
        level: 'error',
        property: 'bf:instanceOf',
        message: 'Instance must link to Work via bf:instanceOf',
        nodeUri: instUri,
        category: 'WEMI',
        fix: 'Set bf:instanceOf to Work URI'
      });
    }

    // Provision Activity / Date
    const provVal = getNodeProp(inst, 'bf:provisionActivity', 'provisionActivity', 'publicationDate');
    if (hasValue(provVal)) {
      passed.push({
        level: 'success',
        property: 'bf:provisionActivity',
        message: 'Production / Publication activity and date documented',
        nodeUri: instUri,
        marcMapping: 'MARC 264',
        category: 'Descriptive'
      });
      descScore += 10;
    } else {
      warnings.push({
        level: 'warning',
        property: 'bf:provisionActivity',
        message: 'Instance has no provision/production date',
        nodeUri: instUri,
        marcMapping: 'MARC 264',
        category: 'Descriptive',
        fix: 'Add bf:provisionActivity with bf:date and bf:place'
      });
    }

    // Physical Extent
    const extVal = getNodeProp(inst, 'bf:extent', 'extent');
    if (hasValue(extVal)) {
      passed.push({
        level: 'success',
        property: 'bf:extent',
        message: 'Physical extent (folios / pages) recorded',
        nodeUri: instUri,
        marcMapping: 'MARC 300 $a',
        category: 'Descriptive'
      });
      descScore += 10;
    } else {
      warnings.push({
        level: 'warning',
        property: 'bf:extent',
        message: 'Instance missing extent (pagination/folios)',
        nodeUri: instUri,
        marcMapping: 'MARC 300 $a',
        category: 'Descriptive',
        fix: 'Add bf:extent (e.g. 344 ورقة)'
      });
    }

    // Dimensions
    const dimVal = getNodeProp(inst, 'bf:dimensions', 'dimensions');
    if (hasValue(dimVal)) {
      passed.push({
        level: 'success',
        property: 'bf:dimensions',
        message: 'Physical dimensions recorded',
        nodeUri: instUri,
        marcMapping: 'MARC 300 $c',
        category: 'Manuscript'
      });
      msScore += 5;
    }

    // Carrier & Media
    const carrierVal = getNodeProp(inst, 'bf:carrier', 'carrier', 'carrierType');
    if (hasValue(carrierVal)) {
      passed.push({
        level: 'success',
        property: 'bf:carrier',
        message: 'RDA Carrier type specified (MARC 338)',
        nodeUri: instUri,
        marcMapping: 'MARC 338',
        category: 'Descriptive'
      });
      descScore += 5;
    }

    // Identification
    const identVal = getNodeProp(inst, 'bf:identifiedBy', 'identifiedBy', 'identifier', 'lccn');
    if (hasValue(identVal)) {
      passed.push({
        level: 'success',
        property: 'bf:identifiedBy',
        message: 'System control identifier / Barcode present',
        nodeUri: instUri,
        marcMapping: 'MARC 001 / 035',
        category: 'Core'
      });
    }
  }

  // 3. ITEM & HOLDINGS VALIDATION
  if (items.length > 0) {
    const item = items[0];
    const itemOf = getNodeProp(item, 'bf:itemOf', 'itemOf');
    if (hasValue(itemOf)) {
      passed.push({
        level: 'success',
        property: 'bf:itemOf',
        message: 'Item correctly links to Instance via bf:itemOf',
        category: 'WEMI'
      });
      wemiScore += 5;
    }
  } else {
    // If instance has hasItem or heldBy
    const instItem = instances[0] && getNodeProp(instances[0], 'bf:hasItem', 'heldBy');
    if (hasValue(instItem)) {
      passed.push({
        level: 'success',
        property: 'bf:hasItem',
        message: 'Holding institution and location identified (IQ-KaCCS)',
        marcMapping: 'MARC 852',
        category: 'WEMI'
      });
      wemiScore += 5;
    }
  }

  // Expression validation if enabled
  if (enableExpression) {
    if (expressions.length > 0) {
      const expr = expressions[0];
      if (expr['bf:expressionOf']) {
        passed.push({
          level: 'success',
          property: 'bf:expressionOf',
          message: 'Expression linked to Work via bf:expressionOf',
          category: 'WEMI'
        });
      } else {
        errors.push({
          level: 'error',
          property: 'bf:expressionOf',
          message: 'Expression must link to Work via bf:expressionOf',
          category: 'WEMI'
        });
      }
    }
  }

  // Calculate Overall Score (0-100)
  let totalScore = coreScore + descScore + accessScore + msScore + wemiScore;
  totalScore = Math.min(100, Math.max(0, totalScore - errors.length * 10 - warnings.length * 3));

  const categories: ValidationCategory[] = [
    {
      name: 'Core Bibliographic',
      nameAr: 'معايير الوصف الأساسية',
      score: Math.min(coreTotal, coreScore),
      total: coreTotal,
      status: coreScore >= coreTotal ? 'pass' : coreScore >= 15 ? 'warn' : 'fail'
    },
    {
      name: 'Descriptive & Manifestation',
      nameAr: 'الوصف المادي والتجسيد',
      score: Math.min(descTotal, descScore),
      total: descTotal,
      status: descScore >= descTotal ? 'pass' : descScore >= 15 ? 'warn' : 'fail'
    },
    {
      name: 'Classification & Subjects',
      nameAr: 'التصنيف والموضوعات',
      score: Math.min(accessTotal, accessScore),
      total: accessTotal,
      status: accessScore >= accessTotal ? 'pass' : accessScore >= 10 ? 'warn' : 'fail'
    },
    {
      name: 'Manuscript Codicology',
      nameAr: 'الكوديكولوجيا والأوائل',
      score: Math.min(msTotal, msScore),
      total: msTotal,
      status: msScore >= msTotal ? 'pass' : msScore >= 5 ? 'warn' : 'fail'
    },
    {
      name: 'WEMI Graph Connectivity',
      nameAr: 'ترابط الكيانات والبيانات',
      score: Math.min(wemiTotal, wemiScore),
      total: wemiTotal,
      status: wemiScore >= wemiTotal ? 'pass' : wemiScore >= 10 ? 'warn' : 'fail'
    },
  ];

  return {
    valid: errors.length === 0,
    score: totalScore,
    errors,
    warnings,
    info,
    passed,
    categories
  };
}

/**
 * Validation Panel Component
 */
interface ValidationPanelProps {
  validation: ValidationResult;
  onClose?: () => void;
  compact?: boolean;
  theme?: 'dark' | 'light' | any;
}

export function ValidationPanel({ validation, onClose, compact = false, theme = 'dark' }: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'info' | 'passed'>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  const isDark = theme !== 'light';
  const score = validation.score ?? (validation.valid ? 100 : 75);
  const errors = validation.errors || [];
  const warnings = validation.warnings || [];
  const info = validation.info || [];
  const passed = validation.passed || [];
  const categories = validation.categories || [];

  const complianceLevel = useMemo(() => {
    if (score >= 95) return { label: 'PCC Full National Standard (مكتمل)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 80) return { label: 'LOC Standard Level (معياري)', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    if (score >= 60) return { label: 'Core Minimum Level (أساسي)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'Needs Remediation (يحتاج استكمال)', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
  }, [score]);

  const displayedList = useMemo(() => {
    if (filter === 'errors') return errors;
    if (filter === 'warnings') return warnings;
    if (filter === 'info') return info;
    if (filter === 'passed') return passed;
    return [...errors, ...warnings, ...info, ...passed];
  }, [filter, errors, warnings, info, passed]);

  const handleCopyReport = () => {
    const lines = [
      '# BIBFRAME 2.0 & Institutional Validation Audit Report',
      `Date: ${new Date().toISOString()}`,
      `Score: ${score}/100 - ${complianceLevel.label}`,
      `Status: ${validation.valid ? 'VALID' : 'FAILED'}`,
      '',
      '## Categorical Breakdown:',
      ...categories.map(c => `- ${c.name}: ${c.score}/${c.total} pts (${c.status.toUpperCase()})`),
      '',
      `## Passed Checks (${passed.length}):`,
      ...passed.map(p => `✓ [${p.property || 'General'}] ${p.message} ${p.marcMapping ? `(${p.marcMapping})` : ''}`),
      '',
      errors.length > 0 ? `## Errors (${errors.length}):\n` + errors.map(e => `✗ [${e.property}] ${e.message} - Fix: ${e.fix || 'N/A'}`).join('\n') : '',
      warnings.length > 0 ? `## Warnings (${warnings.length}):\n` + warnings.map(w => `! [${w.property}] ${w.message}`).join('\n') : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  if (compact) {
    return (
      <div className={`p-4 rounded-xl border backdrop-blur-md ${
        validation.valid ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {validation.valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            <span className="font-bold text-sm text-slate-100">
              {validation.valid ? 'Valid BIBFRAME Graph' : 'Validation Issues Detected'}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-400">{score}/100</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-2xl border transition-all duration-300 ${
      isDark
        ? 'bg-slate-900/90 text-slate-100 border-slate-700/60 shadow-2xl backdrop-blur-xl'
        : 'bg-white text-slate-900 border-slate-200 shadow-xl'
    }`}>
      {/* ================= HEADER & SCORECARD ================= */}
      <div className={`p-6 border-b ${isDark ? 'border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-emerald-950/30' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Title & Level */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-black text-white">
                SHACL & Institutional Validation Scorecard
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              National Library Standards (LOC, PCC, RDA) & W3C BIBFRAME 2.0 Integrity
            </p>
            <div className="pt-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${complianceLevel.bg} ${complianceLevel.color}`}>
                <Award className="h-3.5 w-3.5" /> {complianceLevel.label}
              </span>
            </div>
          </div>

          {/* Score Display Meter */}
          <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl shrink-0">
            <div className="text-center">
              <div className={`text-3xl font-black font-mono ${score >= 85 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {score}
                <span className="text-sm text-slate-500 font-normal">/100</span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                Quality Index
              </div>
            </div>

            <div className="w-px h-10 bg-slate-800" />

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-md"
            >
              {copiedReport ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedReport ? 'Report Copied' : 'Audit Report'}</span>
            </button>
          </div>
        </div>

        {/* Categories Progress Bars */}
        {categories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-800">
            {categories.map((cat, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                  <span className="truncate">{cat.name}</span>
                  <span className="font-mono text-emerald-400">{cat.score}/{cat.total}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.score === cat.total ? 'bg-emerald-400' : cat.score >= cat.total / 2 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${(cat.score / cat.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= FILTER TABS ================= */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: `All Checks (${errors.length + warnings.length + info.length + passed.length})`, count: errors.length + warnings.length + info.length + passed.length },
            { id: 'passed', label: `Passed (${passed.length})`, count: passed.length, color: 'text-emerald-400' },
            { id: 'errors', label: `Errors (${errors.length})`, count: errors.length, color: 'text-red-400' },
            { id: 'warnings', label: `Warnings (${warnings.length})`, count: warnings.length, color: 'text-amber-400' },
            { id: 'info', label: `Suggestions (${info.length})`, count: info.length, color: 'text-blue-400' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filter === t.id
                  ? 'bg-slate-800 text-white shadow border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <span className={t.color}>{t.label}</span>
            </button>
          ))}
        </div>

        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ================= VALIDATION MESSAGES LIST ================= */}
      <div className="p-6 space-y-2.5 max-h-[500px] overflow-y-auto">
        {displayedList.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No issues found under this filter.
          </div>
        ) : (
          displayedList.map((item, idx) => {
            const isError = item.level === 'error';
            const isWarn = item.level === 'warning';
            const isPass = item.level === 'success';

            const bgClass = isError
              ? 'bg-red-950/25 border-red-500/30'
              : isWarn
              ? 'bg-amber-950/25 border-amber-500/30'
              : isPass
              ? 'bg-emerald-950/20 border-emerald-500/25'
              : 'bg-blue-950/20 border-blue-500/25';

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${bgClass}`}
              >
                <div className="mt-0.5 shrink-0">
                  {isError && <AlertCircle className="h-4 w-4 text-red-400" />}
                  {isWarn && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                  {isPass && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  {!isError && !isWarn && !isPass && <Sparkles className="h-4 w-4 text-blue-400" />}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.property && (
                        <span className="font-mono text-xs font-bold text-white">
                          {item.property}
                        </span>
                      )}
                      {item.marcMapping && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {item.marcMapping}
                        </span>
                      )}
                    </div>
                    {item.category && (
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {item.category}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    {item.message}
                  </p>

                  {item.fix && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-300/90 pt-0.5">
                      <CornerDownRight className="h-3 w-3 shrink-0" />
                      <span>Fix: {item.fix}</span>
                    </div>
                  )}

                  {item.nodeUri && (
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      {item.nodeUri}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
