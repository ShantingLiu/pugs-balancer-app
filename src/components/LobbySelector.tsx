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

  const playerCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const playerListRef = useRef<HTMLDivElement>(null);

  const scrollPositionRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);

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

  const allPlayers = useMemo(() => Array.from(players.values()), [players]);
  const lobbySet = useMemo(() => new Set(lobbyBattletags), [lobbyBattletags]);

  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current && playerListRef.current) {
      playerListRef.current.scrollTop = scrollPositionRef.current;
      shouldRestoreScrollRef.current = false;
    }
  }, [lobbyBattletags]);

  const saveScrollPosition = useCallback(() => {
    if (playerListRef.current) {
      scrollPositionRef.current = playerListRef.current.scrollTop;
      shouldRestoreScrollRef.current = true;
    }
  }, []);

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

  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      if (roleFilter !== "all" && !p.rolesWilling.includes(roleFilter)) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesBattletag = p.battletag.toLowerCase().includes(term);
        const matchesHero = p.heroPool.some((h) => h.toLowerCase().includes(term));
        if (!matchesBattletag && !matchesHero) return false;
      }
      return true;
    });
  }, [allPlayers, searchTerm, roleFilter]);

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      const aInLobby = lobbySet.has(a.battletag);
      const bInLobby = lobbySet.has(b.battletag);
      if (aInLobby && !bInLobby) return -1;
      if (!aInLobby && bInLobby) return 1;

      switch (sortBy) {
        case "name":
          return a.battletag.localeCompare(b.battletag);
        case "rank-desc":
        case "rank-asc": {
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
        <p className="mb-4 text-sm">Import players first to build your lobby</p>
        <button
          type="button"
          onClick={handleAddPlayer}
          className="app-primary px-4 py-2 rounded-pill text-sm font-semibold"
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">
          Lobby ({lobbyBattletags.length - afkPlayers.size} active
          {afkPlayers.size > 0 && <span className="text-muted"> / {afkPlayers.size} AFK</span>})
        </h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleAddPlayer}
            className="app-primary px-3 py-1 text-xs font-semibold rounded-pill"
          >
            + Add
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="app-secondary px-3 py-1 text-xs font-semibold rounded-pill"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="app-secondary px-3 py-1 text-xs font-semibold rounded-pill"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick lobby summary */}
      {lobbyBattletags.length > 0 && (
        <div className="app-well p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink-2">In Lobby</span>
            {selectedBattletag && (
              <button
                type="button"
                onClick={() => setSelectedBattletag(null)}
                className="text-xs text-pink-ink hover:underline font-semibold"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`group/badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-pill cursor-pointer border transition-colors duration-150 ${
                    isSelected
                      ? isMustPlay
                        ? "bg-warn-soft text-warn border-warn-edge ring-2 ring-focus hover:bg-warn-fill hover:text-warn-btn-ink"
                        : "bg-pink-soft text-pink-ink border-pink-edge ring-2 ring-focus hover:bg-accent hover:text-accent-ink"
                      : isAfk
                        ? "bg-paper-2 text-muted border-rule hover:bg-paper-3 hover:text-ink hover:border-rule-2"
                        : isMustPlay
                          ? "bg-warn-soft text-warn border-warn-edge hover:bg-warn-fill hover:text-warn-btn-ink"
                          : "bg-sky-soft text-sky-ink border-sky-edge hover:bg-accent hover:text-accent-ink hover:border-pink-edge"
                  }`}
                  title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "") + " - Click to view"}
                >
                  {isMustPlay && !isAfk && <Star className="h-3 w-3" aria-hidden="true" />}
                  {name}
                  {isAfk && <span className="text-muted"> AFK</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromLobby(bt);
                    }}
                    className="inline-flex w-4 h-4 items-center justify-center rounded-pill bg-paper-2/80 text-ink opacity-55 group-hover/badge:opacity-100 focus-visible:opacity-100 hover:bg-bad-soft hover:text-bad transition-opacity"
                    title="Remove from lobby"
                    aria-label={`Remove ${name} from lobby`}
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
        placeholder="Search players or heroes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search players or heroes"
        className="app-input w-full px-3 py-2 text-sm"
      />

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
          aria-label="Filter by role"
          className="app-input px-3 py-1.5 text-sm"
        >
          <option value="all">All Roles</option>
          <option value="Tank">Tank</option>
          <option value="DPS">DPS</option>
          <option value="Support">Support</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="Sort players"
          className="app-input px-3 py-1.5 text-sm"
        >
          <option value="name">Sort: Name</option>
          <option value="rank-desc">Sort: Rank ↓</option>
          <option value="rank-asc">Sort: Rank ↑</option>
          <option value="role">Sort: Role</option>
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleShowWeightModifiers}
          className={`px-2.5 py-1.5 rounded-pill text-sm ${
            showWeightModifiers
              ? "app-sky"
              : "app-quiet"
          }`}
          aria-label={showWeightModifiers ? "Hide weight modifiers" : "Show weight modifiers"}
          title={showWeightModifiers ? "Hide weight modifiers" : "Show weight modifiers"}
        >
          {showWeightModifiers ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Player count indicator */}
      {lobbyBattletags.length - afkPlayers.size < 10 && (
        <div className="text-sm font-semibold text-warn bg-warn-soft border border-warn-edge rounded-well px-3 py-2">
          Need at least 10 active players ({10 - (lobbyBattletags.length - afkPlayers.size)} more)
        </div>
      )}

      {/* Player list */}
      <div ref={playerListRef} className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
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
              className={`relative group rounded-well ${
                selectedBattletag === player.battletag ? "ring-2 ring-focus" : ""
              }`}
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
              {inLobby && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveScrollPosition();
                    removeFromLobby(player.battletag);
                  }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-xs bg-paper-2 border border-rule text-muted hover:bg-bad-soft hover:text-bad hover:border-bad-edge rounded-pill opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Remove from lobby"
                  aria-label={`Remove ${getDisplayName(player.battletag)} from lobby`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {!inLobby && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditPlayer(player.battletag);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs bg-paper-2 border border-rule text-ink-2 hover:bg-sky-soft rounded-pill opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Edit ${getDisplayName(player.battletag)}`}
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
