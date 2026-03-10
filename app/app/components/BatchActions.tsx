'use client';

import type { KeywordEntry } from '@/lib/types';
import type { JobRecord } from '@/lib/job-store';

interface Props {
  keywords: KeywordEntry[];
  jobs: JobRecord[];
  selected: Set<string>;
  onGenerateFlagged: () => void;
  onGenerateSelected: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  hasActiveJobs: boolean;
}

export default function BatchActions({
  keywords,
  jobs,
  selected,
  onGenerateFlagged,
  onGenerateSelected,
  onRefresh,
  isRefreshing,
  hasActiveJobs,
}: Props) {
  const activeJobTitles = new Set(jobs.filter((j) => j.status === 'submitted' || j.status === 'pending').map((j) => j.title));
  const idleKeywords = keywords.filter((k) => !activeJobTitles.has(k.title) && k.status !== 'complete');
  const flaggedCount = idleKeywords.length;
  const selectedCount = selected.size;
  const totalCount = keywords.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="font-medium text-slate-700">{totalCount}</span> keywords
        {selectedCount > 0 && (
          <>
            <span>·</span>
            <span className="font-medium text-blue-600">{selectedCount}</span> selected
          </>
        )}
        {flaggedCount > 0 && (
          <>
            <span>·</span>
            <span className="font-medium text-slate-600">{flaggedCount}</span> ready to generate
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>

        {selectedCount > 0 && (
          <button
            onClick={onGenerateSelected}
            disabled={hasActiveJobs}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate Selected ({selectedCount})
          </button>
        )}

        <button
          onClick={onGenerateFlagged}
          disabled={hasActiveJobs || flaggedCount === 0}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate All ({flaggedCount})
        </button>
      </div>
    </div>
  );
}
