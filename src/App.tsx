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
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <header className="app-toolbar px-6 py-3">
        <div className="container flex items-center justify-between gap-6 px-0">
          <div className="min-w-0">
            <h1 className="text-xl font-medium">
              Swoo’s PUGs Balancer
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSheetSetup(true)}
              className="app-secondary px-3 py-2 text-sm font-medium"
            >
              Sheets
            </button>
            <SyncButton onClick={handleSync} />
            <ModeSelector />
            <button
              onClick={cycleFontScale}
              className="app-secondary px-3 py-2 text-sm font-medium min-w-10"
              aria-label={`Font size: ${fontScale} (click to cycle)`}
              title={`Font size: ${fontScale} (click to cycle)`}
            >
              {fontLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Sync error / info toast */}
      {syncError && (
        <div className="container pt-3">
          <div
            className={`px-3 py-2 text-sm flex items-center justify-between ${
              syncError === "Everything is up to date."
                ? "app-alert-success"
                : "app-alert-error"
            }`}
          >
            <span>
              {syncError.includes("sign in") ? (
                <>
                  Please{" "}
                  <button
                    onClick={() => { setSyncError(null); setShowSheetSetup(true); }}
                    className="underline text-accent font-medium"
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
              className="ml-4 text-muted hover:text-ink"
              aria-label="Dismiss sync message"
            >
              Dismiss
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
      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: Import & Lobby (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <section className="app-surface p-4">
              <CsvImporter />
            </section>
            <section className="app-surface p-4">
              <LobbySelector />
            </section>
          </div>

          {/* Center/Right: Balance + Team Composition + Constraints (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Draft/Balance toggle */}
            <nav className="app-surface flex gap-1 p-1" aria-label="Team planning mode">
              <button
                onClick={() => setDraftMode(false)}
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  !draftMode
                    ? "app-primary"
                    : "text-muted hover:text-ink"
                }`}
              >
                Balance
              </button>
              <button
                onClick={() => setDraftMode(true)}
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  draftMode
                    ? "app-primary"
                    : "text-muted hover:text-ink"
                }`}
              >
                Draft
              </button>
            </nav>

            {draftMode ? (
              <section className="app-surface p-4">
                <DraftView />
              </section>
            ) : (
              <>
                <section className="app-surface p-3">
                  <BalanceButton />
                </section>
                <section className="app-surface p-4">
                  <TeamDisplay result={lastResult} />
                </section>
              </>
            )}
            <SpectatorsList />
            <section className="app-surface p-4">
              <ConstraintsPanel />
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="app-surface p-4">
                <StatsPanel />
              </section>
              <section className="app-surface p-4">
                <Leaderboard />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
