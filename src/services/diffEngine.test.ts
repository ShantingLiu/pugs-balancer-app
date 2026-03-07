import { describe, it, expect } from "vitest";
import type { Player } from "@engine/types";
import { computeDiff, serializeField } from "@services/diffEngine";

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

describe("diffEngine", () => {
  describe("serializeField", () => {
    it("should serialize null to empty string", () => {
      const p = makePlayer({ tankRank: null });
      expect(serializeField(p, "tankRank")).toBe("");
    });

    it("should serialize string fields", () => {
      const p = makePlayer({ tankRank: "Pro 2" });
      expect(serializeField(p, "tankRank")).toBe("Pro 2");
    });

    it("should serialize arrays with comma join", () => {
      const p = makePlayer({ rolesWilling: ["Tank", "DPS"] });
      expect(serializeField(p, "rolesWilling")).toBe("Tank,DPS");
    });

    it("should serialize numbers to string", () => {
      const p = makePlayer({ stadiumWins: 5 });
      expect(serializeField(p, "stadiumWins")).toBe("5");
    });

    it("should serialize 0 as '0'", () => {
      const p = makePlayer({ weightModifier: 0 });
      expect(serializeField(p, "weightModifier")).toBe("0");
    });

    it("should serialize empty array as empty string", () => {
      const p = makePlayer({ heroPool: [] });
      expect(serializeField(p, "heroPool")).toBe("");
    });
  });

  describe("computeDiff", () => {
    it("should return no changes for identical players", () => {
      const player = makePlayer({ battletag: "Swoo#1111", tankRank: "Pro 2" });
      const local = new Map([["Swoo#1111", player]]);
      const remote = new Map([
        ["swoo#1111", { player: { ...player }, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.hasChanges).toBe(false);
      expect(diff.modified).toHaveLength(0);
      expect(diff.newLocal).toHaveLength(0);
      expect(diff.newRemote).toHaveLength(0);
    });

    it("should detect field changes as modified", () => {
      const localPlayer = makePlayer({
        battletag: "Swoo#1111",
        tankRank: "Pro 2",
      });
      const remotePlayer = makePlayer({
        battletag: "Swoo#1111",
        tankRank: "Elite 3",
      });
      const local = new Map([["Swoo#1111", localPlayer]]);
      const remote = new Map([
        ["swoo#1111", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.hasChanges).toBe(true);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].battletag).toBe("Swoo#1111");
      expect(diff.modified[0].fields).toHaveLength(1);
      expect(diff.modified[0].fields[0].field).toBe("tankRank");
      expect(diff.modified[0].fields[0].localValue).toBe("Pro 2");
      expect(diff.modified[0].fields[0].remoteValue).toBe("Elite 3");
    });

    it("should use case-insensitive BattleTag matching", () => {
      const localPlayer = makePlayer({ battletag: "SWOO#1111" });
      const remotePlayer = makePlayer({ battletag: "swoo#1111" });
      const local = new Map([["SWOO#1111", localPlayer]]);
      const remote = new Map([
        ["swoo#1111", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      // Should match, not show as new_local + new_remote
      expect(diff.newLocal).toHaveLength(0);
      expect(diff.newRemote).toHaveLength(0);
    });

    it("should classify local-only players as new_local", () => {
      const player = makePlayer({ battletag: "Local#1111" });
      const local = new Map([["Local#1111", player]]);
      const remote = new Map<
        string,
        { player: Player; rowIndex: number }
      >();

      const diff = computeDiff(local, remote, false);

      expect(diff.newLocal).toHaveLength(1);
      expect(diff.newLocal[0].battletag).toBe("Local#1111");
      expect(diff.newLocal[0].type).toBe("new_local");
      expect(diff.newLocal[0].sheetRowIndex).toBeNull();
    });

    it("should classify remote-only players as new_remote", () => {
      const player = makePlayer({ battletag: "Remote#2222" });
      const local = new Map<string, Player>();
      const remote = new Map([
        ["Remote#2222", { player, rowIndex: 5 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.newRemote).toHaveLength(1);
      expect(diff.newRemote[0].battletag).toBe("Remote#2222");
      expect(diff.newRemote[0].type).toBe("new_remote");
      expect(diff.newRemote[0].parsedPlayer).toBeDefined();
      expect(diff.newRemote[0].sheetRowIndex).toBe(5);
    });

    it("should default new_local selected=true when not first sync", () => {
      const player = makePlayer({ battletag: "Local#1111" });
      const local = new Map([["Local#1111", player]]);
      const remote = new Map<
        string,
        { player: Player; rowIndex: number }
      >();

      const diff = computeDiff(local, remote, false);

      expect(diff.newLocal[0].selected).toBe(true);
    });

    it("should default new_local selected=false on first sync", () => {
      const player = makePlayer({ battletag: "Local#1111" });
      const local = new Map([["Local#1111", player]]);
      const remote = new Map<
        string,
        { player: Player; rowIndex: number }
      >();

      const diff = computeDiff(local, remote, true);

      expect(diff.newLocal[0].selected).toBe(false);
    });

    it("should set isFirstSync on the diff result", () => {
      const local = new Map<string, Player>();
      const remote = new Map<
        string,
        { player: Player; rowIndex: number }
      >();

      expect(computeDiff(local, remote, true).isFirstSync).toBe(true);
      expect(computeDiff(local, remote, false).isFirstSync).toBe(false);
    });
  });

  describe("getDefaultChoice (via computeDiff)", () => {
    it("should default to remote on first sync", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Pro 2",
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Elite 3",
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, true);

      expect(diff.modified[0].fields[0].defaultChoice).toBe("remote");
      expect(diff.modified[0].fields[0].chosenSide).toBe("remote");
    });

    it("should default to local for non-win fields when not first sync", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Champion 2",
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Elite 3",
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.modified[0].fields[0].defaultChoice).toBe("local");
    });

    it("should default to higher value for win counts", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 10,
        regular5v5Wins: 2,
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 5,
        regular5v5Wins: 8,
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      const fields = diff.modified[0].fields;
      const stadiumField = fields.find((f) => f.field === "stadiumWins")!;
      const reg5v5Field = fields.find((f) => f.field === "regular5v5Wins")!;

      // Local has more stadium wins → local
      expect(stadiumField.defaultChoice).toBe("local");
      // Remote has more 5v5 wins → remote
      expect(reg5v5Field.defaultChoice).toBe("remote");
    });

    it("should prefer local for equal win counts", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 5,
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 5,
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      // Equal wins → no diff (same value)
      expect(diff.hasChanges).toBe(false);
    });

    it("should override win count logic on first sync (remote always wins)", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 100,
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        stadiumWins: 1,
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, true);

      const stadiumField = diff.modified[0].fields.find(
        (f) => f.field === "stadiumWins",
      )!;
      expect(stadiumField.defaultChoice).toBe("remote");
    });
  });

  describe("comparePlayerFields (via computeDiff)", () => {
    it("should detect changes across multiple fields", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Pro 2",
        rolesWilling: ["Tank"],
        notes: "old note",
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Elite 1",
        rolesWilling: ["Tank", "DPS"],
        notes: "new note",
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.modified[0].fields.length).toBe(3);
      const fieldNames = diff.modified[0].fields.map((f) => f.field);
      expect(fieldNames).toContain("tankRank");
      expect(fieldNames).toContain("rolesWilling");
      expect(fieldNames).toContain("notes");
    });

    it("should include human-friendly headers in diffs", () => {
      const localPlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Pro 2",
      });
      const remotePlayer = makePlayer({
        battletag: "A#1",
        tankRank: "Elite 1",
      });
      const local = new Map([["A#1", localPlayer]]);
      const remote = new Map([
        ["a#1", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.modified[0].fields[0].header).toBe("Tank Rank (Stadium)");
    });

    it("should not report BattleTag as changed when casing differs", () => {
      const localPlayer = makePlayer({ battletag: "Swoo#1111" });
      const remotePlayer = makePlayer({ battletag: "Swoo#1111" });
      const local = new Map([["Swoo#1111", localPlayer]]);
      const remote = new Map([
        ["swoo#1111", { player: remotePlayer, rowIndex: 2 }],
      ]);

      const diff = computeDiff(local, remote, false);

      expect(diff.hasChanges).toBe(false);
    });
  });
});
