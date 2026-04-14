# HANDOFF — AAAC Video Generator Dashboard

> Last updated: 2026-04-13. Read this before diving into any code.

---

## What this project is

AAAC Video Generator Dashboard — a Next.js 16 app for batch-generating local SEO marketing videos.

It reads keyword/scene data from Google Sheets, submits jobs to an external video generation API, polls for completion, and writes the resulting video URLs back to the sheet.

---

## Current state (as of 2026-04-13)

- App is **fully built and working**
- Deployed to Cloudflare Workers: https://aaac-video-generator.brightfox-digital.workers.dev
- All endpoints verified working:
  - `/api/health`
  - `/api/video/jobs`
  - `/api/keywords`

---

## Key files

| What | Path |
|---|---|
| App root | `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\` |
| README (read this first) | `C:\Users\Banana\Documents\dan-dev\video-generator-api\README.md` |
| Build plan | `C:\Users\Banana\Documents\dan-dev\video-generator-api\PLAN.md` |
| Stage-by-stage prompts | `C:\Users\Banana\Documents\dan-dev\video-generator-api\META-PROMPTS.md` |
| Wrangler config | `app/wrangler.toml` |

---

## Tech stack

- **Framework:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Deployment:** `@opennextjs/cloudflare` adapter — webpack build (NOT turbopack)
- **Job persistence:** Cloudflare KV (binding: `JOBS_KV`)
- **Sheets integration:** Google Sheets API via raw `fetch` + Web Crypto JWT (no `googleapis` package — avoids Node-only APIs incompatible with Cloudflare Workers)
- **Video API:** `https://mediagenerationapi-production.up.railway.app` (user: `daniel`, pass: `daniel1234`)

---

## Secrets

All secrets live in the **Cloudflare dashboard** (not in the repo):

| Secret name | What it is |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | Full JSON key for service account `application-account3` (file: `cloud-storage-340122-205129d4acab.json`) |
| `VIDEO_API_USER_ID` | `daniel` |
| `VIDEO_API_PASSWORD` | `daniel1234` |

---

## Google Sheet

- **Sheet ID:** `1hijw2clTvmZV2qxu6u0GnwR8fd1HbbcfbjJRzuvn0Rk`

| Tab | GID |
|---|---|
| TITLE | 0 |
| AUDIO | 133642313 |
| FINAL_OUTPUT | 1677247627 |
| KEYWORDS | 1758979414 |
| VIDEO_CLIPS | 1869172958 |
| CAPTIONS | 204559524 |
| CONTROL_PANEL | 204732952 |
| BG_MUSIC | 480985891 |
| PHONETIC_TEXT | 774757930 |
| MAKE_VIDEO_FLAGS | 889953456 |

---

## Workflow rules (follow these)

- **Main context window** = decisions and direction only — keep it lean
- **Code edits / git / implementation** → Sonnet sub-agent
- **Planning / architecture** → Opus sub-agent
- **Mechanical edits / formatting** → Haiku sub-agent

---

## Redeploy command

```bash
cd app && npm run deploy
```

---

## Next steps / what's left

Nothing was explicitly planned next — the user will direct. Potential areas:

- Adding new features to the dashboard
- UI improvements
- Monitoring / error alerting
- Custom domain setup on Cloudflare

---

## Cloudflare Account Migration Note (2026-04-14)

- Received KV free tier limit email (>1000 writes/day) from Cloudflare after the migration to the agency paid account
- Personal (free) account: `Daniel@brightfoxdigital.agency's Account` — old worker + KV namespaces deleted 2026-04-14
- Agency (paid) account: `Marketing@brightfoxdigital.agency's Account` ($5/mo — 1M writes/day) — current active account
- Both accounts are accessible under the `daniel@brightfoxdigital.agency` Cloudflare login
- RESOLVED: old worker and 3 KV namespaces deleted from personal account via wrangler on 2026-04-14
- wrangler.toml correctly points to agency account (`bb44c9b37ef496cf4101616fc6c49fd8`)
