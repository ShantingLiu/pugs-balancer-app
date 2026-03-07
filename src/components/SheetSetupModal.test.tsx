import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SheetSetupModal } from "./SheetSetupModal";

// =============================================================================
// Mock stores
// =============================================================================

const mockSheetStore = {
  spreadsheetId: null as string | null,
  sheetName: null as string | null,
  spreadsheetUrl: null as string | null,
  lastSyncedAt: null as number | null,
  hasUnsyncedChanges: false,
  isAuthenticated: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  markSynced: vi.fn(),
  markUnsynced: vi.fn(),
  setAuthenticated: vi.fn(),
};

vi.mock("@store/sheetStore", () => ({
  useSheetStore: Object.assign(
    (selector: (s: typeof mockSheetStore) => unknown) =>
      selector(mockSheetStore),
    { getState: () => mockSheetStore },
  ),
}));

const mockPlayerStore = {
  players: new Map() as Map<string, unknown>,
  getAllPlayers: vi.fn(() => [] as unknown[]),
};

vi.mock("@store/playerStore", () => ({
  usePlayerStore: Object.assign(
    (selector: (s: typeof mockPlayerStore) => unknown) =>
      selector(mockPlayerStore),
    { getState: () => mockPlayerStore },
  ),
}));

// =============================================================================
// Mock services
// =============================================================================

const mockCreateSpreadsheet = vi.fn();
const mockApplyDataValidation = vi.fn();
const mockGetSpreadsheetMeta = vi.fn();
const mockAppendRows = vi.fn();

vi.mock("@services/sheetsApi", () => ({
  createSpreadsheet: (...args: unknown[]) => mockCreateSpreadsheet(...args),
  applyDataValidation: (...args: unknown[]) =>
    mockApplyDataValidation(...args),
  getSpreadsheetMeta: (...args: unknown[]) =>
    mockGetSpreadsheetMeta(...args),
  appendRows: (...args: unknown[]) => mockAppendRows(...args),
}));

const mockBuildTemplateRequest = vi.fn();
const mockSerializePlayerToRow = vi.fn();

vi.mock("@utils/sheetTemplate", () => ({
  buildTemplateRequest: (...args: unknown[]) =>
    mockBuildTemplateRequest(...args),
  serializePlayerToRow: (...args: unknown[]) =>
    mockSerializePlayerToRow(...args),
}));

const mockExtractSheetId = vi.fn();

vi.mock("@utils/sheetUrl", () => ({
  extractSheetId: (...args: unknown[]) => mockExtractSheetId(...args),
}));

const mockSignIn = vi.fn();

vi.mock("@services/googleAuth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("@config/google", () => ({
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
}));

// =============================================================================
// Helpers
// =============================================================================

const onClose = vi.fn();

function renderModal() {
  return render(<SheetSetupModal onClose={onClose} />);
}

// =============================================================================
// Tests
// =============================================================================

describe("SheetSetupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSheetStore.spreadsheetId = null;
    mockSheetStore.sheetName = null;
    mockSheetStore.isAuthenticated = true;
    mockPlayerStore.players = new Map();
    mockPlayerStore.getAllPlayers.mockReturnValue([]);
  });

  // ---------------------------------------------------------------------------
  // P2-005: Sign-in gate
  // ---------------------------------------------------------------------------

  describe("sign-in gate (P2-005)", () => {
    it("shows sign-in prompt when not authenticated", () => {
      mockSheetStore.isAuthenticated = false;
      renderModal();
      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Create New Sheet/)).not.toBeInTheDocument();
    });

    it("calls signIn with client ID and secret when clicking sign-in button", async () => {
      mockSheetStore.isAuthenticated = false;
      mockSignIn.mockResolvedValue(undefined);
      renderModal();
      fireEvent.click(
        screen.getByRole("button", { name: /sign in with google/i }),
      );
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("test-client-id", "test-client-secret");
      });
    });

    it("shows error when sign-in fails", async () => {
      mockSheetStore.isAuthenticated = false;
      mockSignIn.mockRejectedValue(new Error("Popup blocked"));
      renderModal();
      fireEvent.click(
        screen.getByRole("button", { name: /sign in with google/i }),
      );
      await waitFor(() => {
        expect(screen.getByText("Popup blocked")).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // P2-001: Mode selector
  // ---------------------------------------------------------------------------

  describe("mode selector (P2-001)", () => {
    it("renders modal with title 'Google Sheets'", () => {
      renderModal();
      expect(screen.getByText("Google Sheets")).toBeInTheDocument();
    });

    it("shows 3 mode buttons when authenticated", () => {
      renderModal();
      expect(screen.getByText(/Create New Sheet/)).toBeInTheDocument();
      expect(screen.getByText(/Connect Existing Sheet/)).toBeInTheDocument();
      expect(screen.getByText(/Upload Roster to New Sheet/)).toBeInTheDocument();
    });

    it("closes modal when clicking close button", () => {
      renderModal();
      fireEvent.click(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalled();
    });

    it("shows connection info when already connected", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      renderModal();
      expect(screen.getByText("My Roster")).toBeInTheDocument();
      // Mode buttons still shown for switching
      expect(screen.getByText(/Create New Sheet/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-002: Create New Sheet flow
  // ---------------------------------------------------------------------------

  describe("Create New Sheet flow (P2-002)", () => {
    it("shows title input and create button after selecting mode", () => {
      renderModal();
      fireEvent.click(screen.getByText(/Create New Sheet/));
      expect(
        screen.getByDisplayValue("PUGs Balancer Roster"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create" }),
      ).toBeInTheDocument();
    });

    it("executes create flow and closes on success", async () => {
      mockBuildTemplateRequest.mockReturnValue({ properties: {} });
      mockCreateSpreadsheet.mockResolvedValue({
        spreadsheetId: "new-id",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new-id",
        rosterSheetId: 0,
      });
      mockApplyDataValidation.mockResolvedValue(undefined);

      renderModal();
      fireEvent.click(screen.getByText(/Create New Sheet/));
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => {
        expect(mockBuildTemplateRequest).toHaveBeenCalledWith(
          "PUGs Balancer Roster",
        );
        expect(mockCreateSpreadsheet).toHaveBeenCalled();
        expect(mockApplyDataValidation).toHaveBeenCalledWith("new-id", 0);
        expect(mockSheetStore.connect).toHaveBeenCalledWith(
          "new-id",
          "PUGs Balancer Roster",
          "https://docs.google.com/spreadsheets/d/new-id",
        );
        expect(mockSheetStore.markSynced).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("shows error on create failure (P2-006)", async () => {
      mockBuildTemplateRequest.mockReturnValue({});
      mockCreateSpreadsheet.mockRejectedValue(new Error("Quota exceeded"));

      renderModal();
      fireEvent.click(screen.getByText(/Create New Sheet/));
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => {
        expect(screen.getByText("Quota exceeded")).toBeInTheDocument();
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-003: Connect Existing Sheet flow
  // ---------------------------------------------------------------------------

  describe("Connect Existing Sheet flow (P2-003)", () => {
    it("shows URL input and connect button", () => {
      renderModal();
      fireEvent.click(screen.getByText(/Connect Existing Sheet/));
      expect(
        screen.getByPlaceholderText(/docs\.google\.com/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Connect" }),
      ).toBeInTheDocument();
    });

    it("shows error for invalid URL", async () => {
      mockExtractSheetId.mockReturnValue(null);

      renderModal();
      fireEvent.click(screen.getByText(/Connect Existing Sheet/));
      const input = screen.getByPlaceholderText(/docs\.google\.com/);
      fireEvent.change(input, { target: { value: "not-a-url" } });
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid Google Sheets URL/)).toBeInTheDocument();
      });
    });

    it("shows error when Roster tab is missing", async () => {
      mockExtractSheetId.mockReturnValue("some-id");
      mockGetSpreadsheetMeta.mockRejectedValue(
        new Error("MISSING_ROSTER_TAB"),
      );

      renderModal();
      fireEvent.click(screen.getByText(/Connect Existing Sheet/));
      const input = screen.getByPlaceholderText(/docs\.google\.com/);
      fireEvent.change(input, {
        target: {
          value: "https://docs.google.com/spreadsheets/d/some-id/edit",
        },
      });
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(screen.getByText(/Roster/)).toBeInTheDocument();
      });
    });

    it("connects and closes on success", async () => {
      mockExtractSheetId.mockReturnValue("real-id");
      mockGetSpreadsheetMeta.mockResolvedValue({
        title: "My Sheet",
        rosterSheetId: 0,
      });

      renderModal();
      fireEvent.click(screen.getByText(/Connect Existing Sheet/));
      const input = screen.getByPlaceholderText(/docs\.google\.com/);
      const testUrl =
        "https://docs.google.com/spreadsheets/d/real-id/edit";
      fireEvent.change(input, { target: { value: testUrl } });
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(mockSheetStore.connect).toHaveBeenCalledWith(
          "real-id",
          "My Sheet",
          testUrl,
        );
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // P2-004: Upload Roster flow
  // ---------------------------------------------------------------------------

  describe("Upload Roster flow (P2-004)", () => {
    it("shows player count and upload button", () => {
      mockPlayerStore.players = new Map([
        ["p1", { battletag: "p1" }],
        ["p2", { battletag: "p2" }],
      ]);
      renderModal();
      fireEvent.click(screen.getByText(/Upload Roster to New Sheet/));
      expect(screen.getByText(/2 player/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Upload" }),
      ).toBeInTheDocument();
    });

    it("executes upload flow and closes on success", async () => {
      const fakePlayer = { battletag: "Test#1234" };
      mockPlayerStore.getAllPlayers.mockReturnValue([fakePlayer]);
      mockPlayerStore.players = new Map([["Test#1234", fakePlayer]]);
      mockBuildTemplateRequest.mockReturnValue({});
      mockCreateSpreadsheet.mockResolvedValue({
        spreadsheetId: "upload-id",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/upload-id",
        rosterSheetId: 0,
      });
      mockSerializePlayerToRow.mockReturnValue(["Test#1234"]);
      mockAppendRows.mockResolvedValue(undefined);
      mockApplyDataValidation.mockResolvedValue(undefined);

      renderModal();
      fireEvent.click(screen.getByText(/Upload Roster to New Sheet/));
      fireEvent.click(screen.getByRole("button", { name: "Upload" }));

      await waitFor(() => {
        expect(mockCreateSpreadsheet).toHaveBeenCalled();
        expect(mockSerializePlayerToRow).toHaveBeenCalledWith(fakePlayer);
        expect(mockAppendRows).toHaveBeenCalledWith("upload-id", [
          ["Test#1234"],
        ]);
        expect(mockApplyDataValidation).toHaveBeenCalledWith("upload-id", 0);
        expect(mockSheetStore.connect).toHaveBeenCalledWith(
          "upload-id",
          "PUGs Balancer Roster",
          "https://docs.google.com/spreadsheets/d/upload-id",
        );
        expect(mockSheetStore.markSynced).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("shows error on upload failure (P2-006)", async () => {
      mockPlayerStore.getAllPlayers.mockReturnValue([]);
      mockBuildTemplateRequest.mockReturnValue({});
      mockCreateSpreadsheet.mockRejectedValue(
        new Error("Permission denied"),
      );

      renderModal();
      fireEvent.click(screen.getByText(/Upload Roster to New Sheet/));
      fireEvent.click(screen.getByRole("button", { name: "Upload" }));

      await waitFor(() => {
        expect(screen.getByText("Permission denied")).toBeInTheDocument();
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  describe("navigation", () => {
    it("back button returns to mode selector", () => {
      renderModal();
      fireEvent.click(screen.getByText(/Create New Sheet/));
      expect(screen.queryByText(/Connect Existing Sheet/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByText(/← Back/));
      expect(screen.getByText(/Connect Existing Sheet/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-014–015: Disconnect flow
  // ---------------------------------------------------------------------------

  describe("disconnect flow (P2-014, P2-015)", () => {
    it("shows disconnect button when connected to a sheet", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      renderModal();
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });

    it("does not show disconnect button when not connected", () => {
      renderModal();
      expect(
        screen.queryByRole("button", { name: /disconnect/i }),
      ).not.toBeInTheDocument();
    });

    it("calls disconnect immediately when no unsynced changes", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      mockSheetStore.hasUnsyncedChanges = false;
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
      expect(mockSheetStore.disconnect).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("shows warning when disconnecting with unsynced changes", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      mockSheetStore.hasUnsyncedChanges = true;
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
      // Should show confirmation, NOT immediately disconnect
      expect(mockSheetStore.disconnect).not.toHaveBeenCalled();
      expect(screen.getByText(/unsynced changes/i)).toBeInTheDocument();
    });

    it("disconnects when confirming warning", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      mockSheetStore.hasUnsyncedChanges = true;
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
      fireEvent.click(screen.getByRole("button", { name: /disconnect anyway/i }));
      expect(mockSheetStore.disconnect).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("cancels disconnect when dismissing warning", () => {
      mockSheetStore.spreadsheetId = "abc123";
      mockSheetStore.sheetName = "My Roster";
      mockSheetStore.hasUnsyncedChanges = true;
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(mockSheetStore.disconnect).not.toHaveBeenCalled();
    });
  });
});
