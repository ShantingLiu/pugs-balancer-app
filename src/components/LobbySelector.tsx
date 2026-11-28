import { useCallback, useMemo, useState, useRef, useLayoutEffect } from "react";
import { Eye, EyeOff, Pencil, Search, Star, Users, X } from "lucide-react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { PlayerCard } from "./PlayerCard";
import { AppSelect, type SelectOption } from "./AppSelect";
import { AddPlayerModal } from "./AddPlayerModal";
import { WeightAdjuster } from "./WeightAdjuster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@utils/heroUtils";
import type { Player, LobbyPlayer, Role } from "@engine/types";

type SortOption = "name" | "rank-desc" | "rank-asc" | "role";

const STITCH_CHIP_VARIANTS = [
  "pink",
  "sky",
  "purple",
  "emerald",
  "slate",
  "amber",
] as const;

type ChipVariant = (typeof STITCH_CHIP_VARIANTS)[number];

function getChipVariant(battletag: string, index: number): ChipVariant {
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

  return (
    <>
      {allPlayers.length === 0 ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No players loaded</EmptyTitle>
            <EmptyDescription>
              Import players first to build your lobby
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="primary" onClick={handleAddPlayer}>
              + Add Player Manually
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
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
            <Button variant="win1" size="sm" onClick={handleAddPlayer} className="min-h-8 py-1 font-bold">
              + Add
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSelectAll} className="min-h-8 py-1 font-bold">
              All
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClearAll} className="min-h-8 py-1 font-bold">
              Clear
            </Button>
          </div>
        </div>

        {/* Quick lobby summary */}
        {lobbyBattletags.length > 0 && (
          <Card variant="well" className="p-3.5 gap-2">
            <CardHeader className="p-0 flex-row items-center justify-between gap-2">
              <CardTitle className="inline-flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-wider">
                <span>In Lobby</span>
                <Badge className="bg-paper-2 border-transparent px-2 font-bold num">
                  {lobbyBattletags.length}
                </Badge>
              </CardTitle>
              {selectedBattletag && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedBattletag(null)}
                  className="h-auto p-0 text-pink-ink"
                >
                  Clear selection
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
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

                  const badgeVariant: BadgeProps["variant"] = isSelected
                    ? isMustPlay
                      ? "warn"
                      : "pink"
                    : isAfk
                      ? "muted"
                      : isMustPlay
                        ? "amber"
                        : chipVariant;

                  return (
                    <Badge
                      key={bt}
                      variant={badgeVariant}
                      className={cn(
                        "group/badge py-1",
                        isSelected
                          ? isMustPlay
                            ? "ring-2 ring-focus hover:bg-warn-fill hover:text-warn-btn-ink"
                            : "ring-2 ring-focus hover:bg-accent hover:text-accent-ink"
                          : isAfk
                            ? "bg-paper-2 border-rule-2 hover:bg-card-row hover:text-ink"
                            : isMustPlay
                              ? "hover:bg-warn-fill hover:text-warn-btn-ink"
                              : "hover:border-pink-edge"
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger
                          render={
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
                            />
                          }
                        >
                          {isMustPlay && !isAfk && <Star className="size-3 shrink-0" aria-hidden="true" />}
                          <span>{name}</span>
                          {isAfk && <span className="text-muted"> AFK</span>}
                        </TooltipTrigger>
                        <TooltipContent>
                          {`${bt}${isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : ""} - Click to view`}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => removeFromLobby(bt)}
                              className="inline-flex items-center justify-center ml-0.5 text-muted hover:text-bad focus-visible:text-bad focus-visible:outline-none"
                              aria-label={`Remove ${name} from lobby`}
                            />
                          }
                        >
                          <X className="size-3" aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Remove from lobby</TooltipContent>
                      </Tooltip>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            placeholder="Search players or heroes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search players or heroes"
            className="text-xs font-semibold"
          />
          {searchTerm && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <X aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showWeightModifiers ? "sky" : "quiet"}
                  size="icon-sm"
                  shape="well"
                  onClick={toggleShowWeightModifiers}
                  aria-label={showWeightModifiers ? "Hide weight modifiers" : "Show weight modifiers"}
                />
              }
            >
              {showWeightModifiers ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </TooltipTrigger>
            <TooltipContent>
              {showWeightModifiers ? "Hide weight modifiers" : "Show weight modifiers"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Player count indicator */}
        {lobbyBattletags.length - afkPlayers.size < 10 && (
          <Alert variant="warn" className="px-3 py-2">
            <AlertDescription className="font-semibold text-warn">
              Need at least 10 active players ({10 - (lobbyBattletags.length - afkPlayers.size)} more)
            </AlertDescription>
          </Alert>
        )}

        {/* Player list */}
        <div ref={playerListRef} className="app-player-scroll flex flex-col gap-2 max-h-[600px] overflow-y-auto py-1">
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
                className={cn(
                  "relative group rounded-well",
                  selectedBattletag === player.battletag && "ring-2 ring-focus"
                )}
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
                  headerAction={
                    inLobby ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              shape="pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveScrollPosition();
                                removeFromLobby(player.battletag);
                              }}
                              className="size-6 ml-0.5 text-muted hover:bg-bad-soft hover:text-bad focus-visible:text-bad"
                              aria-label={`Remove ${getDisplayName(player.battletag)} from lobby`}
                            />
                          }
                        >
                          <X aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Remove from lobby</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              shape="pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPlayer(player.battletag);
                              }}
                              className="size-6 ml-0.5 text-muted hover:bg-sky-soft hover:text-sky-ink focus-visible:text-sky-ink"
                              aria-label={`Edit ${getDisplayName(player.battletag)}`}
                            />
                          }
                        >
                          <Pencil aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Edit player</TooltipContent>
                      </Tooltip>
                    )
                  }
                />
              </div>
            );
          })}
        </div>

        </div>
      )}

      {/* Add/Edit Player Modal */}
      <AddPlayerModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        editPlayer={editingPlayer}
      />

      {/* Weight Adjuster Modal */}
      <WeightAdjuster
        player={weightAdjustPlayer}
        onClose={() => setWeightAdjustPlayer(null)}
      />
    </>
  );
}
