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

// Module-level map — persists across requests, resets on server restart
const store = new Map<string, JobRecord>();

// Also index by title for quick lookups
const titleIndex = new Map<string, string>(); // title → uniqueKey

export function addJob(title: string, uniqueKey: string): JobRecord {
  const record: JobRecord = {
    title,
    uniqueKey,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
  };
  store.set(uniqueKey, record);
  titleIndex.set(title, uniqueKey);
  return record;
}

export function getJob(uniqueKey: string): JobRecord | undefined {
  return store.get(uniqueKey);
}

export function getJobByTitle(title: string): JobRecord | undefined {
  const key = titleIndex.get(title);
  if (!key) return undefined;
  return store.get(key);
}

export function getAllJobs(): JobRecord[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export function getActiveJobs(): JobRecord[] {
  return getAllJobs().filter((j) => j.status === 'submitted' || j.status === 'pending');
}

export function updateJob(uniqueKey: string, update: Partial<JobRecord>): void {
  const existing = store.get(uniqueKey);
  if (!existing) return;
  store.set(uniqueKey, { ...existing, ...update });
}

export function clearJob(uniqueKey: string): void {
  const job = store.get(uniqueKey);
  if (job) titleIndex.delete(job.title);
  store.delete(uniqueKey);
}
