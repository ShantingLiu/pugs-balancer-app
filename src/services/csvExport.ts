import { invoke, isTauri } from "@tauri-apps/api/core";

export interface CsvExportResult {
  location: string;
  isDesktopExport: boolean;
}

/** Triggers a standard browser file download for web contexts and CSV templates. */
export function triggerBrowserDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a CSV file to ~/Documents/SwoosPugsBalancer/export in the desktop app,
 * falling back to browser Downloads when running on the web.
 */
export async function exportCsvFile(
  filename: string,
  content: string,
): Promise<CsvExportResult> {
  if (isTauri()) {
    const savedPath = await invoke<string>("export_csv_file", { filename, content });
    return { location: savedPath, isDesktopExport: true };
  }
  triggerBrowserDownload(filename, content);
  return { location: "Downloads folder", isDesktopExport: false };
}

/** Opens the desktop export folder (creating it first if needed). */
export async function openExportFolder(): Promise<string> {
  if (!isTauri()) {
    throw new Error("Open Export Folder is only available in the desktop app");
  }
  return await invoke<string>("open_export_folder");
}
