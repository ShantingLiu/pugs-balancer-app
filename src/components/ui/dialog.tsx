import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Root dialog state container. */
function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

/** Element that opens the dialog when activated. */
function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** Portal container for dialog overlay and content. */
function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** Element that closes the dialog when activated. */
function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** Backdrop overlay styled with .app-backdrop and smooth enter/exit transitions. */
function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "app-backdrop fixed inset-0 z-[var(--z-modal)] transition-opacity duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

/** Portaled modal surface styled with .app-modal and optional close button. */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "app-modal fixed top-1/2 left-1/2 z-[var(--z-modal)] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 p-6 text-ink outline-none sm:max-w-lg transition-[opacity,scale,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Close"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-sky-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/** Header layout wrapper for DialogTitle and DialogDescription. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

/** Footer actions container for Dialog. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

/** Accessible dialog heading. */
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "app-display text-lg font-semibold leading-tight text-heading",
        className
      )}
      {...props}
    />
  );
}

/** Accessible supporting description for Dialog. */
function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-ink-2", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
