import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getPurchaseRequestById,
  submitForApproval,
  cancelPurchaseRequest,
  deletePurchaseRequest,
  clearError,
} from "@/redux/purchaseRequestSlice";
import {
  approveRequest,
  rejectApprovalRequest,
} from "@/redux/approvalSlice";
import axios from "axios";
import { BID_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  X,
  FileText,
  CheckCircle,
  Clock,
  Package,
} from "lucide-react";
const PurchaseRequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const {
    currentPurchaseRequest: purchaseRequest,
    loading,
    error,
  } = useSelector((store) => store.purchaseRequest);
  const [activeTab, setActiveTab] = useState("details");
  const [relatedBids, setRelatedBids] = useState([]);
  const [loadingBids, setLoadingBids] = useState(false);

  useEffect(() => {
    if (!id) return;
    dispatch(clearError());
    dispatch(getPurchaseRequestById(id));
  }, [dispatch, id]);

  useEffect(() => {
    const tenderId = purchaseRequest?.linkedTender;
    if (!tenderId) {
      setRelatedBids([]);
      return;
    }
    setLoadingBids(true);
    axios
      .get(`${BID_API_END_POINT}/tender/${tenderId}`, { withCredentials: true })
      .then((res) => setRelatedBids(res.data?.bids || []))
      .catch(() => setRelatedBids([]))
      .finally(() => setLoadingBids(false));
  }, [purchaseRequest?.linkedTender]);

  const handleSubmitForApproval = async () => {
    try {
      await dispatch(submitForApproval(id)).unwrap();
      toast.success("Purchase request submitted for approval");
      dispatch(getPurchaseRequestById(id));
    } catch (err) {
      toast.error(err || "Failed to submit for approval");
    }
  };

  const isAdmin = user?.role === "admin";
  const isStaffOfficer = user?.role === "staff";
  const requesterRaw = purchaseRequest?.requester;
  const requesterId =
    requesterRaw &&
    typeof requesterRaw === "object" &&
    requesterRaw !== null &&
    "_id" in requesterRaw
      ? requesterRaw._id
      : requesterRaw;
  const isRequester =
    user?._id && requesterId && String(requesterId) === String(user._id);

  const handleAdminApprove = async () => {
    const approvalId = purchaseRequest?.pendingApprovalId;
    if (!approvalId) {
      toast.error("No pending approval found for this request.");
      return;
    }
    try {
      await dispatch(
        approveRequest({ approvalId, comments: "" }),
      ).unwrap();
      toast.success("Purchase request approved");
      dispatch(getPurchaseRequestById(id));
    } catch (err) {
      toast.error(err || "Failed to approve");
    }
  };

  const handleAdminReject = async () => {
    const approvalId = purchaseRequest?.pendingApprovalId;
    if (!approvalId) {
      toast.error("No pending approval found for this request.");
      return;
    }
    const reason = window.prompt("Rejection reason (optional):");
    if (reason === null) return;
    try {
      await dispatch(
        rejectApprovalRequest({
          approvalId,
          rejectionReason: reason.trim(),
        }),
      ).unwrap();
      toast.success("Purchase request rejected");
      dispatch(getPurchaseRequestById(id));
    } catch (err) {
      toast.error(err || "Failed to reject");
    }
  };

  const handleCancel = async () => {
    const reason = prompt("Enter cancellation reason:");
    if (reason) {
      try {
        await dispatch(
          cancelPurchaseRequest({ requestId: id, cancellationReason: reason }),
        ).unwrap();
        toast.success("Purchase request cancelled");
        dispatch(getPurchaseRequestById(id));
      } catch (err) {
        toast.error(err || "Failed to cancel purchase request");
      }
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = window.confirm(
      "Delete this draft purchase request? This action cannot be undone.",
    );
    if (!ok) return;
    try {
      await dispatch(deletePurchaseRequest(id)).unwrap();
      toast.success("Purchase request deleted");
      navigate("/purchase-requests");
    } catch (err) {
      toast.error(err || "Failed to delete purchase request");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: "Draft", className: "bg-gray-500" },
      pending_approval: {
        label: "Pending Approval",
        className: "bg-yellow-500",
      },
      approved: { label: "Approved", className: "bg-green-500" },
      rejected: { label: "Rejected", className: "bg-red-500" },
      cancelled: { label: "Cancelled", className: "bg-gray-500" },
      quotation_received: {
        label: "Quotation Received",
        className: "bg-blue-500",
      },
      po_created: { label: "PO Created", className: "bg-purple-500" },
      completed: { label: "Completed", className: "bg-green-700" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { label: "Low", className: "bg-gray-100 text-gray-800" },
      medium: { label: "Medium", className: "bg-blue-100 text-blue-800" },
      high: { label: "High", className: "bg-orange-100 text-orange-800" },
      urgent: { label: "Urgent", className: "bg-red-100 text-red-800" },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return <Badge className={config.className}>{config.label}</Badge>;
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

  if (!id) {
    return (
      <div className="w-full flex-1 bg-canvas py-5 sm:py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
            <div className="text-center py-10 text-slate-600">
              Invalid purchase request link.
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link to="/purchase-requests">Back to purchase requests</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const detailIdMatches =
    purchaseRequest &&
    id &&
    String(purchaseRequest._id) === String(id);

  if (error && !loading && !purchaseRequest) {
    return (
      <div className="w-full flex-1 bg-canvas py-5 sm:py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
            <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50/90 px-6 py-8 text-center">
              <p className="text-sm font-medium text-rose-900">Could not load this purchase request</p>
              <p className="mt-2 text-sm text-rose-800/90">{String(error)}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    dispatch(clearError());
                    dispatch(getPurchaseRequestById(id));
                  }}
                >
                  Try again
                </Button>
                <Button asChild variant="default" className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90">
                  <Link to="/purchase-requests">Back to list</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !detailIdMatches) {
    return (
      <div className="w-full flex-1 bg-canvas py-5 sm:py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
            <div className="text-center py-10 text-slate-600">
              Loading purchase request details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 bg-canvas py-5 sm:py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <nav
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600"
              aria-label="Breadcrumb"
            >
              <Link
                to="/purchase-requests"
                className="inline-flex items-center font-medium text-teal-800 hover:text-teal-950 hover:underline"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4 shrink-0" />
                All purchase requests
              </Link>
              <span className="text-gray-400" aria-hidden>
                /
              </span>
              <span className="font-medium text-gray-900">
                {purchaseRequest.requestNumber}
              </span>
            </nav>
            <Link
              to="/"
              className="text-sm font-semibold text-[#0b1f4d] underline-offset-2 hover:underline"
            >
              Workspace home (dashboard)
            </Link>
          </div>

          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">
                    {purchaseRequest.title}
                  </h1>
                  <span className="text-gray-500">
                    #{purchaseRequest.requestNumber}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(purchaseRequest.status)}
                  {getPriorityBadge(purchaseRequest.priority)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {purchaseRequest.status === "draft" && (
                  <>
                    <Link to={`/purchase-requests/${id}/edit`}>
                      <Button variant="outline">Edit</Button>
                    </Link>
                    <Button
                      onClick={handleSubmitForApproval}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </Button>
                    <Button onClick={handleDelete} variant="destructive">
                      Delete
                    </Button>
                  </>
                )}
                {purchaseRequest.status === "pending_approval" && isAdmin && (
                  <>
                    <Button
                      onClick={handleAdminApprove}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    <Button onClick={handleAdminReject} variant="destructive">
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {purchaseRequest.status === "pending_approval" &&
                  !isAdmin &&
                  isStaffOfficer &&
                  isRequester && (
                    <>
                      <Link to={`/purchase-requests/${id}/edit`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
                      <Button onClick={handleCancel} variant="destructive">
                        <X className="h-4 w-4 mr-2" />
                        Withdraw
                      </Button>
                    </>
                  )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="details">Overview</TabsTrigger>
              <TabsTrigger value="items">
                Items ({purchaseRequest.items?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="quotations">
                Tender bids ({relatedBids?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" aria-label="Request overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Request Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">
                        Department
                      </label>
                      <p className="font-medium">
                        {purchaseRequest.department}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Requester</label>
                      <p className="font-medium">
                        {purchaseRequest.requester?.fullname ||
                          purchaseRequest.requester?.name ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Description
                      </label>
                      <p>{purchaseRequest.description}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Justification
                      </label>
                      <p>{purchaseRequest.justification || "Not provided"}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Delivery Location
                      </label>
                      <p>{purchaseRequest.deliveryLocation}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Financial Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">
                        Total Estimated Amount
                      </label>
                      <p className="text-2xl font-bold">
                        {formatCurrency(purchaseRequest.totalEstimatedAmount)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Required Date
                      </label>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatDate(purchaseRequest.requiredDate)}
                      </p>
                    </div>
                    {purchaseRequest.notes && (
                      <div>
                        <label className="text-sm text-gray-500">Notes</label>
                        <p>{purchaseRequest.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="items">
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Requested Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Item Name</th>
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3">Quantity</th>
                          <th className="text-left p-3">Unit</th>
                          <th className="text-right p-3">Unit Price</th>
                          <th className="text-right p-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseRequest.items?.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-3 font-medium">{item.itemName}</td>
                            <td className="p-3">{item.description || "-"}</td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3">{item.unit}</td>
                            <td className="p-3 text-right">
                              {formatCurrency(item.estimatedUnitPrice)}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td colSpan={5} className="p-3 text-right">
                            Total:
                          </td>
                          <td className="p-3 text-right">
                            {formatCurrency(
                              purchaseRequest.totalEstimatedAmount,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quotations">
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Tender bids
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    Vendor quotations on the linked tender show here after this
                    request is approved and a tender exists.
                  </p>
                </CardHeader>
                <CardContent>
                  {!purchaseRequest.linkedTender ? (
                    <p className="text-gray-500 text-center py-6">
                      No linked tender yet — typically after admin approval a
                      tender is created. Until then, use the main Tenders page.
                    </p>
                  ) : loadingBids ? (
                    <p className="text-gray-500 text-center py-6">
                      Loading bids...
                    </p>
                  ) : relatedBids && relatedBids.length > 0 ? (
                    <div className="space-y-4">
                      {relatedBids.map((bid) => (
                        <div key={bid._id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">
                                {bid.vendor?.name || "Vendor"}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Bid ID: {bid._id}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">
                                {formatCurrency(bid.amount)}
                              </p>
                              <Badge
                                className={
                                  String(bid.status || "").toUpperCase() ===
                                  "ACCEPTED"
                                    ? "bg-green-500"
                                    : "bg-gray-500"
                                }
                              >
                                {bid.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Link
                              to={`/tenders/${purchaseRequest.linkedTender}`}
                            >
                              <Button variant="outline" size="sm">
                                Open Tender
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">
                      No bids received yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Activity History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Request Created</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(purchaseRequest.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequestDetails;
