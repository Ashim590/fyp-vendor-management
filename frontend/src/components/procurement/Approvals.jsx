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

const Approvals = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { approvals, pendingApprovals, loading, error } = useSelector(
    (store) => store.approval,
  );
  const { user } = useSelector((store) => store.auth);
  const canDecide =
    user?.role === "admin" || user?.role === "staff";
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
      toast.error(error);
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
      toast.error(err || "Failed to approve");
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
        toast.error(err || "Failed to reject");
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

      <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
        <colgroup>
          <col className="w-[2%]" />
          <col className="w-[19%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[18%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-center">S/N</TableHead>
            <TableHead className="text-left">Title</TableHead>
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
              <TableCell colSpan={10} className="py-12 text-center text-slate-500">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredApprovals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-12 text-center text-slate-500">
                {showPending
                  ? "Nothing assigned to you as current approver."
                  : "No approvals match your filters."}
              </TableCell>
            </TableRow>
          ) : (
            filteredApprovals.map((approval, index) => (
              <TableRow key={approval._id}>
                <TableCell className="min-w-0 text-center text-xs text-slate-500">
                  {index + 1}
                </TableCell>
                <TableCell className="min-w-0 font-medium text-slate-900">
                  <span className="line-clamp-2 break-words">{approval.title}</span>
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap capitalize text-slate-600">
                  {approval.entityType?.replace("_", " ")}
                </TableCell>
                <TableCell className="min-w-0 text-slate-700">
                  <span className="line-clamp-2 break-words">{approval.requesterName}</span>
                </TableCell>
                <TableCell className="min-w-0 text-slate-600">
                  <span className="line-clamp-2 break-words">{approval.requesterDepartment || "—"}</span>
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap font-medium tabular-nums text-slate-900">
                  {formatCurrency(approval.amount)}
                </TableCell>
                <TableCell className="min-w-0">{getPriorityBadge(approval.priority)}</TableCell>
                <TableCell className="min-w-0">{getStatusBadge(approval.status)}</TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-slate-600">
                  {formatDate(approval.createdAt)}
                </TableCell>
                <TableCell className="min-w-0 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
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
