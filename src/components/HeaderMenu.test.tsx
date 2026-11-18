import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HeaderMenu } from "./HeaderMenu";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";

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
});
