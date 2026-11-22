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
import { HeaderMenu } from "@components/HeaderMenu";
import { SyncDiffModal } from "@components/SyncDiffModal";
import { SheetSetupModal } from "@components/SheetSetupModal";
import { DraftView } from "@components/DraftView";
import { UpdateBanner } from "@components/UpdateBanner";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import { useTheme } from "@hooks/useTheme";
import { MODE_CONFIGS } from "@engine/modeConfig";
import { APP_VERSION } from "@config/appInfo";
import { performSync, applySyncResult } from "@services/sheetSync";
import type { Update } from "@services/updater";
import { initAuth } from "@services/googleAuth";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@config/google";
import { handleSyncError } from "@utils/handleSyncError";
import type { SyncDiff } from "@services/diffEngine";

function App() {
  const lastResult = useSessionStore((state) => state.lastResult);
  const draftMode = useSessionStore((state) => state.draftMode);
  const setDraftMode = useSessionStore((state) => state.setDraftMode);
  const fontScale = useSessionStore((state) => state.fontScale);
  const layoutMode = useSessionStore((state) => state.layoutMode);
  const colorMode = useSessionStore((state) => state.colorMode);
  const setColorMode = useSessionStore((state) => state.setColorMode);
  const gameMode = useSessionStore((state) => state.gameMode);
  const theme = useTheme();
  const spreadsheetId = useSheetStore((s) => s.spreadsheetId);

  const [syncDiff, setSyncDiff] = useState<SyncDiff | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showSheetSetup, setShowSheetSetup] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  const handleUpdateFound = useCallback((found: Update) => {
    setPendingUpdate((prev) => {
      if (prev && prev !== found) {
        void prev.close().catch(() => {});
      }
      return found;
    });
  }, []);

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

  const currentModeLabel = MODE_CONFIGS[gameMode].label;

  const importerSection = (
    <section className="app-surface p-5">
      <CsvImporter />
    </section>
  );

  const lobbySection = (
    <section className="app-surface p-5">
      <LobbySelector />
      <div className="mt-4 pt-3 border-t border-rule text-center">
        <p className="text-xs text-footer-note">
          © {new Date().getFullYear()} Swoo • PUGs Match Engine
        </p>
      </div>
    </section>
  );

  const workspaceSection = (
    <>
      <nav
        className="app-surface flex gap-1.5 p-1.5 rounded-pill"
        aria-label="Team planning mode"
      >
        <button
          type="button"
          onClick={() => setDraftMode(false)}
          className={`flex-1 py-2.5 px-4 rounded-pill text-sm font-bold ${
            !draftMode
              ? "app-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          Balance
        </button>
        <button
          type="button"
          onClick={() => setDraftMode(true)}
          className={`flex-1 py-2.5 px-4 rounded-pill text-sm font-bold ${
            draftMode
              ? "app-sky"
              : "text-muted hover:text-ink"
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
          <TeamDisplay result={lastResult} />
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
    <div className="app-shell min-h-dvh bg-paper text-ink flex flex-col justify-between">
      <div>
        <header className="app-toolbar py-3 sm:py-3.5">
          <div className="container flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span
                className="app-brand-badge inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-well shrink-0 transform hover:rotate-6 transition-transform"
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
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    fill="var(--color-brand-heart)"
                  />
                </svg>
              </span>
              <h1 className="text-base sm:text-xl lg:text-2xl font-bold app-display text-wordmark truncate">
                Swoo’s PUGs Balancer
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold app-measured bg-paper-3 border border-rule text-muted shrink-0">
                v{APP_VERSION}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <span
                className={`hidden sm:inline-flex px-3.5 py-1.5 text-xs font-bold rounded-pill items-center gap-2 ${theme.badge.bg} ${theme.badge.text}`}
              >
                <span className="w-2 h-2 rounded-pill bg-current animate-pulse" aria-hidden="true" />
                {currentModeLabel}
              </span>
              <div
                className="app-well p-0.5 rounded-pill inline-flex gap-0.5"
                role="group"
                aria-label="Color theme"
              >
                <button
                  type="button"
                  onClick={() => setColorMode("light")}
                  aria-pressed={colorMode === "light"}
                  aria-label="Light mode"
                  title="Light mode"
                  className={`inline-flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-pill text-xs font-semibold ${
                    colorMode === "light" ? "app-primary" : "text-muted hover:text-ink"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden lg:inline">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("dark")}
                  aria-pressed={colorMode === "dark"}
                  aria-label="Dark mode"
                  title="Dark mode"
                  className={`inline-flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-pill text-xs font-semibold ${
                    colorMode === "dark" ? "app-sky" : "text-muted hover:text-ink"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden lg:inline">Dark</span>
                </button>
              </div>
              <HeaderMenu
                onOpenSheets={() => setShowSheetSetup(true)}
                onSync={handleSync}
                onUpdateFound={handleUpdateFound}
              />
            </div>
          </div>
        </header>

      <UpdateBanner
        externalUpdate={pendingUpdate}
        onClearExternalUpdate={() => setPendingUpdate(null)}
      />

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

      <footer className="container pb-6 pt-2 text-center text-xs text-footer-note font-medium">
        <p>
          Crafted with love for sweet cozy gaming nights • {currentModeLabel} Match Engine • v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}

export default App;
