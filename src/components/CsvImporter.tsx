import { useState, useCallback, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, Gamepad2, Upload } from "lucide-react";
import { parsePlayersCSV } from "@utils/csvParser";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { Player, GameMode } from "@engine/types";
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
    "roles_willing",
    "role_preference",
    "hero_pool",
    "tank_one_trick",
    "dps_one_trick",
    "support_one_trick",
    "regular_comp_rank",
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
      escapeCSVField(p.rolesWilling.join(",")),
      escapeCSVField(p.rolePreference.join(",")),
      escapeCSVField(p.heroPool.join(",")),
      escapeCSVField(p.tankOneTrick),
      escapeCSVField(p.dpsOneTrick),
      escapeCSVField(p.supportOneTrick),
      escapeCSVField(p.regularCompRank),
      String(p.weightModifier || 0),
      escapeCSVField(p.notes),
      String(stadiumTotal),
      String(regular5v5Total),
      String(regular6v6Total),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function CsvImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    incomingPlayers: Player[];
    missingExisting: Player[];
    warningCount: number;
  } | null>(null);
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

  // Clear success message when teams are generated (Balance/Reshuffle clicked)
  useEffect(() => {
    if (lastResult) {
      setSuccessMessage(null);
      setSuccessDetails(null);
    }
  }, [lastResult]);

  const finalizeImport = useCallback(
    (incomingPlayers: Player[], keptMissingPlayers: Player[], warningCount: number) => {
      clearSessionStats();
      clearLobby();
      setLastResult(null);

      const merged = [...incomingPlayers, ...keptMissingPlayers];
      setPlayers(merged);

      const keptNote =
        keptMissingPlayers.length > 0
          ? ` (${incomingPlayers.length} from CSV + ${keptMissingPlayers.length} existing kept)`
          : "";
      const warningNote = warningCount > 0 ? ` (${warningCount} warnings)` : "";
      setSuccessMessage(
        `Imported ${merged.length} players${keptNote}${warningNote}. Session stats and lobby cleared.`
      );
      setPendingImport(null);
    },
    [setPlayers, clearSessionStats, clearLobby, setLastResult]
  );

  const handleImport = useCallback(
    (csvContent: string) => {
      setError(null);
      setSuccessMessage(null);
      setSuccessDetails(null);

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

        setPendingImport({
          incomingPlayers: result.valid,
          missingExisting,
          warningCount: result.warnings.length,
        });
        return;
      }

      finalizeImport(result.valid, [], result.warnings.length);
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
    const templateContent = `battletag,tank_rank,dps_rank,support_rank,tank_comp_rank,dps_comp_rank,support_comp_rank,roles_willing,role_preference,hero_pool,tank_one_trick,dps_one_trick,support_one_trick,regular_comp_rank,weight_modifier,notes,stadium_wins,regular_5v5_wins,regular_6v6_wins
Player1#1234,Pro 2,,Elite 3,,,,"Tank,DPS","Tank,DPS","Reinhardt,D.Va,Zarya",,,,0,Example player,0,0,0
Player2#5678,,Pro 1,Pro 2,,,,"DPS,Support","Support,DPS","Ana,Kiriko,Ashe",,,Mercy,,0,Support one-trick,0,0,0`;

    const blob = new Blob([templateContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pugs-players-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const handleExportCSV = useCallback(() => {
    const playerArray = Array.from(players.values());
    if (playerArray.length === 0) {
      setError("No players to export");
      return;
    }

    const csvContent = playersToCSV(playerArray, sessionWins);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const modeSlug = gameMode.replace("_", "-");
    const filename = `pugs-players-${modeSlug}-${new Date().toISOString().split("T")[0]}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const hasAnySessionWins = (bt: string) =>
      sessionWins.stadium_5v5.has(bt) ||
      sessionWins.regular_5v5.has(bt) ||
      sessionWins.regular_6v6.has(bt);
    const playersWithSessionWins = playerArray.filter((p) => hasAnySessionWins(p.battletag)).length;
    const sessionWinsMsg = playersWithSessionWins > 0
      ? ` (${playersWithSessionWins} with session wins)`
      : "";
    setSuccessMessage(`Exported ${playerArray.length} players${sessionWinsMsg}`);
    setSuccessDetails(`File: ${filename}\nLocation: Downloads folder`);
    setShowDetails(false);
  }, [players, sessionWins, gameMode]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-heading">Player Data</h2>
        {playerCount > 0 && (
          <span className="text-xs font-semibold text-sky-ink bg-sky-soft border border-sky-edge px-2.5 py-0.5 rounded-pill app-measured">
            {playerCount} players
          </span>
        )}
      </div>

      {/* Drop zone for import */}
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-well p-5 flex flex-col items-center justify-center gap-2 app-nowrap app-card-interactive ${
          isDragging
            ? "border-accent bg-card-row text-ink"
            : "border-sky-edge bg-paper-3 text-ink-2"
        }`}
      >
        <Upload className="h-5 w-5 text-sky-ink" aria-hidden="true" />
        <span className="text-sm font-semibold">Drop or click for CSV</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action buttons - 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={playerCount === 0}
          className="app-secondary flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-pill"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export</span>
        </button>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="app-secondary flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-pill"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          <span>Template</span>
        </button>
        <button
          type="button"
          onClick={handleLoadSampleData}
          className="app-sky col-span-2 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-pill"
        >
          <Gamepad2 className="h-4 w-4" aria-hidden="true" />
          <span>Load Sample Data</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-bad-soft border border-bad-edge rounded-well text-sm text-bad whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-3 bg-ok-soft border border-ok-edge rounded-well text-sm text-ok">
          <div className="flex items-center justify-between gap-2">
            <span>{successMessage}</span>
            {successDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="ml-2 font-semibold underline shrink-0"
                title={showDetails ? "Hide details" : "Show details"}
              >
                {showDetails ? "Hide" : "Details"}
              </button>
            )}
          </div>
          {showDetails && successDetails && (
            <div className="mt-2 pt-2 border-t border-ok-edge text-xs text-ink-2 whitespace-pre-wrap">
              {successDetails}
            </div>
          )}
        </div>
      )}
      {pendingImport && (
        <CsvImportModal
          existingCount={playerCount}
          incomingPlayers={pendingImport.incomingPlayers}
          missingExisting={pendingImport.missingExisting}
          onConfirm={(keptMissingPlayers) =>
            finalizeImport(
              pendingImport.incomingPlayers,
              keptMissingPlayers,
              pendingImport.warningCount
            )
          }
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}
