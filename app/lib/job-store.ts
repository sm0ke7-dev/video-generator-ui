import fs from 'fs';
import path from 'path';

export interface JobRecord {
  title: string;
  uniqueKey: string;
  status: 'submitted' | 'pending' | 'complete' | 'error';
  videoUrl?: string;
  audioUrl?: string;
  submittedAt: string; // ISO string (serializable)
  completedAt?: string;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

const store = new Map<string, JobRecord>();
const titleIndex = new Map<string, string>(); // title → uniqueKey
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = fs.readFileSync(JOBS_FILE, 'utf-8');
    const records: JobRecord[] = JSON.parse(raw);
    for (const r of records) {
      store.set(r.uniqueKey, r);
      titleIndex.set(r.title, r.uniqueKey);
    }
  } catch {
    // No file yet or bad JSON — start fresh
  }
}

function flush(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JOBS_FILE, JSON.stringify(Array.from(store.values()), null, 2));
}

export function addJob(title: string, uniqueKey: string): JobRecord {
  hydrate();
  const record: JobRecord = {
    title,
    uniqueKey,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
  };
  store.set(uniqueKey, record);
  titleIndex.set(title, uniqueKey);
  flush();
  return record;
}

export function getJob(uniqueKey: string): JobRecord | undefined {
  hydrate();
  return store.get(uniqueKey);
}

export function getJobByTitle(title: string): JobRecord | undefined {
  hydrate();
  const key = titleIndex.get(title);
  if (!key) return undefined;
  return store.get(key);
}

export function getAllJobs(): JobRecord[] {
  hydrate();
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export function getActiveJobs(): JobRecord[] {
  return getAllJobs().filter((j) => j.status === 'submitted' || j.status === 'pending');
}

export function updateJob(uniqueKey: string, update: Partial<JobRecord>): void {
  hydrate();
  const existing = store.get(uniqueKey);
  if (!existing) return;
  store.set(uniqueKey, { ...existing, ...update });
  flush();
}

export function clearJob(uniqueKey: string): void {
  hydrate();
  const job = store.get(uniqueKey);
  if (job) titleIndex.delete(job.title);
  store.delete(uniqueKey);
  flush();
}
