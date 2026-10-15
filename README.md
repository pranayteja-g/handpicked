# Handpicked - M0 spike

Goal: find which free host + backend path works from mainland China.

## Setup
1. `cp .env.example .env`, fill Supabase URL + anon key.
2. `npm i && npm run dev`

## Deploy proxy (Cloudflare Worker)
1. Edit `worker/wrangler.toml` -> `SUPABASE_URL`.
2. `cd worker && npx wrangler login && npx wrangler deploy`
3. Put resulting `*.workers.dev` URL in `VITE_PROXY_URL`.

## Deploy page (2+ hosts)
- **Cloudflare Pages**: connect repo, build `npm run build`, out `dist`, set 3 `VITE_*` env vars, `VITE_BASE=/`.
- **GitHub Pages**: add 3 repo secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PROXY_URL`); Settings > Pages > Source = GitHub Actions; push to `main`.
- **Netlify** (optional): same as CF Pages.

## China tester checklist (per URL)
- [ ] Wi-Fi: open URL, tap Run tests, copy report, send
- [ ] Mobile data (each carrier if possible): same
- [ ] Note: page load time (rough), any blank screen

## Decide
- Host: pick fastest/most reliable URL(s) from reports.
- Backend: Supabase direct OK? else proxy OK? else swap backend.
