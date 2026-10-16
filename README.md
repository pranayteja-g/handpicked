# Handpicked

Private friends-only recommendations app. React + Vite + TypeScript PWA, Supabase backend, hosted free on GitHub Pages.

Status: **M2** (M1 + create/send recommendations, inbox with unread badge, sent list, one compressed photo per recommendation, recipient visibility). Reachability test lives at `#/spike`.

## Auth model
- No email, no password to invent. Pick a username -> app generates a **secret key** (`XXXXX-XXXXX-XXXXX-XXXXX`) shown once.
- Under the hood: Supabase email+password auth with a synthetic email `username@handpicked.invalid` and the key as password.
- Lost key but still signed in on a device: Settings -> "Get a new secret key".
- Lost key and signed out everywhere: account unrecoverable (by design, no email).

## Setup (new Supabase project)
1. supabase.com -> New project (free tier allows 2 active; pause an old one if needed). Keep the DB password somewhere.
2. **Authentication -> Providers -> Email**: keep enabled, turn **OFF "Confirm email"**.
3. **SQL Editor** -> paste all of `supabase/migrations/0001_m1_core.sql` -> Run. Expect "Success".
4. **Project Settings -> API**: copy Project URL + `anon` key (never `service_role`).
5. `cp .env.example .env`, fill the two values. `npm install && npm run dev`.
6. Test: create profile -> save key -> Friends page -> Create invite link.
7. Test friendship: open the invite link in a private window -> Create profile -> Accept. Both users should now list each other.

If sign-up says the server rejected the email domain, set `VITE_AUTH_EMAIL_DOMAIN` in `.env` (and in the deploy env) to any domain with real DNS/MX records, e.g. one you own. Pick it before real users sign up: it is part of every login.

## M2 setup (after M1 works)
1. SQL Editor -> paste all of `supabase/migrations/0002_m2_recommendations.sql` -> Run. It also creates the private `rec-images` storage bucket (400 KB cap, webp/jpeg only).
2. Redeploy the app (push). No new env vars.
3. Test with two accounts that are friends: A -> New -> pick B (add a photo) -> Send. B: Inbox shows a badge and an unread card; open it, the badge clears.
4. Third account C who is a friend of A but not picked: sees nothing. B and C both picked: each sees the other's name under "Sent to".

Known gaps (by design for now): no link previews (needs a server function), photo cannot be changed when editing, orphaned image files are not auto-cleaned yet (planned with the song-snippet cleanup job).

## Deploy (GitHub Pages)
- Repo -> Settings -> Secrets -> Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (update to the NEW project's values).
- `VITE_PROXY_URL` secret is optional: leave it unset unless supabase.co is blocked for someone.
- Push to `main` -> workflow deploys. URL: `https://<user>.github.io/<repo>/`.

## Layout
- `src/data/api.ts` - every backend call (UI never touches Supabase directly).
- `src/i18n/en.ts` - all UI strings.
- `src/data/recs.ts` - recommendation queries, image upload, unread count.
- `src/pages/` - Welcome, SignUp, Login, Join, Friends, Settings, Spike, RecList (inbox/sent), Compose (new/edit), RecDetail.
- `supabase/migrations/` - SQL (tables, RLS, RPCs). Run in order.
- `worker/` - optional Cloudflare Worker proxy, only if Supabase is unreachable somewhere.

## Security notes
- Anon key is public by design; data safety = RLS (enabled on every table, minimum grants).
- Friends can see each other's profile only. Strangers see nothing. Invite preview exposes only the owner's display name + username, and only to someone holding the code.
- Never put `service_role` in the frontend or in CI secrets for this repo.
