/**
 * 🧩 Structured Blank Node Editors
 * Modal editors for complex BIBFRAME structures
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthoritySelect } from './AuthoritySelect';
import { searchAllAuthorities, searchRelators } from '../../../services/authoritySearch';

interface EditorProps {
  value: any;
  onChange: (value: any) => void;
  onClose: () => void;
  triggerRect?: DOMRect | null;
}

// Shared popover wrapper — uses portal + fixed positioning near the trigger element
function PopoverWrapper({ children, onClose, triggerRect }: { children: React.ReactNode; onClose: () => void; triggerRect?: DOMRect | null }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerRect) return;
    
    const viewportHeight = window.innerHeight;
    const popoverWidth = Math.min(Math.max(triggerRect.width, 420), 520);
    const popoverMaxHeight = viewportHeight * 0.6; // max-h-[60vh]
    
    // Try to position below the trigger
    let top = triggerRect.bottom + 8;
    
    // If not enough space below, position above
    if (top + popoverMaxHeight > viewportHeight - 20) {
      top = Math.max(20, triggerRect.top - popoverMaxHeight - 8);
    }
    
    // Clamp to viewport
    top = Math.max(20, Math.min(top, viewportHeight - popoverMaxHeight - 20));
    
    // Center horizontally relative to the trigger, but clamp to viewport
    let left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));
    
    setPos({ top, left, width: popoverWidth });
  }, [triggerRect]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!triggerRect) return;
    const handleUpdate = () => {
      // triggerRect is a snapshot, so we just keep current pos
    };
    window.addEventListener('resize', handleUpdate);
    return () => window.removeEventListener('resize', handleUpdate);
  }, [triggerRect]);

  const content = (
    <>
      <div className="fixed inset-0 z-[999998]" style={{ background: 'rgba(0,0,0,0.15)' }} onClick={onClose} />
      {pos && (
        <div
          ref={contentRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 999999,
          }}
        >
          <div 
            style={popoverCardStyle} 
            className="p-6 max-h-[60vh] overflow-auto"
          >
            {children}
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}

const popoverCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 12px 48px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
  borderRadius: 16,
};

/**
 * bf:Title Editor
 */
export function TitleEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const initial = React.useMemo(() => {
    if (!value) return { mainTitle: '', subtitle: '', partNumber: '', partName: '' };
    if (typeof value === 'string') return { mainTitle: value, subtitle: '', partNumber: '', partName: '' };
    const v = Array.isArray(value) ? value[0] || {} : value;
    const main = v['bf:mainTitle'] || v.mainTitle || v['rdfs:label'] || '';
    const mainStr = typeof main === 'object' ? (main['@value'] || '') : String(main);
    const sub = v['bf:subtitle'] || v.subtitle || '';
    const subStr = typeof sub === 'object' ? (sub['@value'] || '') : String(sub);
    const partNum = v['bf:partNumber'] || v.partNumber || '';
    const partNm = v['bf:partName'] || v.partName || '';
    return {
      mainTitle: mainStr,
      subtitle: subStr,
      partNumber: typeof partNum === 'object' ? (partNum['@value'] || '') : String(partNum),
      partName: typeof partNm === 'object' ? (partNm['@value'] || '') : String(partNm),
    };
  }, [value]);

  const [title, setTitle] = useState(initial);
  const { t } = useTranslation();

  const handleSave = () => {
    onChange({
      '@type': 'bf:Title',
      'bf:mainTitle': title.mainTitle,
      mainTitle: title.mainTitle,
      ...(title.subtitle ? { 'bf:subtitle': title.subtitle, subtitle: title.subtitle } : {}),
      ...(title.partNumber ? { 'bf:partNumber': title.partNumber, partNumber: title.partNumber } : {}),
      ...(title.partName ? { 'bf:partName': title.partName, partName: title.partName } : {})
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>{t('editor.editTitle')}</h3>
          <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.mainTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title.mainTitle || ''}
              onChange={(e) => setTitle({ ...title, mainTitle: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
              placeholder={t('editor.enterMainTitle')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>{t('ont.subtitle')}</label>
            <input
              type="text"
              value={title.subtitle || ''}
              onChange={(e) => setTitle({ ...title, subtitle: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
              placeholder={t('editor.enterSubtitle')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>{t('ont.partNumber')}</label>
              <input
                type="text"
                value={title.partNumber || ''}
                onChange={(e) => setTitle({ ...title, partNumber: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
                placeholder="e.g., Part 1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>{t('ont.partName')}</label>
              <input
                type="text"
                value={title.partName || ''}
                onChange={(e) => setTitle({ ...title, partName: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
                placeholder="e.g., Introduction"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!title.mainTitle}
            className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(59,130,246,0.9)" }}
          >
            {t('editor.saveTitle')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
          >
            {t('cancel')}
          </button>
        </div>
    </PopoverWrapper>
  );
}

/**
 * bf:Contribution Editor
 */
export function ContributionEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const initial = React.useMemo(() => {
    if (!value) return { agent: null, role: 'aut' };
    const v = Array.isArray(value) ? value[0] || {} : value;
    const agentLabel = v['bf:agent']?.['rdfs:label'] || v.agent?.label || (typeof v.agent === 'string' ? v.agent : (typeof v === 'string' ? v : ''));
    const agentUri = v['bf:agent']?.['@id'] || v.agent?.uri || '';
    const roleId = v['bf:role']?.['@id'] || '';
    const role = roleId ? roleId.split('/').pop() : (v.role || 'aut');
    return {
      agent: agentLabel ? { label: agentLabel, uri: agentUri, source: 'LOC' } : null,
      role: role || 'aut'
    };
  }, [value]);

  const [contribution, setContribution] = useState(initial);
  const { t } = useTranslation();

  const handleSave = () => {
    const newContrib = {
      '@type': 'bf:Contribution',
      'bf:agent': {
        '@type': 'bf:Person',
        '@id': contribution.agent?.uri || undefined,
        'rdfs:label': contribution.agent?.label || ''
      },
      ...(contribution.role ? {
        'bf:role': {
          '@id': `http://id.loc.gov/vocabulary/relators/${contribution.role}`,
          'rdfs:label': contribution.role
        }
      } : {}),
      agent: contribution.agent,
      role: contribution.role
    };
    if (Array.isArray(value)) {
      onChange([...value, newContrib]);
    } else if (value && typeof value === 'object' && Object.keys(value).length > 0) {
      onChange([value, newContrib]);
    } else {
      onChange([newContrib]);
    }
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>{t('editor.editContribution')}</h3>
          <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <AuthoritySelect
            label={t('ont.agent')}
            value={contribution.agent}
            onChange={(agent) => setContribution({ ...contribution, agent })}
            onSearch={(q) => searchAllAuthorities(q, 'person')}
            placeholder={t('editor.searchPerson')}
            required
            allowCustom
          />

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.role')} <span className="text-red-500">*</span>
            </label>
            <select
              value={contribution.role || 'aut'}
              onChange={(e) => setContribution({ ...contribution, role: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
            >
              <option value="aut">{t('role.aut')}</option>
              <option value="edt">{t('role.edt')}</option>
              <option value="trl">{t('role.trl')}</option>
              <option value="ill">{t('role.ill')}</option>
              <option value="ctb">{t('role.ctb')}</option>
              <option value="cre">{t('role.cre')}</option>
              <option value="pht">{t('role.pht')}</option>
              <option value="com">{t('role.com')}</option>
              <option value="pbl">{t('role.pbl')}</option>
              <option value="cmp">{t('role.cmp')}</option>
              <option value="prf">{t('role.prf')}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!contribution.agent}
            className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(59,130,246,0.9)" }}
          >
            {t('editor.saveContribution')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
          >
            {t('cancel')}
          </button>
        </div>
    </PopoverWrapper>
  );
}

/**
 * bf:ProvisionActivity Editor
 */
export function ProvisionActivityEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const initial = React.useMemo(() => {
    if (!value) return { place: null, agent: null, date: '' };
    const v = Array.isArray(value) ? value[0] || {} : value;
    const date = v['bflc:simpleDate'] || v['bf:date'] || v.date || v.publicationDate || '';
    const agentLabel = v['bf:agent']?.['rdfs:label'] || v.agent?.label || v.agent || '';
    const agentUri = v['bf:agent']?.['@id'] || v.agent?.uri || '';
    const placeLabel = v['bf:place']?.['rdfs:label'] || v.place?.label || v.place || '';
    const placeUri = v['bf:place']?.['@id'] || v.place?.uri || '';
    return {
      place: placeLabel ? { label: placeLabel, uri: placeUri } : null,
      agent: agentLabel ? { label: agentLabel, uri: agentUri } : null,
      date: typeof date === 'object' ? (date['@value'] || '') : String(date)
    };
  }, [value]);

  const [provision, setProvision] = useState(initial);
  const { t } = useTranslation();

  const handleSave = () => {
    onChange({
      '@type': 'bf:Publication',
      'bf:date': provision.date,
      'bflc:simpleDate': provision.date,
      date: provision.date,
      ...(provision.agent ? {
        'bf:agent': {
          '@type': 'bf:Organization',
          '@id': provision.agent.uri || undefined,
          'rdfs:label': provision.agent.label
        },
        agent: provision.agent
      } : {}),
      ...(provision.place ? {
        'bf:place': {
          '@type': 'bf:Place',
          '@id': provision.place.uri || undefined,
          'rdfs:label': provision.place.label
        },
        place: provision.place
      } : {})
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>{t('editor.editPublication')}</h3>
          <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <AuthoritySelect
            label={t('ont.publisher')}
            value={provision.agent}
            onChange={(agent) => setProvision({ ...provision, agent })}
            onSearch={(q) => searchAllAuthorities(q, 'organization')}
            placeholder={t('editor.searchPublisher')}
            allowCustom
          />

          <AuthoritySelect
            label={t('ont.publicationPlace')}
            value={provision.place}
            onChange={(place) => setProvision({ ...provision, place })}
            onSearch={(q) => searchAllAuthorities(q, 'place')}
            placeholder={t('editor.searchPlace')}
            allowCustom
          />

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>{t('ont.publicationDate')}</label>
            <input
              type="text"
              value={provision.date || ''}
              onChange={(e) => setProvision({ ...provision, date: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
              placeholder="YYYY"
              pattern="\d{4}"
              maxLength={4}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(59,130,246,0.9)" }}
          >
            {t('editor.savePublication')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
          >
            {t('cancel')}
          </button>
        </div>
    </PopoverWrapper>
  );
}

/**
 * bf:Identifier Editor
 */
export function IdentifierEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [identifier, setIdentifier] = useState(value || { type: 'Isbn', value: '' });
  const { t } = useTranslation();

  const handleSave = () => {
    onChange(identifier);
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>{t('editor.editIdentifier')}</h3>
          <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.identifierType')} <span className="text-red-500">*</span>
            </label>
            <select
              value={identifier.type || 'Isbn'}
              onChange={(e) => setIdentifier({ ...identifier, type: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
            >
              <option value="Isbn">ISBN</option>
              <option value="Issn">ISSN</option>
              <option value="Lccn">LCCN</option>
              <option value="Local">Local</option>
              <option value="Doi">DOI</option>
              <option value="Oclc">OCLC</option>
              <option value="Ean">EAN</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.identifierValue')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={identifier.value || ''}
              onChange={(e) => setIdentifier({ ...identifier, value: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
              placeholder={t('editor.enterIdentifier')}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!identifier.value}
            className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(59,130,246,0.9)" }}
          >
            {t('editor.saveIdentifier')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
          >
            {t('cancel')}
          </button>
        </div>
    </PopoverWrapper>
  );
}

/**
 * bf:Classification Editor
 */
export function ClassificationEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const initial = React.useMemo(() => {
    if (!value) return { scheme: 'lcc', number: '' };
    if (typeof value === 'string') return { scheme: 'lcc', number: value };
    const v = Array.isArray(value) ? value[0] || {} : value;
    const portion = v['bf:classificationPortion'] || v.classificationPortion || v.number || v.classification || '';
    const item = v['bf:itemPortion'] || v.itemPortion || '';
    const fullNum = [portion, item].filter(Boolean).join(' ');
    const scheme = v['@type']?.includes('Lcc') ? 'lcc' : v['@type']?.includes('Ddc') ? 'ddc' : (v.scheme || 'lcc');
    return { scheme, number: fullNum };
  }, [value]);

  const [classification, setClassification] = useState(initial);
  const { t } = useTranslation();

  const handleSave = () => {
    const parts = classification.number.trim().split(' ');
    const portion = parts[0] || '';
    const item = parts.slice(1).join(' ') || '';
    onChange({
      '@type': classification.scheme === 'lcc' ? 'bf:ClassificationLcc' : 'bf:ClassificationDdc',
      'bf:classificationPortion': portion,
      'bf:itemPortion': item,
      scheme: classification.scheme,
      number: classification.number,
      classificationPortion: portion,
      itemPortion: item
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>{t('editor.editClassification')}</h3>
          <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.scheme')} <span className="text-red-500">*</span>
            </label>
            <select
              value={classification.scheme || 'lcc'}
              onChange={(e) => setClassification({ ...classification, scheme: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
            >
              <option value="lcc">{t('scheme.lcc')}</option>
              <option value="ddc">{t('scheme.ddc')}</option>
              <option value="udc">{t('scheme.udc')}</option>
              <option value="nlm">{t('scheme.nlm')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>
              {t('ont.classificationNumber')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={classification.number || ''}
              onChange={(e) => setClassification({ ...classification, number: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
              placeholder={t('editor.enterClassification')}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!classification.number}
            className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(59,130,246,0.9)" }}
          >
            {t('editor.saveClassification')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
          >
            {t('cancel')}
          </button>
        </div>
    </PopoverWrapper>
  );
}

// ==================== DISSERTATION EDITOR ====================

export function DissertationEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [degree, setDegree] = useState(value?.degree || '');
  const [institution, setInstitution] = useState(value?.grantingInstitution || null);
  const [year, setYear] = useState(value?.dissertationYear || '');
  const [identifier, setIdentifier] = useState(value?.dissertationIdentifier || '');
  const [note, setNote] = useState(value?.dissertationNote || '');

  const handleSave = () => {
    onChange({
      '@type': 'bf:Dissertation',
      degree,
      grantingInstitution: institution,
      dissertationYear: year,
      dissertationIdentifier: identifier,
      dissertationNote: note
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>Dissertation Information</h3>
        <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Degree</label>
          <input
            type="text"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="Ph.D., M.A., M.S., etc."
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Type of degree for which the author was a candidate</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Granting Institution</label>
          <AuthoritySelect
            label=""
            value={institution}
            onChange={setInstitution}
            onSearch={(q) => searchAllAuthorities(q, 'organization')}
            placeholder="Search for institution..."
            allowCustom
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Institution that granted the degree</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Year</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="YYYY"
            maxLength={4}
            pattern="\d{4}"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Year the degree was granted</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Dissertation Identifier</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Identifier"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Optional identifier assigned to the dissertation</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional information about the dissertation..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(59,130,246,0.9)" }}
        >
          Save Dissertation
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </PopoverWrapper>
  );
}

// ==================== TEMPORAL COVERAGE EDITOR ====================

export function TemporalCoverageEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [startDate, setStartDate] = useState(value?.startDate || '');
  const [endDate, setEndDate] = useState(value?.endDate || '');
  const [label, setLabel] = useState(value?.label || '');

  const handleSave = () => {
    onChange({
      '@type': 'bf:Temporal',
      startDate,
      endDate,
      'rdfs:label': label
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>Temporal Coverage</h3>
        <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Start Date</label>
          <input
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="YYYY or YYYY-MM-DD (EDTF)"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-mono"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Beginning date of the time period covered by the content</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>End Date</label>
          <input
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="YYYY or YYYY-MM-DD (EDTF)"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-mono"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Ending date of the time period (leave blank for ongoing)</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Textual Description</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., 'World War II era' or '19th century'"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Optional textual description of the time period</p>
        </div>

        <div className="p-2.5 rounded-lg" style={{ background: "rgba(59,130,246,0.08)" }}>
          <p className="text-xs" style={{ color: "rgba(59,130,246,0.9)" }}>
            <strong>EDTF Format:</strong> Use Extended Date/Time Format. Examples: <code className="px-1 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.08)" }}>1945</code>, <code className="px-1 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.08)" }}>1939/1945</code>, <code className="px-1 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.08)" }}>1945-05-08</code>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(59,130,246,0.9)" }}
        >
          Save Coverage
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </PopoverWrapper>
  );
}

// ==================== SERIES EDITOR ====================

export function SeriesEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [title, setTitle] = useState(value?.title || '');
  const [enumeration, setEnumeration] = useState(value?.seriesEnumeration || '');
  const [issn, setIssn] = useState(value?.issn || '');
  const [relationship, setRelationship] = useState(value?.relationship || 'In series');

  const handleSave = () => {
    onChange({
      '@type': 'bf:Series',
      title,
      seriesEnumeration: enumeration,
      issn,
      relationship,
      'rdfs:label': title
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>Series Information</h3>
        <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Series Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Series title"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Series Enumeration</label>
          <input
            type="text"
            value={enumeration}
            onChange={(e) => setEnumeration(e.target.value)}
            placeholder="v. 3, no. 12, etc."
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Volume, number, or other designation within the series</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>ISSN</label>
          <input
            type="text"
            value={issn}
            onChange={(e) => setIssn(e.target.value)}
            placeholder="####-####"
            pattern="\d{4}-\d{3}[\dX]"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-mono"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>International Standard Serial Number of the series</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Relationship</label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          >
            <option value="In series">In series</option>
            <option value="Subseries">Subseries</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!title}
          className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(59,130,246,0.9)" }}
        >
          Save Series
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </PopoverWrapper>
  );
}

// ==================== ACQUISITION SOURCE EDITOR ====================

export function AcquisitionEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [stockNumber, setStockNumber] = useState(value?.stockNumber || '');
  const [source, setSource] = useState(value?.source || '');
  const [terms, setTerms] = useState(value?.acquisitionTerms || '');
  const [note, setNote] = useState(value?.note || '');

  const handleSave = () => {
    onChange({
      '@type': 'bf:AcquisitionSource',
      stockNumber,
      source,
      acquisitionTerms: terms,
      note
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>Acquisition Source</h3>
        <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Stock Number</label>
          <input
            type="text"
            value={stockNumber}
            onChange={(e) => setStockNumber(e.target.value)}
            placeholder="Stock number from source"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Stock or item number assigned by the source</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Source Organization</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Name of organization"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Organization from which the resource may be obtained</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Terms of Availability (Price)</label>
          <input
            type="text"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="$29.95, Free, Contact vendor, etc."
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Price or terms under which the resource is available</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional information..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(59,130,246,0.9)" }}
        >
          Save Acquisition
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </PopoverWrapper>
  );
}

// ==================== IMMEDIATE ACQUISITION EDITOR ====================

export function ImmediateAcquisitionEditorModal({ value, onChange, onClose, triggerRect }: EditorProps) {
  const [source, setSource] = useState(value?.source || '');
  const [date, setDate] = useState(value?.date || '');
  const [method, setMethod] = useState(value?.method || '');
  const [note, setNote] = useState(value?.note || '');
  const [institution, setInstitution] = useState(value?.applicableInstitution || '');

  const handleSave = () => {
    onChange({
      '@type': 'bf:ImmediateAcquisition',
      source,
      date,
      method,
      note,
      applicableInstitution: institution
    });
    onClose();
  };

  return (
    <PopoverWrapper onClose={onClose} triggerRect={triggerRect}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: "rgba(0,0,0,0.85)" }}>Immediate Source of Acquisition</h3>
        <button onClick={onClose} style={{ color: "rgba(0,0,0,0.4)" }} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Source Name</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Name of donor, vendor, etc."
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Person or organization from which the library acquired the resource</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Acquisition Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Date the resource was acquired</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          >
            <option value="">Select method...</option>
            <option value="Purchase">Purchase</option>
            <option value="Gift">Gift</option>
            <option value="Deposit">Deposit</option>
            <option value="Exchange">Exchange</option>
            <option value="Transfer">Transfer</option>
            <option value="Legal deposit">Legal deposit</option>
          </select>
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Method by which the resource was acquired</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Applicable Institution</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Institution code or name"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
          <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.5)" }}>Institution to which this acquisition applies</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(0,0,0,0.6)" }}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional acquisition details..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.8)" }}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(59,130,246,0.9)" }}
        >
          Save Acquisition
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </PopoverWrapper>
  );
}