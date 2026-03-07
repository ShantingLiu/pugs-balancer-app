import type { Player, Role } from "@engine/types";
import { SHEET_COLUMNS, HEADER_TO_FIELD } from "@utils/sheetTemplate";
import { validateRank, validateRoles } from "@utils/csvParser";

// ---------------------------------------------------------------------------
// Types (§7.1)
// ---------------------------------------------------------------------------

export interface SheetParseResult {
  players: Map<string, { player: Player; rowIndex: number }>;
  headerErrors: string[];
  duplicateErrors: string[];
  rowWarnings: Map<number, string[]>;
}

// ---------------------------------------------------------------------------
// Main entry (§7.1)
// ---------------------------------------------------------------------------

export function parseSheetData(
  headers: string[],
  rows: string[][],
): SheetParseResult {
  const headerErrors: string[] = [];
  const rowWarnings = new Map<number, string[]>();

  // Build column index map by header name
  type HeaderKey = (typeof SHEET_COLUMNS)[number]["header"];
  const colMap = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim() as HeaderKey;
    if (HEADER_TO_FIELD.has(header)) {
      colMap.set(HEADER_TO_FIELD.get(header)!, i);
    }
    // Extra columns are silently ignored
  }

  // Validate required headers
  for (const col of SHEET_COLUMNS) {
    if (col.required && !colMap.has(col.field)) {
      headerErrors.push(`Missing required column: "${col.header}"`);
    }
  }

  if (headerErrors.length > 0) {
    return { players: new Map(), headerErrors, duplicateErrors: [], rowWarnings };
  }

  // FR10: Refuse to sync if duplicate BattleTags exist
  const duplicateErrors = checkDuplicateBattleTags(rows, colMap);
  if (duplicateErrors.length > 0) {
    return { players: new Map(), headerErrors: [], duplicateErrors, rowWarnings };
  }

  // Parse each data row
  const players = new Map<string, { player: Player; rowIndex: number }>();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 2; // 1-based, accounting for header row
    const warnings: string[] = [];

    const battletag = getCellValue(row, colMap, "battletag");
    if (!battletag) continue;

    const player = parsePlayerRow(row, colMap, battletag, warnings);

    if (warnings.length > 0) {
      rowWarnings.set(rowNum, warnings);
    }

    players.set(battletag.toLowerCase(), { player, rowIndex: rowNum });
  }

  return { players, headerErrors: [], duplicateErrors: [], rowWarnings };
}

// ---------------------------------------------------------------------------
// Cell access (§7.1)
// ---------------------------------------------------------------------------

function getCellValue(
  row: string[],
  colMap: Map<string, number>,
  field: string,
): string {
  const colIndex = colMap.get(field);
  if (colIndex === undefined || colIndex >= row.length) return "";
  return row[colIndex]?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Row parsing (§7.1)
// ---------------------------------------------------------------------------

function parsePlayerRow(
  row: string[],
  colMap: Map<string, number>,
  battletag: string,
  warnings: string[],
): Player {
  const get = (field: string) => getCellValue(row, colMap, field);

  // Parse rank with validation — invalid values produce a warning and become null
  const parseRank = (field: string, headerName: string): string | null => {
    const val = get(field);
    if (!val) return null;
    if (!validateRank(val)) {
      warnings.push(`Invalid rank '${val}' in ${headerName} — treated as blank`);
      return null;
    }
    return val;
  };

  // Parse integer, default 0
  const parseInt0 = (field: string): number => {
    const val = get(field);
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  };

  // Parse comma-separated list
  const parseList = (field: string): string[] => {
    const val = get(field);
    return val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
  };

  // Roles — validated individually
  const rolesRaw = get("rolesWilling");
  const rolesWilling = rolesRaw
    ? (rolesRaw
        .split(",")
        .map((r) => r.trim())
        .filter((r) => validateRoles(r))
        .map((r) => {
          const n = r.toLowerCase();
          return n === "tank" ? "Tank" : n === "dps" ? "DPS" : "Support";
        }) as Role[])
    : [];

  // Role preference — also validated
  const rolePreference = parseList("rolePreference").filter((r) =>
    validateRoles(r),
  ).map((r) => {
    const n = r.toLowerCase();
    return n === "tank" ? "Tank" : n === "dps" ? "DPS" : "Support";
  }) as Role[];

  const tankOneTrick = get("tankOneTrick") || null;
  const dpsOneTrick = get("dpsOneTrick") || null;
  const supportOneTrick = get("supportOneTrick") || null;

  // Derive legacy isOneTrick / oneTrickHero from role-specific fields
  const roleOneTricks = [tankOneTrick, dpsOneTrick, supportOneTrick].filter(
    Boolean,
  );
  const isOneTrick = roleOneTricks.length > 0;
  const oneTrickHero = roleOneTricks[0] ?? null;

  return {
    battletag,
    rolesWilling,
    rolePreference: rolePreference.length > 0 ? rolePreference : [...rolesWilling],
    tankRank: parseRank("tankRank", "Tank Rank (Stadium)"),
    dpsRank: parseRank("dpsRank", "DPS Rank (Stadium)"),
    supportRank: parseRank("supportRank", "Support Rank (Stadium)"),
    tankCompRank: parseRank("tankCompRank", "Tank Rank (Comp)"),
    dpsCompRank: parseRank("dpsCompRank", "DPS Rank (Comp)"),
    supportCompRank: parseRank("supportCompRank", "Support Rank (Comp)"),
    regularCompRank: parseRank("regularCompRank", "Comp Rank (Global)"),
    heroPool: parseList("heroPool"),
    isOneTrick,
    oneTrickHero,
    tankOneTrick,
    dpsOneTrick,
    supportOneTrick,
    weightModifier: parseInt0("weightModifier"),
    notes: get("notes") || null,
    stadiumWins: parseInt0("stadiumWins"),
    regular5v5Wins: parseInt0("regular5v5Wins"),
    regular6v6Wins: parseInt0("regular6v6Wins"),
    allTimeWins: 0, // deprecated — not present on sheet
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection (§11.2)
// ---------------------------------------------------------------------------

function checkDuplicateBattleTags(
  rows: string[][],
  colMap: Map<string, number>,
): string[] {
  const seen = new Map<string, number>();
  const errors: string[] = [];

  for (let r = 0; r < rows.length; r++) {
    const tag = getCellValue(rows[r], colMap, "battletag");
    if (!tag) continue;

    const key = tag.toLowerCase();
    const rowNum = r + 2;

    if (seen.has(key)) {
      errors.push(
        `Duplicate BattleTag '${tag}' found on rows ${seen.get(key)} and ${rowNum}. Remove the duplicate in the sheet before syncing.`,
      );
    } else {
      seen.set(key, rowNum);
    }
  }

  return errors;
}
