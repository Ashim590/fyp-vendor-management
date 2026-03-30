import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { BID_API_END_POINT } from "@/utils/constant";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { toast } from "sonner";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
} from "../layout/WorkspacePageLayout";

const statusConfig = {
  SUBMITTED: { label: "Pending", variant: "statusWarning" },
  UNDER_REVIEW: { label: "Under review", variant: "statusInfo" },
  ACCEPTED: { label: "Accepted", variant: "statusSuccess" },
  REJECTED: { label: "Not selected", variant: "statusDanger" },
};

const MyBids = () => {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
        toast.error(err.response?.data?.message || "Could not withdraw."),
      );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <WorkspacePageLayout className="max-w-4xl">
        <WorkspacePageHeader
          title="My tender quotations"
          description="Track quotations you submitted for published tenders. You’ll get notifications when a decision is made."
        />
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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center text-slate-500 shadow-sm">
            You have not submitted any tender quotations yet.
            <Link
              to="/tenders"
              className="mt-3 block text-sm font-semibold text-[#0b1f4d] hover:underline"
            >
              Browse tenders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bids.map((bid) => {
              const cfg = statusConfig[bid.status] || statusConfig.SUBMITTED;
              const t = bid.tender;
              const docs = Array.isArray(bid.documents) ? bid.documents : [];
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
                        <span className="text-slate-500 text-sm">Quote: </span>
                        <span className="font-semibold">
                          NPR {Number(bid.amount).toLocaleString("en-NP")}
                        </span>
                      </p>
                      {bid.technicalProposal?.trim() && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-wrap">
                          {bid.technicalProposal}
                        </p>
                      )}
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
                      <Link
                        to={`/tenders/${t?._id}`}
                        className="text-teal-700 hover:underline text-sm"
                      >
                        View tender
                      </Link>
                    </div>
                  </div>
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
