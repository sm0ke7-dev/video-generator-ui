import { getSheetData } from './sheets';
import type { KeywordEntry, SceneData, BackgroundTrack, ControlPanelStatus } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a Map<title, string[]> from a tab where col 0 = title, cols 1-N = scene values */
function buildSceneMap(rows: string[][]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  // skip header row (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[0]?.trim();
    if (!title) continue;
    const scenes = row.slice(1).map((v) => v?.trim() ?? '');
    map.set(title, scenes);
  }
  return map;
}

// ─── Readers ────────────────────────────────────────────────────────────────

/** Master keyword list from Content Generator tab.
 *  Columns: A=Keyword Variation | B=Core Keyword | C=Location | D=Background Audio | E=Make Video? | F=Final Video URL | G=Final Audio URL */
export async function getAllKeywords(spreadsheetId?: string): Promise<{
  title: string;
  coreKeyword: string;
  location: string;
  backgroundAudio: string;
  makeVideo: boolean;
  finalVideoUrl: string;
  finalAudioUrl: string;
}[]> {
  const rows = await getSheetData('Content Generator', 'A:G', spreadsheetId);
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const [title, coreKeyword, location, backgroundAudio, makeVideo, finalVideoUrl, finalAudioUrl] = rows[i];
    if (!title?.trim()) continue;
    results.push({
      title: title.trim(),
      coreKeyword: coreKeyword?.trim() ?? '',
      location: location?.trim() ?? '',
      backgroundAudio: backgroundAudio?.trim() ?? '',
      makeVideo: makeVideo?.toString().toUpperCase() === 'TRUE',
      finalVideoUrl: finalVideoUrl?.trim() ?? '',
      finalAudioUrl: finalAudioUrl?.trim() ?? '',
    });
  }
  return results;
}

/** Video clip URLs per keyword — from Video tab */
export async function getVideoClips(spreadsheetId?: string): Promise<Map<string, string[]>> {
  const rows = await getSheetData('Video', 'A:ZZ', spreadsheetId);
  return buildSceneMap(rows);
}

/** Caption text per scene per keyword — from Text tab */
export async function getCaptions(spreadsheetId?: string): Promise<Map<string, string[]>> {
  const rows = await getSheetData('Text', 'A:ZZ', spreadsheetId);
  return buildSceneMap(rows);
}

/** Phonetic narration text per scene per keyword — from Phonetic Text tab */
export async function getPhoneticText(spreadsheetId?: string): Promise<Map<string, string[]>> {
  const rows = await getSheetData('Phonetic Text', 'A:ZZ', spreadsheetId);
  return buildSceneMap(rows);
}

/** Background music track URLs — from bgAudio tab.
 *  Column A = URL, header = "Tracks" */
export async function getBackgroundMusic(spreadsheetId?: string): Promise<BackgroundTrack[]> {
  const rows = await getSheetData('bgAudio', 'A:A', spreadsheetId);
  const tracks: BackgroundTrack[] = [];
  for (let i = 1; i < rows.length; i++) {
    const url = rows[i]?.[0]?.trim();
    if (!url) continue;
    // Derive readable name from filename: "Soothing_Solace.mp3" → "Soothing Solace"
    const filename = url.split('/').pop() ?? url;
    const name = filename.replace(/\.mp3$/i, '').replace(/_/g, ' ');
    tracks.push({ url, name });
  }
  return tracks;
}

/** Global generator control state — from start_button tab */
export async function getControlPanel(): Promise<ControlPanelStatus> {
  const rows = await getSheetData('start_button', 'A:B');
  const valueRow = rows[1] ?? [];
  return {
    variationGeneratorActive: valueRow[0]?.trim().toUpperCase() === 'TRUE',
    mediaGeneratorActive: valueRow[1]?.trim().toUpperCase() === 'TRUE',
  };
}

/** Final output URLs — from pasteBoard tab.
 *  Note: col A is empty, cols B & C are video/audio URLs.
 *  Returns array in sheet order. */
export async function getFinalOutputRaw(): Promise<{ videoUrl: string; audioUrl: string }[]> {
  const rows = await getSheetData('pasteBoard', 'A:C');
  const results = [];
  // skip header row
  for (let i = 1; i < rows.length; i++) {
    const [, videoUrl, audioUrl] = rows[i] ?? [];
    if (!videoUrl?.trim() && !audioUrl?.trim()) continue;
    results.push({
      videoUrl: videoUrl?.trim() ?? '',
      audioUrl: audioUrl?.trim() ?? '',
    });
  }
  return results;
}

// ─── Merge ──────────────────────────────────────────────────────────────────

/** Merges all tabs into a unified KeywordEntry[] array.
 *  Join key is the keyword title (col A of each tab). */
export async function getFullKeywordData(spreadsheetId?: string): Promise<KeywordEntry[]> {
  const [keywords, videoClips, captions, phoneticTexts, bgTracks] = await Promise.all([
    getAllKeywords(spreadsheetId),
    getVideoClips(spreadsheetId),
    getCaptions(spreadsheetId),
    getPhoneticText(spreadsheetId),
    getBackgroundMusic(spreadsheetId),
  ]);

  const defaultBgMusic = bgTracks[0]?.url ?? 'default';

  return keywords.map((kw) => {
    const clips = videoClips.get(kw.title) ?? [];
    const caps = captions.get(kw.title) ?? [];
    const phonetics = phoneticTexts.get(kw.title) ?? [];

    const sceneCount = Math.max(clips.length, caps.length);
    const scenes: SceneData[] = [];

    for (let i = 0; i < sceneCount; i++) {
      const videoClipUrl = clips[i] ?? '';
      const captionText = caps[i] ?? '';
      const phoneticText = phonetics[i] ?? captionText;
      if (!videoClipUrl) continue;
      scenes.push({ sceneNumber: i + 1, videoClipUrl, captionText, phoneticText });
    }

    // Status: complete if final URLs exist in sheet
    const hasOutput = !!kw.finalVideoUrl;
    const status = hasOutput ? 'complete' : 'idle';

    return {
      title: kw.title,
      coreKeyword: kw.coreKeyword,
      location: kw.location,
      scenes,
      backgroundMusic: kw.backgroundAudio || defaultBgMusic,
      status: status as KeywordEntry['status'],
      finalVideoUrl: kw.finalVideoUrl || undefined,
      finalAudioUrl: kw.finalAudioUrl || undefined,
    };
  });
}
