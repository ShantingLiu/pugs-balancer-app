import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncDiffModal } from "./SyncDiffModal";
import type { SyncDiff, PlayerDiff, FieldDiff } from "@services/diffEngine";

// =============================================================================
// Test Helpers
// =============================================================================

function makeFieldDiff(overrides: Partial<FieldDiff> = {}): FieldDiff {
  return {
    field: "tankRank",
    header: "Tank Rank (Stadium)",
    localValue: "Gold 1",
    remoteValue: "Platinum 3",
    defaultChoice: "local",
    chosenSide: "local",
    ...overrides,
  };
}

function makePlayerDiff(overrides: Partial<PlayerDiff> = {}): PlayerDiff {
  return {
    battletag: "Player#1111",
    type: "modified",
    fields: [makeFieldDiff()],
    selected: true,
    sheetRowIndex: 2,
    validationWarnings: [],
    ...overrides,
  };
}

function makeSyncDiff(overrides: Partial<SyncDiff> = {}): SyncDiff {
  return {
    modified: [],
    newLocal: [],
    newRemote: [],
    isFirstSync: false,
    hasChanges: true,
    ...overrides,
  };
}

// =============================================================================
// SyncDiffModal Tests
// =============================================================================

describe("SyncDiffModal", () => {
  const mockOnApply = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnApply.mockClear();
    mockOnCancel.mockClear();
  });

  // ---------------------------------------------------------------------------
  // Basic rendering
  // ---------------------------------------------------------------------------

  describe("rendering", () => {
    it("should render the modal with heading", () => {
      const diff = makeSyncDiff();
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText("Sync Changes")).toBeInTheDocument();
    });

    it("should render Cancel and Apply buttons", () => {
      const diff = makeSyncDiff();
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument();
    });

    it("should call onCancel when Cancel is clicked", () => {
      const diff = makeSyncDiff();
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it("should call onApply with resolved diff when Apply is clicked", () => {
      const diff = makeSyncDiff({
        modified: [makePlayerDiff()],
      });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      expect(mockOnApply).toHaveBeenCalledOnce();
      const passedDiff = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(passedDiff.modified).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Sections with counts
  // ---------------------------------------------------------------------------

  describe("sections", () => {
    it("should show Modified section with count when modified players exist", () => {
      const diff = makeSyncDiff({
        modified: [makePlayerDiff(), makePlayerDiff({ battletag: "Player#2222" })],
      });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText(/Modified Players\s*\(2\)/)).toBeInTheDocument();
    });

    it("should show New from Sheet section with count when newRemote players exist", () => {
      const diff = makeSyncDiff({
        newRemote: [
          makePlayerDiff({ battletag: "Remote#1111", type: "new_remote", selected: true }),
        ],
      });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText(/New from Sheet\s*\(1\)/)).toBeInTheDocument();
    });

    it("should show New Locally section with count when newLocal players exist", () => {
      const diff = makeSyncDiff({
        newLocal: [
          makePlayerDiff({ battletag: "Local#1111", type: "new_local", selected: true }),
        ],
      });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText(/New Locally\s*\(1\)/)).toBeInTheDocument();
    });

    it("should hide Modified section when no modified players", () => {
      const diff = makeSyncDiff({ modified: [] });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.queryByText(/Modified Players/)).not.toBeInTheDocument();
    });

    it("should hide New from Sheet section when no newRemote players", () => {
      const diff = makeSyncDiff({ newRemote: [] });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.queryByText(/New from Sheet/)).not.toBeInTheDocument();
    });

    it("should hide New Locally section when no newLocal players", () => {
      const diff = makeSyncDiff({ newLocal: [] });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.queryByText(/New Locally/)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-038: First-sync banner
  // ---------------------------------------------------------------------------

  describe("first-sync banner", () => {
    it("should show first-sync banner when isFirstSync is true", () => {
      const diff = makeSyncDiff({ isFirstSync: true });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText(/first sync/i)).toBeInTheDocument();
    });

    it("should hide first-sync banner when isFirstSync is false", () => {
      const diff = makeSyncDiff({ isFirstSync: false });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.queryByText(/first sync/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-034: acceptAll
  // ---------------------------------------------------------------------------

  describe("acceptAll", () => {
    it("should set all fields to local when Accept All Local is clicked", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            battletag: "A#1111",
            fields: [
              makeFieldDiff({ field: "tankRank", chosenSide: "remote" }),
              makeFieldDiff({ field: "dpsRank", header: "DPS Rank (Stadium)", localValue: "Gold 2", remoteValue: "Silver 1", chosenSide: "remote" }),
            ],
          }),
          makePlayerDiff({
            battletag: "B#2222",
            fields: [
              makeFieldDiff({ field: "supportRank", header: "Support Rank (Stadium)", localValue: "Diamond 1", remoteValue: "Platinum 2", chosenSide: "remote" }),
            ],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      fireEvent.click(screen.getByRole("button", { name: /accept all local/i }));
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));

      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      for (const player of result.modified) {
        for (const field of player.fields) {
          expect(field.chosenSide).toBe("local");
        }
      }
    });

    it("should set all fields to remote when Accept All Remote is clicked", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            fields: [
              makeFieldDiff({ chosenSide: "local" }),
              makeFieldDiff({ field: "dpsRank", header: "DPS Rank (Stadium)", chosenSide: "local" }),
            ],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      fireEvent.click(screen.getByRole("button", { name: /accept all remote/i }));
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));

      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      for (const player of result.modified) {
        for (const field of player.fields) {
          expect(field.chosenSide).toBe("remote");
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // P1-035: updateDiff (field choice toggling)
  // ---------------------------------------------------------------------------

  describe("updateDiff (field choice)", () => {
    it("should switch field to remote when remote value is clicked", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            fields: [makeFieldDiff({ chosenSide: "local", localValue: "Gold 1", remoteValue: "Platinum 3" })],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);

      // Click on remote value to choose it
      const remoteCell = screen.getByTestId("remote-value-Player#1111-tankRank");
      fireEvent.click(remoteCell);

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(result.modified[0].fields[0].chosenSide).toBe("remote");
    });

    it("should switch field to local when local value is clicked", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            fields: [makeFieldDiff({ chosenSide: "remote", localValue: "Gold 1", remoteValue: "Platinum 3" })],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);

      const localCell = screen.getByTestId("local-value-Player#1111-tankRank");
      fireEvent.click(localCell);

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(result.modified[0].fields[0].chosenSide).toBe("local");
    });
  });

  // ---------------------------------------------------------------------------
  // P1-036: toggleSelected
  // ---------------------------------------------------------------------------

  describe("toggleSelected", () => {
    it("should toggle newRemote player selection when checkbox is clicked", () => {
      const diff = makeSyncDiff({
        newRemote: [
          makePlayerDiff({ battletag: "Remote#1111", type: "new_remote", selected: true }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);

      const checkbox = screen.getByRole("checkbox", { name: /Remote#1111/i });
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(result.newRemote[0].selected).toBe(false);
    });

    it("should toggle newLocal player selection when checkbox is clicked", () => {
      const diff = makeSyncDiff({
        newLocal: [
          makePlayerDiff({ battletag: "Local#1111", type: "new_local", selected: true }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);

      const checkbox = screen.getByRole("checkbox", { name: /Local#1111/i });
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(result.newLocal[0].selected).toBe(false);
    });

    it("should allow re-selecting a previously deselected player", () => {
      const diff = makeSyncDiff({
        newRemote: [
          makePlayerDiff({ battletag: "Remote#1111", type: "new_remote", selected: false }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);

      const checkbox = screen.getByRole("checkbox", { name: /Remote#1111/i });
      expect(checkbox).not.toBeChecked();
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const result = mockOnApply.mock.calls[0][0] as SyncDiff;
      expect(result.newRemote[0].selected).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // P1-037: FieldDiffRow
  // ---------------------------------------------------------------------------

  describe("FieldDiffRow", () => {
    it("should display the field header and both values", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            fields: [makeFieldDiff({ header: "Tank Rank (Stadium)", localValue: "Gold 1", remoteValue: "Platinum 3" })],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText("Tank Rank (Stadium)")).toBeInTheDocument();
      expect(screen.getByText("Gold 1")).toBeInTheDocument();
      expect(screen.getByText("Platinum 3")).toBeInTheDocument();
    });

    it("should show empty placeholder for blank values", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            fields: [makeFieldDiff({ localValue: "", remoteValue: "Platinum 3" })],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText("(empty)")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Validation warnings
  // ---------------------------------------------------------------------------

  describe("validation warnings", () => {
    it("should display validation warnings for a player", () => {
      const diff = makeSyncDiff({
        modified: [
          makePlayerDiff({
            validationWarnings: ["Invalid rank 'foo' in Tank Rank — treated as blank"],
          }),
        ],
      });

      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText("Invalid rank 'foo' in Tank Rank — treated as blank")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // No changes state
  // ---------------------------------------------------------------------------

  describe("no changes", () => {
    it("should show a no-changes message when diff has no changes", () => {
      const diff = makeSyncDiff({ hasChanges: false });
      render(<SyncDiffModal diff={diff} onApply={mockOnApply} onCancel={mockOnCancel} />);
      expect(screen.getByText(/no changes/i)).toBeInTheDocument();
    });
  });
});
