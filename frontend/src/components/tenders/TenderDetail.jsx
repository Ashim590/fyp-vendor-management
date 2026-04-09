import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  TENDER_API_END_POINT,
  BID_API_END_POINT,
  PAYMENT_API_END_POINT,
} from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { useSelector } from "react-redux";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import SubmitBidForm from "./SubmitBidForm";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { WorkspaceSegmentedControl } from "../layout/WorkspacePageLayout";
import { BarChart3 } from "lucide-react";

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
  const location = useLocation();
  const { user } = useSelector((store) => store.auth);
  const [tender, setTender] = useState(null);
  const [bids, setBids] = useState([]);
  const [myBid, setMyBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBidForm, setShowBidForm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [staffTenderPayments, setStaffTenderPayments] = useState([]);
  const [myTenderPayment, setMyTenderPayment] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [clarifications, setClarifications] = useState([]);
  const [questionText, setQuestionText] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [questionBusy, setQuestionBusy] = useState(false);
  /** Staff-only: /quotation-comparison API payload */
  const [quotationComparison, setQuotationComparison] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const isOfficerOrAdmin = user?.role === "admin" || user?.role === "staff";
  const isAdmin = user?.role === "admin";
  const isOfficer = user?.role === "staff";
  const isVendor = user?.role === "vendor";

  const staffCanSelectOrAward =
    tender && (tender.status === "PUBLISHED" || tender.status === "CLOSED");

  const sortedQuotations = useMemo(
    () => [...bids].sort((a, b) => Number(a.amount) - Number(b.amount)),
    [bids],
  );

  const [quotationStatusFilter, setQuotationStatusFilter] = useState(
    /** @type {"all" | "selected" | "not_selected"} */ ("all"),
  );

  const filteredSortedQuotations = useMemo(() => {
    if (quotationStatusFilter === "selected") {
      return sortedQuotations.filter((b) => b.status === "ACCEPTED");
    }
    if (quotationStatusFilter === "not_selected") {
      return sortedQuotations.filter((b) => b.status !== "ACCEPTED");
    }
    return sortedQuotations;
  }, [sortedQuotations, quotationStatusFilter]);

  const quotationFilterCounts = useMemo(() => {
    const selected = bids.filter((b) => b.status === "ACCEPTED").length;
    const notSelected = bids.filter((b) => b.status !== "ACCEPTED").length;
    return { all: bids.length, selected, notSelected };
  }, [bids]);

  const comparisonByBidId = useMemo(() => {
    const m = {};
    for (const c of quotationComparison?.comparisons || []) {
      m[c.bidId] = c;
    }
    return m;
  }, [quotationComparison]);

  const excerpt = (text, max = 120) => {
    const t = String(text || "").trim();
    if (!t) return "—";
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  };

  const loadTender = () => {
    setLoading(true);
    setLoadError("");
    axios
      .get(`${TENDER_API_END_POINT}/${id}`, { withCredentials: true })
      .then((res) => setTender(res.data.tender))
      .catch((err) => {
        setTender(null);
        setLoadError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load this tender.",
        );
      })
      .finally(() => setLoading(false));
  };

  const loadBids = () => {
    if (!isOfficerOrAdmin) return;
    axios
      .get(`${BID_API_END_POINT}/tender/${id}`, { withCredentials: true })
      .then((res) => setBids(res.data.bids || []))
      .catch(() => setBids([]));
  };

  const loadQuotationComparison = () => {
    if (!isOfficerOrAdmin || !id) {
      setQuotationComparison(null);
      return;
    }
    setComparisonLoading(true);
    axios
      .get(`${TENDER_API_END_POINT}/${id}/quotation-comparison`, {
        withCredentials: true,
      })
      .then((res) => setQuotationComparison(res.data || null))
      .catch(() => setQuotationComparison(null))
      .finally(() => setComparisonLoading(false));
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

  const loadClarifications = () => {
    if (!id) return;
    axios
      .get(`${TENDER_API_END_POINT}/${id}/clarifications`, {
        withCredentials: true,
      })
      .then((res) => setClarifications(res.data?.clarifications || []))
      .catch(() => setClarifications([]));
  };

  useEffect(() => {
    loadTender();
  }, [id]);

  useEffect(() => {
    setQuotationStatusFilter("all");
  }, [id]);

  useEffect(() => {
    if (tender && isOfficerOrAdmin) loadBids();
  }, [tender, isOfficerOrAdmin]);

  useEffect(() => {
    if (tender && isOfficerOrAdmin) loadQuotationComparison();
  }, [tender?._id, isOfficerOrAdmin, bids.length]);

  useEffect(() => {
    loadMyBid();
  }, [id, isVendor, tender?._id]);

  useEffect(() => {
    if (!tender?._id) return;
    loadClarifications();
  }, [tender?._id, isVendor, isOfficerOrAdmin]);

  useEffect(() => {
    if (location.hash !== "#my-quotation") return;
    if (!myBid) return;
    const el = document.getElementById("my-quotation");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, myBid]);

  useEffect(() => {
    if (location.hash !== "#tender-automated-comparison") return;
    if (!isOfficerOrAdmin || !tender?._id) return;
    const run = () => {
      const el =
        document.getElementById("tender-automated-comparison") ||
        document.getElementById("tender-staff-quotations");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    run();
    const t = window.setTimeout(run, 350);
    return () => window.clearTimeout(t);
  }, [
    location.hash,
    isOfficerOrAdmin,
    tender?._id,
    bids.length,
    comparisonLoading,
  ]);

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
      toast.success(
        "Payment request created. Complete eSewa from Procurement → Payments when ready.",
      );
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
        ? "Deletes the draft and related bids."
        : "Closes the tender to new bids.",
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
      description: "Deletes this tender and related bids.",
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
      description: "You can submit again if the tender is still open.",
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

  const openSelectBidConfirm = (bidId) => {
    setConfirmConfig({
      title: "Select this quotation?",
      description: "",
      variant: "default",
      confirmLabel: "Select",
      action: async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          await axios.patch(
            `${BID_API_END_POINT}/${bidId}/accept`,
            {},
            { withCredentials: true, headers },
          );
          toast.success("Quotation selected.");
          setConfirmConfig(null);
          loadTender();
          loadBids();
          navigate(`/tenders/${id}`, { replace: true });
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to select quotation.";
          toast.error(msg);
        }
      },
    });
  };

  const openAwardTenderConfirm = () => {
    if (!acceptedBid || !tender?._id) return;
    const vendorName = acceptedBid.vendor?.name || "this vendor";
    setConfirmConfig({
      title: "Award this tender?",
      description: `Award to ${vendorName}? Other quotations will be marked not selected.`,
      variant: "default",
      confirmLabel: "Award tender",
      action: async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const vid = acceptedBid.vendor?._id || acceptedBid.vendor;
          const res = await axios.patch(
            `${TENDER_API_END_POINT}/${tender._id}/award`,
            { awardedVendor: vid },
            { withCredentials: true, headers },
          );
          if (res.data?.tender) setTender(res.data.tender);
          toast.success("Tender awarded.");
          setConfirmConfig(null);
          loadTender();
          loadBids();
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to award tender.";
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
      description: "Permanent.",
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

  const submitClarificationQuestion = async () => {
    const q = String(questionText || "").trim();
    if (!q) {
      toast.error("Please enter your question.");
      return;
    }
    setQuestionBusy(true);
    try {
      await axios.post(
        `${TENDER_API_END_POINT}/${id}/clarifications`,
        { question: q },
        { withCredentials: true },
      );
      setQuestionText("");
      toast.success("Question posted.");
      loadClarifications();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to post question.",
      );
    } finally {
      setQuestionBusy(false);
    }
  };

  const answerClarification = async (clarificationId) => {
    const answer = String(answerDrafts?.[clarificationId] || "").trim();
    if (!answer) {
      toast.error("Please enter an answer.");
      return;
    }
    try {
      await axios.patch(
        `${TENDER_API_END_POINT}/${id}/clarifications/${clarificationId}/answer`,
        { answer },
        { withCredentials: true },
      );
      toast.success("Answer posted.");
      setAnswerDrafts((prev) => ({ ...prev, [clarificationId]: "" }));
      loadClarifications();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to post clarification answer.",
      );
    }
  };

  if (loading) {
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

  if (!tender) {
    const sp = new URLSearchParams(location.search);
    const bidParam = sp.get("bid");
    const backToMyBid = bidParam
      ? `/my-bids?openBid=${encodeURIComponent(bidParam)}`
      : "/my-bids";
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-900">
              {loadError || "Tender could not be loaded."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadTender}>
                Retry
              </Button>
              <Button variant="ghost" asChild>
                <Link to={backToMyBid}>Back to My tender quotations</Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const cfg = statusConfig[tender.status] || statusConfig.DRAFT;
  /** Vendors who did not win should not see “Awarded” on the tender — the process is complete (“Closed”). */
  const tenderHeaderBadge =
    isVendor && tender.status === "AWARDED" && !isAwardedVendor
      ? { label: "Closed", className: "bg-slate-200 text-slate-800" }
      : { label: cfg.label, className: cfg.className };
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
              <Badge className={`ml-2 ${tenderHeaderBadge.className}`}>
                {tenderHeaderBadge.label}
              </Badge>
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
              {Array.isArray(tender.requiredDocuments) &&
                tender.requiredDocuments.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-slate-700">
                      Required documents:
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                      {tender.requiredDocuments.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
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
              {isOfficerOrAdmin && tender.status === "PUBLISHED" && (
                <Button variant="outline" onClick={openWithdrawTenderConfirm}>
                  Withdraw tender
                </Button>
              )}
              {isOfficerOrAdmin && tender.status === "DRAFT" && (
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

          {isOfficer &&
            acceptedBid &&
            staffCanSelectOrAward &&
            tender.status !== "AWARDED" && (
              <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">Preferred quotation:</span>{" "}
                  {acceptedBid.vendor?.name || "Vendor"} — NPR{" "}
                  {Number(acceptedBid.amount).toLocaleString("en-NP")}
                </p>
                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-slate-800 shrink-0"
                  onClick={openAwardTenderConfirm}
                >
                  Award tender
                </Button>
              </div>
            )}

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
                  tender={tender}
                  onSuccess={onBidSubmitted}
                  onCancel={() => setShowBidForm(false)}
                />
              )}
            </div>
          )}

          {isVendor && myBid && (
            <div
              id="my-quotation"
              className="mt-6 pt-4 border-t space-y-3 scroll-mt-24"
            >
              <p className="text-sm text-slate-600">
                Your quotation:{" "}
                <span className="font-semibold text-slate-900">
                  NPR {Number(myBid.amount).toLocaleString("en-NP")}
                </span>
                <Badge className="ml-2" variant="outline">
                  {myBid.status === "ACCEPTED"
                    ? tender?.status === "AWARDED" && isAwardedVendor
                      ? "Awarded"
                      : "Selected"
                    : myBid.status === "REJECTED"
                      ? "Not selected"
                      : myBid.status === "UNDER_REVIEW"
                        ? "Under review"
                        : "Pending"}
                </Badge>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Proposal
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-md bg-slate-50 p-3 border min-h-[4rem]">
                    {myBid.technicalProposal?.trim()
                      ? myBid.technicalProposal
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Financial / pricing notes
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-md bg-slate-50 p-3 border min-h-[4rem]">
                    {myBid.financialProposal?.trim()
                      ? myBid.financialProposal
                      : "—"}
                  </p>
                </div>
              </div>
              {Array.isArray(myBid.documents) && myBid.documents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Attachments
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {myBid.documents.map((doc, idx) => (
                      <li key={`${myBid._id}-doc-${idx}`}>
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
              {myBid.status === "SUBMITTED" &&
                tender.status === "PUBLISHED" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={openWithdrawMyBidConfirm}
                  >
                    Withdraw quotation
                  </Button>
                )}
              {Array.isArray(myBid.versionHistory) &&
                myBid.versionHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Version history
                    </p>
                    <ul className="space-y-2">
                      {myBid.versionHistory
                        .slice()
                        .reverse()
                        .map((v, idx) => (
                          <li
                            key={`vh-${idx}`}
                            className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600"
                          >
                            Edited{" "}
                            {new Date(v.editedAt).toLocaleString("en-NP")} •
                            Previous amount NPR{" "}
                            {Number(v.amount || 0).toLocaleString("en-NP")}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {(isVendor || isOfficerOrAdmin) && (
            <div className="mt-6 pt-4 border-t space-y-3">
              <h3 className="text-base font-semibold text-slate-900">
                Clarifications / Q&A
              </h3>
              {isVendor && tender.status === "PUBLISHED" && (
                <div className="space-y-2">
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={2}
                    placeholder="Ask a clarification question for procurement staff."
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={submitClarificationQuestion}
                    disabled={questionBusy}
                  >
                    {questionBusy ? "Posting..." : "Post question"}
                  </Button>
                </div>
              )}
              {clarifications.length === 0 ? (
                <p className="text-sm text-slate-500">No clarifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {clarifications.map((c) => (
                    <div
                      key={c._id}
                      className="rounded-md border bg-slate-50 p-3"
                    >
                      <p className="text-sm text-slate-800">{c.question}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Asked by {c?.vendorUser?.name || "Vendor"} on{" "}
                        {c?.askedAt
                          ? new Date(c.askedAt).toLocaleString("en-NP")
                          : "—"}
                      </p>
                      {c.answer ? (
                        <p className="mt-2 text-sm text-teal-800">
                          <span className="font-medium">Answer:</span>{" "}
                          {c.answer}
                        </p>
                      ) : isOfficerOrAdmin ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={answerDrafts[c._id] || ""}
                            onChange={(e) =>
                              setAnswerDrafts((prev) => ({
                                ...prev,
                                [c._id]: e.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Write public answer for all bidders."
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                          />
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => answerClarification(c._id)}
                          >
                            Post answer
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700">
                          Awaiting procurement response.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isOfficerOrAdmin && (
          <div
            id="tender-staff-quotations"
            className="scroll-mt-24 space-y-6 rounded-2xl border border-slate-200/85 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] sm:p-7"
          >
            <div className="border-b border-slate-100 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Quotations
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[#0b1f4d]">
                Tender quotations{" "}
                <span className="font-semibold text-slate-400">
                  ({bids.length})
                </span>
              </h2>
              {bids.length > 0 && (
                <div className="mt-4">
                  <WorkspaceSegmentedControl
                    value={quotationStatusFilter}
                    onChange={setQuotationStatusFilter}
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
                </div>
              )}
            </div>

            {bids.length > 0 &&
              ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"].some((s) =>
                bids.some((b) => b.status === s),
              ) && (
                <div
                  id="tender-automated-comparison"
                  className="scroll-mt-24 space-y-3 rounded-xl border border-teal-200/60 bg-gradient-to-br from-teal-50/90 via-white to-sky-50/50 p-5 shadow-sm ring-1 ring-teal-900/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-teal-100">
                      <BarChart3
                        className="h-4 w-4 text-teal-700"
                        strokeWidth={2}
                      />
                    </span>
                    <h3 className="text-sm font-semibold tracking-tight text-teal-950">
                      Automated quotation comparison
                    </h3>
                  </div>
                  {comparisonLoading ? (
                    <p className="text-xs font-medium text-slate-600">
                      Loading analysis…
                    </p>
                  ) : quotationComparison?.comparisons?.length ? (
                    <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {quotationComparison.comparisons
                        .filter((c) => c.flags?.lowestPrice)
                        .map((c) => (
                          <li
                            key={`lp-${c.bidId}`}
                            className="rounded-lg border border-teal-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-teal-900 shadow-sm"
                          >
                            Lowest price:{" "}
                            {isOfficerOrAdmin && c.vendorId ? (
                              <Link
                                to={`/vendors/${c.vendorId}`}
                                className="font-semibold underline-offset-2 hover:underline"
                              >
                                {c.vendorName}
                              </Link>
                            ) : (
                              c.vendorName
                            )}
                          </li>
                        ))}
                      {quotationComparison.comparisons
                        .filter((c) => c.flags?.fastestDelivery)
                        .map((c) => (
                          <li
                            key={`fd-${c.bidId}`}
                            className="rounded-lg border border-sky-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-sky-900 shadow-sm"
                          >
                            Fastest delivery:{" "}
                            {isOfficerOrAdmin && c.vendorId ? (
                              <Link
                                to={`/vendors/${c.vendorId}`}
                                className="font-semibold underline-offset-2 hover:underline"
                              >
                                {c.vendorName}
                              </Link>
                            ) : (
                              c.vendorName
                            )}
                            {c.deliveryDaysOffer != null
                              ? ` (${c.deliveryDaysOffer}d)`
                              : ""}
                          </li>
                        ))}
                      {quotationComparison.comparisons
                        .filter((c) => c.flags?.suggestedBestValue)
                        .map((c) => (
                          <li
                            key={`bv-${c.bidId}`}
                            className="rounded-lg border border-violet-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-violet-900 shadow-sm"
                          >
                            Suggested best value:{" "}
                            {isOfficerOrAdmin && c.vendorId ? (
                              <Link
                                to={`/vendors/${c.vendorId}`}
                                className="font-semibold underline-offset-2 hover:underline"
                              >
                                {c.vendorName}
                              </Link>
                            ) : (
                              c.vendorName
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-xs font-medium text-slate-600">
                      No comparison data yet.
                    </p>
                  )}
                </div>
              )}

            {bids.length > 0 && filteredSortedQuotations.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm font-medium text-slate-600">
                No quotations match this filter. Try{" "}
                <button
                  type="button"
                  className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  onClick={() => setQuotationStatusFilter("all")}
                >
                  All
                </button>
                .
              </p>
            )}

            {bids.length > 0 && filteredSortedQuotations.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/[0.03]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200/90 bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3 text-right">
                          Total (incl. VAT)
                        </th>
                        <th className="px-4 py-3 text-right">Lead time</th>
                        <th className="px-4 py-3">Highlights</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Proposal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredSortedQuotations.map((bid) => {
                        const comp = comparisonByBidId[String(bid._id)];
                        const hf =
                          comp?.flags &&
                          (comp.flags.lowestPrice ||
                            comp.flags.fastestDelivery ||
                            comp.flags.suggestedBestValue);
                        return (
                          <tr
                            key={`cmp-${bid._id}`}
                            className="transition-colors hover:bg-slate-50/90"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {isOfficerOrAdmin && bid.vendor?._id ? (
                                <Link
                                  to={`/vendors/${bid.vendor._id}`}
                                  className="text-teal-800 underline-offset-2 hover:underline"
                                >
                                  {bid.vendor?.name || "—"}
                                </Link>
                              ) : (
                                bid.vendor?.name || "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                              <div className="font-medium">
                                {Number(bid.amount).toLocaleString("en-NP")}
                              </div>
                              {bid.vatAmount != null &&
                                Number(bid.vatAmount) > 0 && (
                                  <div className="text-[10px] font-normal text-slate-500">
                                    incl. VAT
                                  </div>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                              {bid.deliveryDaysOffer != null &&
                              bid.deliveryDaysOffer !== ""
                                ? `${bid.deliveryDaysOffer} days`
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {comparisonByBidId[String(bid._id)]?.flags
                                  ?.lowestPrice && (
                                  <Badge className="border-0 bg-teal-100 text-[10px] font-semibold text-teal-800">
                                    Lowest price
                                  </Badge>
                                )}
                                {comparisonByBidId[String(bid._id)]?.flags
                                  ?.fastestDelivery && (
                                  <Badge className="border-0 bg-sky-100 text-[10px] font-semibold text-sky-800">
                                    Fastest delivery
                                  </Badge>
                                )}
                                {comparisonByBidId[String(bid._id)]?.flags
                                  ?.suggestedBestValue && (
                                  <Badge className="border-0 bg-violet-100 text-[10px] font-semibold text-violet-800">
                                    Best value
                                  </Badge>
                                )}
                                {!hf ? "—" : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
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
                                    : bid.status === "ACCEPTED"
                                      ? tender?.status === "AWARDED"
                                        ? "Awarded"
                                        : "Selected"
                                      : bid.status === "REJECTED"
                                        ? "Not selected"
                                        : bid.status}
                              </Badge>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-slate-600">
                              {excerpt(bid.technicalProposal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bids.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm font-medium text-slate-600">
                No quotations yet.
              </p>
            ) : filteredSortedQuotations.length === 0 ? null : (
              <div className="space-y-4">
                {filteredSortedQuotations.map((bid) => (
                  <div
                    key={bid._id}
                    className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">
                          {isOfficerOrAdmin && bid.vendor?._id ? (
                            <Link
                              to={`/vendors/${bid.vendor._id}`}
                              className="text-teal-800 underline-offset-2 hover:underline"
                            >
                              {bid.vendor?.name || "Vendor"}
                            </Link>
                          ) : (
                            bid.vendor?.name || "Vendor"
                          )}
                        </p>
                        {bid.vendor?.email && (
                          <p className="text-xs text-slate-500">
                            {bid.vendor.email}
                          </p>
                        )}
                        <p className="text-base text-slate-800 font-medium">
                          Total (incl. VAT): NPR{" "}
                          {Number(bid.amount).toLocaleString("en-NP")}
                        </p>
                        {bid.amountExcludingVat != null &&
                          bid.vatAmount != null && (
                            <p className="text-xs text-slate-500">
                              Excl. VAT: NPR{" "}
                              {Number(bid.amountExcludingVat).toLocaleString(
                                "en-NP",
                              )}{" "}
                              · VAT: NPR{" "}
                              {Number(bid.vatAmount).toLocaleString("en-NP")}
                            </p>
                          )}
                        <p className="text-xs text-slate-500">
                          Submitted:{" "}
                          {bid.createdAt
                            ? new Date(bid.createdAt).toLocaleString("en-NP")
                            : "—"}
                        </p>
                        {!acceptedBid ? (
                          <Badge
                            className={
                              bid.status === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : bid.status === "REJECTED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-slate-200 text-slate-800"
                            }
                          >
                            {bid.status === "ACCEPTED"
                              ? tender?.status === "AWARDED"
                                ? "Awarded"
                                : "Selected"
                              : bid.status === "REJECTED"
                                ? "Not selected"
                                : bid.status}
                          </Badge>
                        ) : null}
                        {bid.status === "REJECTED" &&
                          bid.rejectionReason &&
                          !acceptedBid && (
                            <p className="text-xs text-red-700 mt-1">
                              Reason: {bid.rejectionReason}
                            </p>
                          )}
                      </div>
                      {acceptedBid ? (
                        <div className="shrink-0 text-right sm:min-w-[7rem]">
                          <p
                            className={
                              bid.status === "ACCEPTED"
                                ? "text-sm font-semibold text-emerald-800"
                                : "text-sm font-medium text-slate-600"
                            }
                          >
                            {bid.status === "ACCEPTED"
                              ? tender?.status === "AWARDED"
                                ? "Awarded"
                                : "Selected"
                              : "Not selected"}
                          </p>
                        </div>
                      ) : (
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          {isOfficer &&
                            staffCanSelectOrAward &&
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
                                          toast.error(
                                            "Could not update status.",
                                          ),
                                        );
                                    }}
                                  >
                                    Mark under review
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => openSelectBidConfirm(bid._id)}
                                >
                                  Select
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
                          {isOfficer &&
                            staffCanSelectOrAward &&
                            bid.status === "ACCEPTED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectBid(bid._id)}
                              >
                                Not selected
                              </Button>
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
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 md:gap-5">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Proposal
                        </p>
                        <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-50/50 p-3.5 text-sm leading-relaxed text-slate-700">
                          {bid.technicalProposal?.trim()
                            ? bid.technicalProposal
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Financial / pricing notes
                        </p>
                        <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-50/50 p-3.5 text-sm leading-relaxed text-slate-700">
                          {bid.financialProposal?.trim()
                            ? bid.financialProposal
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(bid.documents) &&
                      bid.documents.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
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
            <h2 className="text-lg font-semibold text-slate-900">
              Tender payment
            </h2>
            {isOfficerOrAdmin && (
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-sm">
                {staffTenderPayments.length > 0 ? (
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium text-slate-800">
                        Status:
                      </span>{" "}
                      {staffTenderPayments[0].status} — NPR{" "}
                      {Number(
                        staffTenderPayments[0].amount || 0,
                      ).toLocaleString("en-NP")}
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
                      No payment yet. Quoted NPR{" "}
                      {Number(acceptedBid.amount).toLocaleString("en-NP")}.
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
                  <p className="text-amber-800">
                    No accepted quotation found for this award.
                  </p>
                )}
              </div>
            )}
            {isAwardedVendor && (
              <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4 text-sm">
                {!myTenderPayment ? (
                  <div className="space-y-2 text-slate-700">
                    <p>
                      <Link
                        className="font-medium text-teal-800 underline-offset-2 hover:underline"
                        to="/my-payments"
                      >
                        My payments
                      </Link>
                    </p>
                  </div>
                ) : myTenderPayment.status === "Pending" ? (
                  <div className="space-y-2 text-slate-800">
                    <p>
                      Amount recorded: NPR{" "}
                      {Number(myTenderPayment.amount).toLocaleString("en-NP")} —
                      status <span className="font-semibold">Pending</span>.
                    </p>
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
      </div>
    </motion.div>
  );
};

export default TenderDetail;
