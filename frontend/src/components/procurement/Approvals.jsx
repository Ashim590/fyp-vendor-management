import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getAllApprovals,
  getMyPendingApprovals,
  approveRequest,
  rejectApprovalRequest,
} from "@/redux/approvalSlice";
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
import { LoadingState } from "../ui/loading-state";
import { SESSION_ROLE } from "@/constants/userRoles";
import { Search, CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WorkspaceSegmentedControl,
  WORKSPACE_SELECT_CLASS,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";

const Approvals = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { approvals, pendingApprovals, loading, error } = useSelector(
    (store) => store.approval,
  );
  const { user } = useSelector((store) => store.auth);
  const canDecide =
    user?.role === SESSION_ROLE.ADMIN || user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    if (showPending) {
      dispatch(getMyPendingApprovals({ limit: 50 }));
    } else {
      dispatch(getAllApprovals({ limit: 50 }));
    }
  }, [dispatch, showPending]);

  useEffect(() => {
    if (error) {
      toast.error(getApiErrorMessage(error, "Could not load approvals."));
    }
  }, [error]);

  const handleApprove = async (approvalId) => {
    try {
      await dispatch(approveRequest({ approvalId, comments: "" })).unwrap();
      toast.success("Approval granted successfully");
      if (showPending) {
        dispatch(getMyPendingApprovals({ limit: 50 }));
      } else {
        dispatch(getAllApprovals({ limit: 50 }));
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to approve"));
    }
  };

  const handleReject = async (approvalId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await dispatch(
          rejectApprovalRequest({ approvalId, rejectionReason: reason }),
        ).unwrap();
        toast.success("Approval rejected");
        if (showPending) {
          dispatch(getMyPendingApprovals({ limit: 50 }));
        } else {
          dispatch(getAllApprovals({ limit: 50 }));
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to reject"));
      }
    }
  };

  const handleViewApproval = (approval) => {
    if (approval?.entityType === "purchase_request" && approval?.purchaseRequest) {
      const raw = approval.purchaseRequest;
      const prId =
        raw && typeof raw === "object" && raw !== null && "_id" in raw
          ? raw._id
          : raw;
      if (prId) {
        navigate(`/procurement/requests/${prId}`);
        return;
      }
    }
    toast.info("No detail view for this item.");
  };

  const displayApprovals = showPending ? pendingApprovals : approvals;

  const filteredApprovals = displayApprovals.filter((approval) => {
    const matchesSearch =
      approval.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.requesterName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || approval.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: "Pending", variant: "statusWarning" },
      approved: { label: "Approved", variant: "statusSuccess" },
      rejected: { label: "Rejected", variant: "statusDanger" },
      returned: { label: "Returned", variant: "statusInfo" },
    };
    const config = statusConfig[status] || statusConfig.pending;
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
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="Approval Management"
        actions={
          <WorkspaceSegmentedControl
            value={showPending ? "mine" : "all"}
            onChange={(v) => setShowPending(v === "mine")}
            options={[
              {
                value: "mine",
                label: "My pending",
                icon: <Clock className="h-4 w-4 opacity-80" />,
              },
              { value: "all", label: "All approvals" },
            ]}
          />
        }
      />

      <WorkspaceToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by title or requester…"
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
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="returned">Returned</option>
        </select>
      </WorkspaceToolbar>

      <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "md:!table-auto")}>
        <colgroup>
          <col className="min-w-[260px]" />
          <col className="min-w-[120px]" />
          <col className="min-w-[120px]" />
          <col className="min-w-[110px]" />
          <col className="min-w-[120px]" />
          <col className="min-w-[96px]" />
          <col className="min-w-[100px]" />
          <col className="min-w-[110px]" />
          <col className="min-w-[88px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[260px] text-left">
              {/* Mirror row layout so the label sits centered over the title text, not the S/N box */}
              <div className="flex items-center gap-3 sm:gap-4">
                <span
                  className="invisible flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-semibold tabular-nums ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  0
                </span>
                <span className="min-w-0 flex-1 text-center">Request</span>
              </div>
            </TableHead>
            <TableHead className="text-left">Type</TableHead>
            <TableHead className="text-left">Requester</TableHead>
            <TableHead className="text-left">Department</TableHead>
            <TableHead className="text-left">Amount</TableHead>
            <TableHead className="text-left">Priority</TableHead>
            <TableHead className="text-left">Status</TableHead>
            <TableHead className="text-left">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <LoadingState variant="table" />
              </TableCell>
            </TableRow>
          ) : filteredApprovals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-12 text-center text-slate-500">
                {showPending
                  ? "Nothing assigned to you as current approver."
                  : "No approvals match your filters."}
              </TableCell>
            </TableRow>
          ) : (
            filteredApprovals.map((approval, index) => (
              <TableRow key={approval._id}>
                <TableCell className="min-w-0 align-middle">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span
                      className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200/80"
                      title={`Row ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900 sm:text-[13px]">
                      <span className="line-clamp-3 break-words">
                        {approval.title}
                      </span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="min-w-0 align-middle capitalize text-slate-600">
                  <span className="whitespace-nowrap">
                    {String(approval.entityType || "").replace(/_/g, " ") || "—"}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 align-middle text-slate-700">
                  <span className="line-clamp-2 break-words">{approval.requesterName}</span>
                </TableCell>
                <TableCell className="min-w-0 align-middle text-slate-600">
                  <span className="line-clamp-2 break-words">{approval.requesterDepartment || "—"}</span>
                </TableCell>
                <TableCell className="min-w-0 align-middle whitespace-nowrap font-medium tabular-nums text-slate-900">
                  {formatCurrency(approval.amount)}
                </TableCell>
                <TableCell className="min-w-0 align-middle">{getPriorityBadge(approval.priority)}</TableCell>
                <TableCell className="min-w-0 align-middle">{getStatusBadge(approval.status)}</TableCell>
                <TableCell className="min-w-0 align-middle whitespace-nowrap text-slate-600">
                  {formatDate(approval.createdAt)}
                </TableCell>
                <TableCell className="min-w-0 align-middle text-right">
                  <div className="flex flex-col items-end justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-slate-200"
                      onClick={() => handleViewApproval(approval)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDecide && approval.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          onClick={() => handleApprove(approval._id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-rose-200 text-rose-800 hover:bg-rose-50"
                          onClick={() => handleReject(approval._id)}
                        >
                          <XCircle className="h-4 w-4" />
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

export default Approvals;
