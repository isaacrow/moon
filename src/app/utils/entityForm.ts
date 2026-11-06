/**
 * The Entities section's form (Phase 10, step 2): which fields each kind of entity has, following LC's
 * Marva templates (bfPerson, bfFamily, bfCorp, bfConf, bfJurisdiction, Hub, Topic, Place, Form, Temporal),
 * and how the form turns into what the server stores (label, variants, sameAs, note, data).
 */

export type EntityKind = 'agent' | 'place' | 'topic' | 'hub' | 'genre' | 'period';
export type AgentType = 'person' | 'family' | 'organization' | 'meeting' | 'jurisdiction';

export const ENTITY_KINDS: EntityKind[] = ['agent', 'place', 'topic', 'hub', 'genre', 'period'];
export const AGENT_TYPES: AgentType[] = ['person', 'family', 'organization', 'meeting', 'jurisdiction'];

export const KIND_LABELS: Record<EntityKind, [string, string]> = {
  agent: ['أشخاص وهيئات', 'People and bodies'],
  place: ['أماكن', 'Places'],
  topic: ['موضوعات', 'Topics'],
  hub: ['أعمال (محاور)', 'Works (hubs)'],
  genre: ['أنواع وأشكال', 'Genres and forms'],
  period: ['فترات زمنية', 'Periods'],
};

export const AGENT_LABELS: Record<AgentType, [string, string]> = {
  person: ['شخص', 'Person'],
  family: ['أسرة', 'Family'],
  organization: ['هيئة', 'Organization'],
  meeting: ['مؤتمر أو اجتماع', 'Meeting'],
  jurisdiction: ['جهة حكومية أو إقليم', 'Jurisdiction'],
};

/** A detail field: its key in `data`, its labels, and whether it holds a link (or several, one per line). */
export interface DetailField {
  key: string;
  label: [string, string];
  kind?: 'text' | 'uri' | 'uris';
  placeholder?: string;
}

/** The detail fields for a kind (and, for agents, their type), in LC's order. */
export function detailFields(kind: EntityKind, agentType: AgentType = 'person'): DetailField[] {
  switch (kind) {
    case 'agent':
      if (agentType === 'person') return [
        { key: 'birthDate', label: ['تاريخ الميلاد', 'Born'], placeholder: '1913' },
        { key: 'deathDate', label: ['تاريخ الوفاة', 'Died'], placeholder: '1995' },
        { key: 'occupation', label: ['المهنة', 'Occupation'] },
      ];
      if (agentType === 'family') return [
        { key: 'date', label: ['التاريخ', 'Dates'] },
        { key: 'place', label: ['المكان', 'Place'] },
      ];
      return [
        { key: 'date', label: ['التاريخ', 'Date'], placeholder: agentType === 'meeting' ? '2019' : '' },
        { key: 'place', label: ['المكان', 'Place'] },
      ];
    case 'place':
      return [{ key: 'partOf', label: ['جزء من (رابط)', 'Part of (link)'], kind: 'uri', placeholder: 'https://mooon.site/resource/place/…' }];
    case 'topic':
      return [
        { key: 'source', label: ['المصدر (رابط)', 'Source vocabulary (link)'], kind: 'uri', placeholder: 'http://id.loc.gov/authorities/subjects' },
        { key: 'broader', label: ['موضوعات أعم (رابط في كل سطر)', 'Broader topics (one link per line)'], kind: 'uris' },
        { key: 'narrower', label: ['موضوعات أخص (رابط في كل سطر)', 'Narrower topics (one link per line)'], kind: 'uris' },
      ];
    case 'genre':
      return [{ key: 'source', label: ['المصدر (رابط)', 'Source vocabulary (link)'], kind: 'uri', placeholder: 'http://id.loc.gov/authorities/genreForms' }];
    case 'period':
      return [
        { key: 'start', label: ['من سنة', 'From'], placeholder: '750' },
        { key: 'end', label: ['إلى سنة', 'To'], placeholder: '1258' },
      ];
    case 'hub':
      return [
        { key: 'title', label: ['العنوان', 'Title'] },
        { key: 'creator', label: ['المؤلف', 'Creator'] },
        { key: 'creatorUri', label: ['رابط المؤلف', 'Creator link'], kind: 'uri' },
        { key: 'language', label: ['اللغة', 'Language'] },
      ];
  }
}

export interface EntityForm {
  kind: EntityKind;
  agentType: AgentType;
  label: string;
  variants: string;
  sameAs: string;
  note: string;
  details: Record<string, string>;
}

export interface StoredEntity {
  id?: string;
  kind: EntityKind;
  label: string;
  variants?: string[];
  sameAs?: string[];
  note?: string | null;
  data?: Record<string, unknown>;
  version?: number;
}

const lines = (s: string) => [...new Set(s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
const isLink = (s: string) => /^https?:\/\/\S+$/.test(s);

export function emptyForm(kind: EntityKind = 'agent'): EntityForm {
  return { kind, agentType: 'person', label: '', variants: '', sameAs: '', note: '', details: {} };
}

/** A stored entity → the form (lists become one item per line). */
export function formFrom(e: StoredEntity): EntityForm {
  const data = e.data || {};
  const agentType = AGENT_TYPES.includes(data.agentType as AgentType) ? (data.agentType as AgentType) : 'person';
  const details: Record<string, string> = {};
  for (const f of detailFields(e.kind, agentType)) {
    const v = data[f.key];
    details[f.key] = Array.isArray(v) ? v.join('\n') : v == null ? '' : String(v);
  }
  return {
    kind: e.kind, agentType, label: e.label || '', variants: (e.variants || []).join('\n'),
    sameAs: (e.sameAs || []).join('\n'), note: e.note || '', details,
  };
}

/** What is wrong with the form, if anything (empty when it can be saved). */
export function formProblems(f: EntityForm): string[] {
  const out: string[] = [];
  if (!f.label.trim()) out.push('name');
  if (f.label.trim().length > 300) out.push('name-length');
  const bad = lines(f.sameAs).filter((u) => !isLink(u));
  if (bad.length) out.push('same-as');
  for (const d of detailFields(f.kind, f.agentType)) {
    const v = (f.details[d.key] || '').trim();
    if (!v) continue;
    if (d.kind === 'uri' && !isLink(v)) out.push(d.key);
    if (d.kind === 'uris' && lines(v).some((u) => !isLink(u))) out.push(d.key);
  }
  return out;
}

/** The form → the body the server takes (POST /authorities or PUT /authorities/:id). Other keys already in
 *  the entity's data (from a MARC import, say) are kept. */
export function payloadFrom(f: EntityForm, previousData: Record<string, unknown> = {}) {
  const fields = detailFields(f.kind, f.agentType);
  const data: Record<string, unknown> = { ...previousData };
  // Fields of another agent type (a person's dates on what is now an organization) are dropped.
  if (f.kind === 'agent') for (const t of AGENT_TYPES) for (const d of detailFields('agent', t)) delete data[d.key];
  for (const d of fields) {
    const v = (f.details[d.key] || '').trim();
    if (!v) delete data[d.key];
    else data[d.key] = d.kind === 'uris' ? lines(v) : v;
  }
  if (f.kind === 'agent') data.agentType = f.agentType;
  else delete data.agentType;
  const label = f.label.trim();
  return {
    kind: f.kind,
    label,
    variants: lines(f.variants).filter((v) => v !== label),
    sameAs: lines(f.sameAs),
    note: f.note.trim(),
    data,
  };
}

/** True when the text has Arabic letters (so a romanized form can be offered). */
export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
