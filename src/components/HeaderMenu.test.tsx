import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HeaderMenu } from "./HeaderMenu";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import { APP_VERSION } from "@config/appInfo";
import type { Update } from "@services/updater";

const mockCheckForAppUpdateManual = vi.fn();
vi.mock("@services/updater", () => ({
  checkForAppUpdateManual: (...args: unknown[]) => mockCheckForAppUpdateManual(...args),
}));

describe("HeaderMenu", () => {
  const onOpenSheets = vi.fn();
  const onSync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState(useSessionStore.getInitialState());
    useSheetStore.setState(useSheetStore.getInitialState());
  });

  it("opens menu and triggers Sheets setup", () => {
    render(<HeaderMenu onOpenSheets={onOpenSheets} onSync={onSync} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sheets Setup" }));
    expect(onOpenSheets).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("switches layout, theme, and text size from the menu", () => {
    render(<HeaderMenu onOpenSheets={onOpenSheets} onSync={onSync} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    fireEvent.click(screen.getByRole("button", { name: "Wide Teams" }));
    expect(useSessionStore.getState().layoutMode).toBe("wide-teams");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(useSessionStore.getState().colorMode).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "A++" }));
    expect(useSessionStore.getState().fontScale).toBe("x-large");
  });

  it("switches game mode immediately when no active teams exist", () => {
    render(<HeaderMenu onOpenSheets={onOpenSheets} onSync={onSync} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    fireEvent.click(screen.getByRole("button", { name: /Regular 6v6/i }));
    expect(useSessionStore.getState().gameMode).toBe("regular_6v6");
  });

  it("shows unsynced indicator dot and triggers Sync when connected", () => {
    useSheetStore.setState({
      spreadsheetId: "sheet-1",
      sheetName: "My PUGs",
      isAuthenticated: true,
      hasUnsyncedChanges: true,
    });

    render(<HeaderMenu onOpenSheets={onOpenSheets} onSync={onSync} />);
    expect(screen.getByTestId("menu-unsync-badge")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByText("My PUGs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("displays app version and handles Check for Updates states", async () => {
    const onUpdateFound = vi.fn();
    mockCheckForAppUpdateManual.mockResolvedValueOnce({ status: "up-to-date" });

    render(
      <HeaderMenu
        onOpenSheets={onOpenSheets}
        onSync={onSync}
        onUpdateFound={onUpdateFound}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check for Updates" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      `You’re on the latest version (v${APP_VERSION})`,
    );

    const fakeUpdate = { version: "1.4.0" } as unknown as Update;
    mockCheckForAppUpdateManual.mockResolvedValueOnce({
      status: "available",
      update: fakeUpdate,
    });
    fireEvent.click(screen.getByRole("button", { name: "Check for Updates" }));

    await waitFor(() => {
      expect(onUpdateFound).toHaveBeenCalledWith(fakeUpdate);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows error message when manual update check fails", async () => {
    mockCheckForAppUpdateManual.mockRejectedValueOnce(new Error("GitHub unreachable"));

    render(<HeaderMenu onOpenSheets={onOpenSheets} onSync={onSync} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Check for Updates" }));

    expect(await screen.findByRole("status")).toHaveTextContent("GitHub unreachable");
  });
});
