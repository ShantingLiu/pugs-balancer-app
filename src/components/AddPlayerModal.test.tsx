import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AddPlayerModal } from "./AddPlayerModal";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { Player } from "@engine/types";

// =============================================================================
// AddPlayerModal Tests
// =============================================================================

// Helper to create a mock player
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    battletag: "TestPlayer#1234",
    tankRank: "Pro 2",
    dpsRank: null,
    supportRank: null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling: ["Tank"],
    rolePreference: ["Tank"],
    heroPool: ["Reinhardt"],
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

describe("AddPlayerModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    // Reset stores
    usePlayerStore.setState({ players: new Map() });
    useSessionStore.setState({ gameMode: "stadium_5v5" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should not render when isOpen is false", () => {
      render(<AddPlayerModal isOpen={false} onClose={mockOnClose} />);
      expect(screen.queryByText("Add New Player")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText("Add New Player")).toBeInTheDocument();
    });

    it("should show 'Edit Player' title when editPlayer is provided", () => {
      const player = createMockPlayer();
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} editPlayer={player} />);
      expect(screen.getByText("Edit Player")).toBeInTheDocument();
    });

    it("should render all role buttons", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      // Use queryAllByText since role names appear in multiple places (buttons and labels)
      expect(screen.queryAllByText("Tank").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("DPS").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("Support").length).toBeGreaterThan(0);
    });

    it("should render Cancel and Save buttons", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText(/Save|Add Player/)).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("should show error when battletag is empty", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText("Add Player"));
      
      expect(screen.getByText("Battletag/name is required")).toBeInTheDocument();
    });

    it("should show error when no role is selected", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/battletag|name/i);
      fireEvent.change(input, { target: { value: "NewPlayer#1234" } });
      fireEvent.click(screen.getByText("Add Player"));
      
      expect(screen.getByText("Select at least one role willing to play")).toBeInTheDocument();
    });

    it("should show error when role has no rank", async () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/battletag|name/i);
      fireEvent.change(input, { target: { value: "NewPlayer#1234" } });
      
      // Click Tank role (first "Tank" text is the role button)
      fireEvent.click(screen.getAllByText("Tank")[0]);
      
      fireEvent.click(screen.getByText("Add Player"));
      
      await waitFor(() => {
        expect(screen.getByText(/Tank requires a Stadium rank or Regular Comp rank/)).toBeInTheDocument();
      });
    });

    it("should show error when hero pool is empty", async () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/battletag|name/i);
      fireEvent.change(input, { target: { value: "NewPlayer#1234" } });
      
      // Click Tank role (first "Tank" text is the role button)
      fireEvent.click(screen.getAllByText("Tank")[0]);
      
      // Select a rank - need to find the Tank Stadium Rank dropdown
      const selects = screen.getAllByRole("combobox");
      const tankRankSelect = selects.find(s => s.closest("div")?.textContent?.includes("Tank Stadium"));
      if (tankRankSelect) {
        fireEvent.change(tankRankSelect, { target: { value: "Pro 2" } });
      }
      
      fireEvent.click(screen.getByText("Add Player"));
      
      await waitFor(() => {
        expect(screen.getByText("Add at least one hero to hero pool")).toBeInTheDocument();
      });
    });

    it("should show error when duplicate battletag exists", () => {
      // Add existing player to store
      const existingPlayer = createMockPlayer({ battletag: "ExistingPlayer#1234" });
      usePlayerStore.getState().upsertPlayer(existingPlayer);
      
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/battletag|name/i);
      fireEvent.change(input, { target: { value: "ExistingPlayer#1234" } });
      fireEvent.click(screen.getByText("Add Player"));
      
      expect(screen.getByText("A player with this battletag already exists")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("should populate form with player data in edit mode", () => {
      const player = createMockPlayer({
        battletag: "EditMe#9999",
        tankRank: "Legend 1",
        rolesWilling: ["Tank"],
        heroPool: ["Reinhardt", "D.Va"],
      });
      
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} editPlayer={player} />);
      
      const input = screen.getByDisplayValue("EditMe#9999");
      expect(input).toBeInTheDocument();
    });

    it("should show Delete button only in edit mode", () => {
      const { unmount } = render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.queryByText("Delete Player")).not.toBeInTheDocument();
      unmount();
      
      const player = createMockPlayer();
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} editPlayer={player} />);
      expect(screen.getByText("Delete Player")).toBeInTheDocument();
    });

    it("should show delete confirmation when Delete is clicked", () => {
      const player = createMockPlayer();
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} editPlayer={player} />);
      
      fireEvent.click(screen.getByText("Delete Player"));
      
      expect(screen.getByText(/Yes, delete/i)).toBeInTheDocument();
    });
  });

  describe("role toggle", () => {
    it("should toggle role selection", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      // Use getAllByText since "Tank" appears in multiple places
      const tankButtons = screen.getAllByText("Tank");
      const tankButton = tankButtons[0]; // First one is the role toggle
      
      // Click to select
      fireEvent.click(tankButton);
      // Check that it's visually selected (Tank role has yellow background when selected)
      expect(tankButton.closest("button")).toHaveClass("bg-yellow-600");
      
      // Click again to deselect
      fireEvent.click(tankButton);
      expect(tankButton.closest("button")).not.toHaveClass("bg-yellow-600");
    });
  });

  describe("cancel action", () => {
    it("should call onClose when Cancel is clicked", () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText("Cancel"));
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("successful submission", () => {
    it("should add player to store and close modal on valid submit", async () => {
      render(<AddPlayerModal isOpen={true} onClose={mockOnClose} />);
      
      // Fill out form
      const input = screen.getByPlaceholderText(/battletag|name/i);
      fireEvent.change(input, { target: { value: "ValidPlayer#5555" } });
      
      // Select Tank role - use getAllByText since role appears in hero pool too
      const tankButtons = screen.getAllByText("Tank");
      fireEvent.click(tankButtons[0]); // First Tank button is the role toggle
      
      // Select a rank - find the Tank Stadium Rank dropdown
      const selects = screen.getAllByRole("combobox");
      const tankRankSelect = selects[0]; // First select should be tank stadium rank
      fireEvent.change(tankRankSelect, { target: { value: "Pro 2" } });
      
      // Add hero to pool - click on a hero button using getAllByText
      const reinhardtButtons = screen.getAllByText("Reinhardt");
      fireEvent.click(reinhardtButtons[0]);
      
      // Submit
      fireEvent.click(screen.getByText("Add Player"));
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      
      // Verify player was added
      const addedPlayer = usePlayerStore.getState().getPlayer("ValidPlayer#5555");
      expect(addedPlayer).toBeDefined();
      expect(addedPlayer?.rolesWilling).toContain("Tank");
    });
  });
});
