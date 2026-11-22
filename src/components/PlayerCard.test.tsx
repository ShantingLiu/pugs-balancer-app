import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { PlayerCard } from "./PlayerCard";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import type { LobbyPlayer } from "@engine/types";

function makeFlexLobbyPlayer(overrides: Partial<LobbyPlayer> = {}): LobbyPlayer {
  return {
    battletag: "Flex#1234",
    tankRank: "Pro 3",
    dpsRank: "Pro 3",
    supportRank: "Pro 3",
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling: ["Tank", "DPS", "Support"],
    rolePreference: ["Tank", "DPS", "Support"],
    heroPool: ["Reinhardt", "Tracer", "Ana"],
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
    mustPlay: false,
    mustPlayPriority: 0,
    consecutiveSatOut: 0,
    lockedToTeam: null,
    lockedToRole: null,
    tempWeightOverride: null,
    adaptiveWeight: 0,
    isAfk: false,
    consecutiveLosses: 0,
    ...overrides,
  };
}

describe("PlayerCard role lock multi-select", () => {
  beforeEach(() => {
    useSessionStore.setState(useSessionStore.getInitialState());
    usePlayerStore.setState(usePlayerStore.getInitialState());
  });

  it("allows selecting multiple role lock buttons (e.g. D and S) on a T/D/S player", () => {
    const player = makeFlexLobbyPlayer();
    usePlayerStore.getState().upsertPlayer(player);
    useSessionStore.getState().setLobby([player.battletag]);

    const getCardPlayer = (): LobbyPlayer => {
      const lp = useSessionStore.getState().getLobbyPlayers()[0];
      return lp;
    };

    const { rerender } = render(<PlayerCard player={getCardPlayer()} showControls />);

    const tankBtn = screen.getByRole("button", { name: "T" });
    const dpsBtn = screen.getByRole("button", { name: "D" });
    const supBtn = screen.getByRole("button", { name: "S" });

    expect(tankBtn).toHaveAttribute("aria-pressed", "false");
    expect(dpsBtn).toHaveAttribute("aria-pressed", "false");
    expect(supBtn).toHaveAttribute("aria-pressed", "false");

    // Lock to D
    fireEvent.click(dpsBtn);
    rerender(<PlayerCard player={getCardPlayer()} showControls />);
    expect(screen.getByRole("button", { name: "D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");

    // Also select S -> both D and S stay locked
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    rerender(<PlayerCard player={getCardPlayer()} showControls />);
    expect(screen.getByRole("button", { name: "T" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");

    // Toggle D off -> only S stays locked
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    rerender(<PlayerCard player={getCardPlayer()} showControls />);
    expect(screen.getByRole("button", { name: "D" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");
  });
});
