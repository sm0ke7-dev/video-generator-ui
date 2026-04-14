'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import KeywordTable from './components/KeywordTable';
import BatchActions from './components/BatchActions';
import ResultsPanel from './components/ResultsPanel';
import Toast, { type ToastItem } from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import type { KeywordEntry } from '@/lib/types';
import type { JobRecord } from '@/lib/job-store';

type Tab = 'keywords' | 'results';

const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_SHEET_ID = '1hijw2clTvmZV2qxu6u0GnwR8fd1HbbcfbjJRzuvn0Rk';

/** Extracts the sheet ID from a full Google Sheets URL or returns the raw string if it's already an ID */
function parseSheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

export default function DashboardPage() {
  const [keywords, setKeywords] = useState<KeywordEntry[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('keywords');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [sheetInput, setSheetInput] = useState(DEFAULT_SHEET_ID);
  const [activeSheetId, setActiveSheetId] = useState<string | undefined>(DEFAULT_SHEET_ID);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number | null>(null);

  // ─── Toasts ───────────────────────────────────────────────────────────────

  function addToast(message: string, type: ToastItem['type'] = 'info') {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ─── Load keywords ────────────────────────────────────────────────────────

  async function loadKeywords(isRefresh = false, sheetIdOverride?: string) {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const id = sheetIdOverride ?? activeSheetId;
      const url = id ? `/api/keywords?sheetId=${id}` : '/api/keywords';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load keywords');
      const data: KeywordEntry[] = await res.json();
      setKeywords(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadKeywords();
  }, []);

  // ─── Polling ──────────────────────────────────────────────────────────────

  const pollJobs = useCallback(async () => {
    const activeJobs = jobs.filter((j) => j.status === 'submitted' || j.status === 'pending');
    if (activeJobs.length === 0) return;

    // 20-min timeout — mark all active jobs as error
    if (pollStartRef.current && Date.now() - pollStartRef.current > TIMEOUT_MS) {
      setJobs((prev) =>
        prev.map((j) =>
          j.status === 'submitted' || j.status === 'pending'
            ? { ...j, status: 'error' as const, error: 'Timed out after 20 minutes' }
            : j
        )
      );
      addToast('Some jobs timed out after 20 minutes. You can retry them.', 'error');
      stopPolling();
      return;
    }

    try {
      const res = await fetch('/api/video/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueKeys: activeJobs.map((j) => j.uniqueKey), sheetId: activeSheetId }),
      });
      const data = await res.json() as Record<string, unknown>;
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (jobs.length > 0) {
        setJobs((prev) => {
          const updated = new Map(prev.map((j) => [j.uniqueKey, j]));
          for (const j of jobs) {
            updated.set(j.uniqueKey, j);
            // Toast on completion
            if (j.status === 'complete') {
              addToast(`"${j.title}" completed!`, 'success');
            } else if (j.status === 'error') {
              addToast(`"${j.title}" failed: ${j.error ?? 'Unknown error'}`, 'error');
            }
          }
          return Array.from(updated.values());
        });
      }
    } catch {
      // silently continue polling on network error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  function startPolling() {
    if (pollIntervalRef.current) return;
    pollStartRef.current = Date.now();
    pollIntervalRef.current = setInterval(pollJobs, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      pollStartRef.current = null;
    }
  }

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'submitted' || j.status === 'pending');
    if (hasActive) startPolling();
    else stopPolling();
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      const hasActive = jobs.some((j) => j.status === 'submitted' || j.status === 'pending');
      if (hasActive) {
        pollIntervalRef.current = setInterval(pollJobs, POLL_INTERVAL_MS);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollJobs]);

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function submitTitles(titles: string[]) {
    setSubmitting((prev) => {
      const next = new Set(prev);
      titles.forEach((t) => next.add(t));
      return next;
    });

    try {
      const res = await fetch('/api/video/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles, sheetId: activeSheetId }),
      });
      const data = await res.json() as Record<string, unknown>;
      const resultJobs = Array.isArray(data.jobs) ? data.jobs : [];
      if (resultJobs.length > 0) {
        const submitted = resultJobs.filter((j: any) => j.uniqueKey);
        const failed = resultJobs.filter((j: any) => j.error);

        const newJobs: JobRecord[] = submitted.map((j: JobRecord) => j);
        setJobs((prev) => {
          const map = new Map(prev.map((j) => [j.uniqueKey, j]));
          newJobs.forEach((j) => map.set(j.uniqueKey, j));
          return Array.from(map.values());
        });

        if (submitted.length > 0) {
          addToast(`${submitted.length} job${submitted.length > 1 ? 's' : ''} submitted successfully`, 'success');
        }
        for (const f of failed) {
          addToast(`"${f.title}" failed to submit: ${f.error}`, 'error');
        }
      }
    } catch (e) {
      addToast(`Submit failed: ${String(e)}`, 'error');
      setError(`Submit failed: ${String(e)}`);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        titles.forEach((t) => next.delete(t));
        return next;
      });
    }
  }

  // ─── Retry ────────────────────────────────────────────────────────────────

  function handleRetry(title: string) {
    // Remove the failed job from state so it can be resubmitted
    setJobs((prev) => prev.filter((j) => j.title !== title));
    submitTitles([title]);
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  function toggleSelect(title: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  }

  function toggleSelectAll(titles: string[]) {
    setSelected((prev) => {
      const allSelected = titles.every((t) => prev.has(t));
      if (allSelected) {
        const next = new Set(prev);
        titles.forEach((t) => next.delete(t));
        return next;
      }
      return new Set([...prev, ...titles]);
    });
  }

  // ─── Batch actions ────────────────────────────────────────────────────────

  const activeJobTitles = new Set(jobs.filter((j) => j.status === 'submitted' || j.status === 'pending').map((j) => j.title));
  const hasActiveJobs = activeJobTitles.size > 0;

  function handleGenerateFlagged() {
    const titles = keywords
      .filter((k) => !activeJobTitles.has(k.title) && k.status !== 'complete')
      .map((k) => k.title);
    if (titles.length === 0) return;

    setConfirmDialog({
      title: `Generate ${titles.length} videos?`,
      message: `This will submit ${titles.length} video generation jobs simultaneously. This cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        submitTitles(titles);
      },
    });
  }

  function handleGenerateSelected() {
    const titles = Array.from(selected).filter((t) => !activeJobTitles.has(t));
    if (titles.length === 0) return;

    if (titles.length > 1) {
      setConfirmDialog({
        title: `Generate ${titles.length} videos?`,
        message: `This will submit ${titles.length} video generation jobs simultaneously.`,
        onConfirm: () => {
          setConfirmDialog(null);
          submitTitles(titles);
          setSelected(new Set());
        },
      });
    } else {
      submitTitles(titles);
      setSelected(new Set());
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const completedCount = keywords.filter((k) => k.status === 'complete').length +
    jobs.filter((j) => j.status === 'complete' && !keywords.find((k) => k.title === j.title && k.status === 'complete')).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          {lastUpdated && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last synced: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        {hasActiveJobs && (
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            {activeJobTitles.size} job{activeJobTitles.size > 1 ? 's' : ''} running
          </div>
        )}
      </div>

      {/* Sheet switcher */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-slate-500 whitespace-nowrap">Sheet:</span>
        <input
          type="text"
          value={sheetInput}
          onChange={(e) => setSheetInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const id = parseSheetId(sheetInput) || undefined;
              setActiveSheetId(id);
              setJobs([]);
              loadKeywords(false, id);
            }
          }}
          placeholder="Paste Google Sheet URL or ID, then press Enter"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            const id = parseSheetId(sheetInput) || undefined;
            setActiveSheetId(id);
            setJobs([]);
            loadKeywords(false, id);
          }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Load
        </button>
        {activeSheetId && (
          <button
            onClick={() => {
              setSheetInput('');
              setActiveSheetId(undefined);
              setJobs([]);
              loadKeywords(false, undefined);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
          >
            Reset
          </button>
        )}
        {activeSheetId && (
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">✓ Custom sheet active</span>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('keywords')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'keywords'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Keywords
          {keywords.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {keywords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'results'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Completed Results
          {completedCount > 0 && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-600">
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Loading skeleton */}
      {!activeSheetId && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-medium text-slate-600">No sheet loaded</p>
          <p className="text-xs text-slate-400 mt-1">Paste a Google Sheet URL or ID above and click Load</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-slate-200" />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100">
                <div className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 flex-1 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-12 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'results' ? (
        <ResultsPanel keywords={keywords} jobs={jobs} />
      ) : (
        <>
          <BatchActions
            keywords={keywords}
            jobs={jobs}
            selected={selected}
            onGenerateFlagged={handleGenerateFlagged}
            onGenerateSelected={handleGenerateSelected}
            onRefresh={() => loadKeywords(true)}
            isRefreshing={isRefreshing}
            hasActiveJobs={hasActiveJobs}
          />
          <KeywordTable
            keywords={keywords}
            jobs={jobs}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onGenerate={(title) => submitTitles([title])}
            onRetry={handleRetry}
            onRowClick={(title) =>
              setExpandedTitle((prev) => (prev === title ? null : title))
            }
            expandedTitle={expandedTitle}
            submitting={submitting}
          />
        </>
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Confirmation dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Generate"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
