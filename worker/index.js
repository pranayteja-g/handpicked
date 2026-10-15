// Thin Supabase proxy for Cloudflare Workers (*.workers.dev).
// Set SUPABASE_URL as a var (wrangler.toml). Forwards REST, auth, storage, realtime WS.
// Passes through everything incl. Upgrade headers; adds CORS.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const upstream = new URL(env.SUPABASE_URL);
    const url = new URL(request.url);
    url.protocol = upstream.protocol;
    url.host = upstream.host;

    const headers = new Headers(request.headers);
    headers.set("host", upstream.host);

    const resp = await fetch(new Request(url.toString(), { method: request.method, headers, body: request.body, redirect: "manual" }));

    // WebSocket upgrade: return as-is
    if (resp.status === 101) return resp;

    const out = new Response(resp.body, resp);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};
