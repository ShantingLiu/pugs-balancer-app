import { useState, useCallback, useRef, useEffect } from "react";
import { parsePlayersCSV } from "@utils/csvParser";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { Player, GameMode } from "@engine/types";

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
    // Calculate total wins per mode = CSV baseline + session wins
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

      // Confirm before replacing existing players
      if (playerCount > 0) {
        const confirmed = window.confirm(
          `This will replace ${playerCount} existing player(s) with ${result.valid.length} new player(s) and clear session stats. Continue?`
        );
        if (!confirmed) return;
      }

      // Clear session state when importing new CSV
      clearSessionStats();
      clearLobby();
      setLastResult(null);

      setPlayers(result.valid);
      setSuccessMessage(
        `Imported ${result.valid.length} players${
          result.warnings.length > 0
            ? ` (${result.warnings.length} warnings)`
            : ""
        }. Session stats and lobby cleared.`
      );
    },
    [setPlayers, playerCount, clearSessionStats, clearLobby, setLastResult]
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
      // Reset input so same file can be selected again
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
    // Include mode in filename (e.g., "pugs-players-stadium-2026-03-06.csv")
    const modeSlug = gameMode.replace("_", "-");
    const filename = `pugs-players-${modeSlug}-${new Date().toISOString().split("T")[0]}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Count how many players have session wins (across all modes)
    const hasAnySessionWins = (bt: string) => 
      sessionWins.stadium_5v5.has(bt) || 
      sessionWins.regular_5v5.has(bt) || 
      sessionWins.regular_6v6.has(bt);
    const playersWithSessionWins = playerArray.filter(p => hasAnySessionWins(p.battletag)).length;
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Player Data</h2>
        {playerCount > 0 && (
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
            {playerCount} players
          </span>
        )}
      </div>

      {/* Drop zone for import */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
          flex flex-col items-center justify-center gap-2
          ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 hover:border-blue-400 hover:bg-gray-800/50"
          }
        `}
      >
        <div className="text-2xl">📁</div>
        <div className="text-sm text-gray-300 font-medium">
          Drop CSV file or click to import
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Action buttons - 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExportCSV}
          disabled={playerCount === 0}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            playerCount === 0
              ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          <span>📤</span>
          <span>Export</span>
        </button>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <span>📋</span>
          <span>Template</span>
        </button>
        <button
          onClick={handleLoadSampleData}
          className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          <span>🎮</span>
          <span>Load Sample Data</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-3 bg-green-900/50 border border-green-700 rounded-lg text-sm text-green-300">
          <div className="flex items-center justify-between">
            <span>{successMessage}</span>
            {successDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="ml-2 text-green-400 hover:text-green-200 transition-colors"
                title={showDetails ? "Hide details" : "Show details"}
              >
                {showDetails ? "▲" : "ℹ️"}
              </button>
            )}
          </div>
          {showDetails && successDetails && (
            <div className="mt-2 pt-2 border-t border-green-700/50 text-xs text-green-400 whitespace-pre-wrap">
              {successDetails}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
