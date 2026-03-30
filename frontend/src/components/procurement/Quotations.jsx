import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllQuotations,
  acceptQuotation,
  rejectQuotation,
} from "@/redux/quotationSlice";
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
import { Search, CheckCircle, XCircle, Eye, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const Quotations = () => {
  const dispatch = useDispatch();
  const { quotations, loading, error } = useSelector(
    (store) => store.quotation
  );
  const quotationList = Array.isArray(quotations) ? quotations : [];
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    dispatch(getAllQuotations({ limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleAccept = async (quotationId) => {
    try {
      await dispatch(
        acceptQuotation({ quotationId, comparisonNotes: "" })
      ).unwrap();
      toast.success("Quotation accepted successfully");
      dispatch(getAllQuotations({ limit: 100 }));
    } catch (err) {
      toast.error(err || "Failed to accept quotation");
    }
  };

  const handleReject = async (quotationId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await dispatch(
          rejectQuotation({ quotationId, rejectionReason: reason })
        ).unwrap();
        toast.success("Quotation rejected");
        dispatch(getAllQuotations({ limit: 100 }));
      } catch (err) {
        toast.error(err || "Failed to reject quotation");
      }
    }
  };

  const filteredQuotations = quotationList.filter((quotation) => {
    const matchesSearch =
      quotation.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.quotationNumber
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || quotation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      submitted: { label: "Submitted", className: "bg-blue-500" },
      under_review: { label: "Under Review", className: "bg-yellow-500" },
      accepted: { label: "Accepted", className: "bg-green-500" },
      rejected: { label: "Rejected", className: "bg-red-500" },
    };
    const config = statusConfig[status] || statusConfig.submitted;
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
          <h1 className="text-2xl font-bold">Quotation Management</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by vendor or quotation number..."
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
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Quotations Table */}
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PR Reference</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredQuotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No quotations found
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotations.map((quotation) => (
                  <TableRow key={quotation._id}>
                    <TableCell className="font-medium">
                      {quotation.quotationNumber}
                    </TableCell>
                    <TableCell>{quotation.vendorName}</TableCell>
                    <TableCell>
                      {quotation.purchaseRequest?.requestNumber || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        {quotation.items?.length || 0} items
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(quotation.totalAmount)}
                    </TableCell>
                    <TableCell>{formatDate(quotation.deliveryDate)}</TableCell>
                    <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {quotation.status === "submitted" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600"
                              onClick={() => handleAccept(quotation._id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleReject(quotation._id)}
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
        </div>
      </div>
    </div>
  );
};

export default Quotations;
