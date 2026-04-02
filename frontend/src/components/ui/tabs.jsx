import * as React from "react";

import { cn } from "@/lib/utils";

const TabsContext = React.createContext(null);

/**
 * Lightweight controlled tabs (matches Radix-style API used in the app).
 * Parent passes `value` + `onValueChange`; triggers update it, only matching content mounts.
 */
const Tabs = React.forwardRef(
  ({ className, value, onValueChange, children, ...props }, ref) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} ref={ref} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  ),
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef(
  ({ className, value: tabValue, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const active = ctx?.value === tabValue;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={active}
        data-state={active ? "active" : "inactive"}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          className,
        )}
        onClick={() => ctx?.onValueChange?.(tabValue)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef(
  ({ className, value: tabValue, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    if (ctx?.value !== tabValue) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
