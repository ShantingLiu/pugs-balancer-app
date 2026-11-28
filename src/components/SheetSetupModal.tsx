import { useState } from "react";
import { FilePlus2, Link2, Upload, PlugZap } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

// =============================================================================
// SheetSetupModal — Create, connect, or upload a Google Sheet (§10.2)
// =============================================================================

type SetupMode = "create" | "connect" | "upload";

interface SheetSetupModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export function SheetSetupModal({ isOpen = true, onClose }: SheetSetupModalProps) {
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
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMode(null);
      setUrl("");
      setTitle("PUGs Balancer Roster");
      setLoading(false);
      setError(null);
      setConfirmDisconnect(false);
    }
  }

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl">Google Sheets</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in, create, connect, upload, or disconnect a Google Sheet.
          </DialogDescription>
        </DialogHeader>

        {/* Error display */}
        {error && (
          <Alert variant="bad" className="max-h-32 overflow-y-auto shrink-0">
            <AlertDescription className="text-bad">{error}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {!isAuth ? (
          <div className="text-center py-4">
            <p className="text-ink-2 mb-4 text-sm">
              Sign in to access Google Sheets sync.
            </p>
            <Button onClick={handleSignIn} disabled={loading} size="lg">
              {loading && (
                <Spinner
                  data-icon="inline-start"
                  role={undefined}
                  aria-label={undefined}
                  aria-hidden="true"
                />
              )}
              {loading ? "Signing in…" : "Sign in with Google"}
            </Button>
          </div>
        ) : !mode ? (
          <div className="flex flex-col gap-4">
            {spreadsheetId && (
              <Card variant="well">
                <CardContent className="p-3 text-sm text-ink-2">
                  Connected to{" "}
                  <span className="font-semibold text-ink">{sheetName}</span>
                  {spreadsheetUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-2 h-auto p-0"
                      onClick={() => open(spreadsheetUrl)}
                    >
                      Open in Sheets
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {confirmDisconnect && (
              <Alert variant="warn">
                <AlertDescription className="flex flex-col gap-3">
                  <p className="text-sm text-warn font-semibold">
                    You have unsynced changes that will be lost if you disconnect.
                  </p>
                  <div className="flex gap-2.5">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleConfirmDisconnect}
                    >
                      Disconnect anyway
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDisconnect(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2.5">
              <Button
                variant="secondary"
                shape="well"
                className="justify-start py-3 h-auto"
                onClick={() => setMode("create")}
              >
                <FilePlus2 className="text-pink-ink" data-icon="inline-start" aria-hidden="true" />
                Create New Sheet
              </Button>
              <Button
                variant="secondary"
                shape="well"
                className="justify-start py-3 h-auto"
                onClick={() => setMode("connect")}
              >
                <Link2 className="text-sky-ink" data-icon="inline-start" aria-hidden="true" />
                Connect Existing Sheet
              </Button>
              <Button
                variant="secondary"
                shape="well"
                className="justify-start py-3 h-auto app-nowrap"
                onClick={() => setMode("upload")}
              >
                <Upload className="text-pink-ink" data-icon="inline-start" aria-hidden="true" />
                Upload to New Sheet
              </Button>
              {spreadsheetId && (
                <Button
                  variant="danger"
                  shape="well"
                  className="justify-start py-3 h-auto"
                  onClick={handleDisconnect}
                >
                  <PlugZap data-icon="inline-start" aria-hidden="true" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        ) : mode === "create" ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="link"
              size="sm"
              className="self-start h-auto p-0"
              onClick={goBack}
            >
              ← Back
            </Button>
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(error) || undefined} className="gap-1.5">
                <FieldLabel htmlFor="sheet-create-title">Sheet title</FieldLabel>
                <Input
                  id="sheet-create-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(error) || undefined}
                />
              </Field>
            </FieldGroup>
            <Button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full mt-1"
            >
              {loading && (
                <Spinner
                  data-icon="inline-start"
                  role={undefined}
                  aria-label={undefined}
                  aria-hidden="true"
                />
              )}
              {loading ? "Creating…" : "Create"}
            </Button>
          </div>
        ) : mode === "connect" ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="link"
              size="sm"
              className="self-start h-auto p-0"
              onClick={goBack}
            >
              ← Back
            </Button>
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(error) || undefined} className="gap-1.5">
                <FieldLabel htmlFor="sheet-connect-url">Paste Google Sheet URL</FieldLabel>
                <Input
                  id="sheet-connect-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  aria-invalid={Boolean(error) || undefined}
                />
              </Field>
            </FieldGroup>
            <Button
              onClick={handleConnect}
              disabled={loading || !url.trim()}
              className="w-full mt-1"
            >
              {loading && (
                <Spinner
                  data-icon="inline-start"
                  role={undefined}
                  aria-label={undefined}
                  aria-hidden="true"
                />
              )}
              {loading ? "Connecting…" : "Connect"}
            </Button>
          </div>
        ) : mode === "upload" ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="link"
              size="sm"
              className="self-start h-auto p-0"
              onClick={goBack}
            >
              ← Back
            </Button>
            <p className="text-sm text-ink-2">
              {playerCount} player{playerCount !== 1 ? "s" : ""} will be uploaded to a new sheet.
            </p>
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(error) || undefined} className="gap-1.5">
                <FieldLabel htmlFor="sheet-upload-title">Sheet title</FieldLabel>
                <Input
                  id="sheet-upload-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(error) || undefined}
                />
              </Field>
            </FieldGroup>
            <Button
              onClick={handleUpload}
              disabled={loading || !title.trim()}
              className="w-full mt-1"
            >
              {loading && (
                <Spinner
                  data-icon="inline-start"
                  role={undefined}
                  aria-label={undefined}
                  aria-hidden="true"
                />
              )}
              {loading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
