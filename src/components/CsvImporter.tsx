import { useState, useCallback, useRef } from "react";
import { Download, FileSpreadsheet, FolderOpen, Gamepad2, Upload } from "lucide-react";
import { parsePlayersCSV } from "@utils/csvParser";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import {
  exportCsvFile,
  openExportFolder,
  triggerBrowserDownload,
} from "@services/csvExport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Player, GameMode, ValidationWarning } from "@engine/types";
import { CsvImportModal } from "./CsvImportModal";

// =============================================================================
// CsvImporter - Import/Export players via CSV
// =============================================================================

/** Escape a CSV field value (wrap in quotes if needed) */
function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert players to CSV content with mode-specific wins */
function playersToCSV(
  players: Player[],
  sessionWins: Record<GameMode, Map<string, number>>
): string {
  const headers = [
    "battletag",
    "tank_rank",
    "dps_rank",
    "support_rank",
    "tank_comp_rank",
    "dps_comp_rank",
    "support_comp_rank",
    "tank_6v6_rank",
    "dps_6v6_rank",
    "support_6v6_rank",
    "roles_willing",
    "role_preference",
    "hero_pool",
    "tank_one_trick",
    "dps_one_trick",
    "support_one_trick",
    "regular_comp_rank",
    "regular_6v6_rank",
    "weight_modifier",
    "notes",
    "stadium_wins",
    "regular_5v5_wins",
    "regular_6v6_wins",
  ];

  const rows = players.map((p) => {
    const stadiumTotal = (p.stadiumWins ?? 0) + (sessionWins.stadium_5v5.get(p.battletag) ?? 0);
    const regular5v5Total = (p.regular5v5Wins ?? 0) + (sessionWins.regular_5v5.get(p.battletag) ?? 0);
    const regular6v6Total = (p.regular6v6Wins ?? 0) + (sessionWins.regular_6v6.get(p.battletag) ?? 0);

    return [
      escapeCSVField(p.battletag),
      escapeCSVField(p.tankRank),
      escapeCSVField(p.dpsRank),
      escapeCSVField(p.supportRank),
      escapeCSVField(p.tankCompRank),
      escapeCSVField(p.dpsCompRank),
      escapeCSVField(p.supportCompRank),
      escapeCSVField(p.tank6v6Rank ?? null),
      escapeCSVField(p.dps6v6Rank ?? null),
      escapeCSVField(p.support6v6Rank ?? null),
      escapeCSVField(p.rolesWilling.join(",")),
      escapeCSVField(p.rolePreference.join(",")),
      escapeCSVField(p.heroPool.join(",")),
      escapeCSVField(p.tankOneTrick),
      escapeCSVField(p.dpsOneTrick),
      escapeCSVField(p.supportOneTrick),
      escapeCSVField(p.regularCompRank),
      escapeCSVField(p.regular6v6Rank ?? null),
      String(p.weightModifier || 0),
      escapeCSVField(p.notes),
      String(stadiumTotal),
      String(regular5v5Total),
      String(regular6v6Total),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

const EMPTY_PLAYERS: Player[] = [];

type PendingImport = {
  existingCount: number;
  incomingPlayers: Player[];
  missingExisting: Player[];
  warnings: ValidationWarning[];
};

export function CsvImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [modalSnapshot, setModalSnapshot] = useState<PendingImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setPlayers = usePlayerStore((state) => state.setPlayers);
  const playerCount = usePlayerStore((state) => state.players.size);
  const players = usePlayerStore((state) => state.players);
  const sessionWins = useSessionStore((state) => state.totalWins);
  const clearSessionStats = useSessionStore((state) => state.clearSessionStats);
  const clearLobby = useSessionStore((state) => state.clearLobby);
  const setLastResult = useSessionStore((state) => state.setLastResult);
  const lastResult = useSessionStore((state) => state.lastResult);
  const gameMode = useSessionStore((state) => state.gameMode);

  const [prevLastResult, setPrevLastResult] = useState(lastResult);

  // Clear success message when teams are generated (Balance/Reshuffle clicked)
  if (lastResult !== prevLastResult) {
    setPrevLastResult(lastResult);
    if (lastResult) {
      setSuccessMessage(null);
      setSuccessDetails(null);
      setShowDetails(false);
    }
  }

  const finalizeImport = useCallback(
    (
      incomingPlayers: Player[],
      keptMissingPlayers: Player[],
      warnings: ValidationWarning[]
    ) => {
      clearSessionStats();
      clearLobby();
      setLastResult(null);

      const merged = [...incomingPlayers, ...keptMissingPlayers];
      setPlayers(merged);

      const keptNote =
        keptMissingPlayers.length > 0
          ? ` (${incomingPlayers.length} from CSV + ${keptMissingPlayers.length} existing kept)`
          : "";
      const warningNote =
        warnings.length > 0
          ? ` (${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"})`
          : "";
      setSuccessMessage(
        `Imported ${merged.length} players${keptNote}${warningNote}. Session stats and lobby cleared.`
      );
      setSuccessDetails(
        warnings.length > 0
          ? warnings.map((w) => `Row ${w.row}: ${w.message}`).join("\n")
          : null
      );
      setShowDetails(warnings.length > 0);
      setPendingImport(null);
    },
    [setPlayers, clearSessionStats, clearLobby, setLastResult]
  );

  const handleImport = useCallback(
    (csvContent: string) => {
      setError(null);
      setSuccessMessage(null);
      setSuccessDetails(null);
      setShowDetails(false);

      if (!csvContent.trim()) {
        setError("No content to import");
        return;
      }

      const result = parsePlayersCSV(csvContent);

      if (result.errors.length > 0) {
        const errorMessages = result.errors
          .slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.message}`)
          .join("\n");
        setError(
          `Import errors:\n${errorMessages}${
            result.errors.length > 5
              ? `\n...and ${result.errors.length - 5} more`
              : ""
          }`
        );
        return;
      }

      if (result.valid.length === 0) {
        setError("No valid players found in CSV");
        return;
      }

      if (playerCount > 0) {
        const incomingKeys = new Set(
          result.valid.map((p) => p.battletag.toLowerCase())
        );
        const missingExisting = Array.from(players.values())
          .filter((p) => !incomingKeys.has(p.battletag.toLowerCase()))
          .sort((a, b) => a.battletag.localeCompare(b.battletag));

        const nextImport: PendingImport = {
          existingCount: playerCount,
          incomingPlayers: result.valid,
          missingExisting,
          warnings: result.warnings,
        };
        setPendingImport(nextImport);
        setModalSnapshot(nextImport);
        return;
      }

      finalizeImport(result.valid, [], result.warnings);
    },
    [playerCount, players, finalizeImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            handleImport(content);
          };
          reader.readAsText(file);
        } else {
          setError("Please drop a CSV file");
        }
      }
    },
    [handleImport]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          handleImport(content);
        };
        reader.readAsText(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleImport]
  );

  const handleDownloadTemplate = useCallback(() => {
    const templateContent = `battletag,tank_rank,dps_rank,support_rank,tank_comp_rank,dps_comp_rank,support_comp_rank,tank_6v6_rank,dps_6v6_rank,support_6v6_rank,roles_willing,role_preference,hero_pool,tank_one_trick,dps_one_trick,support_one_trick,regular_comp_rank,regular_6v6_rank,weight_modifier,notes,stadium_wins,regular_5v5_wins,regular_6v6_wins
Player1#1234,Pro 2,,Elite 3,,,,,,,"Tank,DPS","Tank,DPS","Reinhardt,D.Va,Zarya",,,,,,0,Example player,0,0,0
Player2#5678,,Pro 1,Pro 2,,,,,,,"DPS,Support","Support,DPS","Ana,Kiriko,Ashe",,,Mercy,,,0,Support one-trick,0,0,0`;

    triggerBrowserDownload("pugs-players-template.csv", templateContent);
  }, []);

  const handleLoadSampleData = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setSuccessDetails(null);

    try {
      const response = await fetch("/sample-players.csv");
      if (!response.ok) throw new Error("Failed to fetch sample data");
      const csvContent = await response.text();
      handleImport(csvContent);
    } catch (err) {
      setError("Failed to load sample data: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }, [handleImport]);

  const handleExportCSV = useCallback(async () => {
    setError(null);
    const playerArray = Array.from(players.values());
    if (playerArray.length === 0) {
      setError("No players to export");
      return;
    }

    const csvContent = playersToCSV(playerArray, sessionWins);
    const modeSlug = gameMode.replace("_", "-");
    const filename = `pugs-players-${modeSlug}-${new Date().toISOString().split("T")[0]}.csv`;

    try {
      const { location } = await exportCsvFile(filename, csvContent);
      const hasAnySessionWins = (bt: string) =>
        sessionWins.stadium_5v5.has(bt) ||
        sessionWins.regular_5v5.has(bt) ||
        sessionWins.regular_6v6.has(bt);
      const playersWithSessionWins = playerArray.filter((p) =>
        hasAnySessionWins(p.battletag),
      ).length;
      const sessionWinsMsg =
        playersWithSessionWins > 0
          ? ` (${playersWithSessionWins} with session wins)`
          : "";
      setSuccessMessage(`Exported ${playerArray.length} players${sessionWinsMsg}`);
      setSuccessDetails(`File: ${filename}\nLocation: ${location}`);
      setShowDetails(false);
    } catch (err) {
      setError(
        "Failed to export CSV: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }, [players, sessionWins, gameMode]);

  const handleOpenExportFolder = useCallback(async () => {
    setError(null);
    try {
      await openExportFolder();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-heading">Player Data</h2>
        {playerCount > 0 && (
          <Badge variant="pink" className="px-3 py-1 font-bold">
            <span className="app-measured">{playerCount}</span> players
          </Badge>
        )}
      </div>

      {/* Drop zone for import */}
      <Button
        variant="ghost"
        shape="well"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group w-full h-auto border-2 border-dashed p-5 flex-col gap-1.5 text-center whitespace-normal app-card-interactive",
          isDragging
            ? "border-accent bg-card-row text-ink"
            : "border-rule-2 hover:border-pink-edge bg-paper-3 text-ink"
        )}
      >
        <span className="size-11 mb-1 rounded-well bg-paper-2 border border-rule inline-flex items-center justify-center text-pink-ink group-hover:scale-105 transition-transform">
          <Upload aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-ink group-hover:text-pink-ink">
          Drop or click for CSV
        </span>
        <span className="text-xs text-muted font-normal">
          Supports Discord &amp; Faceit rating rosters
        </span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          size="sm"
          shape="well"
          onClick={handleExportCSV}
          disabled={playerCount === 0}
          className="py-2.5 font-bold"
        >
          <Download data-icon="inline-start" className="text-pink-ink" aria-hidden="true" />
          <span>Export</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          shape="well"
          onClick={handleDownloadTemplate}
          className="py-2.5 font-bold"
        >
          <FileSpreadsheet data-icon="inline-start" className="text-sky-ink" aria-hidden="true" />
          <span>Template</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          shape="well"
          onClick={handleOpenExportFolder}
          className="col-span-2 py-2.5 font-bold"
        >
          <FolderOpen data-icon="inline-start" className="text-sky-ink" aria-hidden="true" />
          <span>Open Export Folder</span>
        </Button>
        <Button
          variant="sky"
          size="sm"
          shape="well"
          onClick={handleLoadSampleData}
          className="col-span-2 py-2.5 font-extrabold"
        >
          <Gamepad2 data-icon="inline-start" aria-hidden="true" />
          <span>Load Sample Data</span>
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="bad" className="p-3">
          <AlertDescription className="text-bad whitespace-pre-wrap">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success message */}
      {successMessage && (
        <Alert variant="ok" className="p-3">
          <AlertDescription className="w-full text-ok">
            <div className="flex w-full items-center justify-between gap-2">
              <span>{successMessage}</span>
              {successDetails && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => setShowDetails(!showDetails)}
                        className="h-auto p-0 ml-2 text-ok underline shrink-0"
                      />
                    }
                  >
                    {showDetails ? "Hide" : "Details"}
                  </TooltipTrigger>
                  <TooltipContent>
                    {showDetails ? "Hide details" : "Show details"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {showDetails && successDetails && (
              <div className="w-full">
                <Separator className="my-2 bg-ok-edge" />
                <div className="text-xs text-ink-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {successDetails}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      <CsvImportModal
        isOpen={pendingImport !== null}
        existingCount={modalSnapshot?.existingCount ?? playerCount}
        incomingPlayers={modalSnapshot?.incomingPlayers ?? EMPTY_PLAYERS}
        missingExisting={modalSnapshot?.missingExisting ?? EMPTY_PLAYERS}
        onConfirm={(keptMissingPlayers) => {
          if (!pendingImport) return;
          finalizeImport(
            pendingImport.incomingPlayers,
            keptMissingPlayers,
            pendingImport.warnings
          );
        }}
        onCancel={() => setPendingImport(null)}
      />
    </div>
  );
}
