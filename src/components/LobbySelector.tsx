import { useCallback, useMemo, useState, useRef } from "react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { PlayerCard } from "./PlayerCard";
import { AddPlayerModal } from "./AddPlayerModal";
import { WeightAdjuster } from "./WeightAdjuster";
import { getDisplayName } from "@utils/heroUtils";
import type { Player, LobbyPlayer, Role } from "@engine/types";

type SortOption = "name" | "rank-desc" | "rank-asc" | "role";

// =============================================================================
// LobbySelector - Select players for the current lobby
// =============================================================================

export function LobbySelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [weightAdjustPlayer, setWeightAdjustPlayer] = useState<LobbyPlayer | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [selectedBattletag, setSelectedBattletag] = useState<string | null>(null);
  
  // Refs for scrolling to player cards
  const playerCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const playerListRef = useRef<HTMLDivElement>(null);
  
  // Get stable references - don't call functions in selectors
  const players = usePlayerStore((state) => state.players);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const mustPlay = useSessionStore((state) => state.mustPlay);
  const lockedTeam1 = useSessionStore((state) => state.lockedTeam1);
  const lockedTeam2 = useSessionStore((state) => state.lockedTeam2);
  const lockedRoles = useSessionStore((state) => state.lockedRoles);
  const afkPlayers = useSessionStore((state) => state.afkPlayers);
  const tempWeightOverrides = useSessionStore((state) => state.tempWeightOverrides);
  const playerLossStreaks = useSessionStore((state) => state.playerLossStreaks);
  const satOutStreaks = useSessionStore((state) => state.satOutStreaks);
  const adaptiveWeights = useSessionStore((state) => state.adaptiveWeights);
  const mustPlayPriority = useSessionStore((state) => state.mustPlayPriority);
  const lastResult = useSessionStore((state) => state.lastResult);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  const toggleShowWeightModifiers = useSessionStore((state) => state.toggleShowWeightModifiers);
  const addToLobby = useSessionStore((state) => state.addToLobby);
  const removeFromLobby = useSessionStore((state) => state.removeFromLobby);
  const setLobby = useSessionStore((state) => state.setLobby);

  // Derive allPlayers from the Map
  const allPlayers = useMemo(() => Array.from(players.values()), [players]);

  const lobbySet = useMemo(() => new Set(lobbyBattletags), [lobbyBattletags]);

  // Get battletags of players currently in teams
  const playingBattletags = useMemo(() => {
    if (!lastResult || lastResult.team1.length === 0) return new Set<string>();
    return new Set([
      ...lastResult.team1.map((ra) => ra.player.battletag),
      ...lastResult.team2.map((ra) => ra.player.battletag),
    ]);
  }, [lastResult]);
  
  // Get lobby players with session state - derive from primitive state
  const lobbyPlayersMap = useMemo(() => {
    const map = new Map<string, LobbyPlayer>();
    for (const battletag of lobbyBattletags) {
      const player = players.get(battletag);
      if (!player) continue;
      
      const lockedToTeam = lockedTeam1.has(battletag)
        ? 1
        : lockedTeam2.has(battletag)
        ? 2
        : null;

      map.set(battletag, {
        ...player,
        mustPlay: mustPlay.has(battletag),
        mustPlayPriority: mustPlayPriority.get(battletag) ?? 0,
        lockedToTeam,
        lockedToRole: lockedRoles.get(battletag) ?? null,
        tempWeightOverride: tempWeightOverrides.get(battletag) ?? null,
        adaptiveWeight: adaptiveWeights.get(battletag) ?? 0,
        isAfk: afkPlayers.has(battletag),
        consecutiveLosses: playerLossStreaks.get(battletag) ?? 0,
        consecutiveSatOut: satOutStreaks.get(battletag) ?? 0,
      });
    }
    return map;
  }, [lobbyBattletags, players, mustPlay, mustPlayPriority, lockedTeam1, lockedTeam2, lockedRoles, afkPlayers, tempWeightOverrides, adaptiveWeights, playerLossStreaks, satOutStreaks]);

  // Filter players based on search and role
  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      // Role filter
      if (roleFilter !== "all" && !p.rolesWilling.includes(roleFilter)) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesBattletag = p.battletag.toLowerCase().includes(term);
        const matchesHero = p.heroPool.some((h) => h.toLowerCase().includes(term));
        if (!matchesBattletag && !matchesHero) return false;
      }
      return true;
    });
  }, [allPlayers, searchTerm, roleFilter]);

  // Sort players
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      // Always show lobby players first
      const aInLobby = lobbySet.has(a.battletag);
      const bInLobby = lobbySet.has(b.battletag);
      if (aInLobby && !bInLobby) return -1;
      if (!aInLobby && bInLobby) return 1;

      // Then by selected sort option
      switch (sortBy) {
        case "name":
          return a.battletag.localeCompare(b.battletag);
        case "rank-desc":
        case "rank-asc": {
          // Use primary role rank for sorting
          const getPrimaryRank = (p: Player) => {
            const role = p.rolePreference[0] || p.rolesWilling[0];
            if (role === "Tank") return p.tankRank || "";
            if (role === "DPS") return p.dpsRank || "";
            return p.supportRank || "";
          };
          const aRank = getPrimaryRank(a);
          const bRank = getPrimaryRank(b);
          const comparison = aRank.localeCompare(bRank);
          return sortBy === "rank-asc" ? comparison : -comparison;
        }
        case "role":
          return a.rolesWilling[0].localeCompare(b.rolesWilling[0]);
        default:
          return 0;
      }
    });
  }, [filteredPlayers, lobbySet, sortBy]);

  const handleSelectAll = useCallback(() => {
    setLobby(allPlayers.map((p) => p.battletag));
  }, [allPlayers, setLobby]);

  const handleClearAll = useCallback(() => {
    setLobby([]);
  }, [setLobby]);

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setModalOpen(true);
  };

  const handleEditPlayer = (battletag: string) => {
    const player = getPlayer(battletag);
    if (player) {
      setEditingPlayer(player);
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPlayer(null);
  };

  if (allPlayers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="mb-4">Import players first to build your lobby</p>
        <button
          onClick={handleAddPlayer}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Player Manually
        </button>
        <AddPlayerModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          editPlayer={editingPlayer}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Lobby ({lobbyBattletags.length - afkPlayers.size} active
          {afkPlayers.size > 0 && <span className="text-gray-500"> / {afkPlayers.size} AFK</span>})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleAddPlayer}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            + Add
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            All
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick lobby summary */}
      {lobbyBattletags.length > 0 && (
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">In Lobby:</span>
            {selectedBattletag && (
              <button
                onClick={() => setSelectedBattletag(null)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {lobbyBattletags.map((bt) => {
              const isAfk = afkPlayers.has(bt);
              const isPlaying = playingBattletags.has(bt);
              // Only show must-play for players NOT currently in teams
              const isMustPlay = !isPlaying && mustPlay.has(bt);
              const isSelected = selectedBattletag === bt;
              const name = getDisplayName(bt);
              return (
                <span
                  key={bt}
                  onClick={() => {
                    if (selectedBattletag === bt) {
                      // Clicking again deselects
                      setSelectedBattletag(null);
                    } else {
                      setSelectedBattletag(bt);
                      // Scroll to the card
                      const cardEl = playerCardRefs.current.get(bt);
                      if (cardEl && playerListRef.current) {
                        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }
                  }}
                  className={`
                    group/badge inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full cursor-pointer transition-all
                    ${isSelected
                      ? isMustPlay
                        ? "ring-2 ring-white bg-yellow-600/50 text-yellow-100"
                        : "ring-2 ring-white bg-blue-500 text-white"
                      : isAfk 
                        ? "bg-gray-600 text-gray-400 hover:bg-gray-500" 
                        : isMustPlay
                          ? "bg-yellow-600/30 text-yellow-300 ring-1 ring-yellow-500 hover:bg-yellow-600/50"
                          : "bg-blue-600/30 text-blue-300 hover:bg-blue-600/50"
                    }
                  `}
                  title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "") + " - Click to view"}
                >
                  {isMustPlay && !isAfk && "★ "}{name}{isAfk && " 💤"}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromLobby(bt);
                    }}
                    className="hidden group-hover/badge:inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-500/50 hover:bg-red-500 hover:text-white transition-colors"
                    title="Remove from lobby"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 2 L8 8 M8 2 L2 8" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search players or heroes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm outline-none focus:border-blue-500"
      />

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm outline-none focus:border-blue-500"
        >
          <option value="all">All Roles</option>
          <option value="Tank">Tank</option>
          <option value="DPS">DPS</option>
          <option value="Support">Support</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm outline-none focus:border-blue-500"
        >
          <option value="name">Sort: Name</option>
          <option value="rank-desc">Sort: Rank ↓</option>
          <option value="rank-asc">Sort: Rank ↑</option>
          <option value="role">Sort: Role</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={toggleShowWeightModifiers}
          className={`px-2 py-1.5 rounded text-sm transition-colors ${
            showWeightModifiers
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700"
          }`}
          title={showWeightModifiers ? "Hide manual weight modifiers (W/L adjustments still visible)" : "Show manual weight modifiers"}
        >
          {showWeightModifiers ? "👁️" : "👁️‍🗨️"}
        </button>
      </div>

      {/* Player count indicator */}
      {lobbyBattletags.length - afkPlayers.size < 10 && (
        <div className="text-sm text-yellow-500">
          Need at least 10 active players ({10 - (lobbyBattletags.length - afkPlayers.size)} more)
        </div>
      )}

      {/* Player list - taller to show more cards */}
      <div ref={playerListRef} className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {sortedPlayers.map((player) => {
          const inLobby = lobbySet.has(player.battletag);
          const lobbyPlayer = lobbyPlayersMap.get(player.battletag);
          const isHighlighted = selectedBattletag === player.battletag;
          return (
            <div 
              key={player.battletag} 
              ref={(el) => {
                if (el) {
                  playerCardRefs.current.set(player.battletag, el);
                }
              }}
              className={`relative group transition-all ${isHighlighted ? "shadow-[0_0_0_3px_rgba(96,165,250,0.7)] rounded-lg" : ""}`}
            >
              <PlayerCard
                player={inLobby && lobbyPlayer ? lobbyPlayer : player}
                selected={inLobby}
                onClick={() => {
                  // Clear highlight on click
                  setSelectedBattletag(null);
                  if (inLobby) {
                    // If in lobby, clicking edits the player
                    handleEditPlayer(player.battletag);
                  } else {
                    // If not in lobby, clicking adds them
                    addToLobby(player.battletag);
                  }
                }}
                showControls={inLobby}
                onWeightClick={
                  inLobby && lobbyPlayer
                    ? () => setWeightAdjustPlayer(lobbyPlayer)
                    : undefined
                }
              />
              {/* Remove from lobby button (appears on hover when in lobby) */}
              {inLobby && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromLobby(player.battletag);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-xs bg-gray-600 hover:bg-red-600 text-gray-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from lobby"
                >
                  ✕
                </button>
              )}
              {/* Edit button (appears on hover when NOT in lobby) */}
              {!inLobby && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditPlayer(player.battletag);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✏️
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Player Modal */}
      <AddPlayerModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        editPlayer={editingPlayer}
      />

      {/* Weight Adjuster Modal */}
      {weightAdjustPlayer && (
        <WeightAdjuster
          player={weightAdjustPlayer}
          onClose={() => setWeightAdjustPlayer(null)}
        />
      )}
    </div>
  );
}
