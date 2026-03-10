type Status = 'idle' | 'submitted' | 'pending' | 'processing' | 'complete' | 'error';

const CONFIG: Record<Status, { label: string; classes: string }> = {
  idle:       { label: 'Ready',         classes: 'bg-slate-100 text-slate-600' },
  submitted:  { label: 'Queued',        classes: 'bg-yellow-100 text-yellow-700' },
  pending:    { label: 'Processing...', classes: 'bg-blue-100 text-blue-700 animate-pulse' },
  processing: { label: 'Processing...', classes: 'bg-blue-100 text-blue-700 animate-pulse' },
  complete:   { label: 'Complete',      classes: 'bg-emerald-100 text-emerald-700' },
  error:      { label: 'Error',         classes: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.idle;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
