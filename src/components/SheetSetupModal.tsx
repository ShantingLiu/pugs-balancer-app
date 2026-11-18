import { useState } from "react";
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

  return (
    <div className="fixed inset-0 app-backdrop flex items-center justify-center z-50">
      <div className="app-modal p-6 w-full max-w-lg max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-xl font-semibold text-ink">Google Sheets</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink p-1.5 rounded-pill"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-bad-soft border border-bad-edge rounded-well p-3 mb-4 text-sm text-bad max-h-32 overflow-y-auto shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        {!isAuth ? (
          <div className="text-center py-4">
            <p className="text-ink-2 mb-4 text-sm">
              Sign in to access Google Sheets sync.
            </p>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="px-5 py-2.5 app-primary rounded-pill font-semibold text-sm"
            >
              {loading ? "Signing in…" : "Sign in with Google"}
            </button>
          </div>
        ) : !mode ? (
          <div>
            {spreadsheetId && (
              <div className="app-well p-3 mb-4 text-sm text-ink-2">
                Connected to{" "}
                <span className="font-semibold text-ink">{sheetName}</span>
                {spreadsheetUrl && (
                  <button
                    type="button"
                    onClick={() => open(spreadsheetUrl)}
                    className="ml-2 text-sky-ink font-semibold underline"
                  >
                    Open in Sheets
                  </button>
                )}
              </div>
            )}

            {confirmDisconnect ? (
              <div className="bg-warn-soft border border-warn-edge rounded-well p-4 mb-4">
                <p className="text-sm text-warn font-semibold mb-3">
                  You have unsynced changes that will be lost if you disconnect.
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmDisconnect}
                    className="px-3.5 py-1.5 app-danger rounded-pill text-sm font-semibold"
                  >
                    Disconnect anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="px-3.5 py-1.5 app-secondary rounded-pill text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="px-4 py-3 app-secondary rounded-well text-left font-semibold text-sm flex items-center gap-2.5"
              >
                <FilePlus2 className="h-4 w-4 text-pink-ink shrink-0" aria-hidden="true" />
                Create New Sheet
              </button>
              <button
                type="button"
                onClick={() => setMode("connect")}
                className="px-4 py-3 app-secondary rounded-well text-left font-semibold text-sm flex items-center gap-2.5"
              >
                <Link2 className="h-4 w-4 text-sky-ink shrink-0" aria-hidden="true" />
                Connect Existing Sheet
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className="px-4 py-3 app-secondary app-nowrap rounded-well text-left font-semibold text-sm flex items-center gap-2.5"
              >
                <Upload className="h-4 w-4 text-pink-ink shrink-0" aria-hidden="true" />
                Upload Roster to New Sheet
              </button>
              {spreadsheetId && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-3 app-danger rounded-well text-left font-semibold text-sm flex items-center gap-2.5"
                >
                  <PlugZap className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ) : mode === "create" ? (
          <div>
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-sky-ink hover:underline mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm font-semibold text-ink-2 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="app-input w-full px-3 py-2 mb-4 text-sm"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2.5 app-primary rounded-pill font-semibold text-sm"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        ) : mode === "connect" ? (
          <div>
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-sky-ink hover:underline mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm font-semibold text-ink-2 mb-1">
              Paste Google Sheet URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="app-input w-full px-3 py-2 mb-4 text-sm"
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading || !url.trim()}
              className="w-full px-4 py-2.5 app-primary rounded-pill font-semibold text-sm"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        ) : mode === "upload" ? (
          <div>
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-sky-ink hover:underline mb-3"
            >
              ← Back
            </button>
            <p className="text-sm text-ink-2 mb-3">
              {playerCount} player{playerCount !== 1 ? "s" : ""} will be uploaded to a new sheet.
            </p>
            <label className="block text-sm font-semibold text-ink-2 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="app-input w-full px-3 py-2 mb-4 text-sm"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2.5 app-primary rounded-pill font-semibold text-sm"
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
