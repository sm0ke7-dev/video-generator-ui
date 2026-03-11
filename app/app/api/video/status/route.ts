import { NextResponse } from 'next/server';
import { pollStatus } from '@/lib/video-api';
import { getJob, getActiveJobs, updateJob } from '@/lib/job-store';
import { writeFinalOutput } from '@/lib/sheet-write';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Determine which keys to poll
    let uniqueKeys: string[] = [];
    const sheetId: string | undefined = body.sheetId ?? undefined;
    if (body.uniqueKey) {
      uniqueKeys = [body.uniqueKey];
    } else if (body.uniqueKeys?.length) {
      uniqueKeys = body.uniqueKeys;
    } else {
      // Poll all active jobs
      uniqueKeys = getActiveJobs().map((j) => j.uniqueKey);
    }

    if (uniqueKeys.length === 0) {
      return NextResponse.json({ jobs: [] });
    }

    const results = [];

    for (const uniqueKey of uniqueKeys) {
      const job = getJob(uniqueKey);
      if (!job) {
        results.push({ uniqueKey, error: 'Job not found in store' });
        continue;
      }

      const result = await pollStatus(uniqueKey);

      if (result.status === 'error') {
        updateJob(uniqueKey, { status: 'error', error: result.error });
        results.push({ ...job, status: 'error', error: result.error });
        continue;
      }

      if (result.status === 'complete') {
        updateJob(uniqueKey, {
          status: 'complete',
          videoUrl: result.videoUrl,
          audioUrl: result.audioUrl,
          completedAt: new Date().toISOString(),
        });

        // Write back to sheet — Content Generator tab, cols F & G, matched by title
        try {
          await writeFinalOutput(job.title, result.videoUrl, result.audioUrl, sheetId);
        } catch (writeErr) {
          console.error('Failed to write output to sheet:', writeErr);
        }

        results.push({ ...job, status: 'complete', videoUrl: result.videoUrl, audioUrl: result.audioUrl });
        continue;
      }

      // Still pending
      updateJob(uniqueKey, { status: 'pending' });
      results.push({ ...job, status: 'pending' });
    }

    return NextResponse.json({ jobs: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
