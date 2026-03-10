# AAAC Video Generator Dashboard — Project Plan

## Brief
Build a Next.js web dashboard that reads video scene data from a Google Sheet, submits video generation jobs to the Media Generation API, tracks progress with live polling, and writes completed output URLs back to the sheet. The Google Sheet remains the source of truth.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App                        │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Dashboard │  │ Scene Preview│  │ Job Progress  │  │
│  │   Page    │──│   Modal      │──│   Tracker     │  │
│  └────┬─────┘  └──────────────┘  └───────┬───────┘  │
│       │                                   │          │
│  ┌────┴──────────────────────────────────┴───────┐  │
│  │           API Routes (Server-side)             │  │
│  │  /api/sheets/*    /api/video/*                 │  │
│  └────┬──────────────────────────────┬───────────┘  │
└───────┼──────────────────────────────┼───────────────┘
        │                              │
        ▼                              ▼
  Google Sheets API           Media Generation API
  (read scenes, write         (submit jobs, poll
   output URLs)                status)
```

---

## Phase 1: Project Setup & Core Infrastructure
**Goal:** Scaffold the Next.js app, configure all credentials, verify connectivity to both APIs.

### Tasks

#### 1.1 — Initialize Next.js project
- `npx create-next-app@latest app --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm`
- Scaffold inside `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Verify:** `npm run dev` starts without errors

#### 1.2 — Environment & credentials setup
- Create `.env.local` with:
  ```
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH=../cloud-storage-340122-205129d4acab.json
  GOOGLE_SHEET_ID=1hijw2clTvmZV2qxu6u0GnwR8fd1HbbcfbjJRzuvn0Rk
  VIDEO_API_BASE_URL=https://mediagenerationapi-production.up.railway.app
  VIDEO_API_USER_ID=daniel
  VIDEO_API_PASSWORD=daniel1234
  ```
- Create `.gitignore` entry for `.env.local` and `*.json` key files
- **Verify:** Environment variables load in a test API route

#### 1.3 — Google Sheets client library
- Install `googleapis` package
- Create `lib/sheets.ts` — authenticated Sheets client using service account
- Map sheet GIDs to named constants:
  ```
  SHEET_GIDS = {
    TITLE: 0,
    AUDIO: 133642313,
    FINAL_OUTPUT: 1677247627,
    KEYWORDS: 1758979414,
    VIDEO_CLIPS: 1869172958,
    CAPTIONS: 204559524,
    CONTROL_PANEL: 204732952,
    BG_MUSIC: 480985891,
    PHONETIC_TEXT: 774757930,
    MAKE_VIDEO_FLAGS: 889953456,
  }
  ```
- **Verify:** Can read rows from the sheet via a test API route

#### 1.4 — Video API client library
- Create `lib/video-api.ts` with functions:
  - `checkHealth()` → GET /media_api_working
  - `submitJob(requestData)` → POST /media_generator (Matrix method)
  - `pollStatus(uniqueKey)` → POST /get_status
- **Verify:** Health check returns `{ "API Response": "I Am working" }`

### Phase 1 Deliverables
- [ ] Next.js app runs on localhost
- [ ] Google Sheets reads data successfully
- [ ] Video API health check passes
- [ ] All credentials in `.env.local`

---

## Phase 2: Data Layer — Sheet Reading & Type Definitions
**Goal:** Read all 11 sheet tabs, normalize into typed data structures, expose via API routes.

### Tasks

#### 2.1 — TypeScript type definitions
- Create `lib/types.ts`:
  ```typescript
  interface KeywordEntry {
    title: string;
    keyword: string;
    location: string;
    scenes: SceneData[];
    makeVideo: boolean;
    backgroundMusic: string;
    status: 'idle' | 'pending' | 'processing' | 'complete' | 'error';
    finalVideoUrl?: string;
    finalAudioUrl?: string;
  }

  interface SceneData {
    sceneNumber: number;
    videoClipUrl: string;
    captionText: string;
    phoneticText: string;
    audioUrl: string;
  }

  interface VideoJobConfig {
    resolution: string;
    textPlacement: 'top' | 'bottom';
    backgroundMusic: string;
  }

  interface VideoJobRequest {
    user_id: string;
    password: string;
    method_type: 'Matrix' | 'Heap';
    request_data: {
      configs: VideoJobConfig;
      media_generator: {
        url: string;
        text: string;
        phonetic_text?: string;
      }[];
    };
  }
  ```

#### 2.2 — Sheet data fetching service
- Create `lib/sheet-data.ts`:
  - `getKeywords()` — reads Keywords tab, returns titles + locations
  - `getVideoClips(title)` — reads Video Clips tab for a specific keyword
  - `getCaptions(title)` — reads Captions tab for a specific keyword
  - `getPhoneticText(title)` — reads Phonetic Text tab for a specific keyword
  - `getAudioUrls(title)` — reads Audio tab for a specific keyword
  - `getBackgroundMusic()` — reads BG Music tab, returns track list
  - `getMakeVideoFlags()` — reads flags tab, returns per-keyword settings
  - `getFinalOutput()` — reads Final Output tab
  - `getControlPanel()` — reads control panel status
- Merge function: `getFullKeywordData()` — joins all tabs by title into `KeywordEntry[]`

#### 2.3 — API routes for data access
- `app/api/keywords/route.ts` — GET returns all keywords with merged scene data
- `app/api/keywords/[title]/route.ts` — GET returns single keyword with full scene details
- `app/api/music/route.ts` — GET returns background music library
- `app/api/health/route.ts` — GET proxies health check to video API
- **Verify:** Each route returns correctly shaped JSON

#### 2.4 — Write-back service
- `lib/sheet-write.ts`:
  - `writeFinalOutput(title, videoUrl, audioUrl)` — writes to Final Output tab
  - `updateMakeVideoFlag(title, value)` — updates flag in Make Video tab
- **Verify:** Can write a test value and read it back

### Phase 2 Deliverables
- [ ] All sheet tabs are readable and typed
- [ ] Data merges correctly by keyword title
- [ ] API routes return clean JSON
- [ ] Write-back to sheet works

---

## Phase 3: Video Job Engine
**Goal:** Build the server-side job submission and polling engine.

### Tasks

#### 3.1 — Job assembler
- Create `lib/job-assembler.ts`:
  - Takes a `KeywordEntry` and assembles a `VideoJobRequest`
  - Uses Matrix method
  - Maps scenes: video clip URL → `url`, caption → `text`, phonetic → `phonetic_text`
  - Attaches configs (resolution: "1920x1080", text_placement: "bottom", background_music from flag sheet or "default")
- **Verify:** Assembled payload matches API doc schema exactly

#### 3.2 — Job submission API route
- `app/api/video/submit/route.ts`:
  - POST with `{ title: string }` or `{ titles: string[] }` for batch
  - Reads keyword data from sheet
  - Assembles job payload
  - Calls POST /media_generator
  - Stores `unique_request_key` in memory (Map or simple store)
  - Returns job ID to client
- **Verify:** Submitting a job returns a unique_request_key

#### 3.3 — Job polling API route
- `app/api/video/status/route.ts`:
  - POST with `{ uniqueKey: string }`
  - Calls POST /get_status
  - Returns status + URLs if complete
- **Verify:** Can poll a submitted job

#### 3.4 — Job completion handler
- On "complete" status:
  - Write video_url and audio_url to Final Output sheet tab
  - Update in-memory job store
- On error:
  - Log error, update job store with error status

#### 3.5 — In-memory job store
- Create `lib/job-store.ts`:
  - Simple Map<string, JobRecord> for tracking active jobs
  - `JobRecord`: { title, uniqueKey, status, videoUrl, audioUrl, submittedAt, completedAt, error }
  - Batch operations: submit multiple, get all active
- Note: This is ephemeral (resets on server restart) — sheet is the persistent store

### Phase 3 Deliverables
- [ ] Can submit a single video job via API
- [ ] Can submit batch jobs
- [ ] Polling returns correct status
- [ ] Completed jobs write back to sheet
- [ ] Job store tracks all active jobs

---

## Phase 4: Dashboard UI
**Goal:** Build the main dashboard page with keyword table, status indicators, and action buttons.

### Tasks

#### 4.1 — Layout & navigation shell
- `app/layout.tsx` — main layout with header ("AAAC Video Generator Dashboard"), API health indicator
- Tailwind config for brand-appropriate styling (clean, professional)
- **Verify:** Layout renders with header

#### 4.2 — Keywords table component
- `app/components/KeywordTable.tsx`:
  - Fetches from `/api/keywords` on mount
  - Columns: Title, Location, Scenes Count, Make Video?, Status, Actions
  - Status badges: idle (gray), pending (yellow), processing (blue pulse), complete (green), error (red)
  - Checkbox column for batch selection
  - Sort by title/location/status
  - Filter/search bar
- **Verify:** Table renders with real sheet data

#### 4.3 — Action buttons
- "Generate Video" button per row (for flagged items)
- "Generate All Flagged" batch button
- "Refresh Data" to re-fetch from sheet
- Buttons disable appropriately during processing

#### 4.4 — Live polling progress
- When jobs are active, poll `/api/video/status` every 10 seconds
- Update status badges in real-time
- Show elapsed time per active job
- Auto-stop polling after completion or 20-minute timeout
- Use `useEffect` with interval or SWR with refresh

#### 4.5 — API health indicator
- Small indicator in header — green dot if API is up, red if down
- Check on page load, then every 60 seconds

### Phase 4 Deliverables
- [ ] Dashboard shows all keywords from sheet
- [ ] Status indicators update in real-time
- [ ] Can submit individual and batch jobs from UI
- [ ] Health indicator works

---

## Phase 5: Scene Preview & Media Playback
**Goal:** Add scene detail view and media playback for completed videos.

### Tasks

#### 5.1 — Scene preview modal/panel
- `app/components/ScenePreview.tsx`:
  - Click a keyword row to expand/open detail view
  - Shows all scenes in order: scene number, video clip thumbnail/URL, caption text, narration text
  - Audio playback for narration clips
  - Background music selection display

#### 5.2 — Video playback component
- `app/components/VideoPlayer.tsx`:
  - For completed jobs, embed video player with the final video URL
  - Audio player for final audio URL
  - Download buttons for both

#### 5.3 — Batch results view
- `app/components/ResultsPanel.tsx`:
  - Shows all completed videos in a grid/list
  - Quick playback, download links
  - Link to GCS URLs

### Phase 5 Deliverables
- [ ] Can preview scene data before generating
- [ ] Can play completed videos inline
- [ ] Download links work
- [ ] Results panel shows all completions

---

## Phase 6: Polish & Error Handling
**Goal:** Production-quality error handling, loading states, and UX polish.

### Tasks

#### 6.1 — Error handling
- API route error responses with proper status codes
- Client-side error toasts/notifications
- Retry logic for failed API calls (3 retries with backoff)
- Handle: auth failures (300), insertion errors (401), network errors, timeout

#### 6.2 — Loading states
- Skeleton loaders for keyword table
- Spinner for job submission
- Progress indicator during polling

#### 6.3 — Confirmation dialogs
- "Are you sure?" before batch generation
- Show estimated cost/time if applicable

#### 6.4 — Responsive design
- Mobile-friendly table (card view on small screens)
- Responsive header and controls

### Phase 6 Deliverables
- [ ] All error states handled gracefully
- [ ] Loading states throughout
- [ ] Responsive on all screen sizes
- [ ] No unhandled promise rejections

---

## File Structure

```
video-generator-api/
├── cloud-storage-340122-205129d4acab.json   # Service account key (gitignored)
├── API_doc (1).pdf                           # API documentation
├── PLAN.md                                   # This file
├── app/                                      # Next.js application
│   ├── .env.local                            # Credentials (gitignored)
│   ├── .gitignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── lib/
│   │   ├── types.ts                          # TypeScript interfaces
│   │   ├── sheets.ts                         # Google Sheets auth client
│   │   ├── sheet-data.ts                     # Sheet reading functions
│   │   ├── sheet-write.ts                    # Sheet writing functions
│   │   ├── video-api.ts                      # Video API client
│   │   ├── job-assembler.ts                  # Builds API payloads from sheet data
│   │   └── job-store.ts                      # In-memory job tracking
│   ├── app/
│   │   ├── layout.tsx                        # Root layout with header
│   │   ├── page.tsx                          # Dashboard page
│   │   ├── api/
│   │   │   ├── health/route.ts               # Video API health proxy
│   │   │   ├── keywords/
│   │   │   │   ├── route.ts                  # GET all keywords
│   │   │   │   └── [title]/route.ts          # GET single keyword detail
│   │   │   ├── music/route.ts                # GET background music list
│   │   │   └── video/
│   │   │       ├── submit/route.ts           # POST submit job(s)
│   │   │       └── status/route.ts           # POST poll job status
│   │   └── components/
│   │       ├── KeywordTable.tsx              # Main data table
│   │       ├── StatusBadge.tsx               # Status indicator component
│   │       ├── ScenePreview.tsx              # Scene detail modal
│   │       ├── VideoPlayer.tsx               # Video/audio playback
│   │       ├── ResultsPanel.tsx              # Completed results view
│   │       ├── HealthIndicator.tsx           # API health dot
│   │       └── BatchActions.tsx              # Batch operation controls
│   └── public/
│       └── ...
```

---

## Key Decisions

1. **Matrix method over Heap** — API doc recommends it, cleaner scene-by-scene structure
2. **Server-side sheet access only** — Service account key stays on server, never exposed to client
3. **In-memory job store** — Simple, no database needed. Sheet is persistent store for completed jobs.
4. **Next.js App Router** — API routes handle all server-side logic, React components are client-only where needed
5. **Polling over WebSockets** — API only supports polling, 10s interval matches their recommendation

---

## Dependencies

```json
{
  "googleapis": "^131.0.0",
  "next": "^15.0.0",
  "react": "^19.0.0",
  "tailwindcss": "^4.0.0",
  "typescript": "^5.0.0"
}
```

No additional UI libraries needed — Tailwind covers styling. Keep it lean.

---

## Execution Order

Start with **Phase 1**, verify connectivity, then proceed sequentially. Each phase builds on the previous. Phases 4 and 5 have the most visible output. Phase 6 is polish.

**Estimated phases:** 6
**Critical path:** Phase 1 (setup) → Phase 2 (data) → Phase 3 (jobs) → Phase 4 (UI)
