import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { TENDER_API_END_POINT } from "@/utils/constant";
import { useSelector } from "react-redux";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { toast } from "sonner";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";

const statusConfig = {
  DRAFT: { label: "Draft", variant: "statusMuted" },
  PUBLISHED: { label: "Published", variant: "statusSuccess" },
  CLOSED: { label: "Closed", variant: "statusWarning" },
  AWARDED: { label: "Awarded", variant: "statusInfo" },
};

const TenderList = () => {
  const { user } = useSelector((store) => store.auth);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const isOfficerOrAdmin = user?.role === "admin" || user?.role === "staff";
  const isVendor = user?.role === "vendor";

  const fetchTenders = () => {
    const url = TENDER_API_END_POINT;
    const params = {};
    if (filter) params.status = filter;
    if (isVendor && !filter) params.status = "PUBLISHED";
    setLoading(true);
    axios
      .get(url, {
        withCredentials: true,
        params: { ...params, limit: 50 },
      })
      .then((res) => setTenders(res.data.tenders || []))
      .catch(() => setTenders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenders();
  }, [filter, isOfficerOrAdmin, isVendor]);

  const publishTender = async (tenderId) => {
    try {
      await axios.patch(
        `${TENDER_API_END_POINT}/${tenderId}/publish`,
        {},
        { withCredentials: true }
      );
      toast.success("Tender published");
      fetchTenders();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to publish tender");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <WorkspacePageLayout className="max-w-6xl">
        {isVendor && (
          <div className="mb-5 rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-[#0b1f4d]">New tenders:</span> when
            procurement publishes a tender, you’ll get a{" "}
            <span className="font-medium">notification</span> (bell icon) and it
            will appear in this list.
          </div>
        )}

        <WorkspacePageHeader
          title={isOfficerOrAdmin ? "Manage tenders" : "Active tenders"}
          description={
            isOfficerOrAdmin
              ? "Publish drafts, monitor open tenders, and close or award as procurement progresses."
              : "Open published tenders to review requirements and submit your quotation."
          }
          actions={
            isOfficerOrAdmin ? (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={WORKSPACE_SELECT_CLASS}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="CLOSED">Closed</option>
                <option value="AWARDED">Awarded</option>
              </select>
            ) : null
          }
        />

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <LoadingSkeleton className="h-4 w-2/3 mb-3" />
                  <LoadingSkeleton className="h-3 w-full mb-2" />
                  <LoadingSkeleton className="h-3 w-2/3" />
                </div>
                <div className="w-28">
                  <LoadingSkeleton className="h-9 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : tenders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center text-slate-500 shadow-sm">
            No tenders found.
          </div>
        ) : (
          <div className="space-y-3">
            {tenders.map((t) => {
              const cfg = statusConfig[t.status] || statusConfig.DRAFT;
              const showLink = t.status === "PUBLISHED" || isOfficerOrAdmin;
              return (
                <div
                  key={t._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-slate-500">
                        {t.referenceNumber}
                      </span>
                      <Badge variant={cfg.variant} className="whitespace-nowrap">
                        {cfg.label}
                      </Badge>
                    </div>
                    <h2 className="font-semibold text-slate-900 mt-1">
                      {t.title}
                    </h2>
                    <p className="text-sm text-slate-600 line-clamp-1">
                      {t.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Closes: {new Date(t.closeDate).toLocaleDateString()} •{" "}
                      {t.category}
                    </p>
                  </div>
                  {showLink && (
                    <div className="flex items-center gap-2">
                      <Link to={`/tenders/${t._id}`}>
                        <Button variant="outline" size="sm">
                          {isOfficerOrAdmin
                            ? "View / Manage"
                            : "View & Submit Bid"}
                        </Button>
                      </Link>
                      {isOfficerOrAdmin && String(t.status) === "DRAFT" && (
                        <Button
                          size="sm"
                          className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90"
                          onClick={() => publishTender(t._id)}
                        >
                          Publish tender
                        </Button>
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

export default TenderList;
