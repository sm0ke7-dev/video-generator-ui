'use client';

interface Props {
  title: string;
  videoUrl: string;
  audioUrl?: string;
  completedAt?: string;
}

export default function VideoPlayer({ title, videoUrl, audioUrl, completedAt }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="font-medium text-slate-800 text-sm">{title}</p>
          {completedAt && (
            <p className="text-xs text-slate-400 mt-0.5">
              Completed {new Date(completedAt).toLocaleString()}
            </p>
          )}
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          Complete
        </span>
      </div>

      {/* Video */}
      <div className="bg-black aspect-video">
        <video
          src={videoUrl}
          controls
          className="w-full h-full"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100">
        <a
          href={videoUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          ↓ Download Video
        </a>
        {audioUrl && (
          <a
            href={audioUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ↓ Download Audio
          </a>
        )}
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Open in new tab ↗
        </a>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="px-4 pb-3 bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">Audio track</p>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
