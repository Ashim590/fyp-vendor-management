import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllPurchaseRequests,
  deletePurchaseRequest,
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
import { Search, Plus, Eye, Trash2, FileText, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";
const PurchaseRequestList = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const currentUserId = String(user?._id || user?.id || "");
  const { purchaseRequests, loading, error } = useSelector(
    (store) => store.purchaseRequest
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    dispatch(getAllPurchaseRequests({ limit: 100 }));
  }, [dispatch]);

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
        toast.success("Purchase request deleted");
        dispatch(getAllPurchaseRequests({ limit: 100 }));
      } catch (err) {
        toast.error(err || "Failed to delete purchase request");
      }
    }
  };

  const filteredRequests = purchaseRequests.filter((pr) => {
    const matchesSearch =
      pr.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.requestNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || pr.status === statusFilter;
    const matchesDept =
      departmentFilter === "all" || pr.department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "statusMuted" },
      pending_approval: { label: "Pending approval", variant: "statusWarning" },
      approved: { label: "Approved", variant: "statusSuccess" },
      rejected: { label: "Rejected", variant: "statusDanger" },
      cancelled: { label: "Cancelled", variant: "statusNeutral" },
      quotation_received: { label: "Quotation received", variant: "statusInfo" },
      po_created: { label: "PO created", variant: "statusInfo" },
      completed: { label: "Completed", variant: "statusSuccess" },
    };
    const config = statusConfig[status] || statusConfig.draft;
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

  // Get unique departments for filter
  const departments = [
    ...new Set(purchaseRequests.map((pr) => pr.department).filter(Boolean)),
  ];

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="Purchase requests"
        description="Create and track internal purchase requests through approval and fulfillment."
        actions={
          <Link to="/purchase-requests/new">
            <Button className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90">
              <Plus className="mr-2 h-4 w-4" />
              New request
            </Button>
          </Link>
        }
      />

      <WorkspaceToolbar>
        <div className="relative min-w-[200px] flex-1">
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
      </WorkspaceToolbar>

      <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Request #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Estimated Amount</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Required Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No purchase requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((pr) => (
                  <TableRow key={pr._id}>
                    <TableCell className="font-medium">
                      {pr.requestNumber}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/procurement/requests/${pr._id}`}
                        className="hover:underline"
                      >
                        {pr.title}
                      </Link>
                    </TableCell>
                    <TableCell>{pr.department}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        {pr.items?.length || 0} items
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(pr.totalEstimatedAmount)}
                    </TableCell>
                    <TableCell>{getPriorityBadge(pr.priority)}</TableCell>
                    <TableCell>{getStatusBadge(pr.status)}</TableCell>
                    <TableCell>{formatDate(pr.requiredDate)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/procurement/requests/${pr._id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {(user?.role === "admin" ||
                          (user?.role === "staff" &&
                            String(pr.requester?._id || "") === currentUserId &&
                            ["draft", "rejected", "pending_approval"].includes(String(pr.status || "").toLowerCase()))) && (
                          <Link to={`/purchase-requests/${pr._id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {(user?.role === "admin" ||
                          (user?.role === "staff" &&
                            String(pr.requester?._id || "") === currentUserId)) &&
                          pr.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDelete(pr._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
