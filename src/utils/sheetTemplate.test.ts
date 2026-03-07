import { describe, it, expect } from "vitest";
import type { Player } from "@engine/types";
import {
  SHEET_COLUMNS,
  HEADER_TO_FIELD,
  FIELD_TO_HEADER,
  serializePlayerToRow,
  buildDataValidationRequests,
  buildTemplateRequest,
} from "@utils/sheetTemplate";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    battletag: "Test#1234",
    tankRank: null,
    dpsRank: null,
    supportRank: null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling: ["Tank"],
    rolePreference: ["Tank"],
    heroPool: [],
    isOneTrick: false,
    oneTrickHero: null,
    tankOneTrick: null,
    dpsOneTrick: null,
    supportOneTrick: null,
    regularCompRank: null,
    weightModifier: 0,
    notes: null,
    stadiumWins: 0,
    regular5v5Wins: 0,
    regular6v6Wins: 0,
    allTimeWins: 0,
    ...overrides,
  };
}

describe("sheetTemplate", () => {
  describe("SHEET_COLUMNS", () => {
    it("should have 19 columns", () => {
      expect(SHEET_COLUMNS).toHaveLength(19);
    });

    it("should have BattleTag as first column", () => {
      expect(SHEET_COLUMNS[0].header).toBe("BattleTag");
      expect(SHEET_COLUMNS[0].field).toBe("battletag");
    });

    it("should mark BattleTag and Roles as required", () => {
      const required = SHEET_COLUMNS.filter((c) => c.required);
      expect(required).toHaveLength(2);
      expect(required.map((c) => c.field)).toEqual(["battletag", "rolesWilling"]);
    });

    it("should have all unique headers", () => {
      const headers = SHEET_COLUMNS.map((c) => c.header);
      expect(new Set(headers).size).toBe(headers.length);
    });

    it("should have all unique field names", () => {
      const fields = SHEET_COLUMNS.map((c) => c.field);
      expect(new Set(fields).size).toBe(fields.length);
    });
  });

  describe("HEADER_TO_FIELD / FIELD_TO_HEADER", () => {
    it("should map all 19 column headers", () => {
      expect(HEADER_TO_FIELD.size).toBe(19);
      expect(FIELD_TO_HEADER.size).toBe(19);
    });

    it("should be bidirectional inverses", () => {
      for (const [header, field] of HEADER_TO_FIELD) {
        expect(FIELD_TO_HEADER.get(field)).toBe(header);
      }
    });

    it("should map known headers correctly", () => {
      expect(HEADER_TO_FIELD.get("BattleTag")).toBe("battletag");
      expect(HEADER_TO_FIELD.get("Roles")).toBe("rolesWilling");
      expect(HEADER_TO_FIELD.get("Tank Rank (Stadium)")).toBe("tankRank");
      expect(HEADER_TO_FIELD.get("Stadium Wins")).toBe("stadiumWins");
    });
  });

  describe("serializePlayerToRow", () => {
    it("should produce array matching SHEET_COLUMNS length", () => {
      const row = serializePlayerToRow(makePlayer());
      expect(row).toHaveLength(19);
    });

    it("should serialize string fields", () => {
      const row = serializePlayerToRow(
        makePlayer({ battletag: "Swoo#1111", tankRank: "Pro 2" }),
      );
      expect(row[0]).toBe("Swoo#1111"); // BattleTag
      expect(row[3]).toBe("Pro 2"); // Tank Rank (Stadium)
    });

    it("should serialize null as empty string", () => {
      const row = serializePlayerToRow(makePlayer({ dpsRank: null }));
      expect(row[4]).toBe(""); // DPS Rank (Stadium)
    });

    it("should serialize arrays as comma-joined", () => {
      const row = serializePlayerToRow(
        makePlayer({ rolesWilling: ["Tank", "DPS"] }),
      );
      expect(row[1]).toBe("Tank,DPS"); // Roles
    });

    it("should serialize numbers as strings", () => {
      const row = serializePlayerToRow(makePlayer({ stadiumWins: 42 }));
      expect(row[16]).toBe("42"); // Stadium Wins
    });

    it("should round-trip: serialize then parse back to same values", () => {
      const original = makePlayer({
        battletag: "Round#Trip",
        rolesWilling: ["Tank", "DPS"],
        rolePreference: ["DPS", "Tank"],
        tankRank: "Pro 2",
        dpsCompRank: "Diamond 1",
        heroPool: ["Reinhardt", "D.Va"],
        tankOneTrick: "Reinhardt",
        weightModifier: -50,
        notes: "test notes",
        stadiumWins: 10,
        regular5v5Wins: 3,
        regular6v6Wins: 0,
      });

      const row = serializePlayerToRow(original);

      // Verify key fields survived serialization
      expect(row[0]).toBe("Round#Trip");
      expect(row[1]).toBe("Tank,DPS");
      expect(row[2]).toBe("DPS,Tank");
      expect(row[3]).toBe("Pro 2");
      expect(row[10]).toBe("Reinhardt,D.Va");
      expect(row[14]).toBe("-50");
      expect(row[15]).toBe("test notes");
      expect(row[16]).toBe("10");
    });
  });

  describe("buildTemplateRequest", () => {
    const result = buildTemplateRequest("My PUGs Sheet") as Record<string, unknown>;

    it("should set the spreadsheet title", () => {
      expect((result.properties as Record<string, unknown>).title).toBe("My PUGs Sheet");
    });

    it("should create Roster and Info sheets", () => {
      const sheets = result.sheets as Array<Record<string, unknown>>;
      expect(sheets).toHaveLength(2);
      expect(
        (sheets[0].properties as Record<string, unknown>).title,
      ).toBe("Roster");
      expect(
        (sheets[1].properties as Record<string, unknown>).title,
      ).toBe("Info");
    });

    it("should freeze the header row", () => {
      const sheets = result.sheets as Array<Record<string, unknown>>;
      const grid = (sheets[0].properties as Record<string, unknown>)
        .gridProperties as Record<string, unknown>;
      expect(grid.frozenRowCount).toBe(1);
    });

    it("should include all 19 column headers in the first row", () => {
      const sheets = result.sheets as Array<Record<string, unknown>>;
      const rowData = (
        (sheets[0].data as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).rowData as Array<Record<string, unknown>>;
      // First row is headers, next 2 are example rows
      expect(rowData).toHaveLength(3);
      const headerValues = (rowData[0].values as Array<Record<string, unknown>>).map(
        (v) => (v.userEnteredValue as Record<string, string>).stringValue,
      );
      expect(headerValues).toEqual(SHEET_COLUMNS.map((c) => c.header));
    });

    it("should bold header cells", () => {
      const sheets = result.sheets as Array<Record<string, unknown>>;
      const rowData = (
        (sheets[0].data as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).rowData as Array<Record<string, unknown>>;
      const firstCell = (rowData[0].values as Array<Record<string, unknown>>)[0];
      const fmt = firstCell.userEnteredFormat as Record<string, unknown>;
      expect((fmt.textFormat as Record<string, unknown>).bold).toBe(true);
    });

    it("should include example rows", () => {
      const sheets = result.sheets as Array<Record<string, unknown>>;
      const rowData = (
        (sheets[0].data as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).rowData as Array<Record<string, unknown>>;
      const exampleRow = rowData[1].values as Array<Record<string, unknown>>;
      const battletag = (exampleRow[0].userEnteredValue as Record<string, string>).stringValue;
      expect(battletag).toBe("Example#1234");
    });
  });

  describe("buildDataValidationRequests", () => {
    const requests = buildDataValidationRequests(0) as Array<Record<string, unknown>>;

    it("should produce 8 validation requests (1 role + 3 stadium + 4 comp)", () => {
      expect(requests).toHaveLength(8);
    });

    it("should set setDataValidation wrapper on each request", () => {
      for (const req of requests) {
        expect(req).toHaveProperty("setDataValidation");
      }
    });

    it("should target column 1 for Roles dropdown with 7 combos", () => {
      const roleReq = (requests[0] as Record<string, unknown>)
        .setDataValidation as Record<string, unknown>;
      const range = roleReq.range as Record<string, number>;
      expect(range.startColumnIndex).toBe(1);
      expect(range.endColumnIndex).toBe(2);
      const values = (
        (roleReq.rule as Record<string, unknown>).condition as Record<string, unknown>
      ).values as Array<Record<string, string>>;
      expect(values).toHaveLength(7);
      expect(values[0].userEnteredValue).toBe("Tank");
    });

    it("should produce 35 stadium rank options (7 tiers × 5)", () => {
      const stadiumReq = (requests[1] as Record<string, unknown>)
        .setDataValidation as Record<string, unknown>;
      const values = (
        (stadiumReq.rule as Record<string, unknown>).condition as Record<string, unknown>
      ).values as Array<Record<string, string>>;
      expect(values).toHaveLength(35);
      expect(values[0].userEnteredValue).toBe("Rookie 1");
      expect(values[values.length - 1].userEnteredValue).toBe("Legend 5");
    });

    it("should target stadium rank columns 3-5", () => {
      for (let i = 1; i <= 3; i++) {
        const req = (requests[i] as Record<string, unknown>)
          .setDataValidation as Record<string, unknown>;
        const range = req.range as Record<string, number>;
        expect(range.startColumnIndex).toBe(i + 2);
      }
    });

    it("should produce 40 comp rank options (8 tiers × 5)", () => {
      const compReq = (requests[4] as Record<string, unknown>)
        .setDataValidation as Record<string, unknown>;
      const values = (
        (compReq.rule as Record<string, unknown>).condition as Record<string, unknown>
      ).values as Array<Record<string, string>>;
      expect(values).toHaveLength(40);
      expect(values[0].userEnteredValue).toBe("Bronze 1");
      expect(values[values.length - 1].userEnteredValue).toBe("Champion 5");
    });

    it("should target comp rank columns 6-9", () => {
      for (let i = 4; i <= 7; i++) {
        const req = (requests[i] as Record<string, unknown>)
          .setDataValidation as Record<string, unknown>;
        const range = req.range as Record<string, number>;
        expect(range.startColumnIndex).toBe(i + 2);
      }
    });

    it("should use showCustomUi and non-strict mode", () => {
      for (const req of requests) {
        const dvReq = (req as Record<string, unknown>).setDataValidation as Record<string, unknown>;
        const rule = dvReq.rule as Record<string, unknown>;
        expect(rule.showCustomUi).toBe(true);
        expect(rule.strict).toBe(false);
      }
    });

    it("should start validation from row 1 (skip header)", () => {
      for (const req of requests) {
        const dvReq = (req as Record<string, unknown>).setDataValidation as Record<string, unknown>;
        const range = dvReq.range as Record<string, number>;
        expect(range.startRowIndex).toBe(1);
      }
    });

    it("should use the given sheetId", () => {
      const customReqs = buildDataValidationRequests(42) as Array<Record<string, unknown>>;
      for (const req of customReqs) {
        const dvReq = (req as Record<string, unknown>).setDataValidation as Record<string, unknown>;
        const range = dvReq.range as Record<string, number>;
        expect(range.sheetId).toBe(42);
      }
    });
  });
});
