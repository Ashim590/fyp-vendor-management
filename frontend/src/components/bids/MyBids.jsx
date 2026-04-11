import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { BID_API_END_POINT, PAYMENT_API_END_POINT } from "@/utils/constant";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { toast } from "sonner";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceSegmentedControl,
} from "../layout/WorkspacePageLayout";
import { EmptyState } from "../ui/empty-state";
import { FileText } from "lucide-react";
import { getApiErrorMessage } from "@/utils/apiError";
import { getTechnicalProposalDisplayText } from "@/utils/technicalProposal";

const statusConfig = {
  SUBMITTED: { label: "Pending", variant: "statusWarning" },
  UNDER_REVIEW: { label: "Under review", variant: "statusInfo" },
  ACCEPTED: { label: "Accepted", variant: "statusSuccess" },
  REJECTED: { label: "Not selected", variant: "statusDanger" },
};

const MyBids = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bids, setBids] = useState([]);
  const [paymentsByTender, setPaymentsByTender] = useState({});
  const [loading, setLoading] = useState(true);
  const [openBidId, setOpenBidId] = useState(null);
  const [quotationFilter, setQuotationFilter] = useState(
    /** @type {"all" | "selected" | "not_selected"} */ ("all"),
  );

  const quotationFilterCounts = useMemo(() => {
    const selected = bids.filter((b) => b.status === "ACCEPTED").length;
    const notSelected = bids.filter((b) => b.status !== "ACCEPTED").length;
    return { all: bids.length, selected, notSelected };
  }, [bids]);

  const filteredBids = useMemo(() => {
    if (quotationFilter === "selected") {
      return bids.filter((b) => b.status === "ACCEPTED");
    }
    if (quotationFilter === "not_selected") {
      return bids.filter((b) => b.status !== "ACCEPTED");
    }
    return bids;
  }, [bids, quotationFilter]);

  const loadBids = () => {
    setLoading(true);
    axios
      .get(`${BID_API_END_POINT}/my`, {
        withCredentials: true,
        params: { limit: 100 },
      })
      .then((res) => setBids(res.data.bids || []))
      .catch(() => setBids([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBids();
    axios
      .get(`${PAYMENT_API_END_POINT}/my`, {
        withCredentials: true,
        params: { limit: 200 },
      })
      .then((res) => {
        const list = Array.isArray(res?.data?.payments) ? res.data.payments : [];
        const map = {};
        list.forEach((p) => {
          const tid = String(p?.tender?._id || p?.tender || "");
          if (!tid) return;
          if (!map[tid]) map[tid] = p;
        });
        setPaymentsByTender(map);
      })
      .catch(() => setPaymentsByTender({}));
  }, []);

  useEffect(() => {
    if (!bids.length) return;
    const openBid = searchParams.get("openBid");
    if (!openBid) return;
    const matched = bids.find((b) => String(b._id) === String(openBid));
    if (!matched) return;
    setOpenBidId(matched._id);
    const next = new URLSearchParams(searchParams);
    next.delete("openBid");
    setSearchParams(next, { replace: true });
  }, [bids, searchParams, setSearchParams]);

  const handleWithdrawBid = (bidId) => {
    if (
      !confirm(
        "Withdraw this quotation? You can submit again only if the tender is still open.",
      )
    ) {
      return;
    }
    axios
      .delete(`${BID_API_END_POINT}/${bidId}`, { withCredentials: true })
      .then(() => {
        toast.success("Quotation withdrawn.");
        loadBids();
      })
      .catch((err) =>
        toast.error(getApiErrorMessage(err, "Could not withdraw.")),
      );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <WorkspacePageLayout className="max-w-4xl">
        <WorkspacePageHeader title="My tender quotations" />
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <LoadingSkeleton className="h-4 w-2/3 mb-2" />
                  <LoadingSkeleton className="h-3 w-full mb-2" />
                  <LoadingSkeleton className="h-3 w-5/6" />
                </div>
                <LoadingSkeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        ) : bids.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <EmptyState
              icon={FileText}
              title="No quotations yet"
              description="Submit a quotation from an open tender to see it tracked here with status and payment info."
              action={{ label: "Browse tenders", to: "/tenders" }}
              secondaryAction={{ label: "Vendor dashboard", to: "/" }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <WorkspaceSegmentedControl
              value={quotationFilter}
              onChange={setQuotationFilter}
              options={[
                {
                  value: "all",
                  label: `All (${quotationFilterCounts.all})`,
                },
                {
                  value: "selected",
                  label: `Selected (${quotationFilterCounts.selected})`,
                },
                {
                  value: "not_selected",
                  label: `Not selected (${quotationFilterCounts.notSelected})`,
                },
              ]}
              className="w-full max-w-xl flex-wrap sm:flex-nowrap"
            />
            {filteredBids.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm font-medium text-slate-600">
                No quotations match this filter. Try{" "}
                <button
                  type="button"
                  className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  onClick={() => setQuotationFilter("all")}
                >
                  All
                </button>
                .
              </p>
            ) : null}
            {filteredBids.map((bid) => {
              const cfg = statusConfig[bid.status] || statusConfig.SUBMITTED;
              const t = bid.tender;
              const docs = Array.isArray(bid.documents) ? bid.documents : [];
              const isOpen = openBidId === bid._id;
              const tenderId = String(t?._id || t || "");
              const myPayment = paymentsByTender[tenderId] || null;
              const techDisplay = getTechnicalProposalDisplayText(
                bid.technicalProposal,
              );
              return (
                <div
                  key={bid._id}
                  className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="font-semibold text-slate-900">
                        {t?.title || "Tender"}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">
                        {t?.referenceNumber}
                      </p>
                      <p className="text-slate-700 mt-2">
                        <span className="text-slate-500 text-sm">
                          Total (incl. VAT):{" "}
                        </span>
                        <span className="font-semibold">
                          NPR {Number(bid.amount).toLocaleString("en-NP")}
                        </span>
                      </p>
                      {bid.amountExcludingVat != null &&
                        bid.vatAmount != null && (
                          <p className="text-xs text-slate-500">
                            Excl. VAT NPR{" "}
                            {Number(bid.amountExcludingVat).toLocaleString(
                              "en-NP",
                            )}{" "}
                            · VAT NPR{" "}
                            {Number(bid.vatAmount).toLocaleString("en-NP")}
                          </p>
                        )}
                      {techDisplay ? (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-wrap">
                          {techDisplay}
                        </p>
                      ) : null}
                      {bid.rejectionReason && (
                        <p className="text-sm text-red-600 mt-2">
                          Note: {bid.rejectionReason}
                        </p>
                      )}
                      <Badge variant={cfg.variant} className="mt-2 whitespace-nowrap">
                        {cfg.label}
                      </Badge>
                      {docs.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-600 mb-1">
                            Attachments
                          </p>
                          <ul className="flex flex-wrap gap-2">
                            {docs.map((doc, idx) => (
                              <li key={`${bid._id}-d-${idx}`}>
                                <a
                                  href={doc.url}
                                  download={doc.name || "file"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-teal-700 hover:underline"
                                >
                                  {doc.name || `File ${idx + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {bid.status === "ACCEPTED" && (
                        <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/40 p-3 text-sm text-slate-700">
                          {myPayment ? (
                            <>
                              <p>
                                Amount recorded:{" "}
                                <span className="font-semibold">
                                  NPR {Number(myPayment.amount || 0).toLocaleString("en-NP")}
                                </span>{" "}
                                — status{" "}
                                <span className="font-semibold">{myPayment.status}</span>.
                              </p>
                              <p className="mt-1 text-slate-600">
                                Vendors cannot pay from this portal. Procurement completes payment;
                                check <Link className="font-medium text-teal-800 hover:underline" to="/my-payments"> My payments</Link> for updates.
                              </p>
                            </>
                          ) : (
                            <p>
                              Payment record is being prepared by procurement. Check{" "}
                              <Link className="font-medium text-teal-800 hover:underline" to="/my-payments">
                                My payments
                              </Link>{" "}
                              for updates.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {bid.status === "SUBMITTED" &&
                        t?.status === "PUBLISHED" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleWithdrawBid(bid._id)}
                          >
                            Withdraw
                          </Button>
                        )}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenBidId((prev) => (prev === bid._id ? null : bid._id))
                        }
                        className="text-teal-700 hover:underline text-sm"
                      >
                        {isOpen ? "Hide quotation" : "See quotation"}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Technical proposal
                          </p>
                          <p className="min-h-[4rem] whitespace-pre-wrap rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                            {techDisplay || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Financial / pricing notes
                          </p>
                          <p className="min-h-[4rem] whitespace-pre-wrap rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                            {bid.financialProposal?.trim()
                              ? bid.financialProposal
                              : "—"}
                          </p>
                        </div>
                      </div>
                      {docs.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-medium text-slate-600">
                            Attachments
                          </p>
                          <ul className="flex flex-wrap gap-2">
                            {docs.map((doc, idx) => (
                              <li key={`${bid._id}-open-d-${idx}`}>
                                <a
                                  href={doc.url}
                                  download={doc.name || "file"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-teal-700 hover:underline"
                                >
                                  {doc.name || `File ${idx + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </WorkspacePageLayout>
    </motion.div>
  );
};

export default MyBids;
