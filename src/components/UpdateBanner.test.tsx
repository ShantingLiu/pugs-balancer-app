import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateBanner } from "./UpdateBanner";
import type { Update } from "@services/updater";

const mockCheckForAppUpdate = vi.fn();
const mockInstallAppUpdate = vi.fn();

vi.mock("@services/updater", () => ({
  checkForAppUpdate: (...args: unknown[]) => mockCheckForAppUpdate(...args),
  installAppUpdate: (...args: unknown[]) => mockInstallAppUpdate(...args),
}));

function makeMockUpdate(overrides?: Partial<Update>): Update {
  return {
    rid: 1,
    available: true,
    currentVersion: "1.1.0",
    version: "1.2.0",
    rawJson: {},
    download: vi.fn(),
    install: vi.fn(),
    downloadAndInstall: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Update;
}

describe("UpdateBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no update is available", async () => {
    mockCheckForAppUpdate.mockResolvedValue(null);
    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(mockCheckForAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(container.firstChild).toBeNull();
  });

  it("silently ignores background check errors", async () => {
    mockCheckForAppUpdate.mockRejectedValue(new Error("offline"));
    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(mockCheckForAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows update details and installs on Update & Restart", async () => {
    const mockUpdate = makeMockUpdate();
    mockCheckForAppUpdate.mockResolvedValue(mockUpdate);

    let resolveInstall!: () => void;
    mockInstallAppUpdate.mockImplementation(
      (_update: Update, onProgress?: (p: { downloadedBytes: number; totalBytes: number | null }) => void) => {
        onProgress?.({ downloadedBytes: 50, totalBytes: 100 });
        return new Promise<void>((resolve) => {
          resolveInstall = resolve;
        });
      },
    );

    render(<UpdateBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent("v1.2.0");
    expect(screen.getByRole("status")).toHaveTextContent("current: v1.1.0");

    fireEvent.click(screen.getByRole("button", { name: "Update & Restart" }));

    expect(mockInstallAppUpdate).toHaveBeenCalledWith(mockUpdate, expect.any(Function));
    expect(await screen.findByRole("status")).toHaveTextContent("50%");
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();

    resolveInstall();
  });

  it("shows error with Retry and closes resource when dismissed", async () => {
    const mockUpdate = makeMockUpdate();
    mockCheckForAppUpdate.mockResolvedValue(mockUpdate);
    mockInstallAppUpdate.mockRejectedValueOnce(new Error("network drop"));

    const { container } = render(<UpdateBanner />);

    await screen.findByRole("button", { name: "Update & Restart" });
    fireEvent.click(screen.getByRole("button", { name: "Update & Restart" }));

    expect(await screen.findByRole("status")).toHaveTextContent("network drop");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss update notification" }));
    expect(mockUpdate.close).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
  });

  it("renders externalUpdate triggered manually and calls onClearExternalUpdate when dismissed", async () => {
    mockCheckForAppUpdate.mockResolvedValue(null);
    const externalUpdate = makeMockUpdate({ version: "1.3.3", currentVersion: "1.3.2" });
    const onClearExternalUpdate = vi.fn();

    render(
      <UpdateBanner
        externalUpdate={externalUpdate}
        onClearExternalUpdate={onClearExternalUpdate}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("v1.3.3");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss update notification" }));
    expect(externalUpdate.close).toHaveBeenCalledTimes(1);
    expect(onClearExternalUpdate).toHaveBeenCalledTimes(1);
  });
});
