/**
 * Extract spreadsheet ID from various Google Sheets URL formats:
 * - https://docs.google.com/spreadsheets/d/{ID}/edit
 * - https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/{ID}/
 * - https://docs.google.com/spreadsheets/d/{ID}
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}
