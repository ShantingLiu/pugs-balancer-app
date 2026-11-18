import { useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";

// =============================================================================
// SpectatorsList - Shows players sitting out / spectating the current match
// =============================================================================

const STITCH_CHIP_VARIANTS = [
  "app-chip--sky",
  "app-chip--slate",
  "app-chip--purple",
  "app-chip--slate",
  "app-chip--amber",
  "app-chip--pink",
  "app-chip--emerald",
] as const;

function getSpectatorChipVariant(battletag: string, index: number): string {
  let hash = index;
  for (let i = 0; i < battletag.length; i++) {
    hash = (hash * 31 + battletag.charCodeAt(i)) >>> 0;
  }
  return STITCH_CHIP_VARIANTS[hash % STITCH_CHIP_VARIANTS.length];
}

export function SpectatorsList() {
  const lastResult = useSessionStore((state) => state.lastResult);
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const afkPlayers = useSessionStore((state) => state.afkPlayers);
  const mustPlay = useSessionStore((state) => state.mustPlay);
  const draftMode = useSessionStore((state) => state.draftMode);
  const lockedTeam1 = useSessionStore((state) => state.lockedTeam1);
  const lockedTeam2 = useSessionStore((state) => state.lockedTeam2);

  const spectators = useMemo(() => {
    if (draftMode) {
      if (lockedTeam1.size === 0 && lockedTeam2.size === 0) return [];
      return lobbyBattletags.filter(
        (bt) => !lockedTeam1.has(bt) && !lockedTeam2.has(bt)
      );
    }

    if (!lastResult || lastResult.team1.length === 0) {
      return [];
    }

    const playingBattletags = new Set([
      ...lastResult.team1.map((ra) => ra.player.battletag),
      ...lastResult.team2.map((ra) => ra.player.battletag),
    ]);

    return lobbyBattletags.filter((bt) => !playingBattletags.has(bt));
  }, [lastResult, lobbyBattletags, draftMode, lockedTeam1, lockedTeam2]);

  const hasTeams = draftMode
    ? lockedTeam1.size > 0 || lockedTeam2.size > 0
    : lastResult && lastResult.team1.length > 0;
  if (!hasTeams || spectators.length === 0) {
    return null;
  }

  return (
    <section className="app-surface p-5">
      <h2 className="text-sm font-bold text-ink-2 mb-3 flex items-center gap-2">
        <span>Sitting Out / Spectating</span>
        <span className="text-xs px-2 py-0.5 rounded-pill bg-paper-3 text-muted border border-rule font-semibold">
          ({spectators.length})
        </span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {spectators.map((bt, idx) => {
          const name = bt.split("#")[0];
          const isAfk = afkPlayers.has(bt);
          const isMustPlay = mustPlay.has(bt) || (draftMode && !isAfk);
          const chipVariant = getSpectatorChipVariant(bt, idx);
          return (
            <span
              key={bt}
              className={`px-3 py-1 text-xs font-semibold rounded-pill border ${
                isAfk
                  ? "bg-paper-3 border-rule text-muted"
                  : isMustPlay
                  ? "app-chip--amber"
                  : chipVariant
              }`}
              title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "")}
            >
              {name}
              {isAfk && <span className="text-muted ml-1">AFK</span>}
            </span>
          );
        })}
      </div>
    </section>
  );
}
