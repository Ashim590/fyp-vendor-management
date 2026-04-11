import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent loading UI: spinner + label. Use `table` inside a full-width TableCell.
 */
export function LoadingState({
  variant = "page",
  label = "Loading…",
  className,
  /** Hide visible label (keeps sr-only for a11y) */
  labelHidden = false,
}) {
  const spinnerClass =
    variant === "page"
      ? "h-8 w-8 text-teal-600"
      : variant === "compact"
        ? "h-5 w-5 text-teal-600"
        : variant === "inline"
          ? "h-3.5 w-3.5 shrink-0 text-teal-600"
          : "h-4 w-4 shrink-0 text-teal-600";

  const body = (
    <>
      <Loader2 className={cn("animate-spin", spinnerClass)} aria-hidden />
      <span className="sr-only">{label}</span>
      {!labelHidden ? (
        <span className="text-sm font-medium text-slate-600">{label}</span>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <span
        className={cn("inline-flex items-center gap-2 text-slate-500", className)}
      >
        {body}
      </span>
    );
  }

  if (variant === "table") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-8 text-slate-600",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-6 text-slate-600",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-slate-600 sm:py-12",
        className,
      )}
    >
      {body}
    </div>
  );
}
