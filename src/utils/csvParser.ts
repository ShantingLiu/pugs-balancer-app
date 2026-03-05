import type {
  Player,
  Role,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "@engine/types";
import heroesConfig from "@config/heroes.json";

// =============================================================================
// CSV Parser for Stadium PUGs Balancer
// =============================================================================

/**
 * Raw row from CSV before validation
 */
interface RawCsvRow {
  battletag?: string;
  tank_rank?: string;
  dps_rank?: string;
  support_rank?: string;
  tank_comp_rank?: string;
  dps_comp_rank?: string;
  support_comp_rank?: string;
  roles_willing?: string;
  role_preference?: string;
  hero_pool?: string;
  is_one_trick?: string;
  one_trick_hero?: string;
  tank_one_trick?: string;
  dps_one_trick?: string;
  support_one_trick?: string;
  regular_comp_rank?: string;
  weight_modifier?: string;
  notes?: string;
  all_time_wins?: string;
}

/**
 * Detect delimiter (comma or semicolon) from CSV content
 */
function detectDelimiter(csv: string): string {
  const firstLine = csv.split("\n")[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

/**
 * Parse CSV string into array of raw rows
 */
function parseCSV(csv: string): RawCsvRow[] {
  const delimiter = detectDelimiter(csv);
  const lines = csv.trim().split("\n");

  if (lines.length < 2) {
    return [];
  }

  // Parse header row (case-insensitive)
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().trim()
  );

  // Parse data rows
  const rows: RawCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);
    const row: RawCsvRow = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim() || "";
      // Map header to RawCsvRow key
      const key = header.replace(/-/g, "_") as keyof RawCsvRow;
      if (key in row || isValidHeader(key)) {
        row[key] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Check if header is a valid CSV column
 */
function isValidHeader(header: string): boolean {
  const validHeaders = [
    "battletag",
    "tank_rank",
    "dps_rank",
    "support_rank",
    "tank_comp_rank",
    "dps_comp_rank",
    "support_comp_rank",
    "roles_willing",
    "role_preference",
    "hero_pool",
    "is_one_trick",
    "one_trick_hero",
    "tank_one_trick",
    "dps_one_trick",
    "support_one_trick",
    "regular_comp_rank",
    "weight_modifier",
    "notes",
    "all_time_wins",
  ];
  return validHeaders.includes(header);
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// =============================================================================
// Field Parsing Functions
// =============================================================================

/**
 * Parse a comma-separated list from a string (handles quoted values)
 */
function parseList(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];

  // Remove surrounding quotes if present
  let cleaned = value.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * Parse roles from string, validating they are valid Role types
 */
function parseRoles(value: string | undefined): Role[] {
  const list = parseList(value);
  const validRoles: Role[] = [];

  for (const item of list) {
    const normalized = item.toLowerCase();
    if (normalized === "tank") validRoles.push("Tank");
    else if (normalized === "dps") validRoles.push("DPS");
    else if (normalized === "support") validRoles.push("Support");
  }

  return validRoles;
}

/**
 * Parse boolean from string (handles various formats)
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "y"
  );
}

/**
 * Parse integer from string with default
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === "") return defaultValue;
  const parsed = parseInt(value.trim(), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse optional string (returns null if empty)
 */
function parseOptionalString(value: string | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate battletag format
 * Allows: "Name#12345" (full battletag) or just "Name" (no discriminator)
 */
function isValidBattletag(battletag: string): boolean {
  // Must be non-empty and not just whitespace
  // Optional #digits at the end
  return battletag.trim().length > 0;
}

/**
 * Validate rank format (e.g., "Pro 2", "Elite", "Diamond 3")
 */
function isValidRankFormat(rank: string): boolean {
  // Matches: "Pro", "Pro 2", "All-Star 1", etc.
  return /^[\w-]+(\s+\d)?$/.test(rank);
}

/**
 * Check if hero exists in config
 */
function isKnownHero(hero: string): boolean {
  return hero in heroesConfig.heroes;
}

/**
 * Get hero's role from config
 */
function getHeroRole(hero: string): Role | null {
  const heroData = (heroesConfig.heroes as Record<string, { role: string }>)[
    hero
  ];
  return heroData ? (heroData.role as Role) : null;
}

/**
 * Validate a single player row
 */
function validateRow(
  row: RawCsvRow,
  rowNum: number
): {
  player: Player | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required: battletag
  const battletag = row.battletag?.trim() || "";
  if (!battletag) {
    errors.push({ row: rowNum, field: "battletag", message: "Battletag is required" });
  } else if (!isValidBattletag(battletag)) {
    errors.push({
      row: rowNum,
      field: "battletag",
      message: "Battletag cannot be empty",
    });
  }

  // Required: roles_willing
  const rolesWilling = parseRoles(row.roles_willing);
  if (rolesWilling.length === 0) {
    errors.push({
      row: rowNum,
      field: "roles_willing",
      message: "Must specify at least one role (Tank, DPS, Support)",
    });
  }

  // Parse ranks
  const tankRank = parseOptionalString(row.tank_rank);
  const dpsRank = parseOptionalString(row.dps_rank);
  const supportRank = parseOptionalString(row.support_rank);
  const tankCompRank = parseOptionalString(row.tank_comp_rank);
  const dpsCompRank = parseOptionalString(row.dps_comp_rank);
  const supportCompRank = parseOptionalString(row.support_comp_rank);
  const regularCompRank = parseOptionalString(row.regular_comp_rank);

  // Validate rank formats
  if (tankRank && !isValidRankFormat(tankRank)) {
    errors.push({ row: rowNum, field: "tank_rank", message: `Invalid rank format: ${tankRank}` });
  }
  if (dpsRank && !isValidRankFormat(dpsRank)) {
    errors.push({ row: rowNum, field: "dps_rank", message: `Invalid rank format: ${dpsRank}` });
  }
  if (supportRank && !isValidRankFormat(supportRank)) {
    errors.push({ row: rowNum, field: "support_rank", message: `Invalid rank format: ${supportRank}` });
  }

  // Warning: No rank for willing role and no fallback
  for (const role of rolesWilling) {
    const roleRank =
      role === "Tank" ? tankRank : role === "DPS" ? dpsRank : supportRank;
    const roleCompRank =
      role === "Tank" ? tankCompRank : role === "DPS" ? dpsCompRank : supportCompRank;
    if (!roleRank && !roleCompRank && !regularCompRank) {
      warnings.push({
        row: rowNum,
        message: `No rank for ${role}, will use default (Elite 5)`,
      });
    }
  }

  // Parse hero pool
  const heroPool = parseList(row.hero_pool);
  if (heroPool.length === 0) {
    warnings.push({
      row: rowNum,
      message: "No heroes specified, archetype checks will be skipped",
    });
  }

  // Validate heroes
  for (const hero of heroPool) {
    if (!isKnownHero(hero)) {
      warnings.push({ row: rowNum, message: `Unknown hero: ${hero}` });
    } else {
      // Check if hero matches willing roles
      const heroRole = getHeroRole(hero);
      if (heroRole && !rolesWilling.includes(heroRole)) {
        warnings.push({
          row: rowNum,
          message: `${hero} is a ${heroRole} hero but player not willing to play ${heroRole}`,
        });
      }
    }
  }

  // One-trick validation - support both legacy and new role-specific fields
  const tankOneTrick = parseOptionalString(row.tank_one_trick);
  const dpsOneTrick = parseOptionalString(row.dps_one_trick);
  const supportOneTrick = parseOptionalString(row.support_one_trick);
  
  // Legacy fields (derive from role-specific if not provided)
  let isOneTrick = parseBoolean(row.is_one_trick);
  let oneTrickHero = parseOptionalString(row.one_trick_hero);
  
  // If role-specific one-tricks are provided, derive legacy fields
  const roleOneTricks = [tankOneTrick, dpsOneTrick, supportOneTrick].filter(Boolean);
  if (roleOneTricks.length > 0) {
    isOneTrick = true;
    oneTrickHero = oneTrickHero || roleOneTricks[0];
  }
  
  // Validate legacy one-trick (if is_one_trick is true but no hero specified)
  if (isOneTrick && !oneTrickHero && roleOneTricks.length === 0) {
    errors.push({
      row: rowNum,
      field: "one_trick_hero",
      message: "One-trick hero required when is_one_trick is true",
    });
  }

  // Weight modifier validation
  const weightModifier = parseInteger(row.weight_modifier, 0);
  if (weightModifier < -1000 || weightModifier > 1000) {
    warnings.push({
      row: rowNum,
      message: `Weight modifier ${weightModifier} is outside recommended range (-1000 to 1000)`,
    });
  }

  // All-time wins (for leaderboard display)
  const allTimeWins = parseInteger(row.all_time_wins, 0);

  // If there are errors, don't create a player
  if (errors.length > 0) {
    return { player: null, errors, warnings };
  }

  // Parse role preference (default to roles_willing order)
  let rolePreference = parseRoles(row.role_preference);
  if (rolePreference.length === 0) {
    rolePreference = [...rolesWilling];
  }

  // Create player object
  const player: Player = {
    battletag,
    tankRank,
    dpsRank,
    supportRank,
    tankCompRank,
    dpsCompRank,
    supportCompRank,
    rolesWilling,
    rolePreference,
    heroPool,
    isOneTrick,
    oneTrickHero,
    tankOneTrick,
    dpsOneTrick,
    supportOneTrick,
    regularCompRank,
    weightModifier,
    notes: parseOptionalString(row.notes),
    allTimeWins,
  };

  return { player, errors, warnings };
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Parse and validate CSV content into players
 */
export function parsePlayersCSV(csvContent: string): ValidationResult {
  const rows = parseCSV(csvContent);

  const valid: Player[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because: 1-indexed + header row
    const result = validateRow(row, rowNum);

    errors.push(...result.errors);
    warnings.push(...result.warnings);

    if (result.player) {
      valid.push(result.player);
    }
  });

  return { valid, errors, warnings };
}
