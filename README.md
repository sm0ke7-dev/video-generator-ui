# AAAC Video Generator Dashboard

A Next.js dashboard for batch-generating local-SEO marketing videos from a Google Sheet. Users pick keyword rows, the app assembles a scene list from the sheet tabs, submits jobs to an external video-generation API, polls until each job completes, and writes the finished video/audio URLs back into the same sheet.

This README is the orientation doc for anyone (human or LLM) who needs to add features, debug, or deploy this app. It assumes you have **not** read the code yet.

---

## 1. What the app does (end-to-end flow)

1. **User pastes a Google Sheet URL/ID** into the dashboard and clicks **Load**.
2. The app reads several tabs from that sheet (see §4), joins them by `title`, and shows each keyword as a row in a table.
3. User selects one or many rows and clicks **Generate**.
4. For each selected keyword, the app assembles a payload (resolution, background music, scene list of clip URL + caption + phonetic text) and POSTs it to the external video API (`/media_generator`).
5. The API returns a `unique_request_key`. The app stores `{title, uniqueKey, status: submitted}` in a local job store.
6. The browser polls `/api/video/status` every 10s. The server in turn polls the external API's `/get_status` for each active job.
7. On `complete`, the server writes the returned video + audio URLs to the **Content Generator** tab, columns F & G, in the row matching the title. The UI shows a success toast and a playable video in the Results tab.
8. Jobs that don't complete within 20 minutes are marked `error: Timed out`. Failed jobs can be retried.

---

## 2. Architecture at a glance

```
┌──────────────────────────────┐
│  Browser (app/page.tsx)      │  React client component — holds all UI state,
│  - keyword list              │  handles selection, toasts, confirm dialogs,
│  - job records               │  and the 10s polling loop.
│  - polling loop              │
└──────────┬───────────────────┘
           │ fetch
           ▼
┌──────────────────────────────┐
│  Next.js route handlers      │  Thin controllers in app/api/**. Each one
│  (app/api/*/route.ts)        │  calls into lib/ for the real work.
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  lib/ (server-only logic)    │
│  - sheets.ts       (Google)  │  Reads/writes Google Sheets via googleapis
│  - sheet-data.ts   (merge)   │  Reads tabs and joins into KeywordEntry[]
│  - sheet-write.ts  (write)   │  Writes final URLs back to the sheet
│  - video-api.ts    (extern)  │  submit / pollStatus / health against video API
│  - job-assembler.ts          │  KeywordEntry → API request payload
│  - job-store.ts    (persist) │  In-memory Map + JSON file (data/jobs.json)
│  - types.ts                  │  Shared TS types
└──────────────────────────────┘
           │
           ├──► Google Sheets API (read/write sheet tabs)
           └──► mediagenerationapi-production.up.railway.app  (video API)
```

The frontend is a **single client component** (`app/page.tsx`) that owns every piece of state. There is no global store, no React Query, no context — just `useState` and `useEffect`. This is intentional: the app is small enough that a flat state tree is clearer than any abstraction.

---

## 3. Directory layout

```
video-generator-api/
├── app/                            # The Next.js app (this is the deploy unit)
│   ├── app/
│   │   ├── layout.tsx              # Header + HealthIndicator
│   │   ├── page.tsx                # THE dashboard — all UI state lives here
│   │   ├── globals.css             # Tailwind v4
│   │   ├── components/             # Presentational components only
│   │   │   ├── KeywordTable.tsx    # Main table of keywords
│   │   │   ├── BatchActions.tsx    # Generate Flagged / Generate Selected buttons
│   │   │   ├── ResultsPanel.tsx    # "Completed" tab, shows video players
│   │   │   ├── ScenePreview.tsx    # Expanded-row scene details
│   │   │   ├── VideoPlayer.tsx     # <video> wrapper
│   │   │   ├── StatusBadge.tsx     # idle/pending/processing/complete/error pill
│   │   │   ├── HealthIndicator.tsx # Green/red dot in header (polls /api/health)
│   │   │   ├── Toast.tsx           # Toast stack
│   │   │   └── ConfirmDialog.tsx   # Modal confirm for batch actions
│   │   └── api/                    # Route handlers (all Node runtime)
│   │       ├── health/route.ts     # GET  → video API liveness
│   │       ├── keywords/route.ts   # GET  → KeywordEntry[] for a sheet
│   │       ├── music/route.ts      # GET  → background music tracks
│   │       ├── test/route.ts       # Dev-only smoke test
│   │       └── video/
│   │           ├── submit/route.ts # POST → submit titles as video jobs
│   │           ├── status/route.ts # POST → poll jobs, write completions back
│   │           └── jobs/route.ts   # GET  → list jobs from the store
│   ├── lib/                        # Server-only business logic (see §5)
│   ├── data/
│   │   └── jobs.json               # JSON-persisted job store (see §7)
│   ├── public/                     # Default Next.js SVGs
│   ├── .env.local                  # Secrets (see §6)
│   ├── package.json                # Deps: next 16, react 19, googleapis, tailwind 4
│   ├── next.config.ts              # Empty — no custom config
│   └── tsconfig.json
├── cloud-storage-340122-*.json     # Google service account keys (two of them —
│                                     the one referenced in .env.local is live)
├── PLAN.md                         # Historical 6-phase build plan
├── META-PROMPTS.md                 # Stage-by-stage handoff prompts (historical)
└── API_doc (1).pdf                 # External video API documentation
```

---

## 4. The Google Sheet — the app's database

The sheet IS the database. Keyword rows, scene definitions, background music URLs, and final output URLs all live there. Tab names → GIDs are hardcoded in `lib/sheets.ts`.

| Tab name           | GID        | What it holds                                            |
|--------------------|------------|----------------------------------------------------------|
| `Content Generator`| 1758979414 | Master keyword list. **Cols:** A=Title, B=Core keyword, C=Location, D=Background audio URL, E=Make Video? flag, F=Final video URL, G=Final audio URL |
| `Video`            | 1869172958 | Video clip URLs per scene. Col A = title, B..N = scene clips |
| `Text`             | 204559524  | Caption text per scene. Same shape as Video tab |
| `Phonetic Text`    | 774757930  | Phonetic narration per scene. Falls back to caption text |
| `bgAudio`          | 480985891  | Column A = list of background music MP3 URLs |
| `pasteBoard`       | 1677247627 | Legacy "final output" tab (read-only; app writes to Content Generator F/G instead) |
| `start_button`     | 204732952  | Global generator toggles (`variationGeneratorActive`, `mediaGeneratorActive`) — read but not currently gated on |
| `Business Data`    | 0          | Title/config tab (not used by the app yet) |
| `Audio`            | 133642313  | Narration MP3 URLs (not used by the app yet) |

**Join key:** all per-scene tabs join to Content Generator by column A (the title string). Titles must match exactly. Whitespace is trimmed.

**Row→KeywordEntry merge** happens in `lib/sheet-data.ts::getFullKeywordData`. A row becomes `status: 'complete'` iff Content Generator column F has a final video URL.

**Default sheet ID** comes from `GOOGLE_SHEET_ID` in `.env.local`, but the UI lets the user override it per-session by pasting a different URL/ID. When overridden, every server route receives the `sheetId` as a query param or body field and passes it through to the `googleapis` calls.

---

## 5. Library modules (`app/lib/`)

- **`types.ts`** — `KeywordEntry`, `SceneData`, `VideoJobRequest`, `BackgroundTrack`, `ControlPanelStatus`. One source of truth for all shared shapes.

- **`sheets.ts`** — Thin wrapper around `googleapis`. Exposes `getSheetData(name, range, spreadsheetId)` and `writeSheetData(...)`. Authenticates using the service-account JSON pointed to by `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`. Also exports the `SHEET_GIDS` constant and a `GID_TO_NAME` lookup (informational — code reads by tab name, not GID).

- **`sheet-data.ts`** — All read logic. One function per tab (`getAllKeywords`, `getVideoClips`, `getCaptions`, `getPhoneticText`, `getBackgroundMusic`, `getControlPanel`, `getFinalOutputRaw`) plus the merger `getFullKeywordData()` which `Promise.all`s the reads and joins them into `KeywordEntry[]`.

- **`sheet-write.ts`** — Only one function: `writeFinalOutput(title, videoUrl, audioUrl, sheetId?)`. Finds the row by title in column A of Content Generator and writes `F:G`.

- **`video-api.ts`** — The external video-generation API client. Three calls:
  - `checkHealth()` → GET `/media_api_working`
  - `submitJob(requestData)` → POST `/media_generator` (returns a `unique_request_key`)
  - `pollStatus(uniqueKey)` → POST `/get_status` (returns `pending` | `complete` | `error` and the video/audio URLs on completion)

  Credentials (`VIDEO_API_USER_ID`, `VIDEO_API_PASSWORD`) are injected from env on every request.

- **`job-assembler.ts`** — Converts a `KeywordEntry` into the exact JSON the video API wants. Hardcoded config: `1920x1080`, `text_placement: 'bottom'`, `method_type: 'Matrix'`. Only includes `phonetic_text` when it differs from the caption (API falls back to caption otherwise).

- **`job-store.ts`** — In-process `Map<uniqueKey, JobRecord>` + a `Map<title, uniqueKey>` index, hydrated lazily from `data/jobs.json` on first access and flushed to disk after every mutation. Functions: `addJob`, `getJob`, `getJobByTitle`, `getAllJobs`, `getActiveJobs`, `updateJob`, `clearJob`. **This is a filesystem-backed store — see §9 for why that matters on Cloudflare.**

---

## 6. Environment variables

Defined in `app/.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=../cloud-storage-340122-205129d4acab.json
GOOGLE_SHEET_ID=<default sheet id; can be empty>
VIDEO_API_BASE_URL=https://mediagenerationapi-production.up.railway.app
VIDEO_API_USER_ID=<user>
VIDEO_API_PASSWORD=<password>
```

`GOOGLE_SERVICE_ACCOUNT_KEY_PATH` is resolved relative to `process.cwd()` (which is `app/` during `next dev` / `next start`). The default value points one level up at the JSON key sitting in the repo root.

---

## 7. Job persistence model

Jobs are stored in `app/data/jobs.json` as a plain JSON array of `JobRecord` objects. On every read the store hydrates from disk once per process; on every write it re-serializes the whole Map and overwrites the file. This is deliberately simple — there are typically <100 jobs at a time and the app has a single writer.

**Lifecycle of a `JobRecord`:**

```
submitted → pending → complete
                  └─→ error
```

- `submitted` — set in `POST /api/video/submit` immediately after the external API returns a `unique_request_key`.
- `pending` — set by `POST /api/video/status` when the external API reports the job still processing.
- `complete` — set by `POST /api/video/status` when the external API reports completion. The same handler then writes F:G back to the sheet.
- `error` — set either when the external API returns an error field, or when the client-side 20-minute timeout elapses.

Retry removes the record from client state and resubmits (the backend will create a new `uniqueKey`).

---

## 8. Frontend state machine (`app/page.tsx`)

Key state slices:
- `keywords: KeywordEntry[]` — loaded from `/api/keywords`
- `jobs: JobRecord[]` — accumulated from submit/poll responses
- `selected: Set<string>` — titles checked in the table
- `submitting: Set<string>` — titles with an in-flight submit
- `activeSheetId: string | undefined` — currently loaded sheet (undefined = use default from env)

**The polling loop** is gated on "are there any `submitted` or `pending` jobs?" A `useEffect` watches the `jobs` array and starts/stops a `setInterval(pollJobs, 10_000)`. Another `useEffect` re-creates the interval whenever the memoized `pollJobs` callback changes (to avoid stale closures). A hard 20-minute client-side deadline is enforced via `pollStartRef`.

**Row status** in the UI is the *max* of two signals: the keyword's `status` from the sheet read (`complete` iff col F is filled) and the job record's `status` from the live poll. Active jobs take precedence.

---

## 9. Cloudflare Deployment

**Status: LIVE**

**Live URL:** https://aaac-video-generator.brightfox-digital.workers.dev

### Redeploy command

```bash
cd app && npm run deploy
```

### Key architectural changes

The app has been fully migrated to Cloudflare Workers + KV. The following changes were made to bridge the gap from Node.js:

1. **`googleapis` → raw `fetch` + Web Crypto JWT** (`lib/sheets.ts`)
   - Removed the `googleapis` dependency (Node-only, large footprint)
   - Implemented JWT authentication using Web Crypto API (Worker-compatible)
   - All Google Sheets calls now use raw `fetch` to `https://sheets.googleapis.com/v4/spreadsheets/...`
   - Service account key parsed directly from env secret, not from disk

2. **File-based job store → Cloudflare KV** (`lib/job-store.ts`)
   - Replaced `data/jobs.json` filesystem persistence with Cloudflare KV
   - Each job stored as a KV entry: key = `uniqueKey`, value = `JobRecord` JSON
   - Index key `JOBS_INDEX` maintains active job list for polling
   - No disk I/O, fully distributed and durable

3. **Build adapter: `@opennextjs/cloudflare`**
   - Configured in `open-next.config.ts`
   - Must use webpack build (not Turbopack) — see `next build --webpack` in package.json scripts
   - Turbopack's dynamic chunk loading silently fails on Windows with this adapter; webpack is the required fallback

### Secrets (stored in Cloudflare dashboard, not in code)

- `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` — Full JSON service account key (from `cloud-storage-340122-*.json`)
- `VIDEO_API_USER_ID` — Video API user ID
- `VIDEO_API_PASSWORD` — Video API password

Retrieve/update secrets via:
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY_JSON
wrangler secret put VIDEO_API_USER_ID
wrangler secret put VIDEO_API_PASSWORD
```

### KV namespace

- **`JOBS_KV`** — Holds all `JobRecord` entries. Namespace ID in `wrangler.toml` points to the production binding.

### Local development

Create `app/.dev.vars` (gitignored) with all three secrets as plaintext for local testing:
```
GOOGLE_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
VIDEO_API_USER_ID=daniel
VIDEO_API_PASSWORD=daniel1234
```

Then run:
```bash
cd app
npm run dev:wrangler   # Local Workers emulation with KV
```

---

## 10. Local development

```bash
cd app
npm install
npm run dev       # → http://localhost:3000
```

Make sure `.env.local` is populated. The service-account JSON path in `.env.local` is resolved against `app/`, so `../cloud-storage-340122-*.json` points at the repo root.

**Dev-only route:** `GET /api/test` exists for smoke-testing sheet reads without the UI.

---

## 11. Gotchas and non-obvious behavior

- **Tab name ≠ GID name.** The `GID_TO_NAME` comments in `lib/sheets.ts` have a couple of GIDs that were corrected after initial mapping. If you're debugging "sheet not found" errors, trust the **tab name string** the read functions pass (`'Content Generator'`, `'Video'`, `'Text'`, `'Phonetic Text'`, `'bgAudio'`, `'pasteBoard'`, `'start_button'`), not the GID constants.
- **Scene filtering.** `getFullKeywordData` drops any scene where `videoClipUrl` is empty, even if caption/phonetic text exist. This is intentional — the video API can't render a scene without a clip.
- **Status write happens inside the poll handler**, not the submit handler. If writing fails (e.g. permissions), the failure is logged server-side but the job is still marked `complete` for the user. Check server logs if a UI completion doesn't show up in the sheet.
- **Job store hydration is lazy and per-process.** In `next dev` each hot reload can reset module state until the file is re-read; in production it only loads once per process start.
- **Retry deletes the old job from client state** but not from the server job store. The old `JobRecord` still exists in `jobs.json` and will reappear on any full page reload until you clear it.
- **The 20-minute timeout is purely client-side.** If the browser tab is closed, nothing marks the job as errored. Server-side polling only happens when a client asks it to.
- **Two service-account key files** sit in the repo root. `.env.local` points at `205129d4acab.json`. The other (`6bfbc25a8957.json`) appears unused — confirm before deleting.

---

## 12. Where to start for common tasks

| I want to…                                           | Look at                                   |
|------------------------------------------------------|-------------------------------------------|
| Add a column to the keyword table                    | `components/KeywordTable.tsx` + `lib/sheet-data.ts::getAllKeywords` |
| Change resolution or text placement                  | `lib/job-assembler.ts`                    |
| Add a new sheet tab                                  | `lib/sheets.ts` (name map) + new reader in `lib/sheet-data.ts` |
| Change the poll interval or timeout                  | Top of `app/page.tsx` (`POLL_INTERVAL_MS`, `TIMEOUT_MS`) |
| Debug a stuck job                                    | `GET /api/video/jobs` → check `data/jobs.json` → inspect via external API's `/get_status` |
| Change where final URLs are written                  | `lib/sheet-write.ts`                      |
| Swap the external video API                          | `lib/video-api.ts` — all three calls live here |
| Replace the job store (for Cloudflare, etc.)         | `lib/job-store.ts` — keep the exported function signatures identical |
