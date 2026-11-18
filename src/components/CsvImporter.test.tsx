import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CsvImporter } from "./CsvImporter";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";

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
});
