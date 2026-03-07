import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Player } from "@engine/types";
import { SHEET_COLUMNS, serializePlayerToRow } from "@utils/sheetTemplate";
import {
  performSync,
  applySyncResult,
  getColumnIndex,
} from "@services/sheetSync";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import {
  readRosterSheet,
  getSpreadsheetMeta,
  batchUpdateCells,
  appendRows,
} from "@services/sheetsApi";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_HEADERS = SHEET_COLUMNS.map((c) => c.header);

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

const SHEET_ID = "integration-test-sheet";

// ---------------------------------------------------------------------------
// P3-006: Round-trip — serialize local → sheet row → parse → diff = empty
// ---------------------------------------------------------------------------

describe("Integration: round-trip sync", () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: Date.now(),
      hasUnsyncedChanges: false,
    });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("should produce no diff when local players match sheet rows exactly", async () => {
    const player = makePlayer({
      battletag: "RoundTrip#1234",
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
    });

    // Serialize player to sheet row format
    const row = serializePlayerToRow(player);

    // Put same player in local store
    usePlayerStore.getState().upsertPlayer(player);

    // Mock sheet returning the serialized row
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [row],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(false);
    expect(diff.modified).toEqual([]);
    expect(diff.newLocal).toEqual([]);
    expect(diff.newRemote).toEqual([]);
  });

  it("should produce no diff for multiple players round-tripped", async () => {
    const players = [
      makePlayer({ battletag: "Alpha#1111", rolesWilling: ["Tank"], tankRank: "Pro 2" }),
      makePlayer({ battletag: "Bravo#2222", rolesWilling: ["DPS", "Support"], supportRank: "Elite 3" }),
      makePlayer({ battletag: "Charlie#3333", rolesWilling: ["Support"], heroPool: ["Ana", "Kiriko"] }),
    ];

    for (const p of players) usePlayerStore.getState().upsertPlayer(p);

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: players.map(serializePlayerToRow),
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(false);
    expect(diff.modified).toHaveLength(0);
    expect(diff.newLocal).toHaveLength(0);
    expect(diff.newRemote).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P3-007: Conflict resolution — both sides modified → resolve → apply
// ---------------------------------------------------------------------------

describe("Integration: conflict resolution", () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: Date.now(),
      hasUnsyncedChanges: false,
    });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("should detect field conflicts and resolve with chosen sides", async () => {
    // Local has one rank, sheet has another
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Conflict#1111", tankRank: "Gold 1", notes: "local notes" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Conflict#1111", { tankRank: "Diamond 3", notes: "remote notes" })],
    });

    // Step 1: performSync detects the conflict
    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);

    const playerDiff = diff.modified[0];
    const tankField = playerDiff.fields.find((f) => f.field === "tankRank")!;
    const notesField = playerDiff.fields.find((f) => f.field === "notes")!;

    expect(tankField.localValue).toBe("Gold 1");
    expect(tankField.remoteValue).toBe("Diamond 3");
    expect(notesField.localValue).toBe("local notes");
    expect(notesField.remoteValue).toBe("remote notes");

    // Step 2: Simulate user choosing remote for tank, local for notes
    tankField.chosenSide = "remote";
    notesField.chosenSide = "local";

    // Step 3: Apply resolution
    await applySyncResult(SHEET_ID, diff);

    // Verify local store updated with remote tank rank
    const updated = usePlayerStore.getState().getPlayer("Conflict#1111");
    expect(updated?.tankRank).toBe("Diamond 3");
    expect(updated?.notes).toBe("local notes"); // kept local

    // Verify local notes pushed to sheet
    expect(batchUpdateCells).toHaveBeenCalledWith(
      SHEET_ID,
      expect.arrayContaining([
        expect.objectContaining({
          col: getColumnIndex("notes"),
          value: "local notes",
        }),
      ]),
    );
  });

  it("should handle Accept All Remote — all fields resolve to remote", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "AllRemote#1111", tankRank: "Gold 1", dpsRank: "Silver 2" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("AllRemote#1111", { tankRank: "Diamond 3", dpsRank: "Master 1" })],
    });

    const diff = await performSync(SHEET_ID);

    // Accept all remote
    for (const pd of diff.modified) {
      for (const fd of pd.fields) fd.chosenSide = "remote";
    }

    await applySyncResult(SHEET_ID, diff);

    const updated = usePlayerStore.getState().getPlayer("AllRemote#1111");
    expect(updated?.tankRank).toBe("Diamond 3");
    expect(updated?.dpsRank).toBe("Master 1");

    // No cell updates pushed to sheet (all fields accepted from remote)
    expect(batchUpdateCells).not.toHaveBeenCalled();
  });

  it("should handle Accept All Local — all fields push to sheet", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "AllLocal#1111", tankRank: "Gold 1", dpsRank: "Silver 2" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("AllLocal#1111", { tankRank: "Diamond 3", dpsRank: "Master 1" })],
    });

    const diff = await performSync(SHEET_ID);

    // Accept all local
    for (const pd of diff.modified) {
      for (const fd of pd.fields) fd.chosenSide = "local";
    }

    await applySyncResult(SHEET_ID, diff);

    const updated = usePlayerStore.getState().getPlayer("AllLocal#1111");
    expect(updated?.tankRank).toBe("Gold 1"); // unchanged
    expect(updated?.dpsRank).toBe("Silver 2"); // unchanged

    // Local values pushed to sheet
    expect(batchUpdateCells).toHaveBeenCalledWith(
      SHEET_ID,
      expect.arrayContaining([
        expect.objectContaining({ col: getColumnIndex("tankRank"), value: "Gold 1" }),
        expect.objectContaining({ col: getColumnIndex("dpsRank"), value: "Silver 2" }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// P3-008: Win consolidation — session wins bake into baseline before sync
// ---------------------------------------------------------------------------

describe("Integration: win consolidation into sync", () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: Date.now(),
      hasUnsyncedChanges: false,
    });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("should consolidate session wins, then diff against sheet wins correctly", async () => {
    // Local player: baseline 5 stadium wins
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Winner#1111", stadiumWins: 5, regular5v5Wins: 2 }),
    );

    // Session wins: +3 stadium, +1 regular 5v5
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Winner#1111", 3]]),
        regular_5v5: new Map([["Winner#1111", 1]]),
        regular_6v6: new Map(),
      },
    });

    // Sheet has the same values as what we'll have after consolidation (stadium: 8, regular: 3)
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Winner#1111", { stadiumWins: "8", regular5v5Wins: "3" })],
    });

    const diff = await performSync(SHEET_ID);

    // After consolidation: local stadiumWins = 5+3 = 8, r5v5 = 2+1 = 3
    // Sheet has: stadiumWins = 8, r5v5 = 3 → no diff for wins
    const winFields = diff.modified.length > 0
      ? diff.modified[0].fields.filter(
          (f) => f.field === "stadiumWins" || f.field === "regular5v5Wins",
        )
      : [];
    expect(winFields).toHaveLength(0);

    // Session wins should be cleared
    expect(useSessionStore.getState().totalWins.stadium_5v5.size).toBe(0);
    expect(useSessionStore.getState().totalWins.regular_5v5.size).toBe(0);
  });

  it("should detect win difference when sheet is behind after consolidation", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Ahead#1111", stadiumWins: 10 }),
    );

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Ahead#1111", 5]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    // Sheet still has old value (10), but after consolidation local is 15
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Ahead#1111", { stadiumWins: "10" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);

    const winField = diff.modified[0].fields.find((f) => f.field === "stadiumWins")!;
    expect(winField.localValue).toBe("15");
    expect(winField.remoteValue).toBe("10");
    // Higher wins should default to local
    expect(winField.defaultChoice).toBe("local");
  });

  it("should push consolidated wins to sheet when local is chosen", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Push#1111", stadiumWins: 10 }),
    );

    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map([["Push#1111", 5]]),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Push#1111", { stadiumWins: "10" })],
    });

    const diff = await performSync(SHEET_ID);

    // Choose local side for the win field
    for (const fd of diff.modified[0].fields) {
      fd.chosenSide = "local";
    }

    await applySyncResult(SHEET_ID, diff);

    // Verify consolidated value pushed to sheet
    expect(batchUpdateCells).toHaveBeenCalledWith(
      SHEET_ID,
      expect.arrayContaining([
        expect.objectContaining({
          col: getColumnIndex("stadiumWins"),
          value: "15",
        }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// P3-009: First sync — no lastSyncedAt → Accept All Remote defaults
// ---------------------------------------------------------------------------

describe("Integration: first sync defaults", () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: null, // First sync!
      hasUnsyncedChanges: false,
    });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("should set isFirstSync and default all modified fields to remote", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "First#1111", tankRank: "Gold 1" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("First#1111", { tankRank: "Diamond 3" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.isFirstSync).toBe(true);

    // All field defaults should be "remote" on first sync
    for (const pd of diff.modified) {
      for (const fd of pd.fields) {
        expect(fd.defaultChoice).toBe("remote");
        expect(fd.chosenSide).toBe("remote"); // default choice applied
      }
    }
  });

  it("should deselect new local players on first sync", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "LocalOnly#1111" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.isFirstSync).toBe(true);
    expect(diff.newLocal).toHaveLength(1);
    // On first sync, new locals are deselected (sheet is source of truth)
    expect(diff.newLocal[0].selected).toBe(false);
  });

  it("should import all remote players on first sync when applied", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [
        makeRow("Import#1111", { tankRank: "Pro 2" }),
        makeRow("Import#2222", { dpsRank: "Elite 1" }),
      ],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.newRemote).toHaveLength(2);

    // Both should be selected by default
    expect(diff.newRemote[0].selected).toBe(true);
    expect(diff.newRemote[1].selected).toBe(true);

    await applySyncResult(SHEET_ID, diff);

    // Both players should now be in local store
    expect(usePlayerStore.getState().getPlayer("Import#1111")).toBeDefined();
    expect(usePlayerStore.getState().getPlayer("Import#2222")).toBeDefined();
    expect(usePlayerStore.getState().getPlayer("Import#1111")?.tankRank).toBe("Pro 2");
  });

  it("should default win fields to remote on first sync even when local is higher", async () => {
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Wins#1111", stadiumWins: 100 }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Wins#1111", { stadiumWins: "5" })],
    });

    const diff = await performSync(SHEET_ID);

    const winField = diff.modified[0].fields.find((f) => f.field === "stadiumWins")!;
    // First sync overrides higher-wins logic — always defaults to remote
    expect(winField.defaultChoice).toBe("remote");
    expect(winField.chosenSide).toBe("remote");
  });
});

// ---------------------------------------------------------------------------
// P3-010: Validation warnings — invalid data on sheet → warning surfaced
// ---------------------------------------------------------------------------

describe("Integration: validation warnings from sheet", () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: new Map(), lastImportedAt: null });
    useSessionStore.setState({
      totalWins: {
        stadium_5v5: new Map(),
        regular_5v5: new Map(),
        regular_6v6: new Map(),
      },
    });
    useSheetStore.setState({
      spreadsheetId: SHEET_ID,
      lastSyncedAt: Date.now(),
      hasUnsyncedChanges: false,
    });

    vi.mocked(getSpreadsheetMeta).mockResolvedValue({
      title: "Test Sheet",
      rosterSheetId: 0,
    });
    vi.mocked(batchUpdateCells).mockResolvedValue(undefined);
    vi.mocked(appendRows).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("should surface warnings for invalid ranks while still parsing the player", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("BadRank#1111", { tankRank: "not a rank!!" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.newRemote).toHaveLength(1);
    const pd = diff.newRemote[0];

    // The player should still be parseable
    expect(pd.parsedPlayer).toBeDefined();
    expect(pd.parsedPlayer!.battletag).toBe("BadRank#1111");

    // The invalid rank should be null (treated as blank)
    expect(pd.parsedPlayer!.tankRank).toBeNull();

    // Warning should be attached
    expect(pd.validationWarnings.length).toBeGreaterThan(0);
    expect(pd.validationWarnings.some((w) => w.includes("Invalid rank"))).toBe(true);
  });

  it("should silently filter invalid roles without warnings", async () => {
    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("BadRole#1111", { rolesWilling: "Mage,Tank,Healer" })],
    });

    const diff = await performSync(SHEET_ID);

    expect(diff.newRemote).toHaveLength(1);
    const pd = diff.newRemote[0];

    // Invalid roles silently filtered — only "Tank" survives
    expect(pd.parsedPlayer!.rolesWilling).toEqual(["Tank"]);
    // No warnings for role filtering
    expect(pd.validationWarnings).toHaveLength(0);
  });

  it("should attach warnings to modified players too", async () => {
    // Have local player, sheet has same player with invalid rank format
    usePlayerStore.getState().upsertPlayer(
      makePlayer({ battletag: "Warn#1111", tankRank: "Gold 1" }),
    );

    vi.mocked(readRosterSheet).mockResolvedValue({
      headers: VALID_HEADERS,
      rows: [makeRow("Warn#1111", { tankRank: "bad rank!!" })],
    });

    const diff = await performSync(SHEET_ID);

    // Player appears as modified (tank rank differs: "Gold 1" vs null)
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].validationWarnings.length).toBeGreaterThan(0);
  });
});
