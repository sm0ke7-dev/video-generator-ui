import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface JobRecord {
  title: string;
  uniqueKey: string;
  status: 'submitted' | 'pending' | 'complete' | 'error';
  videoUrl?: string;
  audioUrl?: string;
  submittedAt: string;
  completedAt?: string;
  error?: string;
}

const KEY_PREFIX = 'job:';
const TITLE_PREFIX = 'title:';
const INDEX_KEY = 'index:all';

function kv(): KVNamespace {
  const { env } = getCloudflareContext();
  const ns = (env as unknown as { JOBS_KV?: KVNamespace }).JOBS_KV;
  if (!ns) throw new Error('JOBS_KV binding missing — check wrangler.toml');
  return ns;
}

async function readIndex(): Promise<string[]> {
  const raw = await kv().get(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

async function writeIndex(keys: string[]): Promise<void> {
  await kv().put(INDEX_KEY, JSON.stringify(keys));
}

export async function addJob(title: string, uniqueKey: string): Promise<JobRecord> {
  const record: JobRecord = {
    title, uniqueKey, status: 'submitted',
    submittedAt: new Date().toISOString(),
  };
  const store = kv();
  await store.put(KEY_PREFIX + uniqueKey, JSON.stringify(record));
  await store.put(TITLE_PREFIX + title, uniqueKey);
  const index = await readIndex();
  if (!index.includes(uniqueKey)) {
    index.push(uniqueKey);
    await writeIndex(index);
  }
  return record;
}

export async function getJob(uniqueKey: string): Promise<JobRecord | undefined> {
  const raw = await kv().get(KEY_PREFIX + uniqueKey);
  return raw ? (JSON.parse(raw) as JobRecord) : undefined;
}

export async function getJobByTitle(title: string): Promise<JobRecord | undefined> {
  const key = await kv().get(TITLE_PREFIX + title);
  if (!key) return undefined;
  return getJob(key);
}

export async function getAllJobs(): Promise<JobRecord[]> {
  const index = await readIndex();
  const store = kv();
  const records = await Promise.all(
    index.map(async (k) => {
      const raw = await store.get(KEY_PREFIX + k);
      return raw ? (JSON.parse(raw) as JobRecord) : null;
    })
  );
  return records
    .filter((r): r is JobRecord => r !== null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export async function getActiveJobs(): Promise<JobRecord[]> {
  return (await getAllJobs()).filter(
    (j) => j.status === 'submitted' || j.status === 'pending'
  );
}

export async function updateJob(uniqueKey: string, update: Partial<JobRecord>): Promise<void> {
  const existing = await getJob(uniqueKey);
  if (!existing) return;
  await kv().put(KEY_PREFIX + uniqueKey, JSON.stringify({ ...existing, ...update }));
}

export async function clearJob(uniqueKey: string): Promise<void> {
  const existing = await getJob(uniqueKey);
  const store = kv();
  await store.delete(KEY_PREFIX + uniqueKey);
  if (existing) await store.delete(TITLE_PREFIX + existing.title);
  const index = await readIndex();
  await writeIndex(index.filter((k) => k !== uniqueKey));
}
