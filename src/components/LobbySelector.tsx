import { useCallback, useMemo, useState, useRef, useLayoutEffect } from "react";
import { Eye, EyeOff, Pencil, X, Star } from "lucide-react";
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

  // Bug #8 fix: Track scroll position to restore after state changes
  const scrollPositionRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);

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
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  const toggleShowWeightModifiers = useSessionStore((state) => state.toggleShowWeightModifiers);
  const addToLobby = useSessionStore((state) => state.addToLobby);
  const removeFromLobby = useSessionStore((state) => state.removeFromLobby);
  const setLobby = useSessionStore((state) => state.setLobby);

  // Derive allPlayers from the Map
  const allPlayers = useMemo(() => Array.from(players.values()), [players]);

  const lobbySet = useMemo(() => new Set(lobbyBattletags), [lobbyBattletags]);

  // Bug #8 fix: Restore scroll position after lobby changes
  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current && playerListRef.current) {
      playerListRef.current.scrollTop = scrollPositionRef.current;
      shouldRestoreScrollRef.current = false;
    }
  }, [lobbyBattletags]);

  // Helper to save scroll position before state changes
  const saveScrollPosition = useCallback(() => {
    if (playerListRef.current) {
      scrollPositionRef.current = playerListRef.current.scrollTop;
      shouldRestoreScrollRef.current = true;
    }
  }, []);

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
  }, [
    lobbyBattletags,
    players,
    mustPlay,
    mustPlayPriority,
    lockedTeam1,
    lockedTeam2,
    lockedRoles,
    afkPlayers,
    tempWeightOverrides,
    adaptiveWeights,
    playerLossStreaks,
    satOutStreaks,
  ]);

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
      <div className="text-center text-muted py-8">
        <p className="mb-4">Import players first to build your lobby</p>
        <button
          onClick={handleAddPlayer}
          className="px-4 py-2 app-primary transition-colors"
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
        <h2 className="text-lg font-semibold text-ink">
          Lobby ({lobbyBattletags.length - afkPlayers.size} active
          {afkPlayers.size > 0 && (
            <span className="text-muted"> / {afkPlayers.size} AFK</span>
          )}
          )
        </h2>
        <div className="flex gap-1.5">
          <button
            onClick={handleAddPlayer}
            className="px-3 py-1 text-sm app-primary transition-colors"
          >
            + Add
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm app-secondary transition-colors"
          >
            All
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm app-secondary transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick lobby summary */}
      {lobbyBattletags.length > 0 && (
        <div className="app-subsurface p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">In Lobby:</span>
            {selectedBattletag && (
              <button
                onClick={() => setSelectedBattletag(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {lobbyBattletags.map((bt) => {
              const isAfk = afkPlayers.has(bt);
              const isMustPlay = mustPlay.has(bt);
              const isSelected = selectedBattletag === bt;
              const name = getDisplayName(bt);
              return (
                <span
                  key={bt}
                  onClick={() => {
                    if (selectedBattletag === bt) {
                      setSelectedBattletag(null);
                    } else {
                      setSelectedBattletag(bt);
                      const cardEl = playerCardRefs.current.get(bt);
                      if (cardEl && playerListRef.current) {
                        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }
                  }}
                  className={`
                    group/badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs cursor-pointer transition-colors
                    ${
                      isSelected
                        ? "app-chip-active"
                        : isAfk
                        ? "app-chip opacity-65"
                        : isMustPlay
                        ? "app-badge outline outline-1 outline-[var(--color-accent)]"
                        : "app-badge"
                    }
                  `}
                  title={
                    bt +
                    (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "") +
                    " - Click to view"
                  }
                >
                  {isMustPlay && !isAfk && (
                    <Star className="h-3 w-3 text-accent" aria-hidden="true" />
                  )}
                  {name}
                  {isAfk && <span className="text-muted"> AFK</span>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromLobby(bt);
                    }}
                    className="hidden group-hover/badge:inline-flex w-4 h-4 items-center justify-center rounded-full bg-[var(--color-paper)] hover:bg-[var(--color-error)] hover:text-[var(--color-accent-ink)] transition-colors"
                    title="Remove from lobby"
                  >
                    <X className="w-2.5 h-2.5" aria-hidden="true" />
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
        placeholder="Search players or heroes…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 text-sm app-input"
      />

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
          className="px-3 py-1.5 text-sm app-input"
        >
          <option value="all">All Roles</option>
          <option value="Tank">Tank</option>
          <option value="DPS">DPS</option>
          <option value="Support">Support</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-1.5 text-sm app-input"
        >
          <option value="name">Sort: Name</option>
          <option value="rank-desc">Sort: Rank ↓</option>
          <option value="rank-asc">Sort: Rank ↑</option>
          <option value="role">Sort: Role</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={toggleShowWeightModifiers}
          className={`px-2.5 py-1.5 text-sm transition-colors ${
            showWeightModifiers ? "app-chip-active" : "app-chip"
          }`}
          aria-label={showWeightModifiers ? "Hide weight modifiers" : "Show weight modifiers"}
        >
          {showWeightModifiers ? (
            <Eye className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Player count indicator */}
      {lobbyBattletags.length - afkPlayers.size < 10 && (
        <div className="text-sm text-accent font-medium">
          Need at least 10 active players ({10 - (lobbyBattletags.length - afkPlayers.size)} more)
        </div>
      )}

      {/* Player list - taller to show more cards */}
      <div ref={playerListRef} className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {sortedPlayers.map((player) => {
          const inLobby = lobbySet.has(player.battletag);
          const lobbyPlayer = lobbyPlayersMap.get(player.battletag);
          return (
            <div
              key={player.battletag}
              ref={(el) => {
                if (el) {
                  playerCardRefs.current.set(player.battletag, el);
                }
              }}
              className="relative group transition-colors rounded-[var(--radius-card)]"
            >
              <PlayerCard
                player={inLobby && lobbyPlayer ? lobbyPlayer : player}
                selected={inLobby}
                onClick={() => {
                  setSelectedBattletag(null);
                  if (inLobby) {
                    handleEditPlayer(player.battletag);
                  } else {
                    saveScrollPosition();
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
              {/* Remove from lobby button (appears on hover/focus when in lobby) */}
              {inLobby && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveScrollPosition();
                    removeFromLobby(player.battletag);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-xs app-chip hover:bg-[var(--color-error)] hover:text-[var(--color-accent-ink)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10"
                  title="Remove from lobby"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {/* Edit button (appears on hover/focus when NOT in lobby) */}
              {!inLobby && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditPlayer(player.battletag);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs app-chip opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10"
                  title="Edit player"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
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
