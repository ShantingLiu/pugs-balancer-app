import { describe, it, expect } from "vitest";
import { SheetsApiError } from "@services/sheetsApi";
import { SyncError } from "@services/sheetSync";
import { handleSyncError } from "@utils/handleSyncError";

describe("handleSyncError (P2-016, P2-017, P2-018)", () => {
  // P2-016: SheetsApiError mapping
  describe("SheetsApiError", () => {
    it("maps 403 to permission message", () => {
      const err = new SheetsApiError(403, "Forbidden");
      expect(handleSyncError(err)).toBe(
        "You don't have edit access to this sheet. Ask the sheet owner to share it with you.",
      );
    });

    it("maps 404 to deleted/invalid message", () => {
      const err = new SheetsApiError(404, "Not Found");
      expect(handleSyncError(err)).toBe(
        "The connected sheet was deleted or the URL is invalid.",
      );
    });

    it("maps 429 to rate limit message", () => {
      const err = new SheetsApiError(429, "Too Many Requests");
      expect(handleSyncError(err)).toBe(
        "Google API rate limit reached. Wait a moment and try again.",
      );
    });

    it("maps other status codes to generic Sheets error", () => {
      const err = new SheetsApiError(500, "Internal Server Error");
      expect(handleSyncError(err)).toBe(
        "Google Sheets error (500). Please try again.",
      );
    });
  });

  // P2-016: SyncError mapping
  describe("SyncError", () => {
    it("maps MALFORMED_HEADERS with message", () => {
      const err = new SyncError(
        "MALFORMED_HEADERS",
        "Sheet has header problems: missing BattleTag column",
      );
      expect(handleSyncError(err)).toBe(
        "Sheet headers don't match expected format: Sheet has header problems: missing BattleTag column",
      );
    });

    it("maps DUPLICATE_BATTLETAG to its own message", () => {
      const err = new SyncError(
        "DUPLICATE_BATTLETAG",
        "Duplicate BattleTags on sheet: 'Player#1234' on rows 2 and 5",
      );
      expect(handleSyncError(err)).toBe(
        "Duplicate BattleTags on sheet: 'Player#1234' on rows 2 and 5",
      );
    });

    it("returns message for unknown SyncError codes", () => {
      const err = new SyncError("UNKNOWN_CODE", "Something went wrong");
      expect(handleSyncError(err)).toBe("Something went wrong");
    });
  });

  // P2-018: Auth errors
  describe("authentication errors", () => {
    it("maps NOT_AUTHENTICATED to sign-in prompt", () => {
      const err = new Error("NOT_AUTHENTICATED");
      expect(handleSyncError(err)).toBe(
        "Please sign in with Google to sync.",
      );
    });

    it("maps TOKEN_REFRESH_FAILED to session expired", () => {
      const err = new Error("TOKEN_REFRESH_FAILED");
      expect(handleSyncError(err)).toBe(
        "Your Google session has expired. Please sign in again.",
      );
    });

    it("maps MISSING_ROSTER_TAB to roster tab message", () => {
      const err = new Error("MISSING_ROSTER_TAB");
      expect(handleSyncError(err)).toBe(
        "The sheet doesn't have a 'Roster' tab. Make sure you're connecting to the right sheet.",
      );
    });
  });

  // Fallback
  describe("fallback", () => {
    it("returns network error for unknown errors", () => {
      expect(handleSyncError("something")).toBe(
        "Sync failed due to a network error. Please check your connection and try again.",
      );
    });

    it("returns network error for null", () => {
      expect(handleSyncError(null)).toBe(
        "Sync failed due to a network error. Please check your connection and try again.",
      );
    });
  });
});
