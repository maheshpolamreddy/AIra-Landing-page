# AIra Landing Page

Marketing site, auth UI, and API routes for the AIra platform. In production this host also rewrites tutor app paths to the AI Tutor Vercel deployment.

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000.

For full local stack (landing + tutor proxy), clone the tutor sibling and run:

```bash
bash scripts/cloud-agent-install.sh
bash scripts/dev-both.sh
```

See [`AUTH_UNIFICATION.md`](./AUTH_UNIFICATION.md) for architecture and [`COLLABORATION.md`](./COLLABORATION.md) for the two-developer GitHub + Vercel workflow.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js on `:3000` (proxies tutor routes in development) |
| `pnpm build` | Production build (+ auth domain sync when service account is set) |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm auth:sync-domains` | Sync Firebase authorized domains |

## Deploy

Linked to Vercel project **aira-landing-page-elite**. Merges to `main` deploy production: https://aira-landing-page-elite.vercel.app/
