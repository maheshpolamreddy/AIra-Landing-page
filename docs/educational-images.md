# Educational image generation

Landing route: `POST /api/ai/image` (Firebase auth or content bridge in local dev).

## Environment (server-only)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NVIDIA_API_KEY` | Recommended | Primary NVIDIA API key (`nvapi-…`) |
| `NVIDIA_API_KEY_FALLBACK` | Recommended | Second key if primary fails |
| `NVIDIA_IMAGE_MODEL` | No | Default `black-forest-labs/flux.1-dev` (better prompt match) |
| `NVIDIA_IMAGE_MODEL_FALLBACK` | No | Default `black-forest-labs/flux.2-klein-4b` |
| `NVIDIA_IMAGE_BASE_URL` | No | Default `https://ai.api.nvidia.com` (GenAI host) |
| `GROQ_API_KEY` | For SVG fallback | Builds structured diagram JSON when NVIDIA GenAI fails |

Add these to `.env.local` / Vercel project env. **Never commit real `nvapi-…` values.** If a key was pasted into chat, rotate it in the NVIDIA console.

Hosted image generation uses `POST {BASE}/v1/genai/{model}` (not `integrate.api.nvidia.com/v1/images/generations`, which 404s for trial keys; Qwen-Image is downloadable NIM-only).

## Fallback chain

1. Specialized SVG when the **student message** asks for number line / solar system / water cycle / photosynthesis / circuit (lesson topic alone never forces this). Blank white NVIDIA frames are rejected and fall through.
2. Groq rewrites the student ask into a precise, unique image prompt (lesson title is secondary)
3. Primary key → `flux.1-dev`, then `flux.2-klein-4b`
4. Fallback key → same model list
5. Groq → SVG `NoteDiagram` JSON (UI renders with `NotesDiagram`)

## Clients

- Teaching chat: tutor `aiService.generateEducationalImage` after answers that need a diagram
- Studio notes: `resourceStore.generateNotes` enriches 1–2 sections with `imageUrl` or SVG diagrams
