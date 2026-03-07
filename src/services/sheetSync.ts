import type { Player } from "@engine/types";
import type { GameMode } from "@engine/modeConfig";
import { SHEET_COLUMNS } from "@utils/sheetTemplate";
import { serializePlayerToRow } from "@utils/sheetTemplate";
import { parseSheetData } from "@utils/sheetParser";
import { computeDiff } from "@services/diffEngine";
import type { SyncDiff, PlayerDiff } from "@services/diffEngine";
import {
  readRosterSheet,
  getSpreadsheetMeta,
  batchUpdateCells,
  appendRows,
} from "@services/sheetsApi";
import type { CellUpdate } from "@services/sheetsApi";
import { usePlayerStore } from "@store/playerStore";
import { useSheetStore } from "@store/sheetStore";
import { useSessionStore } from "@store/sessionStore";

// ---------------------------------------------------------------------------
// Error class (§8.1 — P1-028)
// ---------------------------------------------------------------------------

export class SyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SyncError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Column index helper (§8.1 — P1-030)
// ---------------------------------------------------------------------------

export function getColumnIndex(field: string): number {
  const idx = SHEET_COLUMNS.findIndex((c) => c.field === field);
  if (idx === -1) throw new Error(`Unknown field: ${field}`);
  return idx;
}

// ---------------------------------------------------------------------------
// Deserialization (§8.1 — P1-029)
// ---------------------------------------------------------------------------

const ARRAY_FIELDS = new Set(["rolesWilling", "rolePreference", "heroPool"]);
const INT_FIELDS = new Set([
  "stadiumWins",
  "regular5v5Wins",
  "regular6v6Wins",
  "weightModifier",
  "allTimeWins",
]);

export function deserializeField(
  field: string,
  value: string,
): unknown {
  if (ARRAY_FIELDS.has(field)) {
    return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }

  if (INT_FIELDS.has(field)) {
    const n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }

  // Boolean field
  if (field === "isOneTrick") {
    return value === "true";
  }

  // Nullable string fields — empty string → null
  if (value === "") return null;
  return value;
}

// ---------------------------------------------------------------------------
// Win consolidation (§9.3 — P1-031)
// ---------------------------------------------------------------------------

const MODE_TO_WIN_FIELD: Record<GameMode, keyof Player> = {
  stadium_5v5: "stadiumWins",
  regular_5v5: "regular5v5Wins",
  regular_6v6: "regular6v6Wins",
};

export function consolidateWinsBeforeSync(): void {
  const sessionState = useSessionStore.getState();
  const playerStore = usePlayerStore.getState();

  const modes: GameMode[] = ["stadium_5v5", "regular_5v5", "regular_6v6"];

  for (const mode of modes) {
    const winsMap = sessionState.totalWins[mode];
    for (const [battletag, sessionWins] of winsMap) {
      if (sessionWins <= 0) continue;

      const player = playerStore.getPlayer(battletag);
      if (!player) continue;

      const field = MODE_TO_WIN_FIELD[mode];
      const baseline = (player[field] as number) ?? 0;
      playerStore.updatePlayer(battletag, { [field]: baseline + sessionWins });
    }
  }

  sessionState.clearSessionWins();
}

// ---------------------------------------------------------------------------
// Sync orchestrator (§8.1 — P1-026)
// ---------------------------------------------------------------------------

export async function performSync(
  spreadsheetId: string,
): Promise<SyncDiff> {
  // 1. Consolidate session wins into player baselines
  consolidateWinsBeforeSync();

  // 2. Verify spreadsheet has a Roster tab
  await getSpreadsheetMeta(spreadsheetId);

  // 3. Read sheet data
  const { headers, rows } = await readRosterSheet(spreadsheetId);

  // 4. Parse into players
  const result = parseSheetData(headers, rows);

  // 5. Check for blocking errors
  if (result.headerErrors.length > 0) {
    throw new SyncError(
      "MALFORMED_HEADERS",
      `Sheet has header problems: ${result.headerErrors.join("; ")}`,
    );
  }

  if (result.duplicateErrors.length > 0) {
    throw new SyncError(
      "DUPLICATE_BATTLETAG",
      `Duplicate BattleTags on sheet: ${result.duplicateErrors.join("; ")}`,
    );
  }

  // 6. Get local players
  const localPlayers = usePlayerStore.getState().players;

  // 7. Detect first sync
  const isFirstSync = useSheetStore.getState().lastSyncedAt === null;

  // 8. Compute diff
  const diff = computeDiff(localPlayers, result.players, isFirstSync);

  // 9. Attach validation warnings from the parser to the diff
  for (const pd of diff.modified) {
    if (pd.sheetRowIndex !== null) {
      const warnings = result.rowWarnings.get(pd.sheetRowIndex);
      if (warnings) pd.validationWarnings = warnings;
    }
  }
  for (const pd of diff.newRemote) {
    if (pd.sheetRowIndex !== null) {
      const warnings = result.rowWarnings.get(pd.sheetRowIndex);
      if (warnings) pd.validationWarnings = warnings;
    }
  }

  return diff;
}

// ---------------------------------------------------------------------------
// Apply sync result (§8.1 — P1-027)
// ---------------------------------------------------------------------------

export async function applySyncResult(
  spreadsheetId: string,
  diff: SyncDiff,
): Promise<void> {
  const playerStore = usePlayerStore.getState();
  const cellUpdates: CellUpdate[] = [];
  const newSheetRows: string[][] = [];

  // --- Modified players ---
  for (const pd of diff.modified) {
    applyModifiedPlayer(pd, playerStore, cellUpdates);
  }

  // --- New remote players (import into local store) ---
  for (const pd of diff.newRemote) {
    if (!pd.selected || !pd.parsedPlayer) continue;
    playerStore.upsertPlayer(pd.parsedPlayer);
  }

  // --- New local players (push to sheet) ---
  for (const pd of diff.newLocal) {
    if (!pd.selected) continue;
    const player = playerStore.getPlayer(pd.battletag);
    if (!player) continue;
    newSheetRows.push(serializePlayerToRow(player));
  }

  // --- Push changes to sheet ---
  if (cellUpdates.length > 0) {
    await batchUpdateCells(spreadsheetId, cellUpdates);
  }

  if (newSheetRows.length > 0) {
    await appendRows(spreadsheetId, newSheetRows);
  }

  // --- Mark as synced ---
  useSheetStore.getState().markSynced();
}

// ---------------------------------------------------------------------------
// Modified player resolution helper
// ---------------------------------------------------------------------------

function applyModifiedPlayer(
  pd: PlayerDiff,
  playerStore: ReturnType<typeof usePlayerStore.getState>,
  cellUpdates: CellUpdate[],
): void {
  const localUpdates: Partial<Player> = {};
  const sheetRowIndex = pd.sheetRowIndex;

  for (const fd of pd.fields) {
    if (fd.chosenSide === "remote") {
      // Apply remote value to local player
      localUpdates[fd.field as keyof Player] = deserializeField(
        fd.field,
        fd.remoteValue,
      ) as never;
    } else if (fd.chosenSide === "local" && sheetRowIndex !== null) {
      // Push local value to sheet
      cellUpdates.push({
        row: sheetRowIndex,
        col: getColumnIndex(fd.field),
        value: fd.localValue,
      });
    }
  }

  if (Object.keys(localUpdates).length > 0) {
    playerStore.updatePlayer(pd.battletag, localUpdates);
  }
}
