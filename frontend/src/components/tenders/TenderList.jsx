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
import { ConfirmDialog } from "../ui/confirm-dialog";

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedTenderIds, setSelectedTenderIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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
          title={isOfficerOrAdmin ? "Manage tenders" : "Active tenders"}
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
            {user?.role === "staff" && (
              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                  Select all
                </label>
              </div>
            )}
            {tenders.map((t) => {
              const cfg = statusConfig[t.status] || statusConfig.DRAFT;
              const showLink = t.status === "PUBLISHED" || isOfficerOrAdmin;
              return (
                <div
                  key={t._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    {user?.role === "staff" && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedTenderIds.includes(String(t._id))}
                        onChange={(e) => toggleSelected(t._id, e.target.checked)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
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
                  </div>
                  {showLink && (
                    <div className="flex flex-wrap items-center gap-2 justify-end">
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
                      {user?.role === "staff" && (
                        <Button
                          size="sm"
                          variant="destructive"
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
