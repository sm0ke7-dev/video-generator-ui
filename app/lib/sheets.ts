import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export const SHEET_GIDS = {
  TITLE: 0,
  AUDIO: 133642313,
  FINAL_OUTPUT: 1677247627,
  KEYWORDS: 1758979414,
  VIDEO_CLIPS: 1869172958,
  CAPTIONS: 204559524,
  CONTROL_PANEL: 204732952,
  BG_MUSIC: 480985891,
  PHONETIC_TEXT: 774757930,
  MAKE_VIDEO_FLAGS: 889953456,
} as const;

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

// Map GIDs to actual tab names (verified against live sheet 2026-03-09)
const GID_TO_NAME: Record<number, string> = {
  [SHEET_GIDS.TITLE]: 'Business Data',          // gid=0        — app config
  [SHEET_GIDS.AUDIO]: 'Audio',                   // gid=133642313 — narration MP3 URLs
  [SHEET_GIDS.FINAL_OUTPUT]: 'pasteBoard',       // gid=1677247627 — completed video/audio URLs
  [SHEET_GIDS.KEYWORDS]: 'Content Generator',    // gid=1758979414 — master keyword list
  [SHEET_GIDS.VIDEO_CLIPS]: 'Video',             // gid=204559524 — video clip URLs per scene
  [SHEET_GIDS.CAPTIONS]: 'Text',                 // gid=889953456 — caption text per scene
  [SHEET_GIDS.CONTROL_PANEL]: 'start_button',    // gid=218290690 — global generator toggles
  [SHEET_GIDS.BG_MUSIC]: 'bgAudio',              // gid=774757930 — background music MP3 URLs
  [SHEET_GIDS.PHONETIC_TEXT]: 'Phonetic Text',   // gid=204732952 — phonetic narration text
  [SHEET_GIDS.MAKE_VIDEO_FLAGS]: 'start_button', // gid=218290690 — same tab (global flag)
};

function getAuthClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!;
  const absolutePath = path.resolve(process.cwd(), keyPath);
  const keyFile = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  return new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function getSheets() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Reads all rows from a sheet tab by its name.
 * Returns raw 2D array of string values.
 */
export async function getSheetData(sheetName: string, range = 'A:ZZ', spreadsheetId = SPREADSHEET_ID): Promise<string[][]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${range}`,
  });
  return (response.data.values ?? []) as string[][];
}

/**
 * Reads rows by GID (looks up tab name from GID_TO_NAME map).
 */
export async function getSheetDataByGid(gid: number, range = 'A:ZZ'): Promise<string[][]> {
  const name = GID_TO_NAME[gid];
  if (!name) throw new Error(`No sheet name mapped for GID ${gid}`);
  return getSheetData(name, range);
}

/**
 * Writes values to a sheet tab.
 */
export async function writeSheetData(sheetName: string, range: string, values: string[][], spreadsheetId = SPREADSHEET_ID): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

/**
 * Gets the actual sheet tab names from the spreadsheet.
 * Useful for debugging GID → name mapping.
 */
export async function getSheetNames(): Promise<{ title: string; sheetId: number }[]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  return (response.data.sheets ?? []).map((s) => ({
    title: s.properties?.title ?? '',
    sheetId: s.properties?.sheetId ?? 0,
  }));
}
