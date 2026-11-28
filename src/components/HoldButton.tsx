import { useState, useRef, useCallback, useEffect } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// =============================================================================
// HoldButton - Button that requires holding for confirmation
// =============================================================================

interface HoldButtonProps extends Omit<ButtonProps, "onClick" | "type" | "className"> {
  onConfirm: () => void;
  holdDuration?: number; // ms, default 1000
  className?: string;
}

export function HoldButton({
  onConfirm,
  holdDuration = 1000,
  children,
  className,
  title,
  disabled,
  variant = "primary",
  size = "default",
  shape = "pill",
  ...buttonProps
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopHolding = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startHolding = useCallback(() => {
    if (disabled) return;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
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
  }, [disabled, holdDuration, onConfirm]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      shape={shape}
      disabled={disabled}
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      className={cn("relative isolate overflow-hidden", className)}
      title={title || "Hold to confirm"}
      {...buttonProps}
    >
      {/* Progress overlay using transform (no width animation) */}
      {isHolding && (
        <div
          className="pointer-events-none absolute inset-0 bg-accent-ink/20 origin-left"
          style={{ transform: `scaleX(${progress / 100})` }}
          aria-hidden="true"
        />
      )}
      <span className="relative inline-flex items-center justify-center gap-2 [&>[data-icon=inline-start]]:-ml-0.5 [&>[data-icon=inline-end]]:-mr-0.5">
        {children}
      </span>
    </Button>
  );
}
