import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { WorkspacePageLayout } from "../layout/WorkspacePageLayout";
import { getAllInvoices } from "@/redux/invoiceSlice";

/**
 * Landing page after eSewa redirects for invoice payments (server redirects here with query params).
 */
export default function InvoiceEsewaReturn() {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const esewaStatus = searchParams.get("esewaStatus");
  const paymentId = searchParams.get("paymentId");

  const isSuccessPath = pathname.endsWith("/success");
  const ok = isSuccessPath && String(status || "").toUpperCase() === "PAID";

  useEffect(() => {
    if (ok) {
      dispatch(getAllInvoices({ limit: 100 }));
    }
  }, [ok, dispatch]);

  return (
    <WorkspacePageLayout className="py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Payment recorded</h1>
            <p className="mt-2 text-sm text-slate-600">
              eSewa confirmed this invoice payment. The invoice status will update to paid.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-14 w-14 text-rose-500" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Payment not completed
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {esewaStatus
                ? `eSewa status: ${esewaStatus}. If you were charged, contact procurement with your reference.`
                : "The payment did not finish or could not be verified. You can try again from Invoices."}
            </p>
          </>
        )}
        {paymentId && (
          <p className="mt-4 font-mono text-xs text-slate-500">Reference: {paymentId}</p>
        )}
        <Link
          to="/invoices"
          className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Back to invoices
        </Link>
      </div>
    </WorkspacePageLayout>
  );
}
