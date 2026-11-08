// Cloudflare Worker on mooon.site/resource/*: makes Moon's record URIs resolve. GitHub Pages only
// serves files, so these addresses are passed to the Moon server, which answers with the published
// record as JSON-LD, Turtle or N-Triples, or sends a browser to the record's OPAC page. Every other
// address on mooon.site never reaches this Worker (see the route in wrangler.toml).
// It also opens the live rooms at mooon.site/live/records/<id>, where catalogers on the same
// record see each other (liveGate.js checks the ticket, liveRoom.js is the room).

import { handleLive } from './liveGate.js';

export { LiveRoom } from './liveRoom.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/live/')) return handleLive(request, env);
    // The SPARQL endpoint also takes POSTed queries (and the browser's CORS preflight for them).
    const isSparql = url.pathname === '/resource/sparql';
    // Moon's MCP server for AI agents (JSON-RPC over POST; a cataloguer's X-Moon-Session for drafts).
    const isMcp = url.pathname === '/resource/mcp';
    if ((isSparql || isMcp) && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': isMcp ? 'Content-Type, Accept, X-Moon-Session, Mcp-Protocol-Version, Mcp-Session-Id' : 'Content-Type, Accept',
        'Access-Control-Max-Age': '86400',
      } });
    }
    const allowed = isSparql || isMcp ? ['GET', 'HEAD', 'POST'] : ['GET', 'HEAD'];
    if (!allowed.includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: allowed.join(', ') } });
    }
    // https://mooon.site/sitemap.xml (every published record's page, for search engines) is built by the server.
    // The public API (see /api.html): /resource/search searches the published catalogue only, and
    // /resource/authorities searches Moon's authority file.
    let path = url.pathname;
    const search = new URLSearchParams(url.search);
    if (path === '/sitemap.xml') path = '/resource/sitemap.xml';
    else if (path === '/resource/search') { path = '/records/search'; search.set('view', 'published'); }
    else if (path === '/resource/authorities') path = '/authorities';
    const qs = search.toString();
    const target = `${env.MOON_API}${path}${qs ? `?${qs}` : ''}`;
    const upstream = await fetch(target, {
      method: request.method,
      body: request.method === 'POST' ? await request.text() : undefined,
      headers: {
        Accept: request.headers.get('Accept') || '*/*',
        ...(request.method === 'POST' ? { 'Content-Type': request.headers.get('Content-Type') || (isMcp ? 'application/json' : 'application/sparql-query') } : {}),
        ...(isMcp && request.headers.get('X-Moon-Session') ? { 'X-Moon-Session': request.headers.get('X-Moon-Session') } : {}),
        ...(isMcp && request.headers.get('Mcp-Protocol-Version') ? { 'Mcp-Protocol-Version': request.headers.get('Mcp-Protocol-Version') } : {}),
        // The public key the website itself uses; the server decides what may be shown (published only).
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
      // A browser's 303 to the OPAC page goes back to the browser as it is.
      redirect: 'manual',
    });
    const response = new Response(upstream.body, upstream);
    response.headers.set('Access-Control-Allow-Origin', '*');
    // Supabase sends every HTML page from its functions as text/plain; the record list at /resource/
    // is a web page, so label it as one.
    if ((url.pathname === '/resource' || url.pathname === '/resource/' || isSparql) && (response.headers.get('Content-Type') || '').startsWith('text/plain')) {
      response.headers.set('Content-Type', 'text/html; charset=utf-8');
    }
    return response;
  },
};
