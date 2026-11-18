import { useState, useEffect, useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { CsvImporter } from "@components/CsvImporter";
import { LobbySelector } from "@components/LobbySelector";
import { TeamDisplay } from "@components/TeamDisplay";
import { BalanceButton } from "@components/BalanceButton";
import { ConstraintsPanel } from "@components/ConstraintsPanel";
import { StatsPanel } from "@components/StatsPanel";
import { Leaderboard } from "@components/Leaderboard";
import { SpectatorsList } from "@components/SpectatorsList";
import { ModeSelector } from "@components/ModeSelector";
import { LayoutSelector } from "@components/LayoutSelector";
import { SyncButton } from "@components/SyncButton";
import { SyncDiffModal } from "@components/SyncDiffModal";
import { SheetSetupModal } from "@components/SheetSetupModal";
import { DraftView } from "@components/DraftView";
import { UpdateBanner } from "@components/UpdateBanner";
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
  const layoutMode = useSessionStore((state) => state.layoutMode);
  const colorMode = useSessionStore((state) => state.colorMode);
  const toggleColorMode = useSessionStore((state) => state.toggleColorMode);
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

  // Scale root font size so ALL rem-based Tailwind classes scale up cleanly
  useEffect(() => {
    const sizes = { normal: "16px", large: "20px", "x-large": "24px" };
    document.documentElement.style.fontSize = sizes[fontScale];
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [fontScale]);

  // Sync light/dark color mode to root dataset
  useEffect(() => {
    document.documentElement.dataset.mode = colorMode;
  }, [colorMode]);

  const fontLabel = fontScale === "large" ? "A+" : fontScale === "x-large" ? "A++" : "A";
  const isDark = colorMode === "dark";

  const importerSection = (
    <section className="app-surface p-5">
      <CsvImporter />
    </section>
  );

  const lobbySection = (
    <div>
      <section className="app-surface p-5">
        <LobbySelector />
      </section>
      <p className="text-xs text-footer-note text-center mt-2">
        © {new Date().getFullYear()} Swoo
      </p>
    </div>
  );

  const workspaceSection = (
    <>
      <nav
        className="app-well flex gap-1.5 p-1.5 rounded-pill"
        aria-label="Team planning mode"
      >
        <button
          type="button"
          onClick={() => setDraftMode(false)}
          className={`flex-1 py-2 px-4 rounded-pill text-sm font-semibold ${
            !draftMode
              ? "app-primary"
              : "text-sky-ink hover:bg-card-row"
          }`}
        >
          Balance
        </button>
        <button
          type="button"
          onClick={() => setDraftMode(true)}
          className={`flex-1 py-2 px-4 rounded-pill text-sm font-semibold ${
            draftMode
              ? "app-sky"
              : "text-sky-ink hover:bg-card-row"
          }`}
        >
          Draft
        </button>
      </nav>

      {draftMode ? (
        <section className="app-surface p-5">
          <DraftView />
        </section>
      ) : (
        <>
          <div>
            <BalanceButton />
          </div>
          <section className="app-surface p-5">
            <TeamDisplay result={lastResult} />
          </section>
        </>
      )}

      <SpectatorsList />
    </>
  );

  const constraintsSection = (
    <section className="app-surface p-5">
      <ConstraintsPanel />
    </section>
  );

  const statsSection = (
    <section className="app-surface p-5">
      <StatsPanel />
    </section>
  );

  const leaderboardSection = (
    <section className="app-surface p-5">
      <Leaderboard />
    </section>
  );

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="app-toolbar py-3">
        <div className="container flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-pill bg-pink-soft border border-pink-edge shrink-0"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 6.8C10.5 4.3 7.5 3.8 5.4 5.2C3.2 6.7 2.8 9.9 4.2 12.6C5.8 15.6 9.6 18.4 12 20.2C14.4 18.4 18.2 15.6 19.8 12.6C21.2 9.9 20.8 6.7 18.6 5.2C16.5 3.8 13.5 4.3 12 6.8Z"
                  fill="var(--color-wordmark)"
                />
              </svg>
            </span>
            <h1 className="text-xl font-semibold text-wordmark truncate">
              Swoo’s PUGs Balancer
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSheetSetup(true)}
              className="app-secondary px-3.5 py-2 rounded-pill text-sm font-semibold"
            >
              Sheets
            </button>
            <SyncButton onClick={handleSync} />
            <ModeSelector />
            <LayoutSelector />
            <button
              type="button"
              onClick={toggleColorMode}
              className="app-secondary p-2 rounded-pill text-sm font-semibold"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-warn" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-sky-ink" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={cycleFontScale}
              className="app-secondary px-3 py-2 rounded-pill text-sm font-semibold min-w-10"
              title={`Font size: ${fontScale} (click to cycle)`}
            >
              {fontLabel}
            </button>
          </div>
        </div>
      </header>

      <UpdateBanner />

      {/* Sync error / info toast */}
      {syncError && (
        <div className="container pt-4">
          <div
            className={`px-4 py-2.5 rounded-well text-sm flex items-center justify-between border ${
              syncError === "Everything is up to date."
                ? "border-ok-edge text-ok bg-ok-soft"
                : "border-bad-edge text-bad bg-bad-soft"
            }`}
          >
            <span>
              {syncError.includes("sign in") ? (
                <>
                  Please{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSyncError(null);
                      setShowSheetSetup(true);
                    }}
                    className="underline font-semibold text-sky-ink"
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
              type="button"
              onClick={() => setSyncError(null)}
              className="ml-4 font-semibold underline"
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

      {/* Main workbench */}
      <main className="container py-6">
        {layoutMode === "wide-teams" ? (
          <div className="space-y-6">
            <div className="space-y-5">{workspaceSection}</div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-5">
                {importerSection}
                {lobbySection}
              </div>
              <div className="lg:col-span-7 space-y-5">
                {constraintsSection}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {statsSection}
                  {leaderboardSection}
                </div>
              </div>
            </div>
          </div>
        ) : layoutMode === "three-col" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 xl:col-span-3 space-y-5">
              {importerSection}
              {lobbySection}
            </div>
            <div className="lg:col-span-8 xl:col-span-6 space-y-5">
              {workspaceSection}
            </div>
            <div className="lg:col-span-12 xl:col-span-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-5">
              {constraintsSection}
              {statsSection}
              {leaderboardSection}
            </div>
          </div>
        ) : layoutMode === "teams-left" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-5">
              {workspaceSection}
              {constraintsSection}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {statsSection}
                {leaderboardSection}
              </div>
            </div>
            <div className="lg:col-span-4 space-y-5">
              {importerSection}
              {lobbySection}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-5">
              {importerSection}
              {lobbySection}
            </div>
            <div className="lg:col-span-8 space-y-5">
              {workspaceSection}
              {constraintsSection}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {statsSection}
                {leaderboardSection}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
