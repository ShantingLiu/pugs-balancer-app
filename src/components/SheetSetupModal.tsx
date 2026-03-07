import { useState } from "react";
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
          "The sheet doesn't have a 'Roster' tab. Make sure you're connecting to the right sheet.",
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to connect to sheet.",
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
        err instanceof Error ? err.message : "Failed to upload roster.",
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-xl font-bold">Google Sheets</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-900/40 border border-red-500 rounded p-3 mb-4 text-sm text-red-300 max-h-32 overflow-y-auto shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        {!isAuth ? (
          // P2-005: Sign-in gate
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              Sign in to access Google Sheets sync.
            </p>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium"
            >
              {loading ? "Signing in…" : "Sign in with Google"}
            </button>
          </div>
        ) : !mode ? (
          // P2-001: Mode selector
          <div>
            {spreadsheetId && (
              <div className="bg-gray-700/50 rounded p-3 mb-4 text-sm text-gray-300">
                Connected to{" "}
                <span className="font-medium text-gray-100">{sheetName}</span>
                {spreadsheetUrl && (
                  <button
                    onClick={() => open(spreadsheetUrl)}
                    className="ml-2 text-blue-400 hover:text-blue-300 underline"
                  >
                    Open in Sheets
                  </button>
                )}
              </div>
            )}
            {/* P2-015: Disconnect confirmation */}
            {confirmDisconnect ? (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-200 mb-3">
                  You have unsynced changes that will be lost if you disconnect.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmDisconnect}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
                  >
                    Disconnect anyway
                  </button>
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode("create")}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left"
              >
                📝 Create New Sheet
              </button>
              <button
                onClick={() => setMode("connect")}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left"
              >
                🔗 Connect Existing Sheet
              </button>
              <button
                onClick={() => setMode("upload")}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left"
              >
                📤 Upload Roster to New Sheet
              </button>
              {/* P2-014: Disconnect button */}
              {spreadsheetId && (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left text-red-400"
                >
                  🔌 Disconnect
                </button>
              )}
            </div>
          </div>
        ) : mode === "create" ? (
          // P2-002: Create New Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-gray-400 hover:text-gray-200 mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm text-gray-400 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-gray-100"
            />
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        ) : mode === "connect" ? (
          // P2-003: Connect Existing Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-gray-400 hover:text-gray-200 mb-3"
            >
              ← Back
            </button>
            <label className="block text-sm text-gray-400 mb-1">
              Paste Google Sheet URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-gray-100"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !url.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        ) : mode === "upload" ? (
          // P2-004: Upload Roster to New Sheet
          <div>
            <button
              onClick={goBack}
              className="text-sm text-gray-400 hover:text-gray-200 mb-3"
            >
              ← Back
            </button>
            <p className="text-sm text-gray-400 mb-3">
              {playerCount} player{playerCount !== 1 ? "s" : ""} will be
              uploaded to a new sheet.
            </p>
            <label className="block text-sm text-gray-400 mb-1">
              Sheet title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-gray-100"
            />
            <button
              onClick={handleUpload}
              disabled={loading || !title.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium"
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
