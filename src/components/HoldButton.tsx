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
        // Confirmed!
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsHolding(false);
        setProgress(0);
        onConfirm();
      }
    }, 16); // ~60fps
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
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      className={`relative overflow-hidden ${className}`}
      title={title || "Hold to confirm"}
    >
      {/* Progress overlay */}
      {isHolding && (
        <div
          className="absolute inset-0 bg-white/20 transition-none"
          style={{ width: `${progress}%` }}
        />
      )}
      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
