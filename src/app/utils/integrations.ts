/**
 * External systems Moon can talk to. They stay off until a real server runs behind mooon.site:
 * the clients point at localhost, so in production they only show made-up status and counts.
 * Turn one on at build time, e.g. VITE_FOLIO_ENABLED=true.
 */
export const FOLIO_ENABLED = import.meta.env?.VITE_FOLIO_ENABLED === 'true';
export const VUFIND_ENABLED = import.meta.env?.VITE_VUFIND_ENABLED === 'true';
