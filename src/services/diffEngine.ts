import type { Player } from "@engine/types";
import { SHEET_COLUMNS } from "@utils/sheetTemplate";

// ---------------------------------------------------------------------------
// Types (§6.1)
// ---------------------------------------------------------------------------

export type DiffType = "modified" | "new_local" | "new_remote";

export interface FieldDiff {
  field: string;
  header: string;
  localValue: string;
  remoteValue: string;
  defaultChoice: "local" | "remote";
  chosenSide: "local" | "remote";
}

export interface PlayerDiff {
  battletag: string;
  type: DiffType;
  fields: FieldDiff[];
  selected: boolean;
  sheetRowIndex: number | null;
  validationWarnings: string[];
  parsedPlayer?: Player;
}

export interface SyncDiff {
  modified: PlayerDiff[];
  newLocal: PlayerDiff[];
  newRemote: PlayerDiff[];
  isFirstSync: boolean;
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Diff computation (§6.2)
// ---------------------------------------------------------------------------

export function computeDiff(
  localPlayers: Map<string, Player>,
  remotePlayers: Map<string, { player: Player; rowIndex: number }>,
  isFirstSync: boolean,
): SyncDiff {
  const modified: PlayerDiff[] = [];
  const newLocal: PlayerDiff[] = [];
  const newRemote: PlayerDiff[] = [];

  // Normalize keys to lowercase for case-insensitive matching
  const localByKey = new Map<string, Player>();
  for (const [tag, player] of localPlayers) {
    localByKey.set(tag.toLowerCase(), player);
  }
  const remoteByKey = new Map<
    string,
    { player: Player; rowIndex: number }
  >();
  for (const [tag, entry] of remotePlayers) {
    remoteByKey.set(tag.toLowerCase(), entry);
  }

  // Find modified + new_local
  for (const [key, localPlayer] of localByKey) {
    const remote = remoteByKey.get(key);

    if (!remote) {
      newLocal.push({
        battletag: localPlayer.battletag,
        type: "new_local",
        fields: [],
        selected: !isFirstSync,
        sheetRowIndex: null,
        validationWarnings: [],
      });
      continue;
    }

    const fieldDiffs = comparePlayerFields(
      localPlayer,
      remote.player,
      isFirstSync,
    );
    if (fieldDiffs.length > 0) {
      modified.push({
        battletag: localPlayer.battletag,
        type: "modified",
        fields: fieldDiffs,
        selected: true,
        sheetRowIndex: remote.rowIndex,
        validationWarnings: [],
      });
    }
  }

  // Find new_remote
  for (const [key, remote] of remoteByKey) {
    if (!localByKey.has(key)) {
      newRemote.push({
        battletag: remote.player.battletag,
        type: "new_remote",
        fields: [],
        selected: true,
        sheetRowIndex: remote.rowIndex,
        validationWarnings: [],
        parsedPlayer: remote.player,
      });
    }
  }

  const hasChanges =
    modified.length + newLocal.length + newRemote.length > 0;

  return { modified, newLocal, newRemote, isFirstSync, hasChanges };
}

// ---------------------------------------------------------------------------
// Field comparison (§6.3)
// ---------------------------------------------------------------------------

function comparePlayerFields(
  local: Player,
  remote: Player,
  isFirstSync: boolean,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const col of SHEET_COLUMNS) {
    const localVal = serializeField(local, col.field);
    const remoteVal = serializeField(remote, col.field);

    if (localVal === remoteVal) continue;

    const choice = getDefaultChoice(col.field, localVal, remoteVal, isFirstSync);
    diffs.push({
      field: col.field,
      header: col.header,
      localValue: localVal,
      remoteValue: remoteVal,
      defaultChoice: choice,
      chosenSide: choice,
    });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Default choice logic (§6.3)
// ---------------------------------------------------------------------------

function getDefaultChoice(
  field: string,
  localVal: string,
  remoteVal: string,
  isFirstSync: boolean,
): "local" | "remote" {
  // First sync: remote is always source of truth (FR6)
  if (isFirstSync) return "remote";

  // Win counts: higher value wins by default
  if (
    field === "stadiumWins" ||
    field === "regular5v5Wins" ||
    field === "regular6v6Wins"
  ) {
    const localNum = parseInt(localVal, 10) || 0;
    const remoteNum = parseInt(remoteVal, 10) || 0;
    return localNum >= remoteNum ? "local" : "remote";
  }

  // Default: local is source of truth (user made intentional changes in-app)
  return "local";
}

// ---------------------------------------------------------------------------
// Serialization (§6.3)
// ---------------------------------------------------------------------------

export function serializeField(player: Player, field: string): string {
  const value = (player as unknown as Record<string, unknown>)[field];
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}
