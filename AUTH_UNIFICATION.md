# Unified auth (Option A) — local + deploy notes

## Architecture
- **Landing (Next.js :3000)** owns `/`, `/login`, `/signup`, marketing, and is the production host.
- **Tutor (Vite :5173)** owns `/student/*`, `/teacher/*`, `/admin/*`, `/dev/*`.
- Both use Firebase project **`aira-landingpage`**.
- Production: landing `vercel.json` rewrites tutor paths to `https://ai-ra-app.vercel.app`.
- Local: landing `next.config.mjs` rewrites those paths to `http://localhost:5173`.

## Local development
```bash
# One-shot (from landing repo): bash scripts/cloud-agent-install.sh && bash scripts/dev-both.sh

# Terminal 1 — tutor
cd ~/AIra-AI-tutor   # or your clone path
npm run dev          # http://127.0.0.1:5173

# Terminal 2 — landing (proxies tutor routes + owns /api/*)
cd "…/AIra-Landing-page"
pnpm dev             # http://127.0.0.1:3000
```
Open **http://127.0.0.1:3000** (or localhost) only. Sign in at `/login`, then you should land on the role home under the same origin.

Both apps bind to IPv4 `127.0.0.1` in dev so Windows/Linux localhost IPv6 mismatches do not break the landing↔tutor proxy.

### API routing
- Landing owns `/api/tts`, `/api/tts/health`, `/api/chat`, `/api/waitlist` (Next.js route handlers).
- Tutor Vite proxies `/api/*` → landing `:3000` so direct `:5173` access still works.
- Do **not** rewrite `/api/*` to the tutor SPA in `next.config.mjs` / landing `vercel.json`.
- Production tutor host (`ai-ra-app.vercel.app`) serves its own `/api/tts` + `/api/waitlist` serverless functions.

## Post-login homes (Firestore `users/{uid}.role`)
- student → `/student/mode-selection`
- teacher → `/teacher/dashboard`
- admin → `/admin/dashboard`

## Demo roles
`/dev/demo-roles` — DEV or authenticated admin only. Not a public login.

## Roll-number auth
Still in tutor `authStore` only (not on landing UI). Confirm whether to migrate before removing.
