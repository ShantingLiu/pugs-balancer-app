import { useState, useEffect, useCallback, useRef } from "react";
import { CsvImporter } from "@components/CsvImporter";
import { LobbySelector } from "@components/LobbySelector";
import { TeamDisplay } from "@components/TeamDisplay";
import { BalanceButton } from "@components/BalanceButton";
import { ConstraintsPanel } from "@components/ConstraintsPanel";
import { StatsPanel } from "@components/StatsPanel";
import { Leaderboard } from "@components/Leaderboard";
import { SpectatorsList } from "@components/SpectatorsList";
import { ModeSelector } from "@components/ModeSelector";
import { SyncButton } from "@components/SyncButton";
import { SyncDiffModal } from "@components/SyncDiffModal";
import { SheetSetupModal } from "@components/SheetSetupModal";
import { DraftView } from "@components/DraftView";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import { useTheme } from "@hooks/useTheme";
import { performSync, applySyncResult } from "@services/sheetSync";
import { initAuth } from "@services/googleAuth";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@config/google";
import { handleSyncError } from "@utils/handleSyncError";
import type { SyncDiff } from "@services/diffEngine";

function App() {
  const lastResult = useSessionStore((state) => state.lastResult);
  const draftMode = useSessionStore((state) => state.draftMode);
  const setDraftMode = useSessionStore((state) => state.setDraftMode);
  const fontScale = useSessionStore((state) => state.fontScale);
  const cycleFontScale = useSessionStore((state) => state.cycleFontScale);
  const theme = useTheme();
  const spreadsheetId = useSheetStore((s) => s.spreadsheetId);

  const [syncDiff, setSyncDiff] = useState<SyncDiff | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showSheetSetup, setShowSheetSetup] = useState(false);

  // P1-042: Restore auth state silently on app launch
  useEffect(() => {
    initAuth(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).catch(() => {});
  }, []);

  // P1-041: Sync button click handler
  const handleSync = useCallback(async () => {
    if (!spreadsheetId || syncing) return;
    setSyncError(null);
    setSyncing(true);
    try {
      const diff = await performSync(spreadsheetId);
      if (!diff.hasChanges) {
        setSyncError("Everything is up to date.");
      } else {
        setSyncDiff(diff);
      }
    } catch (err: unknown) {
      setSyncError(handleSyncError(err));
    } finally {
      setSyncing(false);
    }
  }, [spreadsheetId, syncing]);

  // Auto-sync when a sheet is first connected
  const prevSpreadsheetId = useRef<string | null>(null);
  useEffect(() => {
    if (spreadsheetId && !prevSpreadsheetId.current) {
      handleSync();
    }
    prevSpreadsheetId.current = spreadsheetId;
  }, [spreadsheetId, handleSync]);

  const handleApplySync = useCallback(
    async (resolved: SyncDiff) => {
      if (!spreadsheetId) return;
      setSyncDiff(null);
      try {
        await applySyncResult(spreadsheetId, resolved);
      } catch (err: unknown) {
        setSyncError(handleSyncError(err));
      }
    },
    [spreadsheetId],
  );

  // Scale root font size so ALL rem-based Tailwind classes (text-xs, text-sm, etc.) scale up
  useEffect(() => {
    const sizes = { normal: "16px", large: "20px", "x-large": "24px" };
    document.documentElement.style.fontSize = sizes[fontScale];
    return () => { document.documentElement.style.fontSize = ""; };
  }, [fontScale]);

  const fontLabel = fontScale === "large" ? "A+" : fontScale === "x-large" ? "A++" : "A";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className={`${theme.header.bg} border-b ${theme.header.border} px-6 py-4 transition-colors`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Swoo's PUGs Balancer
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSheetSetup(true)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Sheets ▼
            </button>
            <SyncButton onClick={handleSync} />
            <ModeSelector />
            <button
              onClick={cycleFontScale}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold min-w-[40px] transition-colors"
              title={`Font size: ${fontScale} (click to cycle)`}
            >
              {fontLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Sync error / info toast */}
      {syncError && (
        <div className="max-w-7xl mx-auto px-6 pt-3">
          <div
            className={`p-3 rounded-lg text-sm flex items-center justify-between ${
              syncError === "Everything is up to date."
                ? "bg-green-900/40 border border-green-600 text-green-300"
                : "bg-red-900/40 border border-red-500 text-red-300"
            }`}
          >
            <span>
              {syncError.includes("sign in") ? (
                <>
                  Please{" "}
                  <button
                    onClick={() => { setSyncError(null); setShowSheetSetup(true); }}
                    className="underline text-blue-400 hover:text-blue-300"
                  >
                    sign in with Google
                  </button>
                  {" "}to sync.
                </>
              ) : (
                syncError
              )}
            </span>
            <button
              onClick={() => setSyncError(null)}
              className="ml-4 text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sheet setup modal */}
      {showSheetSetup && (
        <SheetSetupModal onClose={() => setShowSheetSetup(false)} />
      )}

      {/* Sync diff modal */}
      {syncDiff && (
        <SyncDiffModal
          diff={syncDiff}
          onApply={handleApplySync}
          onCancel={() => setSyncDiff(null)}
        />
      )}

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: Import & Lobby (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <CsvImporter />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <LobbySelector />
            </div>
          </div>

          {/* Center/Right: Balance + Team Composition + Constraints (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Draft/Balance toggle */}
            <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 border border-gray-700">
              <button
                onClick={() => setDraftMode(false)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  !draftMode
                    ? "bg-gray-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                ⚖️ Balance
              </button>
              <button
                onClick={() => setDraftMode(true)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  draftMode
                    ? "bg-gray-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                👥 Draft
              </button>
            </div>

            {draftMode ? (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4">Captain Draft</h2>
                <DraftView />
              </div>
            ) : (
              <>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <BalanceButton />
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <h2 className="text-lg font-semibold mb-4">Team Composition</h2>
                  <TeamDisplay result={lastResult} />
                </div>
              </>
            )}
            <SpectatorsList />
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <ConstraintsPanel />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <StatsPanel />
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <Leaderboard />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;