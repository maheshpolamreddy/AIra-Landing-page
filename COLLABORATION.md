# AIra collaborative development (GitHub + Vercel)

Two equal collaborators share these repositories:

| App | Repo | Local | Production |
|-----|------|-------|------------|
| Landing | [AIra-Landing-page](https://github.com/maheshpolamreddy/AIra-Landing-page) | `pnpm dev` → `:3000` | https://aira-landing-page-elite.vercel.app |
| Tutor | [AIra---AI-tutor](https://github.com/maheshpolamreddy/AIra---AI-tutor) | `npm run dev` → `:5173` | Vercel project [ai-ra-app](https://vercel.com/mahesh-polamreddys-projects/ai-ra-app) |

Architecture notes live in [`AUTH_UNIFICATION.md`](./AUTH_UNIFICATION.md). Landing owns marketing + auth UI; tutor owns `/student`, `/teacher`, `/admin`, `/dev`. Production rewrites on the landing Vercel project proxy tutor paths to `ai-ra-app.vercel.app`.

## First-time local setup (both developers)

```bash
# 1) Clone both repos as siblings (recommended)
mkdir -p ~/aira && cd ~/aira
git clone https://github.com/maheshpolamreddy/AIra-Landing-page.git
git clone https://github.com/maheshpolamreddy/AIra---AI-tutor.git

# 2) Install + env (from landing)
cd AIra-Landing-page
bash scripts/cloud-agent-install.sh
# Or set AIRA_TUTOR_DIR if tutor is not at ~/AIra-AI-tutor:
# AIRA_TUTOR_DIR=~/aira/AIra---AI-tutor bash scripts/cloud-agent-install.sh

# 3) Copy env files if install did not create them
cp .env.example .env.local          # landing — fill secrets if needed
cp ~/AIra-AI-tutor/.env.example ~/AIra-AI-tutor/.env   # tutor

# 4) Start both (or use two terminals)
bash scripts/dev-both.sh
# Open http://localhost:3000 only
```

Public Firebase client config already has safe defaults in code / `.env.example`. Keep `GROQ_API_KEY`, `SARVAM_API_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON` in **Vercel project env** and local `.env.local` / `.env` — never commit them.

## Daily Git workflow (minimize merge conflicts)

Both collaborators have full push access. Prefer short-lived feature branches and PRs over direct pushes to `main`.

```bash
# Start from latest main
git checkout main
git pull origin main

# Feature branch (one concern per branch)
git checkout -b feature/short-description

# Commit often with clear messages
git add -A
git commit -m "Explain why this change exists"

# Pull before push; prefer rebase for clean history on your feature branch
git fetch origin
git rebase origin/main   # or: git pull --rebase origin main
git push -u origin HEAD

# Open a PR on GitHub, wait for review / green checks, then merge
```

### Conflict hygiene

- Pull / rebase **before** starting work and again **before** opening a PR.
- Avoid editing the same hot files (`vercel.json`, `next.config.mjs`, shared auth) in parallel — coordinate briefly in chat.
- Never force-push `main`. Force-push feature branches only if you own them and no one else is based on them (`git push --force-with-lease`).
- After merge, delete the feature branch and `git pull` on `main` locally.

### Cross-repo changes

If a change needs both landing rewrites and tutor routes:

1. Land the tutor PR first (or a coordinated pair of PRs).
2. Update landing rewrites / proxy config in a second PR.
3. Redeploy tutor, then landing, so production rewrites always target a live tutor build.

## Vercel deployment (both developers)

Each GitHub repo should be linked to its Vercel project with **Production Branch = `main`**.

| Action | How |
|--------|-----|
| Preview deploy | Push a branch / open a PR → Vercel builds a preview URL automatically |
| Production deploy | Merge to `main` (preferred) or `vercel --prod` from a clean `main` |
| Env vars | Set in Vercel Project Settings → Environment Variables (Production + Preview). Mirror locally in `.env.local` / `.env` |
| Redeploy | Vercel dashboard → Deployments → Redeploy, or push an empty commit only if needed |

CLI (optional, same account access for both collaborators):

```bash
# Landing
cd AIra-Landing-page && npx vercel --prod

# Tutor
cd AIra---AI-tutor && npm run deploy   # vercel --prod --yes
```

After production deploys, smoke-test:

1. Landing home + `/login` / `/signup`
2. Authenticated role home (`/student/...`, `/teacher/...`, `/admin/...`) via landing host
3. Landing `/api/tts/health` (and chat if keys are set)

## Cursor Cloud Agents

`.cursor/environment.json` installs both apps and declares the tutor repo as a dependency. After merging this config to `main`, create/update the Cloud Agents environment in the [dashboard](https://cursor.com/dashboard/cloud-agents#environments) as a **multi-repo** environment that includes both:

1. `maheshpolamreddy/AIra-Landing-page`
2. `maheshpolamreddy/AIra---AI-tutor`

That gives both collaborators’ agents clone + push access to each repo. Add secrets (`GROQ_API_KEY`, etc.) in the environment Secrets tab — not in git.

## Checklist for a safe release

- [ ] Feature branch rebased on latest `main`
- [ ] Local `pnpm build` (landing) / `npm run build` (tutor) succeeds
- [ ] Preview deploy looks good
- [ ] Merge PR → wait for production deploy
- [ ] Smoke-test production URLs
- [ ] Tell the other collaborator to `git pull` before their next push
