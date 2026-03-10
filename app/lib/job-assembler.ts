import type { KeywordEntry, VideoJobRequest } from './types';

export function assembleJobPayload(entry: KeywordEntry): VideoJobRequest {
  const scenes = entry.scenes
    .filter((s) => s.videoClipUrl)
    .map((s) => {
      const scene: { url: string; text: string; phonetic_text?: string } = {
        url: s.videoClipUrl,
        text: s.captionText,
      };
      // Only include phonetic_text if it differs from caption (API falls back to text anyway)
      if (s.phoneticText && s.phoneticText !== s.captionText) {
        scene.phonetic_text = s.phoneticText;
      }
      return scene;
    });

  return {
    user_id: process.env.VIDEO_API_USER_ID!,
    password: process.env.VIDEO_API_PASSWORD!,
    method_type: 'Matrix',
    request_data: {
      configs: {
        resolution: '1920x1080',
        text_placement: 'bottom',
        background_music: entry.backgroundMusic || 'default',
      },
      media_generator: scenes,
    },
  };
}
