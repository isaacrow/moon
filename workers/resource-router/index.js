// Cloudflare Worker on mooon.site/resource/*: makes Moon's record URIs resolve. GitHub Pages only
// serves files, so these addresses are passed to the Moon server, which answers with the published
// record as JSON-LD, Turtle or N-Triples, or sends a browser to the record's OPAC page. Every other
// address on mooon.site never reaches this Worker (see the route in wrangler.toml).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const target = `${env.MOON_API}${url.pathname}${url.search}`;
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Accept: request.headers.get('Accept') || '*/*',
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
    if ((url.pathname === '/resource' || url.pathname === '/resource/') && (response.headers.get('Content-Type') || '').startsWith('text/plain')) {
      response.headers.set('Content-Type', 'text/html; charset=utf-8');
    }
    return response;
  },
};
