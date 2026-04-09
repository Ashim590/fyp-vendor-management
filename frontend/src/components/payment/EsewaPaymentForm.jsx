import React, { useEffect, useRef } from "react";

/**
 * Auto-submits a POST form to eSewa's checkout URL (v2).
 * All fields including signature must be hidden inputs matching server payload keys.
 */
export function EsewaPaymentForm({ checkoutUrl, payload, onCancel }) {
  const formRef = useRef(null);

  useEffect(() => {
    if (!checkoutUrl || !payload) return;
    // Defer so the form is in the DOM; eSewa expects POST (GET on checkout URL often returns 404).
    const t = window.setTimeout(() => {
      formRef.current?.submit();
    }, 50);
    return () => window.clearTimeout(t);
  }, [checkoutUrl, payload]);

  if (!checkoutUrl || !payload) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          Redirecting to eSewa…
        </h2>
        {onCancel && (
          <button
            type="button"
            className="mt-4 text-sm font-medium text-teal-700 hover:underline"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <form
          ref={formRef}
          method="POST"
          action={checkoutUrl}
          className="sr-only"
        >
          {Object.entries(payload).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value ?? ""} />
          ))}
        </form>
      </div>
    </div>
  );
}

export default EsewaPaymentForm;
