import { useState, useRef, useCallback } from "react";

// =============================================================================
// HoldButton - Button that requires holding for confirmation
// =============================================================================

interface HoldButtonProps {
  onConfirm: () => void;
  holdDuration?: number; // ms, default 1000
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function HoldButton({
  onConfirm,
  holdDuration = 1000,
  children,
  className = "",
  title,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startHolding = useCallback(() => {
    setIsHolding(true);
    startTimeRef.current = Date.now();

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / holdDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsHolding(false);
        setProgress(0);
        onConfirm();
      }
    }, 16);
  }, [holdDuration, onConfirm]);

  const stopHolding = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
  }, []);

  return (
    <button
      type="button"
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      className={`relative overflow-hidden ${className}`}
      title={title || "Hold to confirm"}
    >
      {/* Progress overlay using transform (no width animation) */}
      {isHolding && (
        <div
          className="absolute inset-0 bg-accent-ink/20 origin-left"
          style={{ transform: `scaleX(${progress / 100})` }}
          aria-hidden="true"
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
