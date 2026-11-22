import { useCallback, useMemo, useState, useRef, useLayoutEffect } from "react";
import { Eye, EyeOff, Pencil, Search, X, Star } from "lucide-react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { PlayerCard } from "./PlayerCard";
import { AppSelect, type SelectOption } from "./AppSelect";
import { AddPlayerModal } from "./AddPlayerModal";
import { WeightAdjuster } from "./WeightAdjuster";
import { getDisplayName } from "@utils/heroUtils";
import type { Player, LobbyPlayer, Role } from "@engine/types";

type SortOption = "name" | "rank-desc" | "rank-asc" | "role";

const STITCH_CHIP_VARIANTS = [
  "app-chip--pink",
  "app-chip--sky",
  "app-chip--purple",
  "app-chip--emerald",
  "app-chip--slate",
  "app-chip--amber",
] as const;

function getChipVariant(battletag: string, index: number): string {
  let hash = index;
  for (let i = 0; i < battletag.length; i++) {
    hash = (hash * 31 + battletag.charCodeAt(i)) >>> 0;
  }
  return STITCH_CHIP_VARIANTS[hash % STITCH_CHIP_VARIANTS.length];
}

const ROLE_FILTER_OPTIONS: readonly SelectOption<Role | "all">[] = [
  { value: "all", label: "All Roles" },
  { value: "Tank", label: "Tank" },
  { value: "DPS", label: "DPS" },
  { value: "Support", label: "Support" },
];

const SORT_OPTIONS: readonly SelectOption<SortOption>[] = [
  { value: "name", label: "Sort: Name" },
  { value: "rank-desc", label: "Sort: Rank ↓" },
  { value: "rank-asc", label: "Sort: Rank ↑" },
  { value: "role", label: "Sort: Role" },
];

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
  const lockedRolePools = useSessionStore((state) => state.lockedRolePools);
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
        lockedToRoles: lockedRolePools.get(battletag),
        tempWeightOverride: tempWeightOverrides.get(battletag) ?? null,
        adaptiveWeight: adaptiveWeights.get(battletag) ?? 0,
        isAfk: afkPlayers.has(battletag),
        consecutiveLosses: playerLossStreaks.get(battletag) ?? 0,
        consecutiveSatOut: satOutStreaks.get(battletag) ?? 0,
      });
    }
    return map;
  }, [lobbyBattletags, players, mustPlay, mustPlayPriority, lockedTeam1, lockedTeam2, lockedRoles, lockedRolePools, afkPlayers, tempWeightOverrides, adaptiveWeights, playerLossStreaks, satOutStreaks]);

  const lobbySummary = useMemo(() => {
    let tank = 0;
    let dps = 0;
    let support = 0;
    let mustCount = 0;
    let afkCount = 0;

    for (const lp of lobbyPlayersMap.values()) {
      if (lp.isAfk) {
        afkCount++;
        continue;
      }
      if (lp.mustPlay) mustCount++;
      if (lp.rolesWilling.includes("Tank")) tank++;
      if (lp.rolesWilling.includes("DPS")) dps++;
      if (lp.rolesWilling.includes("Support")) support++;
    }

    return {
      activeCount: lobbyPlayersMap.size - afkCount,
      tank,
      dps,
      support,
      mustCount,
      afkCount,
    };
  }, [lobbyPlayersMap]);

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
        <h2 className="text-lg font-bold text-heading min-w-0 flex items-center gap-1.5 flex-wrap">
          <span>Lobby</span>
          <span className="text-muted text-sm font-semibold">
            (<span className="num">{lobbySummary.activeCount}</span> active
            {lobbySummary.afkCount > 0 && (
              <span> / <span className="num">{lobbySummary.afkCount}</span> AFK</span>
            )}
            )
          </span>
        </h2>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAddPlayer}
            className="app-win-1 min-h-8 px-3 py-1 text-xs font-bold rounded-pill app-nowrap"
          >
            + Add
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="app-secondary min-h-8 px-3 py-1 text-xs font-bold rounded-pill app-nowrap"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="app-secondary min-h-8 px-3 py-1 text-xs font-bold rounded-pill app-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick lobby summary */}
      {lobbyBattletags.length > 0 && (
        <div className="app-well p-3.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="inline-flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">In Lobby</span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-pill bg-paper-2 text-ink-2 num">
                {lobbyBattletags.length}
              </span>
            </div>
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

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mb-2.5 text-xs">
            <span>
              <span className="font-semibold text-tank">Tank</span>{" "}
              <span className="font-semibold text-ink num">{lobbySummary.tank}</span>
            </span>
            <span>
              <span className="font-semibold text-dps">DPS</span>{" "}
              <span className="font-semibold text-ink num">{lobbySummary.dps}</span>
            </span>
            <span>
              <span className="font-semibold text-sup">Support</span>{" "}
              <span className="font-semibold text-ink num">{lobbySummary.support}</span>
            </span>
            {lobbySummary.mustCount > 0 && (
              <span className="font-semibold text-warn num">
                Must {lobbySummary.mustCount}
              </span>
            )}
            {lobbySummary.afkCount > 0 && (
              <span className="font-semibold text-muted num">
                AFK {lobbySummary.afkCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {lobbyBattletags.map((bt, idx) => {
              const isAfk = afkPlayers.has(bt);
              const isMustPlay = mustPlay.has(bt);
              const isSelected = selectedBattletag === bt;
              const name = getDisplayName(bt);
              const chipVariant = getChipVariant(bt, idx);
              return (
                <div
                  key={bt}
                  className={`group/badge inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-pill border transition-colors duration-150 ${
                    isSelected
                      ? isMustPlay
                        ? "bg-warn-soft text-warn border-warn-edge ring-2 ring-focus hover:bg-warn-fill hover:text-warn-btn-ink"
                        : "bg-pink-soft text-pink-ink border-pink-edge ring-2 ring-focus hover:bg-accent hover:text-accent-ink"
                      : isAfk
                        ? "bg-paper-2 text-muted border-rule-2 hover:bg-card-row hover:text-ink"
                        : isMustPlay
                          ? "app-chip--amber hover:bg-warn-fill hover:text-warn-btn-ink"
                          : `${chipVariant} hover:border-pink-edge`
                  }`}
                >
                  <button
                    type="button"
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
                    className="inline-flex items-center gap-1 text-left focus-visible:outline-none focus-visible:underline"
                    title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "") + " - Click to view"}
                  >
                    {isMustPlay && !isAfk && <Star className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span>{name}</span>
                    {isAfk && <span className="text-muted"> AFK</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromLobby(bt)}
                    className="inline-flex items-center justify-center ml-0.5 text-muted hover:text-bad focus-visible:text-bad focus-visible:outline-none"
                    title="Remove from lobby"
                    aria-label={`Remove ${name} from lobby`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search players or heroes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search players or heroes"
          className="app-input w-full pl-9 pr-3.5 py-2 text-xs font-semibold"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center min-w-0">
        <AppSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_FILTER_OPTIONS}
          ariaLabel="Filter by role"
        />
        <AppSelect
          value={sortBy}
          onChange={setSortBy}
          options={SORT_OPTIONS}
          ariaLabel="Sort players"
        />
        <button
          type="button"
          onClick={toggleShowWeightModifiers}
          className={`shrink-0 px-2.5 py-1.5 rounded-well text-sm ${
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
      <div ref={playerListRef} className="app-player-scroll space-y-2 max-h-[600px] overflow-y-auto py-1">
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
