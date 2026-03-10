'use client';

import type { KeywordEntry } from '@/lib/types';

interface Props {
  entry: KeywordEntry;
  onClose: () => void;
}

export default function ScenePreview({ entry, onClose }: Props) {
  const bgName = entry.backgroundMusic
    ? entry.backgroundMusic.split('/').pop()?.replace(/\.mp3$/i, '').replace(/_/g, ' ')
    : 'Default';

  return (
    <div className="border-t border-blue-100 bg-blue-50/50 px-6 py-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{entry.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {entry.scenes.length} scenes · Background: {bgName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scenes grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entry.scenes.map((scene) => (
          <div
            key={scene.sceneNumber}
            className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            {/* Video clip */}
            <div className="relative bg-black aspect-video">
              <video
                src={scene.videoClipUrl}
                controls
                preload="metadata"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                Scene {scene.sceneNumber}
              </span>
            </div>

            {/* Text */}
            <div className="px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-slate-700 leading-snug">
                {scene.captionText}
              </p>
              {scene.phoneticText && scene.phoneticText !== scene.captionText && (
                <p className="text-xs italic text-slate-400 leading-snug">
                  {scene.phoneticText}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completed video player inline if available */}
      {entry.finalVideoUrl && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-800">Final Output</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <video
              src={entry.finalVideoUrl}
              controls
              className="w-full max-w-md rounded-lg shadow"
            />
            <div className="flex flex-col gap-2">
              <a
                href={entry.finalVideoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                ↓ Download Video
              </a>
              {entry.finalAudioUrl && (
                <>
                  <audio src={entry.finalAudioUrl} controls className="w-full max-w-xs" />
                  <a
                    href={entry.finalAudioUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-emerald-300 px-4 py-2 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    ↓ Download Audio
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
