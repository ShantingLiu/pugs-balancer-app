import { SheetsApiError } from "@services/sheetsApi";
import { SyncError } from "@services/sheetSync";

export function handleSyncError(error: unknown): string {
  if (error instanceof SheetsApiError) {
    switch (error.status) {
      case 403:
        return "You don't have edit access to this sheet. Ask the sheet owner to share it with you.";
      case 404:
        return "The connected sheet was deleted or the URL is invalid.";
      case 429:
        return "Google API rate limit reached. Wait a moment and try again.";
      default:
        return `Google Sheets error (${error.status}). Please try again.`;
    }
  }

  if (error instanceof SyncError) {
    switch (error.code) {
      case "MALFORMED_HEADERS":
        return `Sheet headers don't match expected format: ${error.message}`;
      case "DUPLICATE_BATTLETAG":
        return error.message;
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    if (error.message === "NOT_AUTHENTICATED") {
      return "Please sign in with Google to sync.";
    }
    if (error.message === "TOKEN_REFRESH_FAILED") {
      return "Your Google session has expired. Please sign in again.";
    }
    if (error.message === "MISSING_ROSTER_TAB") {
      return "The sheet doesn't have a 'Roster' tab. Make sure you're connecting to the right sheet.";
    }
  }

  return "Sync failed due to a network error. Please check your connection and try again.";
}
