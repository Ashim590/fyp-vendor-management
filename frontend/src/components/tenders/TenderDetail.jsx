import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  TENDER_API_END_POINT,
  BID_API_END_POINT,
  PAYMENT_API_END_POINT,
} from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { EsewaPaymentForm } from "@/components/payment/EsewaPaymentForm";
import { useSelector } from "react-redux";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import SubmitBidForm from "./SubmitBidForm";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { ConfirmDialog } from "../ui/confirm-dialog";

const statusConfig = {
  DRAFT: { label: "Draft", className: "bg-slate-200 text-slate-800" },
  PUBLISHED: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-800",
  },
  CLOSED: { label: "Closed", className: "bg-amber-100 text-amber-800" },
  AWARDED: { label: "Awarded", className: "bg-teal-50 text-teal-800" },
};

const TenderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const [tender, setTender] = useState(null);
  const [bids, setBids] = useState([]);
  const [myBid, setMyBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBidForm, setShowBidForm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [staffTenderPayments, setStaffTenderPayments] = useState([]);
  const [myTenderPayment, setMyTenderPayment] = useState(null);
  const [paymentCheckout, setPaymentCheckout] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const isOfficerOrAdmin = user?.role === "admin" || user?.role === "staff";
  const isAdmin = user?.role === "admin";
  const isOfficer = user?.role === "staff";
  const isVendor = user?.role === "vendor";

  const sortedQuotations = useMemo(
    () => [...bids].sort((a, b) => Number(a.amount) - Number(b.amount)),
    [bids],
  );

  const excerpt = (text, max = 120) => {
    const t = String(text || "").trim();
    if (!t) return "—";
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  };

  const loadTender = () => {
    axios
      .get(`${TENDER_API_END_POINT}/${id}`, { withCredentials: true })
      .then((res) => setTender(res.data.tender))
      .catch(() => setTender(null))
      .finally(() => setLoading(false));
  };

  const loadBids = () => {
    if (!isOfficerOrAdmin) return;
    axios
      .get(`${BID_API_END_POINT}/tender/${id}`, { withCredentials: true })
      .then((res) => setBids(res.data.bids || []))
      .catch(() => setBids([]));
  };

  const loadMyBid = () => {
    if (!isVendor || !id) {
      setMyBid(null);
      return;
    }
    axios
      .get(`${BID_API_END_POINT}/my`, {
        withCredentials: true,
        params: { limit: 150 },
      })
      .then((res) => {
        const list = res.data?.bids || [];
        const mine = list.find(
          (b) => String(b.tender?._id || b.tender) === String(id),
        );
        setMyBid(mine || null);
      })
      .catch(() => setMyBid(null));
  };

  useEffect(() => {
    loadTender();
  }, [id]);

  useEffect(() => {
    if (tender && isOfficerOrAdmin) loadBids();
  }, [tender, isOfficerOrAdmin]);

  useEffect(() => {
    loadMyBid();
  }, [id, isVendor, tender?._id]);

  useEffect(() => {
    if (!tender?._id || tender.status !== "AWARDED") {
      setStaffTenderPayments([]);
      setMyTenderPayment(null);
      return;
    }
    const headers = getAuthHeaderFromStorage();
    if (isOfficerOrAdmin) {
      axios
        .get(`${PAYMENT_API_END_POINT}`, {
          params: { tenderId: tender._id },
          withCredentials: true,
          headers,
        })
        .then((res) => setStaffTenderPayments(res.data?.payments || []))
        .catch(() => setStaffTenderPayments([]));
    }
    if (isVendor) {
      axios
        .get(`${PAYMENT_API_END_POINT}/my`, {
          withCredentials: true,
          headers,
        })
        .then((res) => {
          const list = res.data?.payments || [];
          const mine = list.find(
            (p) => String(p.tender?._id || p.tender) === String(tender._id),
          );
          setMyTenderPayment(mine || null);
        })
        .catch(() => setMyTenderPayment(null));
    }
  }, [tender?._id, tender?.status, isOfficerOrAdmin, isVendor]);

  const acceptedBid = bids.find((b) => b.status === "ACCEPTED");
  const awardedVendorId = tender?.awardedVendor?._id || tender?.awardedVendor;
  const isAwardedVendor =
    isVendor &&
    awardedVendorId &&
    String(user?.vendorProfile || "") === String(awardedVendorId);

  const createTenderPayment = async () => {
    if (!acceptedBid || !tender?._id) return;
    setPaymentBusy(true);
    try {
      await axios.post(
        `${PAYMENT_API_END_POINT}/create`,
        {
          tenderId: tender._id,
          vendorId: acceptedBid.vendor?._id || acceptedBid.vendor,
          amount: acceptedBid.amount,
          bidId: acceptedBid._id,
        },
        { withCredentials: true, headers: getAuthHeaderFromStorage() },
      );
      toast.success("Payment request created. The vendor can pay via eSewa.");
      const res = await axios.get(`${PAYMENT_API_END_POINT}`, {
        params: { tenderId: tender._id },
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      });
      setStaffTenderPayments(res.data?.payments || []);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Could not create payment.",
      );
    } finally {
      setPaymentBusy(false);
    }
  };

  const startTenderEsewa = async (paymentId) => {
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
      setPaymentCheckout({ checkoutUrl: data.checkoutUrl, payload: data.payload });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Could not open eSewa checkout.",
      );
    }
  };

  const handlePublish = () => {
    axios
      .patch(
        `${TENDER_API_END_POINT}/${id}/publish`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        setTender(res.data.tender);
        toast.success("Tender published.");
      })
      .catch(() => toast.error("Failed to publish"));
  };

  const handleClose = () => {
    axios
      .patch(
        `${TENDER_API_END_POINT}/${id}/close`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        setTender(res.data.tender);
        toast.success("Tender closed.");
      })
      .catch(() => toast.error("Failed to close"));
  };

  const openWithdrawTenderConfirm = () => {
    const isDraft = tender?.status === "DRAFT";
    setConfirmConfig({
      title: isDraft ? "Remove draft tender?" : "Withdraw this tender?",
      description: isDraft
        ? "This will permanently delete the draft and remove related bids and pending payments. This cannot be undone."
        : "The tender will be closed to new bids. Existing submitted bids remain on record.",
      variant: isDraft ? "destructive" : "default",
      confirmLabel: isDraft ? "Remove draft" : "Withdraw tender",
      action: async () => {
        try {
          const res = await axios.patch(
            `${TENDER_API_END_POINT}/${id}/withdraw`,
            {},
            { withCredentials: true },
          );
          if (res.data?.deleted) {
            toast.success("Draft tender removed.");
            setConfirmConfig(null);
            navigate("/tenders");
          } else {
            setTender(res.data.tender);
            toast.success("Tender withdrawn.");
            setConfirmConfig(null);
          }
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Failed to withdraw tender",
          );
        }
      },
    });
  };

  const openDeleteTenderConfirm = () => {
    setConfirmConfig({
      title: "Delete tender?",
      description:
        "This will permanently delete this tender and all related bids and pending payments. This action cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete tender",
      action: async () => {
        try {
          await axios.delete(`${TENDER_API_END_POINT}/${id}`, {
            withCredentials: true,
          });
          toast.success("Tender deleted.");
          setConfirmConfig(null);
          navigate("/tenders");
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to delete tender");
        }
      },
    });
  };

  const openWithdrawMyBidConfirm = () => {
    if (!myBid?._id) return;
    setConfirmConfig({
      title: "Withdraw your quotation?",
      description:
        "You can submit again later only if this tender is still open for quotations.",
      variant: "destructive",
      confirmLabel: "Withdraw quotation",
      action: async () => {
        try {
          await axios.delete(`${BID_API_END_POINT}/${myBid._id}`, {
            withCredentials: true,
          });
          toast.success("Quotation withdrawn.");
          setMyBid(null);
          setConfirmConfig(null);
          loadTender();
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Could not withdraw quotation",
          );
        }
      },
    });
  };

  const openAcceptBidConfirm = (bidId) => {
    const bid = bids.find((b) => String(b._id) === String(bidId));
    setConfirmConfig({
      title: "Accept this quotation?",
      description:
        "This will mark this quotation as selected and award the tender to this vendor.",
      variant: "default",
      confirmLabel: "Accept",
      action: async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          await axios.patch(
            `${BID_API_END_POINT}/${bidId}/accept`,
            {},
            { withCredentials: true, headers },
          );
          toast.success("Quotation accepted. Tender awarded.");
          setConfirmConfig(null);
          loadTender();
          loadBids();
          navigate(`/tenders/${id}`, { replace: true });
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to accept quotation.";
          toast.error(msg);
        }
      },
    });
  };

  const handleRejectBid = (bidId) => {
    const reason = prompt("Rejection reason (optional):");
    axios
      .patch(
        `${BID_API_END_POINT}/${bidId}/reject`,
        { rejectionReason: reason || "" },
        { withCredentials: true },
      )
      .then(() => {
        toast.success("Quotation marked as not selected.");
        loadBids();
      })
      .catch(() => toast.error("Failed to update quotation."));
  };

  const openDeleteBidConfirm = (bidId) => {
    setConfirmConfig({
      title: "Remove this quotation?",
      description:
        "This will permanently remove the quotation from the system. This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Remove",
      action: async () => {
        try {
          await axios.delete(`${BID_API_END_POINT}/${bidId}`, {
            withCredentials: true,
          });
          toast.success("Quotation removed.");
          setConfirmConfig(null);
          loadBids();
          loadTender();
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Failed to remove quotation",
          );
        }
      },
    });
  };

  const onBidSubmitted = () => {
    setShowBidForm(false);
    toast.success("Quotation submitted.");
    loadTender();
    if (isOfficerOrAdmin) loadBids();
    loadMyBid();
  };

  if (loading || !tender) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <LoadingSkeleton className="h-4 w-36" />
          <div className="bg-white rounded-lg border p-4 sm:p-6 space-y-3">
            <LoadingSkeleton className="h-5 w-3/4" />
            <LoadingSkeleton className="h-3 w-full" />
            <LoadingSkeleton className="h-3 w-5/6" />
            <LoadingSkeleton className="h-9 w-32" />
            <div className="pt-4 border-t space-y-2">
              <LoadingSkeleton className="h-4 w-28" />
              <LoadingSkeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const cfg = statusConfig[tender.status] || statusConfig.DRAFT;
  const canBid = isVendor && tender.status === "PUBLISHED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <ConfirmDialog
        open={!!confirmConfig}
        onOpenChange={(open) => !open && setConfirmConfig(null)}
        title={confirmConfig?.title ?? ""}
        description={confirmConfig?.description}
        variant={confirmConfig?.variant ?? "default"}
        confirmLabel={confirmConfig?.confirmLabel}
        cancelLabel={confirmConfig?.cancelLabel ?? "Cancel"}
        onConfirm={confirmConfig?.action}
      />
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Link
          to="/tenders"
          className="text-teal-700 hover:underline text-sm mb-4 inline-block"
        >
          ← Back to Tenders
        </Link>

        <div className="bg-white rounded-lg border p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="font-mono text-sm text-slate-500">
                {tender.referenceNumber}
              </span>
              <Badge className={`ml-2 ${cfg.className}`}>{cfg.label}</Badge>
              <h1 className="text-2xl font-bold text-slate-900 mt-2">
                {tender.title}
              </h1>
              <p className="text-slate-600 mt-2">{tender.description}</p>
              <p className="text-sm text-slate-500 mt-2">
                Category: {tender.category} • Closes:{" "}
                {new Date(tender.closeDate).toLocaleDateString()}
                {tender.budget &&
                  ` • Budget: NPR ${tender.budget.toLocaleString()}`}
              </p>
              {tender.requirements && (
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-medium">Requirements:</span>{" "}
                  {tender.requirements}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {isOfficerOrAdmin && tender.status === "DRAFT" && (
                <Button
                  onClick={handlePublish}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Publish Tender
                </Button>
              )}
              {isAdmin && (
                <Button variant="destructive" onClick={openDeleteTenderConfirm}>
                  Delete tender
                </Button>
              )}
              {isOfficer && tender.status === "PUBLISHED" && (
                <Button variant="outline" onClick={openWithdrawTenderConfirm}>
                  Withdraw tender
                </Button>
              )}
              {isOfficer && tender.status === "DRAFT" && (
                <Button variant="outline" onClick={openWithdrawTenderConfirm}>
                  Withdraw draft
                </Button>
              )}
              {isAdmin && tender.status === "PUBLISHED" && (
                <Button onClick={handleClose} variant="outline">
                  Close tender
                </Button>
              )}
            </div>
          </div>

          {canBid && (
            <div className="mt-6 pt-4 border-t">
              {!showBidForm ? (
                <Button
                  onClick={() => setShowBidForm(true)}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  Submit quotation
                </Button>
              ) : (
                <SubmitBidForm
                  tenderId={tender._id}
                  onSuccess={onBidSubmitted}
                  onCancel={() => setShowBidForm(false)}
                />
              )}
            </div>
          )}

          {isVendor &&
            myBid &&
            myBid.status === "SUBMITTED" &&
            tender.status === "PUBLISHED" && (
              <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">
                  Your quotation:{" "}
                  <span className="font-semibold text-slate-900">
                    NPR {Number(myBid.amount).toLocaleString("en-NP")}
                  </span>
                  <Badge className="ml-2" variant="outline">
                    {myBid.status === "ACCEPTED"
                      ? "Accepted"
                      : myBid.status === "REJECTED"
                        ? "Not selected"
                        : "Pending"}
                  </Badge>
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openWithdrawMyBidConfirm}
                >
                  Withdraw quotation
                </Button>
              </div>
            )}
        </div>

        {isOfficerOrAdmin && (
          <div className="bg-white rounded-lg border p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Tender quotations ({bids.length})
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isAdmin && !isOfficer
                  ? "Read-only monitoring. Procurement officers evaluate and award quotations."
                  : "Compare quotations by price and proposal. Accept one to proceed."}
              </p>
            </div>

            {bids.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2 text-right">Price (NPR)</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Proposal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuotations.map((bid) => (
                      <tr
                        key={`cmp-${bid._id}`}
                        className="border-t border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {bid.vendor?.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(bid.amount).toLocaleString("en-NP")}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              bid.status === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : bid.status === "REJECTED"
                                  ? "bg-red-100 text-red-800"
                                  : bid.status === "UNDER_REVIEW"
                                    ? "bg-teal-50 text-teal-800"
                                    : "bg-amber-100 text-amber-800"
                            }
                          >
                            {bid.status === "SUBMITTED"
                              ? "Pending"
                              : bid.status === "UNDER_REVIEW"
                                ? "Under review"
                                : bid.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-xs">
                          {excerpt(bid.technicalProposal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bids.length === 0 ? (
              <p className="text-slate-500">No quotations yet.</p>
            ) : (
              <div className="space-y-4">
                {bids.map((bid) => (
                  <div
                    key={bid._id}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">
                          {bid.vendor?.name || "Vendor"}
                        </p>
                        {bid.vendor?.email && (
                          <p className="text-xs text-slate-500">
                            {bid.vendor.email}
                          </p>
                        )}
                        <p className="text-base text-slate-800 font-medium">
                          Quoted price: NPR{" "}
                          {Number(bid.amount).toLocaleString("en-NP")}
                        </p>
                        <p className="text-xs text-slate-500">
                          Submitted:{" "}
                          {bid.createdAt
                            ? new Date(bid.createdAt).toLocaleString("en-NP")
                            : "—"}
                        </p>
                        <Badge
                          className={
                            bid.status === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-800"
                              : bid.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-200 text-slate-800"
                          }
                        >
                          {bid.status}
                        </Badge>
                        {bid.status === "REJECTED" && bid.rejectionReason && (
                          <p className="text-xs text-red-700 mt-1">
                            Reason: {bid.rejectionReason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                        {isOfficer &&
                          tender.status === "PUBLISHED" &&
                          (bid.status === "SUBMITTED" ||
                            bid.status === "UNDER_REVIEW") && (
                            <>
                              {bid.status === "SUBMITTED" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    axios
                                      .patch(
                                        `${BID_API_END_POINT}/${bid._id}/evaluate`,
                                        { status: "UNDER_REVIEW" },
                                        { withCredentials: true },
                                      )
                                      .then(() => {
                                        toast.success("Marked under review.");
                                        loadBids();
                                      })
                                      .catch(() =>
                                        toast.error("Could not update status."),
                                      );
                                  }}
                                >
                                  Mark under review
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => openAcceptBidConfirm(bid._id)}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectBid(bid._id)}
                              >
                                Not selected
                              </Button>
                            </>
                          )}
                        {(isAdmin || isOfficer) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDeleteBidConfirm(bid._id)}
                          >
                            Remove quotation
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                          Proposal
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-md bg-white p-3 border min-h-[4rem]">
                          {bid.technicalProposal?.trim()
                            ? bid.technicalProposal
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                          Financial / pricing notes
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-md bg-white p-3 border min-h-[4rem]">
                          {bid.financialProposal?.trim()
                            ? bid.financialProposal
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(bid.documents) &&
                      bid.documents.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Attachments
                          </p>
                          <ul className="flex flex-wrap gap-2">
                            {bid.documents.map((doc, idx) => (
                              <li key={`${bid._id}-doc-${idx}`}>
                                <a
                                  href={doc.url}
                                  download={doc.name || "attachment"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-teal-700 hover:underline"
                                >
                                  {doc.name || `File ${idx + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tender.status === "AWARDED" && (
          <div className="bg-white rounded-lg border p-4 sm:p-6 mt-6 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Tender payment (eSewa)</h2>
            <p className="text-sm text-slate-600">
              When a quotation is accepted, a pending payment is created automatically. It
              shows under{" "}
              <Link className="font-medium text-teal-700 underline-offset-2 hover:underline" to="/procurement/payments">
                Payments
              </Link>{" "}
              (staff) and{" "}
              <Link className="font-medium text-teal-700 underline-offset-2 hover:underline" to="/my-payments">
                My payments
              </Link>{" "}
              (vendor). The vendor pays with eSewa from there or below.
            </p>
            {isOfficerOrAdmin && (
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-sm">
                {staffTenderPayments.length > 0 ? (
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium text-slate-800">Status:</span>{" "}
                      {staffTenderPayments[0].status} — NPR{" "}
                      {Number(staffTenderPayments[0].amount || 0).toLocaleString("en-NP")}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {staffTenderPayments[0].paymentNumber}
                    </p>
                    <Link
                      to="/procurement/payments"
                      className="inline-block text-sm font-medium text-teal-700 hover:underline"
                    >
                      Open Payments list →
                    </Link>
                  </div>
                ) : acceptedBid ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-slate-700">
                      No payment row yet (unusual). Quoted NPR{" "}
                      {Number(acceptedBid.amount).toLocaleString("en-NP")}. You can create one
                      manually.
                    </p>
                    <Button
                      type="button"
                      disabled={paymentBusy}
                      onClick={createTenderPayment}
                      variant="outline"
                    >
                      {paymentBusy ? "Creating…" : "Create payment manually"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-amber-800">No accepted quotation found for this award.</p>
                )}
              </div>
            )}
            {isAwardedVendor && (
              <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4 text-sm">
                {!myTenderPayment ? (
                  <div className="space-y-2 text-slate-700">
                    <p>
                      Your payment should appear shortly after award. Open{" "}
                      <Link
                        className="font-medium text-teal-800 underline-offset-2 hover:underline"
                        to="/my-payments"
                      >
                        My payments
                      </Link>{" "}
                      to pay with eSewa, or refresh this page.
                    </p>
                  </div>
                ) : myTenderPayment.status === "Pending" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-slate-800">
                      Amount due: NPR{" "}
                      {Number(myTenderPayment.amount).toLocaleString("en-NP")}
                    </p>
                    <Button
                      type="button"
                      onClick={() => startTenderEsewa(myTenderPayment._id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Pay with eSewa
                    </Button>
                  </div>
                ) : (
                  <p className="text-slate-800">
                    Payment {myTenderPayment.status}: NPR{" "}
                    {Number(myTenderPayment.amount).toLocaleString("en-NP")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {paymentCheckout && (
          <EsewaPaymentForm
            checkoutUrl={paymentCheckout.checkoutUrl}
            payload={paymentCheckout.payload}
            onCancel={() => setPaymentCheckout(null)}
          />
        )}
      </div>
    </motion.div>
  );
};

export default TenderDetail;
