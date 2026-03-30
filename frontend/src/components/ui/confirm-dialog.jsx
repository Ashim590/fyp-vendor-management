import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Centered confirmation modal (replaces window.confirm). Uses viewport-centered Radix dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}) {
  const [busy, setBusy] = React.useState(false);
  const isDanger = variant === "destructive";

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleConfirm = async () => {
    if (!onConfirm || busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChange = (next) => {
    if (!next && busy) return;
    onOpenChange?.(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        onPointerDownOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        className={cn(
          "gap-0 overflow-hidden border-slate-200/90 p-0 shadow-2xl sm:max-w-[440px]",
          "rounded-2xl",
        )}
      >
        <div className="flex gap-4 p-6">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              isDanger ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700",
            )}
            aria-hidden
          >
            {isDanger ? (
              <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Info className="h-5 w-5" strokeWidth={2} />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="pr-2 text-lg font-semibold leading-snug text-slate-900">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-sm leading-relaxed text-slate-600">
                  {description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
          </div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
            className="min-w-[96px] rounded-xl"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? "destructive" : "default"}
            disabled={busy}
            onClick={handleConfirm}
            className="min-w-[96px] rounded-xl"
          >
            {busy ? "Please wait…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
