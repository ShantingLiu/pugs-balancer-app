import { describe, it, expect } from "vitest";
import { parseSheetData } from "@utils/sheetParser";
import { SHEET_COLUMNS } from "@utils/sheetTemplate";

const HEADERS = SHEET_COLUMNS.map((c) => c.header);

function makeRow(overrides: Record<string, string> = {}): string[] {
  const defaults: Record<string, string> = {
    BattleTag: "Test#1234",
    Roles: "Tank",
    "Role Preference": "Tank",
    "Tank Rank (Stadium)": "Pro 2",
    "DPS Rank (Stadium)": "",
    "Support Rank (Stadium)": "",
    "Tank Rank (Comp)": "",
    "DPS Rank (Comp)": "",
    "Support Rank (Comp)": "",
    "Comp Rank (Global)": "",
    "Hero Pool": "",
    "Tank One-Trick": "",
    "DPS One-Trick": "",
    "Support One-Trick": "",
    "Weight Modifier": "0",
    Notes: "",
    "Stadium Wins": "0",
    "Regular 5v5 Wins": "0",
    "Regular 6v6 Wins": "0",
  };
  const merged = { ...defaults, ...overrides };
  return HEADERS.map((h) => merged[h] ?? "");
}

describe("sheetParser", () => {
  describe("parseSheetData", () => {
    it("should parse a valid sheet with one player", () => {
      const rows = [makeRow({ BattleTag: "Swoo#1111", Roles: "Tank,DPS" })];
      const result = parseSheetData(HEADERS, rows);

      expect(result.headerErrors).toHaveLength(0);
      expect(result.duplicateErrors).toHaveLength(0);
      expect(result.players.size).toBe(1);

      const entry = result.players.get("swoo#1111")!;
      expect(entry.player.battletag).toBe("Swoo#1111");
      expect(entry.player.rolesWilling).toEqual(["Tank", "DPS"]);
      expect(entry.rowIndex).toBe(2); // row 0 → rowNum 2 (1-based + header)
    });

    it("should parse multiple players", () => {
      const rows = [
        makeRow({ BattleTag: "Player1#1111" }),
        makeRow({ BattleTag: "Player2#2222" }),
        makeRow({ BattleTag: "Player3#3333" }),
      ];
      const result = parseSheetData(HEADERS, rows);

      expect(result.players.size).toBe(3);
    });

    it("should skip blank rows (empty BattleTag)", () => {
      const rows = [
        makeRow({ BattleTag: "Player1#1111" }),
        makeRow({ BattleTag: "" }),
        makeRow({ BattleTag: "Player2#2222" }),
      ];
      const result = parseSheetData(HEADERS, rows);

      expect(result.players.size).toBe(2);
    });

    it("should reject missing required BattleTag column", () => {
      const badHeaders = HEADERS.filter((h) => h !== "BattleTag");
      // Rebuild row without the BattleTag column
      const row = badHeaders.map(() => "x");
      const result = parseSheetData(badHeaders, [row]);

      expect(result.headerErrors.length).toBeGreaterThan(0);
      expect(result.headerErrors[0]).toContain("BattleTag");
      expect(result.players.size).toBe(0);
    });

    it("should reject missing required Roles column", () => {
      const badHeaders = HEADERS.filter((h) => h !== "Roles");
      const row = badHeaders.map(() => "x");
      const result = parseSheetData(badHeaders, [row]);

      expect(result.headerErrors.length).toBeGreaterThan(0);
      expect(result.headerErrors.some((e) => e.includes("Roles"))).toBe(true);
    });

    it("should silently ignore extra columns", () => {
      const extendedHeaders = [...HEADERS, "Custom Notes", "Extra"];
      const rows = [
        [...makeRow({ BattleTag: "Test#1111" }), "custom value", "extra"],
      ];
      const result = parseSheetData(extendedHeaders, rows);

      expect(result.headerErrors).toHaveLength(0);
      expect(result.players.size).toBe(1);
    });

    it("should store players keyed by lowercase BattleTag", () => {
      const rows = [makeRow({ BattleTag: "UPPER#1111" })];
      const result = parseSheetData(HEADERS, rows);

      expect(result.players.has("upper#1111")).toBe(true);
      expect(result.players.get("upper#1111")!.player.battletag).toBe(
        "UPPER#1111",
      );
    });
  });

  describe("parsePlayerRow (via parseSheetData)", () => {
    it("should parse rank fields", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          "Tank Rank (Stadium)": "Pro 2",
          "DPS Rank (Comp)": "Diamond 1",
          "Comp Rank (Global)": "Master 3",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.tankRank).toBe("Pro 2");
      expect(player.dpsCompRank).toBe("Diamond 1");
      expect(player.regularCompRank).toBe("Master 3");
    });

    it("should warn and null-out invalid rank formats", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          "Tank Rank (Stadium)": "not a rank!!",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.tankRank).toBeNull();
      expect(result.rowWarnings.get(2)).toBeDefined();
      expect(result.rowWarnings.get(2)![0]).toContain("Invalid rank");
    });

    it("should parse comma-separated roles", () => {
      const rows = [
        makeRow({ BattleTag: "A#1", Roles: "Tank,DPS,Support" }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.rolesWilling).toEqual(["Tank", "DPS", "Support"]);
    });

    it("should filter out invalid roles", () => {
      const rows = [
        makeRow({ BattleTag: "A#1", Roles: "Tank,Healer,DPS" }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.rolesWilling).toEqual(["Tank", "DPS"]);
    });

    it("should parse hero pool as array", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          "Hero Pool": "Reinhardt,D.Va,Zarya",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.heroPool).toEqual(["Reinhardt", "D.Va", "Zarya"]);
    });

    it("should parse integer fields with fallback to 0", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          "Stadium Wins": "15",
          "Regular 5v5 Wins": "",
          "Weight Modifier": "abc",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.stadiumWins).toBe(15);
      expect(player.regular5v5Wins).toBe(0);
      expect(player.weightModifier).toBe(0); // "abc" → NaN → 0
    });

    it("should parse one-trick fields and derive legacy fields", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          "Tank One-Trick": "Reinhardt",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.tankOneTrick).toBe("Reinhardt");
      expect(player.isOneTrick).toBe(true);
      expect(player.oneTrickHero).toBe("Reinhardt");
    });

    it("should set isOneTrick false when no one-trick fields", () => {
      const rows = [makeRow({ BattleTag: "A#1" })];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.isOneTrick).toBe(false);
      expect(player.oneTrickHero).toBeNull();
    });

    it("should default rolePreference to rolesWilling when empty", () => {
      const rows = [
        makeRow({
          BattleTag: "A#1",
          Roles: "DPS,Support",
          "Role Preference": "",
        }),
      ];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.rolePreference).toEqual(["DPS", "Support"]);
    });

    it("should parse notes as null when empty", () => {
      const rows = [makeRow({ BattleTag: "A#1", Notes: "" })];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.notes).toBeNull();
    });

    it("should parse notes as string when present", () => {
      const rows = [makeRow({ BattleTag: "A#1", Notes: "Great player" })];
      const result = parseSheetData(HEADERS, rows);
      const player = result.players.get("a#1")!.player;

      expect(player.notes).toBe("Great player");
    });
  });

  describe("checkDuplicateBattleTags", () => {
    it("should detect duplicate BattleTags (case-insensitive)", () => {
      const rows = [
        makeRow({ BattleTag: "Swoo#1111" }),
        makeRow({ BattleTag: "swoo#1111" }),
      ];
      const result = parseSheetData(HEADERS, rows);

      expect(result.duplicateErrors.length).toBeGreaterThan(0);
      expect(result.duplicateErrors[0]).toContain("Duplicate BattleTag");
      expect(result.players.size).toBe(0); // blocks the entire parse
    });

    it("should report row numbers in duplicate error", () => {
      const rows = [
        makeRow({ BattleTag: "A#1" }),
        makeRow({ BattleTag: "B#2" }),
        makeRow({ BattleTag: "a#1" }),
      ];
      const result = parseSheetData(HEADERS, rows);

      expect(result.duplicateErrors[0]).toContain("2"); // first occurrence
      expect(result.duplicateErrors[0]).toContain("4"); // second occurrence (row 3 + header = 4)
    });

    it("should pass when no duplicates", () => {
      const rows = [
        makeRow({ BattleTag: "A#1" }),
        makeRow({ BattleTag: "B#2" }),
      ];
      const result = parseSheetData(HEADERS, rows);

      expect(result.duplicateErrors).toHaveLength(0);
    });
  });
});
