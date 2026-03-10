import { NextResponse } from 'next/server';
import { getFullKeywordData } from '@/lib/sheet-data';
import { assembleJobPayload } from '@/lib/job-assembler';
import { submitJob } from '@/lib/video-api';
import { addJob } from '@/lib/job-store';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const titles: string[] = body.titles ?? (body.title ? [body.title] : []);

    if (titles.length === 0) {
      return NextResponse.json({ error: 'No titles provided' }, { status: 400 });
    }

    const keywords = await getFullKeywordData();
    const results = [];

    for (const title of titles) {
      const entry = keywords.find((k) => k.title === title);
      if (!entry) {
        results.push({ title, error: 'Keyword not found in sheet' });
        continue;
      }

      if (entry.scenes.length === 0) {
        results.push({ title, error: 'No scenes found for this keyword' });
        continue;
      }

      const payload = assembleJobPayload(entry);
      const result = await submitJob(payload.request_data);

      if (result.status === 300) {
        results.push({ title, error: 'Authentication failed' });
        continue;
      }

      if (result.status === 401 || !result.uniqueRequestKey) {
        results.push({ title, error: result.description ?? 'Error submitting job' });
        continue;
      }

      const job = addJob(title, result.uniqueRequestKey);
      results.push({ title, uniqueKey: job.uniqueKey, status: job.status });
    }

    return NextResponse.json({ jobs: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
