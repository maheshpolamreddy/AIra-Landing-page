# Unified auth (Option A) — local + deploy notes

## Architecture
- **Landing (Next.js :3000)** owns `/`, `/login`, `/signup`, marketing, and is the production host.
- **Tutor (Vite :5173)** owns `/student/*`, `/teacher/*`, `/admin/*`, `/dev/*`.
- Both use Firebase project **`aira-landingpage`**.
- Production: landing `vercel.json` rewrites tutor paths to `https://ai-ra-app.vercel.app`.
- Local: landing `next.config.mjs` rewrites those paths to `http://localhost:5173`.

## Local development
```bash
# Terminal 1 — tutor
cd "…/AIra Project/Project"
npm run dev          # http://localhost:5173

# Terminal 2 — landing (proxies tutor routes + owns /api/*)
cd "…/AIra landing page"
pnpm dev             # http://localhost:3000
```
Open **http://localhost:3000** only. Sign in at `/login`, then you should land on the role home under the same origin.

### API routing
- Landing owns `/api/tts`, `/api/tts/health`, `/api/chat`, `/api/waitlist`, `/api/welcome` (Next.js route handlers).
- Tutor Vite proxies `/api/*` → landing `:3000` so direct `:5173` access still works.
- Do **not** rewrite `/api/*` to the tutor SPA in `next.config.mjs` / landing `vercel.json`.
- Production tutor host (`ai-ra-app.vercel.app`) serves its own `/api/tts` + `/api/waitlist` serverless functions.

## Welcome email (new accounts only)
Branded “Welcome to AIra” mail is sent from landing `/api/welcome` **once per new account**:
- New OAuth (Google / Apple / Microsoft): when `isNewUser === true`
- New email/password: **after** email verification succeeds (not at signup)

Returning logins never request welcome. Firestore `welcomeEmailSent` + claim-before-send make sends idempotent.

### Required env (`.env.local` + Vercel `aira-landing-page-elite`)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=airaaitutor@gmail.com
SMTP_PASS=<Google App Password>
SMTP_FROM="AIra <airaaitutor@gmail.com>"
```
Optional but recommended for domain sync / Admin SDK:
```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```
Without SMTP, signup still works; welcome mail fails and is logged. Without a service account, `/api/welcome` still works via Firebase/Firestore REST + the caller's ID token (needs `NEXT_PUBLIC_FIREBASE_*` at build time). Email copy always spells the brand as **AIra** (ASCII).

## Post-auth navigation
- student → always `/student/mode-selection` (Mode Selection)
- teacher → `/teacher/dashboard`
- admin → `/admin/dashboard`

## Logout
Logout from tutor or landing header clears the session and navigates to the **Landing Page** (`/`), never `/login`.

## Demo roles
`/dev/demo-roles` — DEV or authenticated admin only. Not a public login.

## Roll-number auth
Still in tutor `authStore` only (not on landing UI). Confirm whether to migrate before removing.
