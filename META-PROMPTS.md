# AAAC Video Generator Dashboard — Meta-Prompts

## Pipeline Overview

6-stage build pipeline. Each stage produces artifacts the next stage consumes. Run stages sequentially — each depends on the previous stage's output.

**Handoff pattern:** Each stage ends with a verification checklist. Do NOT proceed to the next stage until all checks pass.

---

## Stage 1: Setup & Infrastructure

<stage-prompt id="stage-1-setup">

### Role
You are building Phase 1 of the AAAC Video Generator Dashboard — a Next.js app that connects to a Google Sheet and a Video Generation API.

### Context
- **Project directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\`
- **Next.js app location:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Service account key:** `../cloud-storage-340122-205129d4acab.json` (relative to app dir)
- **Platform:** Windows 11, bash shell

### What to build

**1. Scaffold Next.js app**
```bash
cd "C:/Users/Banana/Documents/dan-dev/video-generator-api"
npx create-next-app@latest app --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

**2. Create `app/.env.local`**
```
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=../cloud-storage-340122-205129d4acab.json
GOOGLE_SHEET_ID=1hijw2clTvmZV2qxu6u0GnwR8fd1HbbcfbjJRzuvn0Rk
VIDEO_API_BASE_URL=https://mediagenerationapi-production.up.railway.app
VIDEO_API_USER_ID=daniel
VIDEO_API_PASSWORD=daniel1234
```

**3. Add to `app/.gitignore`**
```
.env.local
../*.json
```

**4. Install dependencies**
```bash
cd app && npm install googleapis
```

**5. Create `app/lib/sheets.ts`** — Google Sheets authenticated client
- Read the service account JSON key from `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- Use `googleapis` package, `google.auth.GoogleAuth` with `sheets` scope
- Export a `getSheets()` function that returns an authenticated sheets client
- Export sheet GID constants:
  ```typescript
  export const SHEET_GIDS = {
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
  } as const;
  ```
- Export `SPREADSHEET_ID` from env
- Export a helper `getSheetData(sheetName: string, range?: string)` that reads rows

**6. Create `app/lib/video-api.ts`** — Video Generation API client
- Read `VIDEO_API_BASE_URL`, `VIDEO_API_USER_ID`, `VIDEO_API_PASSWORD` from env
- Export functions:
  - `checkHealth(): Promise<{ apiWorking: boolean }>` — GET `/media_api_working`
  - `submitJob(requestData: object): Promise<{ status: number; uniqueRequestKey: string }>` — POST `/media_generator` with `{ user_id, password, method_type: "Matrix", request_data }`
  - `pollStatus(uniqueKey: string): Promise<{ status: string; videoUrl: string; audioUrl: string }>` — POST `/get_status` with `{ user_id, password, unique_key }`

**7. Create test API route `app/app/api/test/route.ts`**
- GET handler that:
  1. Calls `checkHealth()` from video-api
  2. Reads first row from the sheet using `getSheetData()`
  3. Returns both results as JSON
- This route is temporary — just for verifying connectivity

### Verification checklist
- [ ] `npm run dev` starts without errors on `localhost:3000`
- [ ] `GET /api/test` returns video API health status
- [ ] `GET /api/test` returns sheet data
- [ ] No credentials are exposed in client-side code
- [ ] `.env.local` exists and is gitignored

### Output artifacts
Files created:
- `app/.env.local`
- `app/lib/sheets.ts`
- `app/lib/video-api.ts`
- `app/app/api/test/route.ts`

</stage-prompt>

---

## Stage 2: Data Layer

<stage-prompt id="stage-2-data-layer">

### Role
You are building Phase 2 of the AAAC Video Generator Dashboard. Phase 1 is complete — the Next.js app is scaffolded, Google Sheets client (`lib/sheets.ts`) and Video API client (`lib/video-api.ts`) are working.

### Context
- **App directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Existing files:** `lib/sheets.ts` (Sheets auth + `getSheetData()` helper), `lib/video-api.ts` (API client)
- **Sheet ID:** `1hijw2clTvmZV2qxu6u0GnwR8fd1HbbcfbjJRzuvn0Rk`

### Google Sheet structure (11 tabs)

| Tab Name | GID | Columns | Purpose |
|----------|-----|---------|---------|
| Title | 0 | A: key, B: value | App label |
| Audio | 133642313 | Title, scene1-scene20 | GCS narration MP3 URLs per keyword |
| Final Output | 1677247627 | (Title), Final Video URL, Final Audio URL | Completed outputs |
| Keywords | 1758979414 | Title Bar: "Keyword, SPACE, Location" + keyword rows | Keyword + location list |
| Video Clips | 1869172958 | Title, scene1-scene22 | GCS video clip URLs per keyword |
| Captions | 204559524 | Title, scene1-scene15 | Caption text per scene per keyword |
| Control Panel | 204732952 | Variation Generator Start/Stop, Media Generator Start/Stop | TRUE/FALSE toggles |
| BG Music | 480985891 | 64 MP3 URLs | Background music library |
| Phonetic Text | 774757930 | Title, scene1-scene15 | Narration text per scene per keyword |
| Make Video Flags | 889953456 | Keyword, Make Video? (bool), Background Audio URL, Final Video URL, Final Audio URL | Per-keyword flags |

### What to build

**1. Create `app/lib/types.ts`**
```typescript
export interface KeywordEntry {
  title: string;
  scenes: SceneData[];
  makeVideo: boolean;
  backgroundMusic: string;
  status: 'idle' | 'pending' | 'processing' | 'complete' | 'error';
  finalVideoUrl?: string;
  finalAudioUrl?: string;
}

export interface SceneData {
  sceneNumber: number;
  videoClipUrl: string;
  captionText: string;
  phoneticText: string;
  audioUrl: string;
}

export interface VideoJobConfig {
  resolution: string;
  text_placement: 'top' | 'bottom';
  background_music: string;
}

export interface VideoJobRequest {
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

export interface BackgroundTrack {
  name: string;
  url: string;
}
```

**2. Create `app/lib/sheet-data.ts`** — Reading service
- Import `getSheetData` from `./sheets`
- Functions (all async, all read from the Google Sheet):
  - `getAllKeywordTitles()` — read Video Clips tab, return array of title strings from column A
  - `getVideoClips()` — read Video Clips tab, return Map<title, string[]> of scene clip URLs
  - `getCaptions()` — read Captions tab, return Map<title, string[]> of caption texts
  - `getPhoneticText()` — read Phonetic Text tab, return Map<title, string[]>
  - `getAudioUrls()` — read Audio tab, return Map<title, string[]> of narration MP3 URLs
  - `getBackgroundMusic()` — read BG Music tab, return BackgroundTrack[]
  - `getMakeVideoFlags()` — read Make Video Flags tab, return Map<title, { makeVideo: boolean, backgroundMusic: string }>
  - `getFinalOutput()` — read Final Output tab, return Map<title, { videoUrl: string, audioUrl: string }>
  - `getFullKeywordData()` — **MERGE function**: calls all the above, joins by title, returns `KeywordEntry[]`
    - For each title: zip video clips, captions, phonetic text, audio URLs into SceneData[] (match by scene index)
    - Attach makeVideo flag and backgroundMusic from flags tab
    - Attach finalVideoUrl/finalAudioUrl from output tab
    - Set status: 'complete' if final URLs exist, 'idle' otherwise

**Important:** Sheet rows use title as the join key. Titles in different tabs should match. Handle missing data gracefully (empty string defaults).

**3. Create `app/lib/sheet-write.ts`** — Write-back service
- `writeFinalOutput(title: string, videoUrl: string, audioUrl: string)` — find the row in Final Output tab matching title, write videoUrl and audioUrl
- `updateMakeVideoFlag(title: string, value: boolean)` — find and update the Make Video? column

**4. Create API routes**

`app/app/api/keywords/route.ts` — GET
- Calls `getFullKeywordData()`
- Returns JSON array of all KeywordEntry objects

`app/app/api/keywords/[title]/route.ts` — GET
- Calls `getFullKeywordData()`, filters to matching title
- Returns single KeywordEntry with full scene details

`app/app/api/music/route.ts` — GET
- Calls `getBackgroundMusic()`
- Returns JSON array of BackgroundTrack

`app/app/api/health/route.ts` — GET
- Calls `checkHealth()` from video-api
- Returns `{ healthy: boolean }`

**5. Delete test route**
- Remove `app/app/api/test/route.ts` (no longer needed)

### Verification checklist
- [ ] `GET /api/keywords` returns array of KeywordEntry with scenes populated
- [ ] `GET /api/keywords/AAAC%20Wildlife%20Removal%20Pearland` returns single entry with all scene data
- [ ] `GET /api/music` returns 64 background tracks
- [ ] `GET /api/health` returns `{ healthy: true }`
- [ ] Scene data correctly merges video clips + captions + phonetic text + audio by scene index
- [ ] Keywords with final output URLs show status "complete"
- [ ] Keywords without final output show status "idle"

### Output artifacts
Files created:
- `app/lib/types.ts`
- `app/lib/sheet-data.ts`
- `app/lib/sheet-write.ts`
- `app/app/api/keywords/route.ts`
- `app/app/api/keywords/[title]/route.ts`
- `app/app/api/music/route.ts`
- `app/app/api/health/route.ts`

Files deleted:
- `app/app/api/test/route.ts`

</stage-prompt>

---

## Stage 3: Job Engine

<stage-prompt id="stage-3-job-engine">

### Role
You are building Phase 3 of the AAAC Video Generator Dashboard. Phases 1-2 are complete — the app reads all sheet data into typed structures and exposes it via API routes.

### Context
- **App directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Existing files:** `lib/sheets.ts`, `lib/video-api.ts`, `lib/types.ts`, `lib/sheet-data.ts`, `lib/sheet-write.ts`, plus API routes under `app/api/`
- **Video API endpoints:**
  - `POST /media_generator` — submit job, returns `{ status: 200, unique_request_key: "UUID" }`
  - `POST /get_status` — poll with `{ user_id, password, unique_key }`, returns `{ status: "pending"|"complete", video_url, audio_url }`
- **Auth:** `user_id: "daniel"`, `password: "daniel1234"` (from env vars)
- **Method:** Always use "Matrix"

### API payload format (Matrix method)
```json
{
  "user_id": "daniel",
  "password": "daniel1234",
  "method_type": "Matrix",
  "request_data": {
    "configs": {
      "resolution": "1920x1080",
      "text_placement": "bottom",
      "background_music": "default"
    },
    "media_generator": [
      {
        "url": "https://storage.googleapis.com/.../clip.mp4",
        "text": "Caption for this scene",
        "phonetic_text": "Optional narration text"
      }
    ]
  }
}
```

### What to build

**1. Create `app/lib/job-assembler.ts`**
- `assembleJobPayload(entry: KeywordEntry): VideoJobRequest`
  - Map each scene: `videoClipUrl` → `url`, `captionText` → `text`, `phoneticText` → `phonetic_text`
  - Only include scenes where `videoClipUrl` is non-empty
  - If `phoneticText` is empty, omit `phonetic_text` field (API falls back to `text`)
  - Config: resolution `"1920x1080"`, text_placement `"bottom"`, background_music from `entry.backgroundMusic` or `"default"`
  - Credentials from env vars

**2. Create `app/lib/job-store.ts`**
- In-memory store (module-level Map — persists across requests in dev, resets on server restart)
```typescript
export interface JobRecord {
  title: string;
  uniqueKey: string;
  status: 'submitted' | 'pending' | 'processing' | 'complete' | 'error';
  videoUrl?: string;
  audioUrl?: string;
  submittedAt: Date;
  completedAt?: Date;
  error?: string;
}
```
- Export functions:
  - `addJob(title: string, uniqueKey: string): void`
  - `getJob(uniqueKey: string): JobRecord | undefined`
  - `getJobByTitle(title: string): JobRecord | undefined`
  - `getAllJobs(): JobRecord[]`
  - `getActiveJobs(): JobRecord[]` — status is submitted or pending
  - `updateJob(uniqueKey: string, update: Partial<JobRecord>): void`

**3. Create `app/app/api/video/submit/route.ts`** — POST
- Request body: `{ title: string }` or `{ titles: string[] }`
- For each title:
  1. Read full keyword data via `getFullKeywordData()` (or cache it)
  2. Find matching entry
  3. Assemble payload via `assembleJobPayload()`
  4. Call `submitJob()` from video-api
  5. Store in job store via `addJob()`
- Return: `{ jobs: { title, uniqueKey, status }[] }`
- Handle errors: auth failure (status 300), insertion error (status 401)

**4. Create `app/app/api/video/status/route.ts`** — POST
- Request body: `{ uniqueKey: string }` or `{ uniqueKeys: string[] }` or empty body for all active
- For each key:
  1. Call `pollStatus()` from video-api
  2. If "complete": update job store, call `writeFinalOutput()` to write back to sheet
  3. If error: update job store with error
- Return: `{ jobs: JobRecord[] }`

**5. Create `app/app/api/video/jobs/route.ts`** — GET
- Returns all jobs from the in-memory store
- Useful for the UI to get current state of all jobs

### Verification checklist
- [ ] `assembleJobPayload()` produces a payload matching the API doc schema exactly
- [ ] `POST /api/video/submit` with `{ title: "AAAC Wildlife Removal Pearland" }` returns a unique_request_key (test with a REAL submission only if user confirms — otherwise verify payload shape only)
- [ ] `POST /api/video/status` with a key returns pending/complete status
- [ ] On completion, final URLs are written to the Google Sheet
- [ ] `GET /api/video/jobs` returns all tracked jobs
- [ ] Job store correctly tracks submitted → pending → complete lifecycle

### Output artifacts
Files created:
- `app/lib/job-assembler.ts`
- `app/lib/job-store.ts`
- `app/app/api/video/submit/route.ts`
- `app/app/api/video/status/route.ts`
- `app/app/api/video/jobs/route.ts`

</stage-prompt>

---

## Stage 4: Dashboard UI

<stage-prompt id="stage-4-dashboard-ui">

### Role
You are building Phase 4 of the AAAC Video Generator Dashboard. Phases 1-3 are complete — the backend is fully functional with sheet reading, job submission, polling, and write-back. Now build the frontend.

### Context
- **App directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Available API routes:**
  - `GET /api/keywords` → KeywordEntry[]
  - `GET /api/keywords/[title]` → KeywordEntry
  - `GET /api/music` → BackgroundTrack[]
  - `GET /api/health` → { healthy: boolean }
  - `POST /api/video/submit` → { jobs: { title, uniqueKey, status }[] }
  - `POST /api/video/status` → { jobs: JobRecord[] }
  - `GET /api/video/jobs` → JobRecord[]
- **Styling:** Tailwind CSS 4. Clean, professional look. No extra UI libraries.

### What to build

**1. Update `app/app/layout.tsx`**
- Header bar: "AAAC Video Generator Dashboard" title on left
- HealthIndicator component on right side of header
- Dark header (slate-800), white content area
- Inter or system font

**2. Create `app/app/components/HealthIndicator.tsx`** (client component)
- Polls `GET /api/health` every 60 seconds
- Shows green pulsing dot + "API Online" or red dot + "API Offline"
- Small, sits in header

**3. Create `app/app/components/StatusBadge.tsx`**
- Takes `status: 'idle' | 'pending' | 'processing' | 'complete' | 'error'`
- Renders colored pill badge:
  - idle: gray bg, "Ready"
  - pending: yellow bg, "Queued"
  - processing: blue bg with pulse animation, "Processing..."
  - complete: green bg, "Complete"
  - error: red bg, "Error"

**4. Create `app/app/components/KeywordTable.tsx`** (client component)
- Fetches `GET /api/keywords` on mount
- Fetches `GET /api/video/jobs` to overlay active job statuses
- Table columns:
  - Checkbox (for batch select)
  - Title (keyword name)
  - Scenes (count of non-empty scenes)
  - Make Video? (shows flag from sheet)
  - Background Music (truncated track name)
  - Status (StatusBadge)
  - Actions (Generate button)
- **Search/filter bar** at top — filters by title text
- **Sort** by clicking column headers (title, status)
- "Generate" button per row:
  - Calls `POST /api/video/submit` with `{ title }`
  - Disables during processing
  - Only enabled if makeVideo is true or always enabled (user choice)
- Merge job store status with sheet status: if a job is active for a title, show its status instead of the sheet status

**5. Create `app/app/components/BatchActions.tsx`** (client component)
- Sits above the table
- "Generate All Flagged" button — submits all rows where makeVideo=true and status is idle
- "Generate Selected" button — submits checked rows
- "Refresh Data" button — re-fetches from sheet
- Show count: "X flagged / Y selected / Z total"
- Buttons disable when jobs are running

**6. Update `app/app/page.tsx`** (main dashboard)
- Composes: BatchActions + KeywordTable
- Manages state: keywords data, selected rows, active jobs
- **Polling logic:**
  - When any job is active, poll `POST /api/video/status` every 10 seconds with all active unique keys
  - Update job statuses in state
  - Stop polling when all jobs complete or after 20-minute timeout
  - Show elapsed time somewhere subtle

### Verification checklist
- [ ] Dashboard loads and displays all keywords from the sheet
- [ ] Search filters the table correctly
- [ ] Clicking "Generate" submits a job and status updates to "Queued" then "Processing..."
- [ ] Batch actions work (Generate All Flagged, Generate Selected)
- [ ] Status badges update in real-time via polling
- [ ] Health indicator shows API status
- [ ] UI doesn't break with 20+ keywords

### Output artifacts
Files created/modified:
- `app/app/layout.tsx` (modified)
- `app/app/page.tsx` (rewritten)
- `app/app/components/HealthIndicator.tsx`
- `app/app/components/StatusBadge.tsx`
- `app/app/components/KeywordTable.tsx`
- `app/app/components/BatchActions.tsx`

</stage-prompt>

---

## Stage 5: Preview & Playback

<stage-prompt id="stage-5-preview-playback">

### Role
You are building Phase 5 of the AAAC Video Generator Dashboard. Phases 1-4 are complete — the full dashboard is working with keyword table, job submission, and live status polling. Now add scene preview and media playback.

### Context
- **App directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Existing components:** KeywordTable, StatusBadge, HealthIndicator, BatchActions
- **Data available per keyword:** scenes[] (videoClipUrl, captionText, phoneticText, audioUrl), finalVideoUrl, finalAudioUrl, backgroundMusic

### What to build

**1. Create `app/app/components/ScenePreview.tsx`** (client component)
- Triggered by clicking a keyword row in the table (expand row or slide-out panel)
- Displays all scenes in a vertical timeline/card layout:
  - Scene number
  - Video clip: `<video>` element with the GCS clip URL (small preview, controls)
  - Caption text displayed below clip
  - Phonetic/narration text in italics if different from caption
  - Audio: small play button for the narration MP3
- Shows background music track name at the top
- Close button to collapse

**2. Create `app/app/components/VideoPlayer.tsx`** (client component)
- For completed keywords (have finalVideoUrl):
  - Full video player: `<video controls>` with the final MP4 URL
  - Audio player: `<audio controls>` with the final MP3 URL
  - Download buttons for both (anchor tags with download attribute)
  - Title displayed above
- Displayed in the expanded ScenePreview area or as a separate section

**3. Create `app/app/components/ResultsPanel.tsx`** (client component)
- A tab or section on the dashboard showing ALL completed videos
- Grid of cards, each with:
  - Keyword title
  - Video thumbnail (first frame or just a play icon)
  - Play button → opens VideoPlayer
  - Download video / Download audio buttons
  - Timestamp of completion
- Filter: show only completed entries
- Sort by completion time (newest first)

**4. Update `app/app/page.tsx`**
- Add tab navigation: "All Keywords" | "Completed Results"
- "All Keywords" shows the existing KeywordTable with expandable ScenePreview
- "Completed Results" shows the ResultsPanel
- Wire row click in KeywordTable to toggle ScenePreview

**5. Update `app/app/components/KeywordTable.tsx`**
- Add row click handler to expand/collapse ScenePreview
- Show expand/collapse chevron icon
- Highlighted row when expanded

### Verification checklist
- [ ] Clicking a keyword row expands to show scene preview
- [ ] Video clips play inline in scene preview
- [ ] Narration audio plays per scene
- [ ] Completed videos play in full via VideoPlayer
- [ ] Download links work for video and audio
- [ ] Results panel shows all completed entries
- [ ] Tab navigation works between views

### Output artifacts
Files created/modified:
- `app/app/components/ScenePreview.tsx` (new)
- `app/app/components/VideoPlayer.tsx` (new)
- `app/app/components/ResultsPanel.tsx` (new)
- `app/app/page.tsx` (modified — tabs + expand logic)
- `app/app/components/KeywordTable.tsx` (modified — row expand)

</stage-prompt>

---

## Stage 6: Polish & Error Handling

<stage-prompt id="stage-6-polish">

### Role
You are building Phase 6 (final) of the AAAC Video Generator Dashboard. Phases 1-5 are complete — the full app is functional. Now add production-quality polish.

### Context
- **App directory:** `C:\Users\Banana\Documents\dan-dev\video-generator-api\app\`
- **Everything works** — this stage is about resilience, UX, and edge cases

### What to build

**1. Error handling**
- Wrap all API route handlers in try/catch with proper HTTP status codes
- Client-side: create a `Toast` or notification component
  - Shows success (green), error (red), info (blue) messages
  - Auto-dismiss after 5 seconds
  - Stack multiple toasts
- Handle specific API errors:
  - Video API auth failure (status 300) → "Authentication failed — check credentials"
  - Insertion error (status 401) → "Failed to submit job — try again"
  - Network error → "Cannot reach API — check connection"
  - Sheet read error → "Failed to load data from Google Sheet"
- Add retry logic to sheet reads and video API calls: 3 attempts with exponential backoff (1s, 2s, 4s)

**2. Loading states**
- KeywordTable: skeleton rows while loading (gray pulsing placeholders)
- Submit button: spinner icon while submitting
- ScenePreview: loading state while fetching detail
- Initial page load: full-page loading state

**3. Confirmation dialogs**
- Before batch generation: modal asking "Generate X videos? This will submit X jobs to the API."
- Show list of titles that will be submitted
- Confirm / Cancel buttons

**4. Responsive design**
- Table → card layout on screens < 768px
- Header stacks vertically on mobile
- Scene preview full-width on mobile
- Video player responsive
- Touch-friendly button sizes (min 44px)

**5. Empty states**
- No keywords loaded: "No keywords found in sheet. Check your Google Sheet connection."
- No completed videos: "No completed videos yet. Submit a job to get started!"
- Search with no results: "No keywords match your search."

**6. Polling improvements**
- Show "Last updated: X seconds ago" near the table
- Show elapsed time per active job: "Processing... (2m 34s)"
- Visual countdown to next poll
- 20-minute timeout: show warning at 15 minutes, stop at 20 with "Timed out" status

### Verification checklist
- [ ] All API errors show user-friendly toast messages
- [ ] Loading skeletons appear while data loads
- [ ] Batch generation shows confirmation dialog
- [ ] App is usable on mobile (375px width)
- [ ] Empty states display correctly
- [ ] 20-minute timeout works
- [ ] No unhandled promise rejections in console
- [ ] All buttons have disabled states when appropriate

### Output artifacts
Files created/modified:
- `app/app/components/Toast.tsx` (new)
- `app/app/components/ConfirmDialog.tsx` (new)
- `app/app/components/SkeletonTable.tsx` (new)
- All existing components modified for error/loading/responsive states

</stage-prompt>

---

## Running the Pipeline

### Sequential execution
```
Stage 1 (Setup) → verify → Stage 2 (Data) → verify → Stage 3 (Jobs) → verify → Stage 4 (UI) → verify → Stage 5 (Preview) → verify → Stage 6 (Polish) → verify → DONE
```

### How to use these prompts
1. Start a fresh Claude session
2. Say: "Execute Stage N" and paste the stage prompt
3. Or reference this file: "Read META-PROMPTS.md and execute Stage N"
4. After each stage, run the verification checklist before proceeding
5. If a stage fails verification, fix issues before moving to the next

### Context handoff between stages
Each stage prompt includes what exists from prior stages. If you're continuing in the same session, Claude already has context. If starting a new session, the stage prompt provides enough context to pick up where the last left off.

### Estimated effort per stage
| Stage | Effort | Files |
|-------|--------|-------|
| 1. Setup | Light | 3 new |
| 2. Data Layer | Medium | 7 new, 1 deleted |
| 3. Job Engine | Medium | 5 new |
| 4. Dashboard UI | Heavy | 4 new, 2 modified |
| 5. Preview & Playback | Medium | 3 new, 2 modified |
| 6. Polish | Medium | 3 new, all modified |
