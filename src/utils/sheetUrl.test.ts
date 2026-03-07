import { describe, it, expect } from "vitest";
import { extractSheetId } from "@utils/sheetUrl";

describe("sheetUrl", () => {
  describe("extractSheetId", () => {
    it("should extract ID from standard edit URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit";
      expect(extractSheetId(url)).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      );
    });

    it("should extract ID from URL with gid fragment", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0";
      expect(extractSheetId(url)).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      );
    });

    it("should extract ID from URL with query params", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit?usp=sharing";
      expect(extractSheetId(url)).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      );
    });

    it("should extract ID from /copy URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/copy";
      expect(extractSheetId(url)).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      );
    });

    it("should extract ID from URL ending with just /d/ID", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
      expect(extractSheetId(url)).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      );
    });

    it("should return null for invalid URL", () => {
      expect(extractSheetId("not a url")).toBeNull();
    });

    it("should return null for non-sheets Google URL", () => {
      expect(
        extractSheetId("https://docs.google.com/document/d/abc123/edit"),
      ).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(extractSheetId("")).toBeNull();
    });

    it("should handle IDs with hyphens and underscores", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/abc-123_XYZ/edit";
      expect(extractSheetId(url)).toBe("abc-123_XYZ");
    });
  });
});
