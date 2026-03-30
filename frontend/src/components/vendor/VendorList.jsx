import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllVendors,
  approveVendor,
  rejectVendor,
} from "@/redux/vendorSlice";
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
import { Search, CheckCircle, XCircle, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const VendorList = () => {
  const dispatch = useDispatch();
  const { vendors, loading, error } = useSelector((store) => store.vendor);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    dispatch(getAllVendors({ limit: 50 }));
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleApprove = async (vendorId) => {
    try {
      await dispatch(approveVendor(vendorId)).unwrap();
      toast.success("Vendor approved successfully");
      dispatch(getAllVendors({ limit: 50 }));
    } catch (err) {
      toast.error(err || "Failed to approve vendor");
    }
  };

  const handleReject = async (vendorId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await dispatch(
          rejectVendor({ vendorId, rejectionReason: reason })
        ).unwrap();
        toast.success("Vendor rejected");
        dispatch(getAllVendors({ limit: 50 }));
      } catch (err) {
        toast.error(err || "Failed to reject vendor");
      }
    }
  };

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: "Pending", className: "bg-yellow-500" },
      approved: { label: "Approved", className: "bg-green-500" },
      suspended: { label: "Suspended", className: "bg-red-500" },
      rejected: { label: "Rejected", className: "bg-gray-500" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <Button>Register New Vendor</Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search vendors..."
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Vendors Table */}
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor._id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>{vendor.email}</TableCell>
                    <TableCell className="capitalize">
                      {vendor.category?.replace("_", " ")}
                    </TableCell>
                    <TableCell>{vendor.phoneNumber}</TableCell>
                    <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                    <TableCell>{vendor.rating?.toFixed(1) || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/vendors/${vendor._id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {vendor.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600"
                              onClick={() => handleApprove(vendor._id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleReject(vendor._id)}
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

export default VendorList;
