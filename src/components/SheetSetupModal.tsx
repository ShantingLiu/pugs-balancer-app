import { useState, useEffect } from "react";
import { FilePlus2, Link2, Upload, PlugZap, X } from "lucide-react";
import { useSheetStore } from "@store/sheetStore";
import { usePlayerStore } from "@store/playerStore";
import {
  createSpreadsheet,
  applyDataValidation,
  getSpreadsheetMeta,
  appendRows,
} from "@services/sheetsApi";
import { buildTemplateRequest, serializePlayerToRow } from "@utils/sheetTemplate";
import { extractSheetId } from "@utils/sheetUrl";
import { signIn } from "@services/googleAuth";
import { open } from "@tauri-apps/plugin-shell";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@config/google";

// =============================================================================
// SheetSetupModal — Create, connect, or upload a Google Sheet (§10.2)
// =============================================================================

type SetupMode = "create" | "connect" | "upload";

interface SheetSetupModalProps {
  onClose: () => void;
}

export function SheetSetupModal({ onClose }: SheetSetupModalProps) {
  const isAuth = useSheetStore((s) => s.isAuthenticated);
  const spreadsheetId = useSheetStore((s) => s.spreadsheetId);
  const sheetName = useSheetStore((s) => s.sheetName);
  const connect = useSheetStore((s) => s.connect);
  const disconnect = useSheetStore((s) => s.disconnect);
  const spreadsheetUrl = useSheetStore((s) => s.spreadsheetUrl);
  const hasUnsyncedChanges = useSheetStore((s) => s.hasUnsyncedChanges);
  const markSynced = useSheetStore((s) => s.markSynced);
  const playerCount = usePlayerStore((s) => s.players.size);

  const [mode, setMode] = useState<SetupMode | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("PUGs Balancer Roster");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // P2-014: Disconnect flow
  const handleDisconnect = () => {
    if (hasUnsyncedChanges) {
      setConfirmDisconnect(true);
      return;
    }
    disconnect();
    onClose();
  };

  const handleConfirmDisconnect = () => {
    disconnect();
    onClose();
  };

  // P2-005: Sign-in gate
  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  // P2-002: Create New Sheet flow
  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const req = buildTemplateRequest(title);
      const result = await createSpreadsheet(req);
      await applyDataValidation(result.spreadsheetId, result.rosterSheetId);
      connect(result.spreadsheetId, title, result.spreadsheetUrl);
      markSynced();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sheet.");
    } finally {
      setLoading(false);
    }
  };

  // P2-003: Connect Existing Sheet flow
  const handleConnect = async () => {
    setError(null);
    const id = extractSheetId(url);
    if (!id) {
      setError("Invalid Google Sheets URL.");
      return;
    }
    setLoading(true);
    try {
      const meta = await getSpreadsheetMeta(id);
      connect(id, meta.title, url);
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message === "MISSING_ROSTER_TAB") {
        setError(
          "The sheet doesn't have a 'Roster' tab. Make sure you're connecting to the right sheet."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to connect to sheet."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // P2-004: Upload Roster to New Sheet flow
  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    try {
      const players = usePlayerStore.getState().getAllPlayers();
      const req = buildTemplateRequest(title);
      const result = await createSpreadsheet(req);
      const rows = players.map((p) => serializePlayerToRow(p));
      if (rows.length > 0) {
        await appendRows(result.spreadsheetId, rows);
      }
      await applyDataValidation(result.spreadsheetId, result.rosterSheetId);
      connect(result.spreadsheetId, title, result.spreadsheetUrl);
      markSynced();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload roster."
      );
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setMode(null);
    setError(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="app-modal p-6 w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-xl font-bold text-ink">Google Sheets</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="app-alert-error p-3 mb-4 text-sm text-bad max-h-32 overflow-y-auto shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        {!isAuth ? (
          // P2-005: Sign-in gate
          <div className="text-center py-4">
            <p className="text-muted mb-4">
              Sign in to access Google Sheets sync.
            </p>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-4 py-2 app-primary disabled:opacity-50 font-medium"
            >
              {loading ? "Signing in…" : "Sign in with Google"}
            </button>
          </div>
        ) : !mode ? (
          // P2-001: Mode selector
          <div>
            {spreadsheetId && (
              <div className="app-subsurface p-3 mb-4 text-sm text-ink-2">
                Connected to{" "}
                <span className="font-medium text-ink">{sheetName}</span>
                {spreadsheetUrl && (
                  <button
                    onClick={() => open(spreadsheetUrl)}
                    className="ml-2 text-accent hover:underline"
                  >
                    Open in Sheets
                  </button>
                )}
              </div>
            )}
            {/* P2-015: Disconnect confirmation */}
            {confirmDisconnect ? (
              <div className="app-alert-accent p-4 mb-4">
                <p className="text-sm text-ink mb-3">
                  You have unsynced changes that will be lost if you disconnect.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmDisconnect}
                    className="px-3 py-1.5 app-danger text-sm font-medium"
                  >
                    Disconnect anyway
                  </button>
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="px-3 py-1.5 app-secondary text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode("create")}
                className="px-4 py-3 app-secondary text-left flex items-center gap-2"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Create New Sheet
              </button>
              <button
                onClick={() => setMode("connect")}
                className="px-4 py-3 app-secondary text-left flex items-center gap-2"
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Connect Existing Sheet
              </button>
              <button
                onClick={() => setMode("upload")}
                className="px-4 py-3 app-secondary text-left flex items-center gap-2"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload Roster to New Sheet
              </button>
              {/* P2-014: Disconnect button */}
              {spreadsheetId && (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-3 app-secondary text-left text-bad flex items-center gap-2"
                >
                  <PlugZap className="h-4 w-4" aria-hidden="true" />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ) : mode === "create" ? (
          // P2-002: Create New Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-muted hover:text-ink mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm text-ink-2 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full app-input px-3 py-2 mb-4"
            />
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2 app-primary disabled:opacity-50 font-medium"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        ) : mode === "connect" ? (
          // P2-003: Connect Existing Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-muted hover:text-ink mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm text-ink-2 mb-1">
              Paste Google Sheet URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="w-full app-input px-3 py-2 mb-4"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !url.trim()}
              className="w-full px-4 py-2 app-primary disabled:opacity-50 font-medium"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        ) : mode === "upload" ? (
          // P2-004: Upload Roster to New Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-muted hover:text-ink mb-3"
            >
              ← Back
            </button>
            <p className="text-sm text-muted mb-3">
              {playerCount} player{playerCount !== 1 ? "s" : ""} will be
              uploaded to a new sheet.
            </p>
            <label className="block text-sm text-ink-2 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full app-input px-3 py-2 mb-4"
            />
            <button
              onClick={handleUpload}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2 app-primary disabled:opacity-50 font-medium"
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
