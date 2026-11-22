import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type { Update };

export interface UpdateProgress {
  downloadedBytes: number;
  totalBytes: number | null;
}

export type ManualUpdateCheckResult =
  | { status: "available"; update: Update }
  | { status: "up-to-date" }
  | { status: "unsupported" };

/**
 * Checks for a newer signed desktop release when running inside Tauri.
 * Returns null in web/test environments or when already up to date.
 */
export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isTauri()) return null;
  return await check();
}

/**
 * Manual update check for UI triggers, distinguishing unsupported web mode from up-to-date.
 */
export async function checkForAppUpdateManual(): Promise<ManualUpdateCheckResult> {
  if (!isTauri()) return { status: "unsupported" };
  const update = await check();
  if (update && update.available) {
    return { status: "available", update };
  }
  if (update) {
    void update.close().catch(() => {});
  }
  return { status: "up-to-date" };
}

/**
 * Downloads and installs an available update, then relaunches the app.
 */
export async function installAppUpdate(
  update: Update,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
  let totalBytes: number | null = null;
  let downloadedBytes = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      totalBytes = event.data.contentLength ?? null;
      downloadedBytes = 0;
      onProgress?.({ downloadedBytes, totalBytes });
    } else if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress?.({ downloadedBytes, totalBytes });
    }
  });

  await relaunch();
}
