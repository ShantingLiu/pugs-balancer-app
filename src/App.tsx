import { useState, useEffect, useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { CsvImporter } from "@components/CsvImporter";
import { LobbySelector } from "@components/LobbySelector";
import { TeamDisplay } from "@components/TeamDisplay";
import { BalanceButton } from "@components/BalanceButton";
import { ConstraintsPanel } from "@components/ConstraintsPanel";
import { StatsPanel } from "@components/StatsPanel";
import { Leaderboard } from "@components/Leaderboard";
import { SpectatorsList } from "@components/SpectatorsList";
import { HeaderMenu } from "@components/HeaderMenu";
import { WindowControls } from "@components/WindowControls";
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

  const notifySyncStatus = useCallback((message: string) => {
    if (message === "Everything is up to date.") {
      toast.success(message);
      return;
    }
    if (message.toLowerCase().includes("sign in")) {
      toast.error(message, {
        action: {
          label: "Sign in with Google",
          onClick: () => setShowSheetSetup(true),
        },
      });
      return;
    }
    toast.error(message);
  }, []);

  // P1-042: Restore auth state silently on app launch
  useEffect(() => {
    initAuth(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).catch(() => {});
  }, []);

  // P1-041: Sync button click handler
  const handleSync = useCallback(async () => {
    if (!spreadsheetId || syncing) return;
    setSyncing(true);
    try {
      const diff = await performSync(spreadsheetId);
      if (!diff.hasChanges) {
        notifySyncStatus("Everything is up to date.");
      } else {
        setSyncDiff(diff);
      }
    } catch (err: unknown) {
      notifySyncStatus(handleSyncError(err));
    } finally {
      setSyncing(false);
    }
  }, [spreadsheetId, syncing, notifySyncStatus]);

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
        notifySyncStatus(handleSyncError(err));
      }
    },
    [spreadsheetId, notifySyncStatus],
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
    <Card variant="surface">
      <CardContent className="pt-5">
        <CsvImporter />
      </CardContent>
    </Card>
  );

  const lobbySection = (
    <Card variant="surface">
      <CardContent className="pt-5 pb-4">
        <LobbySelector />
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Separator />
        <p className="text-xs text-footer-note text-center">
          © {new Date().getFullYear()} Swoo • PUGs Match Engine
        </p>
      </CardFooter>
    </Card>
  );

  const workspaceSection = (
    <>
      <Tabs
        value={draftMode ? "draft" : "balance"}
        onValueChange={(value) => setDraftMode(value === "draft")}
        className="gap-5"
      >
        <TabsList aria-label="Team planning mode">
          <TabsTrigger value="balance" activeVariant="primary" className="py-2.5">
            Balance
          </TabsTrigger>
          <TabsTrigger value="draft" activeVariant="sky" className="py-2.5">
            Draft
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draft">
          <Card variant="surface">
            <CardContent className="pt-5">
              <DraftView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="flex flex-col gap-5">
          <div>
            <BalanceButton />
          </div>
          <TeamDisplay result={lastResult} />
        </TabsContent>
      </Tabs>

      <SpectatorsList />
    </>
  );

  const constraintsSection = (
    <Card variant="surface">
      <CardContent className="pt-5">
        <ConstraintsPanel />
      </CardContent>
    </Card>
  );

  const statsSection = (
    <Card variant="surface">
      <CardContent className="pt-5">
        <StatsPanel />
      </CardContent>
    </Card>
  );

  const leaderboardSection = (
    <Card variant="surface">
      <CardContent className="pt-5">
        <Leaderboard />
      </CardContent>
    </Card>
  );

  return (
    <div className="app-shell h-dvh overflow-hidden bg-paper text-ink flex flex-col">
      <header
        data-tauri-drag-region
        className="app-toolbar shrink-0 select-none flex items-center"
      >
        <div
          data-tauri-drag-region
          className="container flex-1 min-w-0 flex items-center justify-between gap-2 sm:gap-4 py-2 has-[+[data-window-controls]]:pr-3"
        >
          <div
            data-tauri-drag-region
            className="flex items-center gap-2.5 sm:gap-3 min-w-0"
          >
            <span
              data-tauri-drag-region
              className="app-brand-badge inline-flex items-center justify-center size-9 sm:size-10 rounded-well shrink-0 transform hover:rotate-6 transition-transform"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="pointer-events-none"
              >
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="var(--color-brand-heart)"
                />
              </svg>
            </span>
            <h1
              data-tauri-drag-region
              className="text-base sm:text-xl lg:text-2xl font-bold app-display text-wordmark truncate"
            >
              Swoo’s PUGs Balancer
            </h1>
            <Badge
              variant="muted"
              data-tauri-drag-region
              className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-semibold app-measured shrink-0"
            >
              v{APP_VERSION}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Badge
              className={cn(
                "hidden sm:inline-flex px-3.5 py-1.5 font-bold gap-2",
                theme.badge.bg,
                theme.badge.text,
              )}
            >
              <span className="size-2 rounded-pill bg-current animate-pulse" aria-hidden="true" />
              {currentModeLabel}
            </Badge>
            <ToggleGroup
              value={[colorMode]}
              onValueChange={(vals) => {
                const next = vals[0];
                if (next === "light" || next === "dark") setColorMode(next);
              }}
              aria-label="Color theme"
              size="sm"
            >
              <ToggleGroupItem
                value="light"
                activeVariant="primary"
                aria-label="Light mode"
                title="Light mode"
                className="px-2 lg:px-2.5 py-1.5"
              >
                <Sun data-icon="inline-start" aria-hidden="true" />
                <span className="hidden lg:inline">Light</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="dark"
                activeVariant="sky"
                aria-label="Dark mode"
                title="Dark mode"
                className="px-2 lg:px-2.5 py-1.5"
              >
                <Moon data-icon="inline-start" aria-hidden="true" />
                <span className="hidden lg:inline">Dark</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <HeaderMenu
              onOpenSheets={() => setShowSheetSetup(true)}
              onSync={handleSync}
              onUpdateFound={handleUpdateFound}
            />
          </div>
        </div>
        <WindowControls />
      </header>

      {/* Sheet setup modal */}
      <SheetSetupModal
        isOpen={showSheetSetup}
        onClose={() => setShowSheetSetup(false)}
      />

      {/* Sync diff modal */}
      <SyncDiffModal
        diff={syncDiff}
        onApply={handleApplySync}
        onCancel={() => setSyncDiff(null)}
      />

      <div className="app-scroll-viewport flex-1 min-h-0 overflow-y-auto overflow-x-clip flex flex-col justify-between">
        <div>
          <UpdateBanner
            externalUpdate={pendingUpdate}
            onClearExternalUpdate={() => setPendingUpdate(null)}
          />

          {/* Main workbench */}
      <main className="container py-6">
        {layoutMode === "wide-teams" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5">{workspaceSection}</div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 flex flex-col gap-5">
                {importerSection}
                {lobbySection}
              </div>
              <div className="lg:col-span-7 flex flex-col gap-5">
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
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-5">
              {importerSection}
              {lobbySection}
            </div>
            <div className="lg:col-span-8 xl:col-span-6 flex flex-col gap-5">
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
            <div className="lg:col-span-8 flex flex-col gap-5">
              {workspaceSection}
              {constraintsSection}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {statsSection}
                {leaderboardSection}
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-5">
              {importerSection}
              {lobbySection}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 flex flex-col gap-5">
              {importerSection}
              {lobbySection}
            </div>
            <div className="lg:col-span-8 flex flex-col gap-5">
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
    </div>
  );
}

export default App;
