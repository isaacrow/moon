/**
 * Moon's own values and imported ones, kept apart (Phase 13 S18, step 2). When an entity is copied from, or
 * refreshed from, LC or Wikidata, Moon keeps what that source said as a layer of its own
 * (data.imported[<source address>] = { at, label, variants, details }). The entity's values are then read as:
 * a value the source gave and nobody changed is imported; anything else is the cataloguer's own.
 *
 * A refresh from a source:
 * - updates a detail only while it still holds the source's earlier value (an edited one is the cataloguer's);
 * - adds the source's new name forms and details; removes name forms only that source gave and has dropped;
 * - never changes the entity's own name (a new name from the source becomes another form of the name);
 * - keeps the new layer, so the next refresh compares with it.
 * Kept free of React so the tests can run it.
 */
import type { EntityForm } from '../app/utils/entityForm';
import type { EntityDraft } from './entityImport';

export interface ImportedLayer { at: string; label: string; variants: string[]; details: Record<string, string> }
export type ImportedLayers = Record<string, ImportedLayer>;

const lines = (s: string) => [...new Set(s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
const norm = (s: string | undefined) => (s || '').trim();

/** What a source said, as a layer to keep. */
export function layerFrom(d: EntityDraft, at = new Date().toISOString()): ImportedLayer {
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.details)) if (norm(v)) details[k] = norm(v);
  return { at, label: norm(d.label), variants: [...new Set(d.variants.map(norm).filter(Boolean))], details };
}

export interface RefreshChange { kind: 'added' | 'updated' | 'removed' | 'kept-own'; field: string; value: string; was?: string }

/**
 * The form after refreshing from one source: `old` is what that source said last time (none for the first
 * time), `next` what it says now; `others` are the other sources' layers, so a name form another source also
 * gives is not removed. Returns the new form and what changed, for the cataloguer to see before saving.
 */
export function refreshFromSource(form: EntityForm, old: ImportedLayer | undefined, next: ImportedLayer, others: ImportedLayer[] = []):
  { form: EntityForm; changes: RefreshChange[] } {
  const changes: RefreshChange[] = [];
  const label = norm(form.label);

  // Name forms: add the source's new ones (and its name, when it differs from Moon's); drop only forms this
  // source gave before, has dropped now, and no other source gives.
  const offered = [...next.variants, ...(next.label && next.label !== label ? [next.label] : [])];
  const before = new Set([...(old?.variants || []), ...(old?.label ? [old.label] : [])]);
  const stillGiven = new Set([...offered, ...others.flatMap((o) => [...o.variants, o.label])]);
  let variants = lines(form.variants);
  for (const v of variants) {
    if (before.has(v) && !stillGiven.has(v)) changes.push({ kind: 'removed', field: 'variants', value: v });
  }
  variants = variants.filter((v) => !(before.has(v) && !stillGiven.has(v)));
  for (const v of offered) {
    if (v !== label && !variants.includes(v)) { variants.push(v); changes.push({ kind: 'added', field: 'variants', value: v }); }
  }

  // Details: the source's value replaces the entity's only while the entity still holds the source's old one.
  const details = { ...form.details };
  const keys = new Set([...Object.keys(next.details), ...Object.keys(old?.details || {})]);
  for (const k of keys) {
    const mine = norm(details[k]);
    const was = norm(old?.details[k]);
    const now = norm(next.details[k]);
    if (mine === now) continue;
    if (!mine) {
      if (now) { details[k] = now; changes.push({ kind: 'added', field: k, value: now }); }
    } else if (old && mine === was) {
      if (now) { details[k] = now; changes.push({ kind: 'updated', field: k, value: now, was }); }
      else { delete details[k]; changes.push({ kind: 'removed', field: k, value: was }); }
    } else if (now) {
      changes.push({ kind: 'kept-own', field: k, value: mine, was: now });
    }
  }
  return { form: { ...form, variants: variants.filter((v) => v !== label).join('\n'), details }, changes };
}

/** Which of an entity's values are imported from a source (and which source); everything else is Moon's own. */
export function originOf(field: string, value: string, layers: ImportedLayers): string | null {
  const v = norm(value);
  if (!v) return null;
  for (const [source, layer] of Object.entries(layers)) {
    if (field === 'variants' ? layer.variants.includes(v) || layer.label === v : norm(layer.details[field]) === v) return source;
  }
  return null;
}
