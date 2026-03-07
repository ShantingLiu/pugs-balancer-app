import { fetch } from "@tauri-apps/plugin-http";
import { getAccessToken, invalidateAccessToken } from "@services/googleAuth";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@config/google";
import { buildDataValidationRequests } from "@utils/sheetTemplate";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// ---------------------------------------------------------------------------
// Auth-aware fetch with transparent 401 retry (§4.1)
// ---------------------------------------------------------------------------

async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    invalidateAccessToken();
    const freshToken = await getAccessToken(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${freshToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  return response;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function readRosterSheet(
  spreadsheetId: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  const range = encodeURIComponent("Roster");
  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}?majorDimension=ROWS`,
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }

  const data = await response.json();
  const values: string[][] = data.values ?? [];

  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: values[0],
    rows: values.slice(1),
  };
}

// ---------------------------------------------------------------------------
// Write (batch update cells)
// ---------------------------------------------------------------------------

export async function batchUpdateCells(
  spreadsheetId: string,
  updates: CellUpdate[],
): Promise<void> {
  if (updates.length === 0) return;

  const data = updates.map((u) => ({
    range: `Roster!${columnLetter(u.col)}${u.row}`,
    values: [[u.value]],
  }));

  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    },
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }
}

// ---------------------------------------------------------------------------
// Append rows (new players)
// ---------------------------------------------------------------------------

export async function appendRows(
  spreadsheetId: string,
  rows: string[][],
): Promise<void> {
  if (rows.length === 0) return;

  const range = encodeURIComponent("Roster");
  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: rows }),
    },
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }
}

// ---------------------------------------------------------------------------
// Delete rows (reserved for future use)
// ---------------------------------------------------------------------------

export async function deleteRows(
  spreadsheetId: string,
  sheetId: number,
  rowIndices: number[],
): Promise<void> {
  if (rowIndices.length === 0) return;

  const requests = rowIndices
    .sort((a, b) => b - a)
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests }),
    },
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function getSpreadsheetMeta(
  spreadsheetId: string,
): Promise<{ title: string; rosterSheetId: number }> {
  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=properties.title,sheets.properties`,
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rosterTab = data.sheets?.find(
    (s: any) => s.properties.title === "Roster",
  );

  if (!rosterTab) {
    throw new Error("MISSING_ROSTER_TAB");
  }

  return {
    title: data.properties.title,
    rosterSheetId: rosterTab.properties.sheetId,
  };
}

// ---------------------------------------------------------------------------
// Create spreadsheet
// ---------------------------------------------------------------------------

export async function createSpreadsheet(
  requestBody: object,
): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  rosterSheetId: number;
}> {
  const response = await authFetch(SHEETS_API, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rosterTab = data.sheets?.find(
    (s: any) => s.properties.title === "Roster",
  );

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    rosterSheetId: rosterTab?.properties.sheetId ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Data validation (dropdowns)
// ---------------------------------------------------------------------------

export async function applyDataValidation(
  spreadsheetId: string,
  rosterSheetId: number,
): Promise<void> {
  const requests = buildDataValidationRequests(rosterSheetId);
  if (requests.length === 0) return;

  const response = await authFetch(
    `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests }),
    },
  );

  if (!response.ok) {
    throw new SheetsApiError(response.status, await response.text());
  }
}

// ---------------------------------------------------------------------------
// Helpers & Types
// ---------------------------------------------------------------------------

export interface CellUpdate {
  row: number; // 1-based row number
  col: number; // 0-based column index
  value: string;
}

export function columnLetter(index: number): string {
  let result = "";
  let i = index;
  while (i >= 0) {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}

export class SheetsApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Sheets API error ${status}: ${body}`);
    this.name = "SheetsApiError";
    this.status = status;
    this.body = body;
  }
}
