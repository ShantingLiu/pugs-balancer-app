import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DraftView } from "./DraftView";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import type { Player } from "@engine/types";

// =============================================================================
// Test helpers
// =============================================================================

function createPlayer(
  battletag: string,
  rolesWilling: ("Tank" | "DPS" | "Support")[],
  overrides: Partial<Player> = {}
): Player {
  return {
    battletag,
    tankRank: rolesWilling.includes("Tank") ? "Pro 3" : null,
    dpsRank: rolesWilling.includes("DPS") ? "Pro 3" : null,
    supportRank: rolesWilling.includes("Support") ? "Pro 3" : null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling,
    rolePreference: rolesWilling,
    heroPool: ["Hero1"],
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

function seedLobby(players: { bt: string; roles: ("Tank" | "DPS" | "Support")[] }[]) {
  const store = usePlayerStore.getState();
  players.forEach(({ bt, roles }) => store.upsertPlayer(createPlayer(bt, roles)));
  useSessionStore.getState().setLobby(players.map((p) => p.bt));
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
  usePlayerStore.setState(usePlayerStore.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// P3-007: DraftView component tests
describe("DraftView", () => {
  describe("rendering", () => {
    it("renders 3 panels", () => {
      seedLobby([
        { bt: "Tank1#1", roles: ["Tank"] },
        { bt: "DPS1#1", roles: ["DPS"] },
      ]);

      render(<DraftView />);

      expect(screen.getByText("Team 1")).toBeInTheDocument();
      expect(screen.getByText("Team 2")).toBeInTheDocument();
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("shows unassigned players in the pool", () => {
      seedLobby([
        { bt: "Tank1#1", roles: ["Tank"] },
        { bt: "DPS1#1", roles: ["DPS"] },
      ]);

      render(<DraftView />);

      expect(screen.getByText("Tank1")).toBeInTheDocument();
      expect(screen.getByText("DPS1")).toBeInTheDocument();
    });

    it("shows assigned players in team panel", () => {
      seedLobby([
        { bt: "Tank1#1", roles: ["Tank"] },
        { bt: "DPS1#1", roles: ["DPS"] },
      ]);
      useSessionStore.getState().assignToTeam("Tank1#1", 1);

      render(<DraftView />);

      // Tank1 should be in Team 1 panel, not in unassigned
      // There should be (1/5) count for Team 1
      expect(screen.getByText("(1/5)")).toBeInTheDocument();
    });

    it("shows empty slot placeholders", () => {
      seedLobby([{ bt: "Tank1#1", roles: ["Tank"] }]);

      render(<DraftView />);

      // Should show placeholder slots for empty roles
      const tankSlots = screen.getAllByText("— Tank —");
      expect(tankSlots.length).toBeGreaterThanOrEqual(2); // 1 per team
    });
  });

  describe("click-to-assign", () => {
    it("opens popup when clicking unassigned player", () => {
      seedLobby([{ bt: "Tank1#1", roles: ["Tank"] }]);

      render(<DraftView />);

      fireEvent.click(screen.getByText("Tank1"));

      expect(screen.getByText("← Team 1")).toBeInTheDocument();
      expect(screen.getByText("Team 2 →")).toBeInTheDocument();
    });

    it("assigns player to team when popup role button clicked", () => {
      seedLobby([{ bt: "Tank1#1", roles: ["Tank"] }]);

      render(<DraftView />);

      fireEvent.click(screen.getByText("Tank1"));
      // Popup shows role buttons per team; T buttons: [filter, popup-team1, popup-team2]
      const tButtons = screen.getAllByRole("button", { name: "T" });
      // Index 1 is the popup's Team 1 T button (index 0 is the role filter)
      fireEvent.click(tButtons[1]);

      // Player is now assigned to Team 1
      const state = useSessionStore.getState();
      expect(state.lockedTeam1.has("Tank1#1")).toBe(true);
    });
  });

  describe("click-to-unassign", () => {
    it("returns player to pool when clicking assigned player", () => {
      seedLobby([{ bt: "Tank1#1", roles: ["Tank"] }]);
      useSessionStore.getState().assignToTeam("Tank1#1", 1);

      render(<DraftView />);

      // Click the assigned player — should unassign
      fireEvent.click(screen.getByText("Tank1"));

      const state = useSessionStore.getState();
      expect(state.lockedTeam1.has("Tank1#1")).toBe(false);
    });
  });

  describe("Fill Remaining button", () => {
    it("shows when players are assigned but slots remain", () => {
      seedLobby([
        { bt: "Tank1#1", roles: ["Tank"] },
        { bt: "DPS1#1", roles: ["DPS"] },
      ]);
      useSessionStore.getState().assignToTeam("Tank1#1", 1);

      render(<DraftView />);

      expect(screen.getByText("⚡ Fill Remaining")).toBeInTheDocument();
    });

    it("hidden when no players assigned", () => {
      seedLobby([{ bt: "Tank1#1", roles: ["Tank"] }]);

      render(<DraftView />);

      expect(screen.queryByText("⚡ Fill Remaining")).not.toBeInTheDocument();
    });
  });
});
