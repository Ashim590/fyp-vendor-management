import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllPurchaseOrders } from "@/redux/purchaseOrderSlice";
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
import { Search, Eye, FileText, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { WORKSPACE_DATA_TABLE_CLASS } from "../layout/WorkspacePageLayout";
import { cn } from "@/lib/utils";

const PurchaseOrders = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const canOpenVendorProfile =
    user?.role === "admin" || user?.role === "staff";
  const { purchaseOrders, loading, error } = useSelector(
    (store) => store.purchaseOrder
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    dispatch(getAllPurchaseOrders({ limit: 50 }));
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const filteredOrders = purchaseOrders.filter((order) => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: "Draft", className: "bg-gray-500" },
      pending: { label: "Pending", className: "bg-yellow-500" },
      approved: { label: "Approved", className: "bg-green-500" },
      issued: { label: "Issued", className: "bg-blue-500" },
      partial: { label: "Partially Delivered", className: "bg-orange-500" },
      completed: { label: "Completed", className: "bg-green-700" },
      cancelled: { label: "Cancelled", className: "bg-red-500" },
    };
    const config = statusConfig[status] || statusConfig.draft;
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

  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Purchase Order Management</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by order number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-4 py-2"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="issued">Issued</option>
            <option value="partial">Partially Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Purchase Orders Table */}
        <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[24%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">PO Number</TableHead>
                <TableHead className="text-left">Vendor</TableHead>
                <TableHead className="text-left">PR Reference</TableHead>
                <TableHead className="text-left">Items</TableHead>
                <TableHead className="text-left">Total Amount</TableHead>
                <TableHead className="text-left">Delivery Date</TableHead>
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="min-w-0 truncate font-medium tabular-nums">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="min-w-0">
                      {canOpenVendorProfile && order.vendor ? (
                        <Link
                          to={`/vendors/${order.vendor}`}
                          className="line-clamp-2 break-words font-medium text-teal-800 hover:underline"
                        >
                          {order.vendorName || "—"}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 break-words">{order.vendorName || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0 truncate whitespace-nowrap tabular-nums">
                      {order.purchaseRequest?.requestNumber || "N/A"}
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                        {order.itemsCount ?? order.items?.length ?? 0} items
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap font-medium tabular-nums">
                      {formatCurrency(order.totalAmount)}
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap">
                      {formatDate(order.deliveryDate)}
                    </TableCell>
                    <TableCell className="min-w-0">{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Truck className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>
    </div>
  );
};

export default PurchaseOrders;
