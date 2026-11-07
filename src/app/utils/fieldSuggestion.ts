// "Suggest a change" (Phase 13 S4): the text a field holds now, to start a suggestion from, and the field's
// value with an accepted suggestion put in, in the same shape the field already has. Kept free of React so
// the tests can run it.

/** A field's value as one line of text: a string, a JSON-LD value object, or a list of one of those. */
export function fieldText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '' : value.length === 1 ? fieldText(value[0]) : null;
  if (typeof value === 'object' && typeof (value as any)['@value'] === 'string') return (value as any)['@value'];
  return null; // a linked entity or a structure: not one line of text
}

/**
 * The field's new value with the suggested text in, keeping its shape (and a language tag); null when the
 * field is not plain text, so the cataloger puts the suggestion in by hand.
 */
export function withSuggested(current: unknown, text: string): unknown | null {
  if (fieldText(current) === null) return null;
  if (current === undefined || current === null || current === '' || typeof current === 'string') return text;
  if (typeof current === 'number') return Number.isFinite(Number(text)) ? Number(text) : text;
  if (Array.isArray(current)) {
    if (current.length === 0) return [text];
    const inner = withSuggested(current[0], text);
    return inner === null ? null : [inner];
  }
  return { ...(current as object), '@value': text };
}
