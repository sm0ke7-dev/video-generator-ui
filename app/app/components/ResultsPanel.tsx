'use client';

import VideoPlayer from './VideoPlayer';
import type { KeywordEntry } from '@/lib/types';
import type { JobRecord } from '@/lib/job-store';

interface Props {
  keywords: KeywordEntry[];
  jobs: JobRecord[];
}

export default function ResultsPanel({ keywords, jobs }: Props) {
  // Merge sheet-based completions with in-session job completions
  const completedFromSheet = keywords.filter((k) => k.status === 'complete' && k.finalVideoUrl);

  const completedFromJobs = jobs
    .filter((j) => j.status === 'complete' && j.videoUrl)
    .filter((j) => !completedFromSheet.find((k) => k.title === j.title)); // avoid dupes

  const sheetResults = completedFromSheet.map((k) => ({
    title: k.title,
    videoUrl: k.finalVideoUrl!,
    audioUrl: k.finalAudioUrl,
    completedAt: undefined as string | undefined,
  }));

  const jobResults = completedFromJobs.map((j) => ({
    title: j.title,
    videoUrl: j.videoUrl!,
    audioUrl: j.audioUrl,
    completedAt: j.completedAt,
  }));

  // Jobs completed this session first (newest first), then sheet results
  const all = [
    ...jobResults.sort((a, b) =>
      (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
    ),
    ...sheetResults,
  ];

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-slate-400">
        <p className="text-lg font-medium">No completed videos yet</p>
        <p className="text-sm mt-1">Generate a video from the Keywords tab to see results here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        {all.length} completed video{all.length !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {all.map((result) => (
          <VideoPlayer
            key={result.title}
            title={result.title}
            videoUrl={result.videoUrl}
            audioUrl={result.audioUrl}
            completedAt={result.completedAt}
          />
        ))}
      </div>
    </div>
  );
}
