import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Player } from "@engine/types";
import {
  SyncError,
  getColumnIndex,
  deserializeField,
  consolidateWinsBeforeSync,
  performSync,
  applySyncResult,
} from "@services/sheetSync";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import { SHEET_COLUMNS } from "@utils/sheetTemplate";
import {
  readRosterSheet,
  getSpreadsheetMeta,
  batchUpdateCells,
  appendRows,
} from "@services/sheetsApi";
import type { SyncDiff } from "@services/diffEngine";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@services/sheetsApi", () => ({
  readRosterSheet: vi.fn(),
  getSpreadsheetMeta: vi.fn(),
  batchUpdateCells: vi.fn(),
  appendRows: vi.fn(),
}));

vi.mock("@services/googleAuth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
  invalidateAccessToken: vi.fn(),
}));

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

// ---------------------------------------------------------------------------
// SyncError (P1-028)
// ---------------------------------------------------------------------------

describe("SyncError", () => {
  it("stores code and message", () => {
    const err = new SyncError("TEST_CODE", "Something went wrong");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("Something went wrong");
    expect(err.name).toBe("SyncError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// getColumnIndex (P1-030)
// ---------------------------------------------------------------------------

describe("getColumnIndex", () => {
  it("returns 0 for battletag", () => {
    expect(getColumnIndex("battletag")).toBe(0);
  });

  it("returns 1 for rolesWilling", () => {
    expect(getColumnIndex("rolesWilling")).toBe(1);
  });

  it("returns correct index for stadiumWins", () => {
    expect(getColumnIndex("stadiumWins")).toBe(16);
  });

  it("throws for unknown field", () => {
    expect(() => getColumnIndex("nonexistent")).toThrow("Unknown field");
  });
});

// ---------------------------------------------------------------------------
// deserializeField (P1-029)
// ---------------------------------------------------------------------------

describe("deserializeField", () => {
  describe("array fields", () => {
    it("parses comma-separated roles", () => {
      expect(deserializeField("rolesWilling", "Tank,DPS")).toEqual([
        "Tank",
        "DPS",
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(deserializeField("rolesWilling", "")).toEqual([]);
    });

    it("trims whitespace in array items", () => {
      expect(deserializeField("heroPool", "Tracer , Genji")).toEqual([
        "Tracer",
        "Genji",
      ]);
    });

    it("filters empty items from arrays", () => {
      expect(deserializeField("heroPool", "Tracer,,Genji")).toEqual([
        "Tracer",
        "Genji",
      ]);
    });
  });

  describe("integer fields", () => {
    it("parses valid integers", () => {
      expect(deserializeField("stadiumWins", "42")).toBe(42);
    });

    it("returns 0 for empty string", () => {
      expect(deserializeField("regular5v5Wins", "")).toBe(0);
    });

    it("returns 0 for non-numeric strings", () => {
      expect(deserializeField("weightModifier", "abc")).toBe(0);
    });
  });

  describe("boolean fields", () => {
    it("parses isOneTrick true", () => {
      expect(deserializeField("isOneTrick", "true")).toBe(true);
    });

    it("parses isOneTrick false for other values", () => {
      expect(deserializeField("isOneTrick", "false")).toBe(false);
      expect(deserializeField("isOneTrick", "")).toBe(false);
    });
  });

  describe("nullable string fields", () => {
    it("returns string value for non-empty", () => {
      expect(deserializeField("tankRank", "Gold 1")).toBe("Gold 1");
    });

    it("returns null for empty string", () => {
      expect(deserializeField("tankRank", "")).toBeNull();
    });

    it("returns null for notes with empty string", () => {
      expect(deserializeField("notes", "")).toBeNull();
    });

    it("returns value for notes with content", () => {
      expect(deserializeField("notes", "flex player")).toBe("flex player");
    });
  });
});

// ---------------------------------------------------------------------------
// consolidateWinsBeforeSync (P1-031)
// ---------------------------------------------------------------------------

describe("consolidateWinsBeforeSync", () => {
  beforeEach(() => {
    // Reset stores to initial state
    usePlayerStore.setState({
      players: new Map(),
      lastImportedAt: null,
    });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
  });

  it("adds session wins to player baselines", () => {
    const player = makePlayer({
      battletag: "Hero#1234",
      stadiumWins: 5,
      regular5v5Wins: 3,
      regular6v6Wins: 1,
    });
    usePlayerStore.getState().upsertPlayer(player);

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Hero#1234", 2]]),
        regular_5v5: new Map([["Hero#1234", 1]]),
        regular_6v6: new Map([["Hero#1234", 3]]),
      },
    });

    consolidateWinsBeforeSync();

    const updated = usePlayerStore.getState().getPlayer("Hero#1234");
    expect(updated?.stadiumWins).toBe(7); // 5 + 2
    expect(updated?.regular5v5Wins).toBe(4); // 3 + 1
    expect(updated?.regular6v6Wins).toBe(4); // 1 + 3
  });

  it("clears session wins after consolidation", () => {
    const player = makePlayer({ battletag: "Hero#1234", stadiumWins: 5 });
    usePlayerStore.getState().upsertPlayer(player);

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Hero#1234", 2]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    consolidateWinsBeforeSync();

    const wins = useSessionStore.getState().totalWins;
    expect(wins.stadium_5v5.size).toBe(0);
    expect(wins.regular_5v5.size).toBe(0);
    expect(wins.regular_6v6.size).toBe(0);
  });

  it("skips players not in the store", () => {
    // Session has wins for a player that doesn't exist in store
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Ghost#9999", 5]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    // Should not throw
    expect(() => consolidateWinsBeforeSync()).not.toThrow();
  });

  it("skips zero/negative session wins", () => {
    const player = makePlayer({ battletag: "Hero#1234", stadiumWins: 10 });
    usePlayerStore.getState().upsertPlayer(player);

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Hero#1234", 0]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    consolidateWinsBeforeSync();

    const updated = usePlayerStore.getState().getPlayer("Hero#1234");
    expect(updated?.stadiumWins).toBe(10); // Unchanged
  });

  it("handles multiple players across multiple modes", () => {
    const p1 = makePlayer({ battletag: "Alpha#1111", stadiumWins: 0 });
    const p2 = makePlayer({ battletag: "Bravo#2222", regular5v5Wins: 10 });
    usePlayerStore.getState().upsertPlayer(p1);
    usePlayerStore.getState().upsertPlayer(p2);

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Alpha#1111", 3]]),
        regular_5v5: new Map([["Bravo#2222", 7]]),
        regular_6v6: new Map(),
      },
    });

    consolidateWinsBeforeSync();

    expect(usePlayerStore.getState().getPlayer("Alpha#1111")?.stadiumWins).toBe(3);
    expect(usePlayerStore.getState().getPlayer("Bravo#2222")?.regular5v5Wins).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// performSync (P1-026 orchestration)
// ---------------------------------------------------------------------------

const VALID_HEADERS = SHEET_COLUMNS.map((c) => c.header);

function makeRow(battletag: string, overrides: Record<string, string> = {}): string[] {
  const row = new Array(SHEET_COLUMNS.length).fill("");
  row[getColumnIndex("battletag")] = battletag;
  row[getColumnIndex("rolesWilling")] = overrides.rolesWilling ?? "Tank";
  for (const [field, value] of Object.entries(overrides)) {
    if (field === "rolesWilling") continue;
    row[getColumnIndex(field)] = value;
  }
  return row;
}

describe("performSync", () => {
  const SHEET_ID = "test-spreadsheet-id";

  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
    useSheetStore.setState({ lastSyncedAt: null, hasUnsyncedChanges: false });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [],
    });
    vi.clearAllMocks();
  });

  it("returns a SyncDiff with no changes when sheet and local are empty", async () => {
    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(false);
    expect(diff.modified).toEqual([]);
    expect(diff.newLocal).toEqual([]);
    expect(diff.newRemote).toEqual([]);
  });

  it("detects new remote players from the sheet", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Remote#1234", { tankRank: "Gold 1" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(true);
    expect(diff.newRemote).toHaveLength(1);
    expect(diff.newRemote[0].battletag).toBe("Remote#1234");
  });

  it("detects new local players not on the sheet", async () => {
    // Set lastSyncedAt to non-null (not first sync — new locals are selected)
    useSheetStore.setState({ lastSyncedAt: Date.now() });
    usePlayerStore.getState().upsertPlayer(makePlayer({ battletag: "Local#5678" }));

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(true);
    expect(diff.newLocal).toHaveLength(1);
    expect(diff.newLocal[0].battletag).toBe("Local#5678");
  });

  it("detects modified players with field differences", async () => {
    useSheetStore.setState({ lastSyncedAt: Date.now() });
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Player#1111", tankRank: "Gold 1" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Player#1111", { tankRank: "Diamond 1" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].battletag).toBe("Player#1111");
    expect(diff.modified[0].fields.some((f) => f.field === "tankRank")).toBe(true);
  });

  it("throws MALFORMED_HEADERS when required column is missing", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: ["Not A Valid Header"],
      rows: [],
    });

    await expect(performSync(SHEET_ID)).rejects.toThrow(SyncError);
    await expect(performSync(SHEET_ID)).rejects.toMatchObject({
      code: "MALFORMED_HEADERS",
    });
  });

  it("throws DUPLICATE_BATTLETAG when sheet has duplicates", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [
        makeRow("Dupe#1111"),
        makeRow("Dupe#1111"),
      ],
    });

    await expect(performSync(SHEET_ID)).rejects.toThrow(SyncError);
    await expect(performSync(SHEET_ID)).rejects.toMatchObject({
      code: "DUPLICATE_BATTLETAG",
    });
  });

  it("consolidates session wins before computing diff", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Winner#1111", stadiumWins: 5 }),
    );
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Winner#1111", 3]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Winner#1111", { stadiumWins: "5" })],
    });

    await performSync(SHEET_ID);

    // Session wins should be consolidated into baseline
    expect(usePlayerStore.getState().getPlayer("Winner#1111")?.stadiumWins).toBe(8);
    // Session wins cleared
    expect(useSessionStore.getState().totalWins.stadium_5v5.size).toBe(0);
  });

  it("sets isFirstSync true when lastSyncedAt is null", async () => {
    useSheetStore.setState({ lastSyncedAt: null });

    const diff = await performSync(SHEET_ID);
    expect(diff.isFirstSync).toBe(true);
  });

  it("sets isFirstSync false when lastSyncedAt is set", async () => {
    useSheetStore.setState({ lastSyncedAt: Date.now() });

    const diff = await performSync(SHEET_ID);
    expect(diff.isFirstSync).toBe(false);
  });

  it("propagates API errors from getSpreadsheetMeta", async () => {
    vi.mocked(getSpreadsheetMeta).mockRejectedValue(new Error("Network failure"));

    await expect(performSync(SHEET_ID)).rejects.toThrow("Network failure");
  });

  it("propagates API errors from readRosterSheet", async () => {
    vi.mocked(readRosterSheet).mockRejectedValue(new Error("Read failure"));

    await expect(performSync(SHEET_ID)).rejects.toThrow("Read failure");
  });
});

// ---------------------------------------------------------------------------
// applySyncResult (P1-027 orchestration)
// ---------------------------------------------------------------------------

describe("applySyncResult", () => {
  const SHEET_ID = "test-spreadsheet-id";

  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: null,
      hasUnsyncedChanges: true,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  function makeDiff(overrides: Partial<SyncDiff> = {}): SyncDiff {
    return {
      modified: [],
      newLocal: [],
      newRemote: [],
      isFirstSync: false,
      hasChanges: true,
      ...overrides,
    };
  }

  it("imports selected new remote players into local store", async () => {
    const remotePlayer = makePlayer({ battletag: "Remote#9999", tankRank: "Gold 1" });
    const diff = makeDiff({
      newRemote: [
        {
          battletag: "Remote#9999",
          type: "new_remote",
          fields: [],
          selected: true,
          sheetRowIndex: 2,
          validationWarnings: [],
          parsedPlayer: remotePlayer,
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    const player = usePlayerStore.getState().getPlayer("Remote#9999");
    expect(player).toBeDefined();
    expect(player?.tankRank).toBe("Gold 1");
  });

  it("skips unselected new remote players", async () => {
    const diff = makeDiff({
      newRemote: [
        {
          battletag: "Skip#1111",
          type: "new_remote",
          fields: [],
          selected: false,
          sheetRowIndex: 2,
          validationWarnings: [],
          parsedPlayer: makePlayer({ battletag: "Skip#1111" }),
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    expect(usePlayerStore.getState().getPlayer("Skip#1111")).toBeUndefined();
  });

  it("pushes selected new local players to the sheet", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Pushy#3333", tankRank: "Diamond 1" }),
    );
    const diff = makeDiff({
      newLocal: [
        {
          battletag: "Pushy#3333",
          type: "new_local",
          fields: [],
          selected: true,
          sheetRowIndex: null,
          validationWarnings: [],
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    expect(appendRows).toHaveBeenCalledWith(SHEET_ID, expect.any(Array));
    const rows = vi.mocked(appendRows).mock.calls[0][1];
    expect(rows[0][getColumnIndex("battletag")]).toBe("Pushy#3333");
  });

  it("skips unselected new local players", async () => {
    usePlayerStore.getState().upsertPlayer(makePlayer({ battletag: "NoGo#4444" }));
    const diff = makeDiff({
      newLocal: [
        {
          battletag: "NoGo#4444",
          type: "new_local",
          fields: [],
          selected: false,
          sheetRowIndex: null,
          validationWarnings: [],
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    expect(appendRows).not.toHaveBeenCalled();
  });

  it("applies remote field choices to local store for modified players", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Mod#5555", tankRank: "Gold 1" }),
    );
    const diff = makeDiff({
      modified: [
        {
          battletag: "Mod#5555",
          type: "modified",
          fields: [
            {
              field: "tankRank",
              header: "Tank Rank (Stadium)",
              localValue: "Gold 1",
              remoteValue: "Diamond 1",
              defaultChoice: "remote",
              chosenSide: "remote",
            },
          ],
          selected: true,
          sheetRowIndex: 3,
          validationWarnings: [],
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    expect(usePlayerStore.getState().getPlayer("Mod#5555")?.tankRank).toBe("Diamond 1");
  });

  it("pushes local field choices to sheet via batchUpdateCells", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Mod#6666", notes: "updated locally" }),
    );
    const diff = makeDiff({
      modified: [
        {
          battletag: "Mod#6666",
          type: "modified",
          fields: [
            {
              field: "notes",
              header: "Notes",
              localValue: "updated locally",
              remoteValue: "old note",
              defaultChoice: "local",
              chosenSide: "local",
            },
          ],
          selected: true,
          sheetRowIndex: 4,
          validationWarnings: [],
        },
      ],
    });

    await applySyncResult(SHEET_ID, diff);

    expect(batchUpdateCells).toHaveBeenCalledWith(SHEET_ID, [
      { row: 4, col: getColumnIndex("notes"), value: "updated locally" },
    ]);
  });

  it("marks synced after applying changes", async () => {
    const diff = makeDiff();

    await applySyncResult(SHEET_ID, diff);

    expect(useSheetStore.getState().lastSyncedAt).not.toBeNull();
    expect(useSheetStore.getState().hasUnsyncedChanges).toBe(false);
  });

  it("does not call batchUpdateCells when there are no cell updates", async () => {
    const diff = makeDiff();

    await applySyncResult(SHEET_ID, diff);

    expect(batchUpdateCells).not.toHaveBeenCalled();
  });

  it("does not call appendRows when there are no new local rows", async () => {
    const diff = makeDiff();

    await applySyncResult(SHEET_ID, diff);

    expect(appendRows).not.toHaveBeenCalled();
  });

  it("propagates API errors from batchUpdateCells", async () => {
    usePlayerStore.getState().upsertPlayer(makePlayer({ battletag: "Err#7777" }));
    vi.mocked(batchUpdateCells).mockRejectedValue(new Error("Batch failed"));

    const diff = makeDiff({
      modified: [
        {
          battletag: "Err#7777",
          type: "modified",
          fields: [
            {
              field: "notes",
              header: "Notes",
              localValue: "x",
              remoteValue: "y",
              defaultChoice: "local",
              chosenSide: "local",
            },
          ],
          selected: true,
          sheetRowIndex: 2,
          validationWarnings: [],
        },
      ],
    });

    await expect(applySyncResult(SHEET_ID, diff)).rejects.toThrow("Batch failed");
  });

  it("propagates API errors from appendRows", async () => {
    usePlayerStore.getState().upsertPlayer(makePlayer({ battletag: "Err#8888" }));
    vi.mocked(appendRows).mockRejectedValue(new Error("Append failed"));

    const diff = makeDiff({
      newLocal: [
        {
          battletag: "Err#8888",
          type: "new_local",
          fields: [],
          selected: true,
          sheetRowIndex: null,
          validationWarnings: [],
        },
      ],
    });

    await expect(applySyncResult(SHEET_ID, diff)).rejects.toThrow("Append failed");
  });
});
