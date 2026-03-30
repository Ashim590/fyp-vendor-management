import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-stone-200/90 bg-white/95 text-stone-900 shadow-premium backdrop-blur-md font-sans",
          description: "group-[.toast]:text-stone-500",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-slate-900 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:border group-[.toast]:border-stone-200 group-[.toast]:bg-stone-50 group-[.toast]:text-stone-700",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
