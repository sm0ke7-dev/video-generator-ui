import { getSheetData, writeSheetData } from './sheets';

/**
 * Writes final video + audio URLs to Content Generator tab, cols F & G,
 * in the row matching the given keyword title (col A).
 */
export async function writeFinalOutput(title: string, videoUrl: string, audioUrl: string): Promise<void> {
  const rows = await getSheetData('Content Generator', 'A:A');

  // Find the row index (1-based, including header)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.[0]?.trim() === title) {
      rowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Title "${title}" not found in Content Generator tab`);
  }

  await writeSheetData('Content Generator', `F${rowIndex}:G${rowIndex}`, [[videoUrl, audioUrl]]);
}
