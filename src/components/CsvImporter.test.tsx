import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CsvImporter } from "./CsvImporter";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";

const mockExportCsvFile = vi.fn();
const mockOpenExportFolder = vi.fn();
const mockTriggerBrowserDownload = vi.fn();

vi.mock("@services/csvExport", () => ({
  exportCsvFile: (...args: unknown[]) => mockExportCsvFile(...args),
  openExportFolder: (...args: unknown[]) => mockOpenExportFolder(...args),
  triggerBrowserDownload: (...args: unknown[]) =>
    mockTriggerBrowserDownload(...args),
}));

function buildCsv(battletags: string[]): string {
  const header =
    "battletag,tank_rank,dps_rank,support_rank,roles_willing,role_preference,hero_pool";
  const rows = battletags.map(
    (bt) => `${bt},Pro 2,,Pro 3,"Tank,Support","Tank,Support","Reinhardt,Ana"`
  );
  return [header, ...rows].join("\n");
}

function uploadCsvFile(container: HTMLElement, csvContent: string, name = "roster.csv") {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csvContent], name, { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve(csvContent),
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("CsvImporter merge prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState(usePlayerStore.getInitialState());
    useSessionStore.setState(useSessionStore.getInitialState());
  });

  it("imports immediately when no existing players are loaded", async () => {
    const { container } = render(<CsvImporter />);
    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2", "Charlie#3"]));

    await waitFor(() => {
      expect(usePlayerStore.getState().players.size).toBe(3);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reminds user about missing existing players and merges selected ones", async () => {
    const { container } = render(<CsvImporter />);
    uploadCsvFile(
      container,
      buildCsv(["Alpha#1", "Bravo#2", "Charlie#3", "Delta#4", "Echo#5"])
    );
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(5));

    // Re-import smaller CSV missing Delta#4 and Echo#5 (plus case-variant alpha#1)
    uploadCsvFile(container, buildCsv(["alpha#1", "Bravo#2", "Charlie#3"]));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Keep Existing Players?")).toBeInTheDocument();
    expect(screen.getByLabelText("Keep Delta#4")).toBeChecked();
    expect(screen.getByLabelText("Keep Echo#5")).toBeChecked();
    expect(screen.queryByLabelText("Keep Alpha#1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add & Import (5)" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const finalTags = Array.from(usePlayerStore.getState().players.keys());
    expect(finalTags).toHaveLength(5);
    expect(finalTags).toContain("Delta#4");
    expect(finalTags).toContain("Echo#5");
  });

  it("allows unchecking specific missing players before merging", async () => {
    const { container } = render(<CsvImporter />);
    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2", "Extra1#1", "Extra2#2"]));
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(4));

    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2"]));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByLabelText("Keep Extra1#1"));
    expect(screen.getByLabelText("Keep Extra1#1")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Add & Import (3)" }));

    const finalTags = Array.from(usePlayerStore.getState().players.keys());
    expect(finalTags).toEqual(["Alpha#1", "Bravo#2", "Extra2#2"]);
  });

  it("lets user replace roster with only the new CSV", async () => {
    const { container } = render(<CsvImporter />);
    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2", "Extra#3"]));
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(3));

    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2"]));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "New CSV Only (2)" }));

    const finalTags = Array.from(usePlayerStore.getState().players.keys());
    expect(finalTags).toEqual(["Alpha#1", "Bravo#2"]);
  });

  it("shows Replace Roster prompt when no existing players are missing", async () => {
    const { container } = render(<CsvImporter />);
    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2"]));
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(2));

    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2", "Charlie#3"]));
    await screen.findByRole("dialog");
    expect(screen.getByText("Replace Roster?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(usePlayerStore.getState().players.size).toBe(2);
  });

  it("exports CSV via csvExport service and shows saved location in Details", async () => {
    mockExportCsvFile.mockResolvedValueOnce({
      location: "C:\\Users\\Jenny\\Documents\\SwoosPugsBalancer\\export\\pugs-players.csv",
      isDesktopExport: true,
    });

    const { container } = render(<CsvImporter />);
    uploadCsvFile(container, buildCsv(["Alpha#1", "Bravo#2"]));
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(await screen.findByText(/Exported 2 players/)).toBeInTheDocument();
    expect(mockExportCsvFile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(
      screen.getByText(/SwoosPugsBalancer\\export\\pugs-players\.csv/)
    ).toBeInTheDocument();
  });

  it("opens export folder directly when Open Export Folder is clicked", async () => {
    mockOpenExportFolder.mockResolvedValueOnce(
      "C:\\Users\\Jenny\\Documents\\SwoosPugsBalancer\\export"
    );

    render(<CsvImporter />);
    fireEvent.click(screen.getByRole("button", { name: "Open Export Folder" }));

    await waitFor(() => {
      expect(mockOpenExportFolder).toHaveBeenCalledTimes(1);
    });
  });

  it("displays warning details automatically on import and cleanly round-trips exported CSV", async () => {
    let exportedCsv = "";
    mockExportCsvFile.mockImplementationOnce(async (_filename: string, csv: string) => {
      exportedCsv = csv;
      return {
        location: "C:\\Users\\Jenny\\Documents\\SwoosPugsBalancer\\export\\pugs-players.csv",
        isDesktopExport: true,
      };
    });

    const { container } = render(<CsvImporter />);
    uploadCsvFile(
      container,
      "battletag,tank_rank,roles_willing,hero_pool\nWarnPlayer#1,Pro 2,Tank,"
    );

    expect(
      await screen.findByText(/Imported 1 players \(1 warning\)\. Session stats and lobby cleared\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Row 2: No heroes specified, archetype checks will be skipped/)
    ).toBeInTheDocument();

    // Hide & re-open Details toggle works
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(
      screen.queryByText(/Row 2: No heroes specified, archetype checks will be skipped/)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(
      screen.getByText(/Row 2: No heroes specified, archetype checks will be skipped/)
    ).toBeInTheDocument();

    // Clean round-trip: import clean roster, export, replace roster with exported CSV -> 0 warnings
    uploadCsvFile(container, buildCsv(["Clean#1", "Clean#2"]));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "New CSV Only (2)" }));
    await waitFor(() => expect(usePlayerStore.getState().players.size).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mockExportCsvFile).toHaveBeenCalledTimes(1));

    uploadCsvFile(container, exportedCsv);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Replace Roster" }));
    expect(
      await screen.findByText("Imported 2 players. Session stats and lobby cleared.")
    ).toBeInTheDocument();
  });
});
