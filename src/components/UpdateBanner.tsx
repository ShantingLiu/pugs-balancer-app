import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  checkForAppUpdate,
  installAppUpdate,
  type Update,
  type UpdateProgress,
} from "@services/updater";

interface UpdateBannerProps {
  externalUpdate?: Update | null;
  onClearExternalUpdate?: () => void;
}

export function UpdateBanner({ externalUpdate, onClearExternalUpdate }: UpdateBannerProps = {}) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);
  const installedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    checkForAppUpdate()
      .then((found) => {
        if (!found) return;
        if (cancelled) {
          void found.close().catch(() => {});
          return;
        }
        updateRef.current = found;
        setUpdate(found);
      })
      .catch(() => {
        // Ignore silent background update check failures (e.g., offline)
      });

    return () => {
      cancelled = true;
      if (updateRef.current && !installedRef.current) {
        void updateRef.current.close().catch(() => {});
        updateRef.current = null;
      }
    };
  }, []);

  const activeUpdate = externalUpdate ?? update;
  if (!activeUpdate) return null;

  const handleInstall = async () => {
    if (installing) return;
    setError(null);
    setInstalling(true);
    setProgress(null);

    try {
      await installAppUpdate(activeUpdate, (nextProgress) => {
        setProgress(nextProgress);
      });
      installedRef.current = true;
    } catch (err: unknown) {
      setInstalling(false);
      setError(
        err instanceof Error ? err.message : "Failed to download and install the update.",
      );
    }
  };

  const handleDismiss = () => {
    if (installing) return;
    if (externalUpdate) {
      void externalUpdate.close().catch(() => {});
      onClearExternalUpdate?.();
    }
    if (updateRef.current) {
      void updateRef.current.close().catch(() => {});
      updateRef.current = null;
    }
    setUpdate(null);
    setError(null);
  };

  const percent =
    progress?.totalBytes && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100))
      : null;

  return (
    <div className="container pt-4">
      <div
        role="status"
        className={`px-4 py-2.5 rounded-well text-sm flex flex-wrap items-center justify-between gap-3 border ${
          error
            ? "border-bad-edge text-bad bg-bad-soft"
            : "border-sky-edge text-sky-ink bg-sky-soft"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {error ? (
              <>Update to v{activeUpdate.version} failed: {error}</>
            ) : installing ? (
              percent !== null ? (
                <>Downloading update v{activeUpdate.version} ({percent}%)…</>
              ) : (
                <>Installing update v{activeUpdate.version}…</>
              )
            ) : (
              <>
                Update <span className="font-semibold">v{activeUpdate.version}</span> is ready to install
                {" "}
                <span className="text-muted">(current: v{activeUpdate.currentVersion})</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="app-primary px-3.5 py-1.5 rounded-pill text-xs font-semibold"
          >
            {installing ? "Updating…" : error ? "Retry" : "Update & Restart"}
          </button>
          {!installing && (
            <button
              type="button"
              onClick={handleDismiss}
              className="app-secondary px-3 py-1.5 rounded-pill text-xs font-semibold"
              aria-label="Dismiss update notification"
            >
              Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
