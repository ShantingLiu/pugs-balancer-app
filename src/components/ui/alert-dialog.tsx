import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Root confirmation dialog state container. */
function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root {...props} />;
}

/** Trigger that opens the AlertDialog. */
function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

/** Portal wrapper for AlertDialog. */
function AlertDialogPortal(props: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

/** Backdrop overlay styled with .app-backdrop and smooth enter/exit transitions. */
function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "app-backdrop fixed inset-0 z-[var(--z-modal)] transition-opacity duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

/** Portaled confirmation modal surface styled with .app-modal. */
function AlertDialogContent({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm";
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "app-modal fixed top-1/2 left-1/2 z-[var(--z-modal)] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 p-6 text-ink outline-none data-[size=sm]:max-w-sm data-[size=default]:sm:max-w-md transition-[opacity,scale,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

/** Header layout wrapper for AlertDialogTitle and AlertDialogDescription. */
function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

/** Footer action row for AlertDialogCancel and AlertDialogAction. */
function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

/** Accessible title for AlertDialog. */
function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "app-display text-lg font-semibold leading-tight text-heading",
        className
      )}
      {...props}
    />
  );
}

/** Accessible description for AlertDialog. */
function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-ink-2", className)}
      {...props}
    />
  );
}

/** Confirm action button inside AlertDialogFooter. */
function AlertDialogAction({
  className,
  variant = "primary",
  size = "default",
  shape = "pill",
  ...props
}: ButtonProps) {
  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      shape={shape}
      className={cn(className)}
      {...props}
    />
  );
}

/** Cancel button inside AlertDialogFooter that closes the AlertDialog. */
function AlertDialogCancel({
  className,
  variant = "secondary",
  size = "default",
  shape = "pill",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<ButtonProps, "variant" | "size" | "shape">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} size={size} shape={shape} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
};
