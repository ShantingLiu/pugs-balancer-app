import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SheetState {
  spreadsheetId: string | null;
  sheetName: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: number | null;
  hasUnsyncedChanges: boolean;
  isAuthenticated: boolean;
}

interface SheetActions {
  connect(spreadsheetId: string, name: string, url: string): void;
  disconnect(): void;
  markSynced(): void;
  markUnsynced(): void;
  setAuthenticated(value: boolean): void;
}

export const useSheetStore = create<SheetState & SheetActions>()(
  persist(
    (set) => ({
      spreadsheetId: null,
      sheetName: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
      hasUnsyncedChanges: false,
      isAuthenticated: false,

      connect: (spreadsheetId, name, url) =>
        set({ spreadsheetId, sheetName: name, spreadsheetUrl: url }),

      disconnect: () =>
        set({
          spreadsheetId: null,
          sheetName: null,
          spreadsheetUrl: null,
          lastSyncedAt: null,
          hasUnsyncedChanges: false,
        }),

      markSynced: () =>
        set({ lastSyncedAt: Date.now(), hasUnsyncedChanges: false }),

      markUnsynced: () => set({ hasUnsyncedChanges: true }),

      setAuthenticated: (value) => set({ isAuthenticated: value }),
    }),
    {
      name: "pugs-balancer-sheet",
      partialize: (state) => ({
        spreadsheetId: state.spreadsheetId,
        sheetName: state.sheetName,
        spreadsheetUrl: state.spreadsheetUrl,
        lastSyncedAt: state.lastSyncedAt,
        hasUnsyncedChanges: state.hasUnsyncedChanges,
      }),
    },
  ),
);
