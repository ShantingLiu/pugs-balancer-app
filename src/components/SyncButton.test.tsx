import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncButton } from "./SyncButton";

// =============================================================================
// Mock sheetStore
// =============================================================================

const mockStoreState = {
  spreadsheetId: null as string | null,
  sheetName: null as string | null,
  lastSyncedAt: null as number | null,
  hasUnsyncedChanges: false,
  isAuthenticated: false,
};

vi.mock("@store/sheetStore", () => ({
  useSheetStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// =============================================================================
// SyncButton Tests
// =============================================================================

describe("SyncButton", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
    // Reset to defaults
    mockStoreState.spreadsheetId = null;
    mockStoreState.sheetName = null;
    mockStoreState.lastSyncedAt = null;
    mockStoreState.hasUnsyncedChanges = false;
    mockStoreState.isAuthenticated = false;
  });

  // ---------------------------------------------------------------------------
  // P1-039: Basic rendering & disabled state
  // ---------------------------------------------------------------------------

  describe("rendering", () => {
    it("should render the Sync button", () => {
      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
    });

    it("should show 'Not connected' when no sheet is connected", () => {
      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });

    it("should be disabled when not connected", () => {
      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeDisabled();
    });

    it("should be disabled when not authenticated even if connected", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = false;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeDisabled();
    });

    it("should be enabled when connected and authenticated", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeEnabled();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-039: Connection status text & relative time
  // ---------------------------------------------------------------------------

  describe("connection status", () => {
    it("should show sheet name when connected", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/My Roster/)).toBeInTheDocument();
    });

    it("should show 'Connected' when sheet name is null", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = null;
      mockStoreState.isAuthenticated = true;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    });

    it("should show relative time when lastSyncedAt is set", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.lastSyncedAt = Date.now() - 30 * 1000; // 30 seconds ago

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    it("should show minutes ago for recent syncs", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.lastSyncedAt = Date.now() - 5 * 60 * 1000; // 5 min ago

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it("should show hours ago for older syncs", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.lastSyncedAt = Date.now() - 3 * 60 * 60 * 1000; // 3h ago

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/3h ago/)).toBeInTheDocument();
    });

    it("should show days ago for very old syncs", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.lastSyncedAt = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2d ago

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByText(/2d ago/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-040: Unsync badge
  // ---------------------------------------------------------------------------

  describe("unsync badge", () => {
    it("should show amber badge when hasUnsyncedChanges and enabled", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.hasUnsyncedChanges = true;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.getByTestId("unsync-badge")).toBeInTheDocument();
    });

    it("should NOT show badge when no unsynced changes", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;
      mockStoreState.hasUnsyncedChanges = false;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.queryByTestId("unsync-badge")).not.toBeInTheDocument();
    });

    it("should NOT show badge when button is disabled even with unsynced changes", () => {
      mockStoreState.spreadsheetId = null;
      mockStoreState.hasUnsyncedChanges = true;

      render(<SyncButton onClick={mockOnClick} />);
      expect(screen.queryByTestId("unsync-badge")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Click behavior
  // ---------------------------------------------------------------------------

  describe("click", () => {
    it("should call onClick when clicked and enabled", () => {
      mockStoreState.spreadsheetId = "abc123";
      mockStoreState.sheetName = "My Roster";
      mockStoreState.isAuthenticated = true;

      render(<SyncButton onClick={mockOnClick} />);
      screen.getByRole("button", { name: /sync/i }).click();
      expect(mockOnClick).toHaveBeenCalledOnce();
    });

    it("should NOT call onClick when disabled", () => {
      render(<SyncButton onClick={mockOnClick} />);
      screen.getByRole("button", { name: /sync/i }).click();
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });
});
