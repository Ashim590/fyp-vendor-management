import React from "react";

/**
 * Simple Tailwind skeleton for demo/prod polish.
 * Uses `animate-pulse` for subtle loading placeholders.
 */
export function LoadingSkeleton({
  className = "",
  variant = "box",
  style = {},
  children
}) {
  if (variant === "text") {
    return (
      <div className={`animate-pulse bg-slate-200/80 rounded ${className}`} style={style}>
        {children}
      </div>
    );
  }

  return <div className={`animate-pulse bg-slate-200/80 rounded ${className}`} style={style} />;
}

