import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

/** Compact circular hairline desktop window controls integrated at the right edge of the app header (Tauri only). */
export function WindowControls() {
  const inTauri = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!inTauri) return;

    const appWindow = getCurrentWindow();
    let active = true;
    let unlisten: (() => void) | undefined;

    const syncMaximized = () => {
      appWindow
        .isMaximized()
        .then((maximized) => {
          if (active) setIsMaximized(maximized);
        })
        .catch(() => {});
    };

    syncMaximized();
    appWindow
      .onResized(() => {
        syncMaximized();
      })
      .then((fn) => {
        if (active) {
          unlisten = fn;
        } else {
          fn();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      unlisten?.();
    };
  }, [inTauri]);

  if (!inTauri) return null;

  const handleMinimize = () => {
    void getCurrentWindow().minimize();
  };

  const handleToggleMaximize = () => {
    void getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    void getCurrentWindow().close();
  };

  return (
    <div
      data-window-controls=""
      className="inline-flex items-center gap-0.5 pr-3 shrink-0"
      role="group"
      aria-label="Window controls"
    >
      <Separator orientation="vertical" className="h-5 mr-2" />

      <button
        type="button"
        onClick={handleMinimize}
        aria-label="Minimize window"
        className="inline-flex size-7 items-center justify-center rounded-pill text-muted transition-colors hover:bg-sky-soft hover:text-ink active:translate-y-0! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Minus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={handleToggleMaximize}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        className="inline-flex size-7 items-center justify-center rounded-pill text-muted transition-colors hover:bg-sky-soft hover:text-ink active:translate-y-0! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {isMaximized ? (
          <Copy
            className="size-3 -scale-x-100"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : (
          <Square className="size-3" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close window"
        className="inline-flex size-7 items-center justify-center rounded-pill text-muted transition-colors hover:bg-bad-soft hover:text-bad active:bg-bad active:text-paper-2 active:translate-y-0! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
