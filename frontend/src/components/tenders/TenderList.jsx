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
  WorkspaceSegmentedControl,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { BarChart3, ArrowUpRight, Eye } from "lucide-react";

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
  /** Vendor-only: open calls for bid vs history (closed/awarded they joined). */
  const [vendorScope, setVendorScope] = useState("active");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedTenderIds, setSelectedTenderIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const isOfficerOrAdmin = user?.role === "admin" || user?.role === "staff";
  const isVendor = user?.role === "vendor";

  const fetchTenders = () => {
    const url = TENDER_API_END_POINT;
    const params = { limit: 50 };
    if (isVendor) {
      params.scope = vendorScope === "previous" ? "previous" : "active";
    } else if (filter) {
      params.status = filter;
    }
    setLoading(true);
    axios
      .get(url, {
        withCredentials: true,
        params,
      })
      .then((res) => {
        const list = res.data.tenders || [];
        setTenders(list);
        setSelectedTenderIds((prev) =>
          prev.filter((id) => list.some((t) => String(t._id) === String(id))),
        );
      })
      .catch(() => setTenders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenders();
  }, [filter, isOfficerOrAdmin, isVendor, vendorScope]);

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

  const confirmDeleteTender = async () => {
    if (!deleteTarget?._id) return;
    try {
      await axios.delete(`${TENDER_API_END_POINT}/${deleteTarget._id}`, {
        withCredentials: true,
      });
      toast.success("Tender deleted.");
      setDeleteTarget(null);
      fetchTenders();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete this tender.");
    }
  };

  const toggleSelected = (tenderId, checked) => {
    const id = String(tenderId);
    setSelectedTenderIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedTenderIds([]);
      return;
    }
    setSelectedTenderIds(tenders.map((t) => String(t._id)));
  };

  const deleteSelectedTenders = async () => {
    if (!selectedTenderIds.length) return;
    const ids = [...selectedTenderIds];
    const results = await Promise.allSettled(
      ids.map((id) =>
        axios.delete(`${TENDER_API_END_POINT}/${id}`, { withCredentials: true }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Deleted ${ok} tender(s).`);
    if (failed > 0) toast.error(`${failed} tender(s) could not be deleted.`);
    setBulkDeleteOpen(false);
    setSelectedTenderIds([]);
    fetchTenders();
  };

  const isAllSelected =
    tenders.length > 0 && selectedTenderIds.length === tenders.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete tender?"
        description={
          deleteTarget
            ? `This permanently removes “${deleteTarget.title}” (${deleteTarget.referenceNumber}), all quotations, and any non-completed payments. You cannot delete if a completed payment exists.`
            : ""
        }
        variant="destructive"
        confirmLabel="Delete tender"
        onConfirm={confirmDeleteTender}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected tenders?"
        description={`You selected ${selectedTenderIds.length} tender(s). This permanently removes selected tenders, related quotations, and any non-completed payments. Items with completed payments cannot be deleted.`}
        variant="destructive"
        confirmLabel="Delete selected"
        onConfirm={deleteSelectedTenders}
      />
      <WorkspacePageLayout className="max-w-6xl">
        <WorkspacePageHeader
          title={
            isOfficerOrAdmin
              ? "Manage tenders"
              : vendorScope === "previous"
                ? "Previous tenders"
                : "Active tenders"
          }
          actions={
            isOfficerOrAdmin ? (
              <div className="flex items-center gap-2">
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
                {user?.role === "staff" && selectedTenderIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    Delete selected ({selectedTenderIds.length})
                  </Button>
                )}
              </div>
            ) : null
          }
        />

        {isVendor ? (
          <WorkspaceSegmentedControl
            className="mb-6"
            value={vendorScope}
            onChange={setVendorScope}
            options={[
              { value: "active", label: "Active tenders" },
              { value: "previous", label: "Previous tenders" },
            ]}
          />
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]"
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
          <div className="rounded-2xl border border-slate-200/80 bg-white px-8 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
            <p className="text-sm font-medium text-slate-700">No tenders found</p>
            <p className="mt-1 text-sm text-slate-500">
              {isVendor
                ? vendorScope === "previous"
                  ? "You have no closed or awarded tenders yet. Completed calls you took part in will appear here."
                  : "There are no open published tenders right now. Check back later."
                : "Try another status filter or check back later."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {user?.role === "staff" && (
              <div className="flex items-center rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 px-4 py-3 shadow-sm ring-1 ring-slate-900/[0.03]">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0b1f4d] shadow-sm focus:ring-2 focus:ring-[#0b1f4d]/20"
                  />
                  Select all on this page
                </label>
              </div>
            )}
            {tenders.map((t) => {
              const isComplete = String(t.status) === "AWARDED";
              const cfg = isComplete
                ? { label: "Closed", variant: "statusMuted" }
                : statusConfig[t.status] || statusConfig.DRAFT;
              const vendorHistory =
                isVendor &&
                (String(t.status) === "CLOSED" ||
                  String(t.status) === "AWARDED");
              const showLink =
                isOfficerOrAdmin ||
                t.status === "PUBLISHED" ||
                vendorHistory;
              return (
                <div
                  key={t._id}
                  className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-stretch sm:justify-between sm:gap-6"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {user?.role === "staff" && (
                      <input
                        type="checkbox"
                        className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0b1f4d] shadow-sm focus:ring-2 focus:ring-[#0b1f4d]/20"
                        checked={selectedTenderIds.includes(String(t._id))}
                        onChange={(e) => toggleSelected(t._id, e.target.checked)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium tracking-tight text-slate-500 sm:text-sm">
                          {t.referenceNumber}
                        </span>
                        <Badge
                          variant={cfg.variant}
                          className="whitespace-nowrap font-semibold"
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <h2 className="mt-2 text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg">
                        {t.title}
                      </h2>
                      {t.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600 line-clamp-2">
                          {t.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        Closes{" "}
                        {new Date(t.closeDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {t.category}
                      </p>
                    </div>
                  </div>
                  {showLink && (
                    <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-4 sm:w-auto sm:min-w-[12.5rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                        {isOfficerOrAdmin && !isComplete && (
                          <Link
                            to={`/tenders/${t._id}#tender-automated-comparison`}
                            className="w-full sm:w-auto"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-full gap-2 border-teal-200/90 bg-teal-50/40 font-medium text-teal-900 shadow-sm hover:bg-teal-50 hover:text-teal-950"
                            >
                              <BarChart3 className="h-3.5 w-3.5 opacity-80" />
                              Compare bids
                            </Button>
                          </Link>
                        )}
                        <Link
                          to={`/tenders/${t._id}`}
                          className="w-full sm:w-auto"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-full gap-2 border-[#0b1f4d]/18 font-medium text-[#0b1f4d] shadow-sm hover:bg-[#0b1f4d]/[0.06]"
                          >
                            {isOfficerOrAdmin ? (
                              isComplete ? (
                                <>
                                  <Eye className="h-3.5 w-3.5 opacity-70" />
                                  View details
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                                  View & manage
                                </>
                              )
                            ) : vendorHistory ? (
                              <>
                                <Eye className="h-3.5 w-3.5 opacity-70" />
                                View details
                              </>
                            ) : (
                              "View & Submit Bid"
                            )}
                          </Button>
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                        {isOfficerOrAdmin && String(t.status) === "DRAFT" && (
                          <Button
                            size="sm"
                            className="h-9 w-full bg-[#0b1f4d] font-medium hover:bg-[#12306b]"
                            onClick={() => publishTender(t._id)}
                          >
                            Publish tender
                          </Button>
                        )}
                        {user?.role === "staff" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-9 w-full font-medium"
                            onClick={() =>
                              setDeleteTarget({
                                _id: t._id,
                                title: t.title,
                                referenceNumber: t.referenceNumber,
                              })
                            }
                          >
                            Delete tender
                          </Button>
                        )}
                      </div>
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
