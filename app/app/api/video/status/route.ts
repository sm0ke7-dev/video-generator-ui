import { NextResponse } from 'next/server';
import { pollStatus } from '@/lib/video-api';
import { getJob, getActiveJobs, updateJob } from '@/lib/job-store';
import { writeFinalOutput } from '@/lib/sheet-write';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    let uniqueKeys: string[] = [];
    const sheetId: string | undefined = typeof body.sheetId === 'string' ? body.sheetId : undefined;

    if (typeof body.uniqueKey === 'string') {
      uniqueKeys = [body.uniqueKey];
    } else if (Array.isArray(body.uniqueKeys) && body.uniqueKeys.length) {
      uniqueKeys = body.uniqueKeys.filter((k): k is string => typeof k === 'string');
    } else {
      uniqueKeys = (await getActiveJobs()).map((j) => j.uniqueKey);
    }

    if (uniqueKeys.length === 0) {
      return NextResponse.json({ jobs: [] });
    }

    const results = [];

    for (const uniqueKey of uniqueKeys) {
      const job = await getJob(uniqueKey);
      if (!job) {
        results.push({ uniqueKey, error: 'Job not found in store' });
        continue;
      }

      const result = await pollStatus(uniqueKey);

      if (result.status === 'error') {
        await updateJob(uniqueKey, { status: 'error', error: result.error });
        results.push({ ...job, status: 'error', error: result.error });
        continue;
      }

      if (result.status === 'complete') {
        await updateJob(uniqueKey, {
          status: 'complete',
          videoUrl: result.videoUrl,
          audioUrl: result.audioUrl,
          completedAt: new Date().toISOString(),
        });
        try {
          await writeFinalOutput(job.title, result.videoUrl, result.audioUrl, sheetId);
        } catch (writeErr) {
          console.error('Failed to write output to sheet:', writeErr);
        }
        results.push({ ...job, status: 'complete', videoUrl: result.videoUrl, audioUrl: result.audioUrl });
        continue;
      }

      await updateJob(uniqueKey, { status: 'pending' });
      results.push({ ...job, status: 'pending' });
    }

    return NextResponse.json({ jobs: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
