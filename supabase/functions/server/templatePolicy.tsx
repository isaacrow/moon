/**
 * Field templates with an owner and a version (Phase 13 S18). The editor saves the whole list of templates
 * at once; this decides, template by template, what the save may change:
 * - a new template belongs to whoever saved it (version 1);
 * - a changed template must be changed by its owner or the Super Admin, from the latest version (a save from
 *   an older copy is refused for that template, so nobody's newer change is lost); it gets the next version
 *   and the earlier one goes to its history;
 * - a template missing from the save is removed only when the saver knew it (it was in their copy) and may
 *   change it; a template someone else added meanwhile is never removed by a save that did not know it.
 * No imports: the edge function stores the result; the tests run it in Node.
 */

export interface Template { id: string; owner?: string; version?: number; updatedBy?: string; updatedAt?: string; [k: string]: unknown }
export interface Saver { username: string; admin: boolean }
export interface TemplateRefusal { id: string; name?: string; reason: 'not-owner' | 'stale' }

const META = new Set(['owner', 'version', 'updatedBy', 'updatedAt']);
const content = (t: Template) => JSON.stringify(Object.keys(t).filter((k) => !META.has(k)).sort().map((k) => [k, t[k]]));
const mayChange = (t: Template, who: Saver) => who.admin || !t.owner || t.owner === who.username;

export function applyTemplateSave(stored: Template[], incoming: Template[], known: string[] | undefined, who: Saver, now: string):
  { templates: Template[]; refused: TemplateRefusal[]; previous: Template[] } {
  const refused: TemplateRefusal[] = [];
  const previous: Template[] = [];
  const byId = new Map(stored.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: Template[] = [];

  for (const t of incoming) {
    if (!t || typeof t.id !== 'string' || !t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    const old = byId.get(t.id);
    if (!old) {
      out.push({ ...t, owner: who.username, version: 1, updatedBy: who.username, updatedAt: now });
      continue;
    }
    if (content(old) === content(t)) { out.push(old); continue; }
    const name = typeof old.name === 'string' ? old.name : undefined;
    if (!mayChange(old, who)) { refused.push({ id: t.id, name, reason: 'not-owner' }); out.push(old); continue; }
    if (typeof t.version === 'number' && typeof old.version === 'number' && t.version < old.version) {
      refused.push({ id: t.id, name, reason: 'stale' });
      out.push(old);
      continue;
    }
    previous.push(old);
    out.push({ ...t, owner: old.owner || who.username, version: (old.version || 1) + 1, updatedBy: who.username, updatedAt: now });
  }

  // Templates the save left out.
  const knew = new Set(known || []);
  for (const old of stored) {
    if (seen.has(old.id)) continue;
    if (knew.has(old.id) && mayChange(old, who)) { previous.push(old); continue; } // removed on purpose
    if (knew.has(old.id)) refused.push({ id: old.id, name: typeof old.name === 'string' ? old.name : undefined, reason: 'not-owner' });
    out.push(old);
  }
  return { templates: out, refused, previous };
}
