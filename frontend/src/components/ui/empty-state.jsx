import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Centered empty list / zero-results block with optional primary + secondary actions.
 */
export function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  /** `{ label, to }` — primary button-style link */
  action,
  /** `{ label, to }` — text link below primary */
  secondaryAction,
  compact = false,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "py-5 px-2" : "py-10 px-4 sm:py-12",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mb-3 rounded-full bg-slate-100 text-slate-500",
            compact ? "mb-2 p-2" : "p-3",
          )}
          aria-hidden
        >
          <Icon
            className={cn(compact ? "h-5 w-5" : "h-7 w-7")}
            strokeWidth={1.5}
          />
        </div>
      ) : null}
      <p
        className={cn(
          "font-semibold text-slate-900",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            "mt-2 max-w-md text-slate-600",
            compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
          )}
        >
          {description}
        </p>
      ) : null}
      {(action?.to || secondaryAction?.to) && (
        <div
          className={cn(
            "mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center",
            compact && "mt-3",
          )}
        >
          {action?.to ? (
            <Link
              to={action.to}
              className={cn(
                "inline-flex items-center justify-center rounded-lg bg-[#0b1f4d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a1a42]",
                compact && "py-2 text-xs",
              )}
            >
              {action.label}
            </Link>
          ) : null}
          {secondaryAction?.to ? (
            <Link
              to={secondaryAction.to}
              className={cn(
                "inline-flex items-center justify-center text-sm font-semibold text-teal-800 underline-offset-2 hover:underline",
                compact && "text-xs",
              )}
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
