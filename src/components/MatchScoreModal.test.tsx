import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchScoreModal } from "./MatchScoreModal";

// =============================================================================
// MatchScoreModal Tests
// =============================================================================

describe("MatchScoreModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  describe("rendering", () => {
    it("should not render when isOpen is false", () => {
      render(
        <MatchScoreModal
          isOpen={false}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText(/Team \d Won!/)).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("🏆 Team 1 Won!")).toBeInTheDocument();
    });

    it("should display correct winning team number", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={2}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("🏆 Team 2 Won!")).toBeInTheDocument();
    });

    it("should have default score values of 4-0", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
      const loserInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;

      expect(winnerInput.value).toBe("4");
      expect(loserInput.value).toBe("0");
    });

    it("should render Cancel, Skip, and Confirm buttons", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Skip")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });
  });

  describe("score validation", () => {
    it("should show error when winner score is not greater than loser", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0];
      const loserInput = screen.getAllByRole("spinbutton")[1];

      fireEvent.change(winnerInput, { target: { value: "3" } });
      fireEvent.change(loserInput, { target: { value: "3" } });
      fireEvent.click(screen.getByText("Confirm"));

      expect(screen.getByText("Winner's score must be higher than loser's")).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should show error when winner score is less than loser", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0];
      const loserInput = screen.getAllByRole("spinbutton")[1];

      fireEvent.change(winnerInput, { target: { value: "2" } });
      fireEvent.change(loserInput, { target: { value: "4" } });
      fireEvent.click(screen.getByText("Confirm"));

      expect(screen.getByText("Winner's score must be higher than loser's")).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should show error when winner score is less than 1", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0];
      const loserInput = screen.getAllByRole("spinbutton")[1];

      fireEvent.change(winnerInput, { target: { value: "0" } });
      fireEvent.change(loserInput, { target: { value: "0" } });
      fireEvent.click(screen.getByText("Confirm"));

      expect(screen.getByText("Winner's score must be higher than loser's")).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe("button actions", () => {
    it("should call onCancel when Cancel button is clicked", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText("Cancel"));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("should call onConfirm with default scores when Confirm is clicked", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText("Confirm"));
      // Default is 4-0 with no cash scores
      expect(mockOnConfirm).toHaveBeenCalledWith(4, 0, undefined, undefined, undefined, undefined);
    });

    it("should call onConfirm with custom scores", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0];
      const loserInput = screen.getAllByRole("spinbutton")[1];

      fireEvent.change(winnerInput, { target: { value: "5" } });
      fireEvent.change(loserInput, { target: { value: "3" } });
      fireEvent.click(screen.getByText("Confirm"));

      expect(mockOnConfirm).toHaveBeenCalledWith(5, 3, undefined, undefined, undefined, undefined);
    });

    it("should call onConfirm with 1-0 when Skip is clicked", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText("Skip"));
      expect(mockOnConfirm).toHaveBeenCalledWith(1, 0);
    });

    it("should pass cash scores when provided", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const inputs = screen.getAllByRole("spinbutton");
      // Cash inputs are at index 2 and 3 (after score inputs)
      const team1CashInput = inputs[2];
      const team2CashInput = inputs[3];

      fireEvent.change(team1CashInput, { target: { value: "15000" } });
      fireEvent.change(team2CashInput, { target: { value: "8000" } });
      fireEvent.click(screen.getByText("Confirm"));

      expect(mockOnConfirm).toHaveBeenCalledWith(4, 0, 15000, 8000, undefined, undefined);
    });
  });

  describe("roll factor preview", () => {
    it("should show stomp message for 4-0 score", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Default is 4-0, which is a stomp
      expect(screen.getByText(/Stomp!/)).toBeInTheDocument();
    });

    it("should show close game message for 4-3 score", () => {
      render(
        <MatchScoreModal
          isOpen={true}
          winningTeam={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const winnerInput = screen.getAllByRole("spinbutton")[0];
      const loserInput = screen.getAllByRole("spinbutton")[1];

      fireEvent.change(winnerInput, { target: { value: "4" } });
      fireEvent.change(loserInput, { target: { value: "3" } });

      // 4-3: factor = 1/4 = 0.25 >= 0.25 -> "Close game"
      expect(screen.getByText(/Close game/)).toBeInTheDocument();
    });
  });
});
