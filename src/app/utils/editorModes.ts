/**
 * Two ways into Moon Studio for people who are learning or who are not cataloguers (Phase 13 S22):
 *
 * - Practice: a copy of a real published record opens in the editor; every check runs on save, but the
 *   record is kept only in this browser and never reaches the catalogue, its review queue or FOLIO.
 * - Simple mode: only the fields a language expert needs (title, people, language, subject, summary, the
 *   edition's statement, publication and extent); everything else stays as it is, just out of sight.
 */

/** The fields simple mode shows, per entity (the editor's property names). */
export const SIMPLE_FIELDS: Record<string, Set<string>> = {
  Work: new Set(['bf:title', 'bf:contribution', 'bf:language', 'bf:subject', 'bf:genreForm', 'bf:summary', 'bf:note', 'bf:translationOf']),
  Instance: new Set(['bf:title', 'bf:responsibilityStatement', 'bf:editionStatement', 'bf:provisionActivity', 'bf:extent', 'bf:identifiedBy', 'bf:note']),
};

const SIMPLE_KEY = 'moon-simple-mode';
const PRACTICE_KEY = 'moon-practice-records';
export const PRACTICE_MAX = 20;

export function readSimpleMode(): boolean {
  try { return localStorage.getItem(SIMPLE_KEY) === '1'; } catch { return false; }
}
export function writeSimpleMode(on: boolean): void {
  try { if (on) localStorage.setItem(SIMPLE_KEY, '1'); else localStorage.removeItem(SIMPLE_KEY); } catch { /* storage blocked */ }
}

export interface PracticeRecord { id: string; title: string; savedAt: string; from?: string; document: unknown }

export function practiceRecords(): PracticeRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRACTICE_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/** Keeps a practice save in this browser (the newest first, at most PRACTICE_MAX); returns the list. */
export function keepPractice(rec: PracticeRecord, list = practiceRecords()): PracticeRecord[] {
  const next = [rec, ...list.filter((r) => r.id !== rec.id)].slice(0, PRACTICE_MAX);
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(next)); } catch { /* full or blocked: the practice is still checked */ }
  return next;
}

/**
 * A published record turned into a practice copy: no storage id (so nothing can save over the real one),
 * marked as practice, and saying where it came from.
 */
export function practiceCopy<R extends { metadata?: Record<string, unknown> }>(record: R, fromId: string): R {
  const { storageId: _s, serverVersion: _v, ...meta } = (record.metadata || {}) as Record<string, unknown>;
  return { ...record, metadata: { ...meta, practice: true, practiceFrom: fromId } };
}

export const isPractice = (record: { metadata?: Record<string, unknown> } | null | undefined): boolean => !!record?.metadata?.practice;
