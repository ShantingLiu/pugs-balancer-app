import { useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// SpectatorsList - Shows players sitting out / spectating the current match
// =============================================================================

const STITCH_CHIP_VARIANTS = [
  "sky",
  "slate",
  "purple",
  "slate",
  "amber",
  "pink",
  "emerald",
] as const satisfies readonly NonNullable<BadgeProps["variant"]>[];

function getSpectatorChipVariant(
  battletag: string,
  index: number
): (typeof STITCH_CHIP_VARIANTS)[number] {
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
    <Card variant="surface" className="p-5 gap-3" role="region" aria-label="Sitting Out / Spectating">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-bold text-ink-2 flex items-center gap-2">
          <span>Sitting Out / Spectating</span>
          <Badge variant="muted">({spectators.length})</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-wrap gap-2">
          {spectators.map((bt, idx) => {
            const name = bt.split("#")[0];
            const isAfk = afkPlayers.has(bt);
            const isMustPlay = mustPlay.has(bt) || (draftMode && !isAfk);
            const chipVariant = getSpectatorChipVariant(bt, idx);
            const variant: BadgeProps["variant"] = isAfk
              ? "muted"
              : isMustPlay
              ? "amber"
              : chipVariant;
            const tooltipLabel = `${bt}${isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : ""}`;

            return (
              <Tooltip key={bt}>
                <TooltipTrigger render={<Badge variant={variant} className="px-3 py-1" />}>
                  {name}
                  {isAfk && <span className="text-muted">AFK</span>}
                </TooltipTrigger>
                <TooltipContent>{tooltipLabel}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
