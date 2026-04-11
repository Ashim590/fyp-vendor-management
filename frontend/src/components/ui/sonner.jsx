import { Toaster as Sonner } from "sonner";

/**
 * Toasts are short-lived feedback (success/errors) with Sonner’s built-in motion;
 * they sit apart from the persisted notification list on /notifications.
 */
const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      duration={4500}
      visibleToasts={5}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group toast border border-stone-200/90 bg-white/95 text-stone-900 shadow-premium backdrop-blur-md font-sans data-[swipe=end]:animate-out data-[swipe=move]:transition-transform data-[closed]:fade-out-80",
          description: "group-[.toast]:text-stone-500",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-slate-900 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:border group-[.toast]:border-stone-200 group-[.toast]:bg-stone-50 group-[.toast]:text-stone-700",
          closeButton:
            "group-[.toast]:border-stone-200 group-[.toast]:bg-white group-[.toast]:text-stone-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
