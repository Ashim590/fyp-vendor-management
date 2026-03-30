import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import axios from "axios";
import { getAllInvoices } from "@/redux/invoiceSlice";
import { useSearchParams } from "react-router-dom";
import { PAYMENT_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
} from "../layout/WorkspacePageLayout";
import { EsewaPaymentForm } from "./EsewaPaymentForm";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function VendorPayments() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${PAYMENT_API_END_POINT}/my`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      });
      setPayments(data.payments || []);
    } catch {
      toast.error("Could not load payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ps = searchParams.get("paymentStatus");
    if (ps === "completed") {
      toast.success("eSewa reported a successful payment. Refreshing status…");
      load();
      dispatch(getAllInvoices({ limit: 100 }));
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    } else if (ps === "failed" || ps === "cancelled") {
      toast.error(
        ps === "cancelled"
          ? "Payment was cancelled or not completed."
          : "Payment could not be verified. Contact support if money was debited.",
      );
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, load, dispatch]);

  const startEsewa = async (paymentId) => {
    try {
      const { data } = await axios.post(
        `${PAYMENT_API_END_POINT}/${paymentId}/esewa/initiate`,
        {},
        {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        },
      );
      if (!data?.success || !data.checkoutUrl || !data.payload) {
        throw new Error(data?.message || "Could not start eSewa");
      }
      setCheckout({ checkoutUrl: data.checkoutUrl, payload: data.payload });
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e?.message || "Could not start eSewa checkout.",
      );
    }
  };

  const statusBadge = (status) => {
    const map = {
      Pending: "statusWarning",
      Completed: "statusSuccess",
      Failed: "statusDanger",
    };
    return (
      <Badge variant={map[status] || "statusMuted"} className="whitespace-nowrap">
        {status}
      </Badge>
    );
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="My tender payments"
        description="Pay awarded tender fees securely via eSewa when procurement opens a payment request."
      />

      {checkout && (
        <EsewaPaymentForm
          checkoutUrl={checkout.checkoutUrl}
          payload={checkout.payload}
          onCancel={() => setCheckout(null)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Tender</th>
              <th className="px-4 py-3 text-right">Amount (NPR)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 className="inline h-5 w-5 animate-spin text-teal-600" />
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No tender payments yet. They appear when procurement records a payment
                  for an awarded tender.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{p.paymentNumber}</td>
                  <td className="px-4 py-3">
                    {p.tender?.title || p.tenderReference || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(p.amount || 0).toLocaleString("en-NP")}
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "Pending" ? (
                      <Button size="sm" type="button" onClick={() => startEsewa(p._id)}>
                        Pay with eSewa
                      </Button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePageLayout>
  );
}
