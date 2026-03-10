'use client';

import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import ScenePreview from './ScenePreview';
import type { KeywordEntry } from '@/lib/types';
import type { JobRecord } from '@/lib/job-store';

interface Props {
  keywords: KeywordEntry[];
  jobs: JobRecord[];
  selected: Set<string>;
  onToggleSelect: (title: string) => void;
  onToggleSelectAll: (titles: string[]) => void;
  onGenerate: (title: string) => void;
  onRetry: (title: string) => void;
  onRowClick: (title: string) => void;
  expandedTitle: string | null;
  submitting: Set<string>;
}

type SortKey = 'title' | 'location' | 'status' | 'scenes';
type SortDir = 'asc' | 'desc';

function resolveStatus(kw: KeywordEntry, jobs: JobRecord[]): string {
  const job = jobs.find((j) => j.title === kw.title);
  return job ? job.status : kw.status;
}

export default function KeywordTable({
  keywords,
  jobs,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onGenerate,
  onRetry,
  onRowClick,
  expandedTitle,
  submitting,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = keywords
    .filter((kw) =>
      search === '' ||
      kw.title.toLowerCase().includes(search.toLowerCase()) ||
      kw.location.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortKey === 'title') { av = a.title; bv = b.title; }
      if (sortKey === 'location') { av = a.location; bv = b.location; }
      if (sortKey === 'status') { av = resolveStatus(a, jobs); bv = resolveStatus(b, jobs); }
      if (sortKey === 'scenes') { av = String(a.scenes.length).padStart(4, '0'); bv = String(b.scenes.length).padStart(4, '0'); }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const allFilteredTitles = filtered.map((k) => k.title);
  const allSelected = allFilteredTitles.length > 0 && allFilteredTitles.every((t) => selected.has(t));

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none';

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search keywords or locations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(allFilteredTitles)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </th>
              <th className={thClass} onClick={() => handleSort('title')}>
                Keyword <SortIcon col="title" />
              </th>
              <th className={thClass} onClick={() => handleSort('location')}>
                Location <SortIcon col="location" />
              </th>
              <th className={thClass} onClick={() => handleSort('scenes')}>
                Scenes <SortIcon col="scenes" />
              </th>
              <th className={thClass} onClick={() => handleSort('status')}>
                Status <SortIcon col="status" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {search ? 'No keywords match your search.' : 'No keywords found.'}
                </td>
              </tr>
            )}
            {filtered.map((kw) => {
              const status = resolveStatus(kw, jobs) as Parameters<typeof StatusBadge>[0]['status'];
              const isExpanded = expandedTitle === kw.title;
              const isSubmitting = submitting.has(kw.title);
              const isActive = status === 'submitted' || status === 'pending' || status === 'processing';
              const isComplete = status === 'complete';
              const isError = status === 'error';

              return (
                <React.Fragment key={kw.title}>
                <tr
                  className={`group transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(kw.title)}
                      onChange={() => onToggleSelect(kw.title)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </td>
                  <td
                    className="px-4 py-3 font-medium text-slate-800 cursor-pointer"
                    onClick={() => onRowClick(kw.title)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''} text-slate-400`}>
                        ▶
                      </span>
                      {kw.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{kw.location}</td>
                  <td className="px-4 py-3 text-slate-500">{kw.scenes.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {isComplete ? (
                      <span className="text-xs text-emerald-600 font-medium">Done</span>
                    ) : isError ? (
                      <button
                        onClick={() => onRetry(kw.title)}
                        disabled={isSubmitting}
                        className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-40"
                      >
                        {isSubmitting ? 'Retrying...' : '↺ Retry'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onGenerate(kw.title)}
                        disabled={isActive || isSubmitting}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSubmitting ? 'Submitting...' : isActive ? 'Running...' : 'Generate'}
                      </button>
                    )}
                  </td>
                </tr>
                {/* Inline scene preview */}
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <ScenePreview
                        entry={kw}
                        onClose={() => onRowClick(kw.title)}
                      />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
