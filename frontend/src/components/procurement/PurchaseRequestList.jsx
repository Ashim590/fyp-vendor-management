import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllPurchaseRequests,
  deletePurchaseRequest,
  restorePurchaseRequest,
} from "@/redux/purchaseRequestSlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "sonner";
import { SESSION_ROLE } from "@/constants/userRoles";
import {
  Search,
  Plus,
  Eye,
  Trash2,
  Pencil,
  RotateCcw,
  ClipboardList,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "../ui/empty-state";
import { LoadingState } from "../ui/loading-state";

const PurchaseRequestList = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const currentUserId = String(user?._id || user?.id || "");
  const { purchaseRequests, loading, error } = useSelector(
    (store) => store.purchaseRequest,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [trashView, setTrashView] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [bulkPermanentOpen, setBulkPermanentOpen] = useState(false);

  const isAdmin = user?.role === SESSION_ROLE.ADMIN;
  const isStaff = user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;

  const canOperateRow = (pr) =>
    isAdmin || (isStaff && String(pr.requester?._id || "") === currentUserId);

  useEffect(() => {
    dispatch(getAllPurchaseRequests({ limit: 100, trash: trashView ? 1 : 0 }));
  }, [dispatch, trashView]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this purchase request?")
    ) {
      try {
        await dispatch(deletePurchaseRequest(id)).unwrap();
        toast.success("Moved to trash. Auto-delete in 5 days.");
        dispatch(
          getAllPurchaseRequests({ limit: 100, trash: trashView ? 1 : 0 }),
        );
      } catch (err) {
        toast.error(err || "Failed to delete purchase request");
      }
    }
  };

  const handleRestore = async (id) => {
    try {
      await dispatch(restorePurchaseRequest(id)).unwrap();
      toast.success("Purchase request restored");
      dispatch(
        getAllPurchaseRequests({ limit: 100, trash: trashView ? 1 : 0 }),
      );
    } catch (err) {
      toast.error(err || "Failed to restore purchase request");
    }
  };

  const handlePermanentDelete = async (id) => {
    if (
      !window.confirm(
        "Permanently delete this request from trash? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await dispatch(
        deletePurchaseRequest({ requestId: id, force: true }),
      ).unwrap();
      toast.success("Permanently deleted.");
      dispatch(
        getAllPurchaseRequests({ limit: 100, trash: trashView ? 1 : 0 }),
      );
    } catch (err) {
      toast.error(err || "Failed to permanently delete purchase request");
    }
  };

  const filteredRequests = useMemo(
    () =>
      purchaseRequests.filter((pr) => {
        const matchesSearch =
          pr.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.requestNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || pr.status === statusFilter;
        const matchesDept =
          departmentFilter === "all" || pr.department === departmentFilter;
        return matchesSearch && matchesStatus && matchesDept;
      }),
    [purchaseRequests, searchTerm, statusFilter, departmentFilter],
  );

  const selectableFiltered = useMemo(
    () => filteredRequests.filter((pr) => canOperateRow(pr)),
    [filteredRequests, isAdmin, isStaff, currentUserId],
  );
  const selectableIds = selectableFiltered.map((pr) => String(pr._id));
  const isAllFilteredSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    const visible = new Set(filteredRequests.map((p) => String(p._id)));
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredRequests]);

  useEffect(() => {
    setSelectedIds([]);
  }, [trashView]);

  const toggleSelectId = (id, checked) => {
    const s = String(id);
    setSelectedIds((prev) =>
      checked
        ? prev.includes(s)
          ? prev
          : [...prev, s]
        : prev.filter((x) => x !== s),
    );
  };

  const toggleSelectAllFiltered = (checked) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(selectableIds);
  };

  const deleteBulkSelected = async () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => dispatch(deletePurchaseRequest(id)).unwrap()),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Moved ${ok} to trash. Auto-delete in 5 days.`);
    if (failed > 0) toast.error(`${failed} could not be moved to trash.`);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    dispatch(getAllPurchaseRequests({ limit: 100, trash: trashView ? 1 : 0 }));
  };

  const restoreBulkSelected = async () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => dispatch(restorePurchaseRequest(id)).unwrap()),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Restored ${ok} request(s).`);
    if (failed > 0) toast.error(`${failed} could not be restored.`);
    setBulkRestoreOpen(false);
    setSelectedIds([]);
    dispatch(getAllPurchaseRequests({ limit: 100, trash: 1 }));
  };

  const permanentDeleteBulkSelected = async () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) =>
        dispatch(
          deletePurchaseRequest({ requestId: id, force: true }),
        ).unwrap(),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Permanently deleted ${ok} request(s).`);
    if (failed > 0) toast.error(`${failed} could not be deleted permanently.`);
    setBulkPermanentOpen(false);
    setSelectedIds([]);
    dispatch(getAllPurchaseRequests({ limit: 100, trash: 1 }));
  };

  const getStatusBadge = (status) => {
    const normalizedStatus = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const statusConfig = {
      draft: { label: "Draft", variant: "statusMuted" },
      pending_approval: { label: "Pending approval", variant: "statusWarning" },
      approved: { label: "Approved", variant: "statusSuccess" },
      rejected: { label: "Rejected", variant: "statusDanger" },
      cancelled: { label: "Cancelled", variant: "statusNeutral" },
      quotation_received: {
        label: "Quotation received",
        variant: "statusInfo",
      },
      po_created: { label: "PO created", variant: "statusInfo" },
      completed: { label: "Completed", variant: "statusSuccess" },
    };
    const config = statusConfig[normalizedStatus] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="whitespace-nowrap">
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { label: "Low", variant: "statusNeutral" },
      medium: { label: "Medium", variant: "statusInfo" },
      high: { label: "High", variant: "statusWarning" },
      urgent: { label: "Urgent", variant: "statusDanger" },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <Badge variant={config.variant} className="whitespace-nowrap">
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    // Keep required date stable across timezones to avoid off-by-one-day display.
    return parsed.toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  // Get unique departments for filter
  const departments = [
    ...new Set(purchaseRequests.map((pr) => pr.department).filter(Boolean)),
  ];

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="Purchase requests"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant={trashView ? "default" : "outline"}
              onClick={() => setTrashView((v) => !v)}
            >
              {trashView ? "Back to active" : "View trash"}
            </Button>
            {!trashView && (
              <Link to="/purchase-requests/new">
                <Button className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90">
                  <Plus className="mr-2 h-4 w-4" />
                  New request
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <WorkspaceToolbar>
        <div className="relative min-w-0 w-full flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by title or request number…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 border-slate-200/90 pl-10 shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={WORKSPACE_SELECT_CLASS}
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="quotation_received">Quotation received</option>
          <option value="po_created">PO created</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className={WORKSPACE_SELECT_CLASS}
        >
          <option value="all">All departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        {!trashView && (isAdmin || isStaff) && selectedIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete selected ({selectedIds.length})
          </Button>
        )}
        {trashView && (isAdmin || isStaff) && selectedIds.length > 0 && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkRestoreOpen(true)}
            >
              Restore selected ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkPermanentOpen(true)}
            >
              Delete permanently ({selectedIds.length})
            </Button>
          </>
        )}
      </WorkspaceToolbar>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Move selected to trash?"
        description={`${selectedIds.length} request(s) will go to trash and be permanently removed after 5 days. Pending approvals will be cancelled.`}
        variant="destructive"
        confirmLabel="Move to trash"
        onConfirm={deleteBulkSelected}
      />
      <ConfirmDialog
        open={bulkRestoreOpen}
        onOpenChange={setBulkRestoreOpen}
        title="Restore selected?"
        description={`${selectedIds.length} request(s) will be restored from trash to the active list.`}
        confirmLabel="Restore"
        onConfirm={restoreBulkSelected}
      />
      <ConfirmDialog
        open={bulkPermanentOpen}
        onOpenChange={setBulkPermanentOpen}
        title="Permanently delete selected?"
        description={`${selectedIds.length} request(s) will be removed from the database. This cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete permanently"
        onConfirm={permanentDeleteBulkSelected}
      />

      <Table className={cn(WORKSPACE_DATA_TABLE_CLASS)}>
        {isAdmin || isStaff ? (
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[3%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[11%]" />
            <col className="w-[21%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
          </colgroup>
        )}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {(isAdmin || isStaff) && (
              <TableHead className="text-center">
                {selectableFiltered.length > 0 ? (
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={isAllFilteredSelected}
                    onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                  />
                ) : null}
              </TableHead>
            )}
            <TableHead className="text-center">S/N</TableHead>
            <TableHead className="text-left">Request #</TableHead>
            <TableHead className="text-left">Title</TableHead>
            <TableHead className="text-left">Department</TableHead>
            <TableHead className="text-left">Items</TableHead>
            <TableHead className="text-right whitespace-nowrap">
              Estimated amount
            </TableHead>
            <TableHead className="text-left whitespace-nowrap">
              Priority
            </TableHead>
            <TableHead className="text-left whitespace-nowrap">
              Status
            </TableHead>
            <TableHead className="text-left whitespace-nowrap">
              Required Date
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin || isStaff ? 11 : 10}
                className="p-0"
              >
                <LoadingState variant="table" />
              </TableCell>
            </TableRow>
          ) : filteredRequests.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin || isStaff ? 11 : 10}
                className="p-0 align-top"
              >
                {trashView ? (
                  <EmptyState
                    compact
                    title="Trash is empty"
                    description="Deleted requests stay here until they are permanently removed or restored."
                  />
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title="No purchase requests match"
                    description="Try clearing search and filters, or start a new request for your department."
                    action={{
                      label: "New purchase request",
                      to: "/purchase-requests/new",
                    }}
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            filteredRequests.map((pr, index) => (
              <TableRow
                key={pr._id}
                className={index % 2 ? "bg-slate-50/30" : ""}
              >
                {(isAdmin || isStaff) && (
                  <TableCell className="w-10 text-center align-middle">
                    {canOperateRow(pr) ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${pr.requestNumber || pr._id}`}
                        checked={selectedIds.includes(String(pr._id))}
                        onChange={(e) =>
                          toggleSelectId(pr._id, e.target.checked)
                        }
                      />
                    ) : null}
                  </TableCell>
                )}
                <TableCell className="min-w-0 text-center text-xs text-slate-500">
                  {index + 1}
                </TableCell>
                <TableCell
                  className="min-w-0 whitespace-nowrap font-medium tabular-nums text-slate-700"
                  title={pr.requestNumber}
                >
                  {pr.requestNumber}
                </TableCell>
                <TableCell className="min-w-0">
                  {trashView ? (
                    <span className="line-clamp-2 break-words font-medium text-slate-900">
                      {pr.title}
                    </span>
                  ) : (
                    <Link
                      to={`/procurement/requests/${pr._id}`}
                      className="line-clamp-2 break-words font-medium text-slate-900 hover:underline"
                    >
                      {pr.title}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="min-w-0 text-slate-700">
                  <span className="line-clamp-2 break-words">
                    {pr.department}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-slate-700">
                  <span className="tabular-nums">
                    {pr.itemsCount ?? pr.items?.length ?? 0}
                  </span>{" "}
                  items
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-right tabular-nums font-medium text-slate-900">
                  {formatCurrency(pr.totalEstimatedAmount)}
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap">
                  {getPriorityBadge(pr.priority)}
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap">
                  {getStatusBadge(pr.status)}
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-slate-700">
                  {formatDate(pr.requiredDate)}
                </TableCell>
                    <TableCell className="min-w-0 align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                    {!trashView && (
                      <Link to={`/procurement/requests/${pr._id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {(user?.role === "admin" ||
                      (user?.role === SESSION_ROLE.PROCUREMENT_OFFICER &&
                        String(pr.requester?._id || "") === currentUserId &&
                        ["draft", "rejected", "pending_approval"].includes(
                          String(pr.status || "").toLowerCase(),
                        ))) &&
                      !trashView && (
                        <Link to={`/purchase-requests/${pr._id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit request"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    {!trashView &&
                      (user?.role === "admin" ||
                        (user?.role === SESSION_ROLE.PROCUREMENT_OFFICER &&
                          String(pr.requester?._id || "") ===
                            currentUserId)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600"
                          title="Move to trash"
                          onClick={() => handleDelete(pr._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    {trashView &&
                      (user?.role === "admin" ||
                        (user?.role === SESSION_ROLE.PROCUREMENT_OFFICER &&
                          String(pr.requester?._id || "") ===
                            currentUserId)) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Restore"
                            onClick={() => handleRestore(pr._id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600"
                            title="Delete permanently"
                            onClick={() => handlePermanentDelete(pr._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WorkspacePageLayout>
  );
};

export default PurchaseRequestList;
