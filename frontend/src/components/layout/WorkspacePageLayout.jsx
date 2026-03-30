import { cn } from "@/lib/utils";

/** Native `<select>` styling aligned with workspace UI (navy focus ring). */
export const WORKSPACE_SELECT_CLASS =
  "h-10 min-w-[140px] cursor-pointer rounded-lg border border-slate-200/90 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-[#0b1f4d]/35 focus:outline-none focus:ring-2 focus:ring-[#0b1f4d]/12";

export function WorkspacePageLayout({ children, className }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl", className)}>{children}</div>
  );
}

/**
 * Page title row: navy headline, optional subtitle, right-aligned actions.
 */
export function WorkspacePageHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[#0b1f4d] sm:text-[1.65rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
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
export function WorkspaceSegmentedControl({ value, onChange, options, className }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner",
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
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all",
              active
                ? "bg-white text-[#0b1f4d] shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
