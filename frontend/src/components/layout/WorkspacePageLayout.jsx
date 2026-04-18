import { cn } from "@/lib/utils";

/** Native `<select>` styling aligned with workspace UI (navy focus ring). */
export const WORKSPACE_SELECT_CLASS =
  "h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200/90 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-[#0b1f4d]/35 focus:outline-none focus:ring-2 focus:ring-[#0b1f4d]/12 sm:w-auto sm:min-w-[140px]";

/** List tables under workspace pages — readable type + relaxed line height in body cells. */
export const WORKSPACE_DATA_TABLE_CLASS =
  "!table-auto md:!table-fixed text-xs sm:text-[13px] [&_thead>tr>th]:whitespace-nowrap [&_tbody>tr>td]:leading-snug [&_tbody>tr>td]:align-middle";

export function WorkspacePageLayout({ children, className }) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-7xl", className)}>
      {children}
    </div>
  );
}

/**
 * Page title row: navy headline, optional subtitle, right-aligned actions.
 */
export function WorkspacePageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "text-2xl font-bold tracking-tight text-[#0b1f4d] sm:text-[1.65rem]",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Filters / search strip */
export function WorkspaceToolbar({ children, className }) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Segmented control for view toggles (e.g. My pending / All).
 * @param {{ value: string, onChange: (v: string) => void, options: { value: string, label: string, icon?: React.ReactNode }[] }} props
 */
export function WorkspaceSegmentedControl({
  value,
  onChange,
  options,
  className,
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-full flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner",
        className,
      )}
      role="group"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-[44px] flex-1 basis-[calc(50%-2px)] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-center text-xs font-semibold leading-snug transition-all sm:min-h-0 sm:flex-none sm:basis-auto sm:px-3.5 sm:text-sm",
              active
                ? "bg-white text-[#0b1f4d] shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {opt.icon}
            <span className="break-words">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
