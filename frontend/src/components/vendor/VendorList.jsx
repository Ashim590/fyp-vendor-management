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
import { Card, CardContent } from "../ui/card";
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
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Building2,
  Mail,
  Phone,
  MapPin,
  LayoutGrid,
  List,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getVendorCategoryLabel } from "@/utils/constant";
import { WORKSPACE_DATA_TABLE_CLASS } from "../layout/WorkspacePageLayout";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

function truncateText(s, max = 140) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function VendorMark({ vendor, size = "card" }) {
  const isCard = size === "card";
  const wrap = isCard
    ? "h-11 w-11 rounded-xl ring-1 ring-teal-100"
    : "h-9 w-9 rounded-lg ring-1 ring-slate-200";
  if (vendor.logo && String(vendor.logo).trim().length > 0) {
    return (
      <img
        src={vendor.logo}
        alt=""
        className={`${wrap} shrink-0 object-cover bg-white`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-teal-50 text-teal-700 ${wrap}`}
    >
      <Building2 className={isCard ? "h-5 w-5" : "h-4 w-4"} />
    </div>
  );
}

const VendorList = () => {
  const dispatch = useDispatch();
  const { vendors, loading, error } = useSelector((store) => store.vendor);
  const { user } = useSelector((store) => store.auth);
  const isStaff = user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;
  const canApprove = user?.role === "admin";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [layout, setLayout] = useState("cards");

  useEffect(() => {
    dispatch(getAllVendors({ limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(getApiErrorMessage(error, "Could not load vendors."));
    }
  }, [error]);

  const handleApprove = async (vendorId) => {
    try {
      await dispatch(approveVendor(vendorId)).unwrap();
      toast.success("Vendor approved successfully");
      dispatch(getAllVendors({ limit: 100 }));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to approve vendor"));
    }
  };

  const handleReject = async (vendorId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await dispatch(
          rejectVendor({ vendorId, rejectionReason: reason }),
        ).unwrap();
        toast.success("Vendor rejected");
        dispatch(getAllVendors({ limit: 100 }));
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to reject vendor"));
      }
    }
  };

  const filteredVendors = vendors.filter((vendor) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      vendor.name?.toLowerCase().includes(q) ||
      vendor.email?.toLowerCase().includes(q) ||
      vendor.description?.toLowerCase().includes(q) ||
      vendor.province?.toLowerCase().includes(q) ||
      vendor.district?.toLowerCase().includes(q);
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

  const locationLine = (v) =>
    [v.district, v.province].filter(Boolean).join(", ") || "—";

  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isStaff ? "Vendor directory" : "Vendor management"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <Button
                type="button"
                variant={layout === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={() => setLayout("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
                Profiles
              </Button>
              <Button
                type="button"
                variant={layout === "table" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={() => setLayout("table")}
              >
                <List className="h-4 w-4" />
                Table
              </Button>
            </div>
            {canApprove ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin?tab=vendors">Pending registrations</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, location, or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-4 py-2 text-sm bg-white"
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
          <LoadingState variant="page" label="Loading vendors…" />
        ) : filteredVendors.length === 0 ? (
          <p className="text-center py-16 text-slate-500">No vendors match your filters.</p>
        ) : layout === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVendors.map((vendor) => (
              <Card
                key={vendor._id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-start gap-3">
                    <VendorMark vendor={vendor} size="card" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/vendors/${vendor._id}`}
                        className="font-semibold text-slate-900 hover:text-teal-800 line-clamp-2"
                      >
                        {vendor.name?.trim() || "Vendor (unnamed)"}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {getStatusBadge(vendor.status)}
                        <span className="text-xs text-slate-500">
                          ★ {vendor.rating?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {getVendorCategoryLabel(vendor.category)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-slate-600">
                    <p className="flex items-center gap-2 min-w-0">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{vendor.email || "—"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {vendor.phoneNumber || "—"}
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                      <span className="line-clamp-2">
                        {vendor.address ? (
                          <>
                            {vendor.address}
                            <span className="text-slate-400"> · </span>
                          </>
                        ) : null}
                        {locationLine(vendor)}
                      </span>
                    </p>
                  </div>

                  {vendor.description ? (
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed border-t border-slate-100 pt-3">
                      {truncateText(vendor.description, 220)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                      No description on file.
                    </p>
                  )}

                  <div className="mt-auto pt-2 flex flex-wrap gap-2">
                    <Button size="sm" asChild className="gap-1">
                      <Link to={`/vendors/${vendor._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Full profile
                      </Link>
                    </Button>
                    {canApprove && vendor.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-200"
                          onClick={() => handleApprove(vendor._id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-700 border-red-200"
                          onClick={() => handleReject(vendor._id)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table
              className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}
            >
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[6%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-left">Vendor</TableHead>
                  <TableHead className="text-left">Email</TableHead>
                  <TableHead className="text-left">Location</TableHead>
                  <TableHead className="text-left">Category</TableHead>
                  <TableHead className="text-left">Phone</TableHead>
                  <TableHead className="text-left">Status</TableHead>
                  <TableHead className="text-left">Rating</TableHead>
                  <TableHead className="text-left">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor._id}>
                    <TableCell className="min-w-0 font-medium">
                      <div className="flex min-w-0 items-center gap-2">
                        <VendorMark vendor={vendor} size="table" />
                        <Link
                          to={`/vendors/${vendor._id}`}
                          className="text-teal-800 hover:underline truncate"
                        >
                          {vendor.name?.trim() || "—"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 truncate text-sm" title={vendor.email}>
                      {vendor.email}
                    </TableCell>
                    <TableCell className="min-w-0 text-sm text-slate-600">
                      <span className="line-clamp-2 break-words">{locationLine(vendor)}</span>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap">
                      {getVendorCategoryLabel(vendor.category)}
                    </TableCell>
                    <TableCell className="min-w-0 truncate">{vendor.phoneNumber}</TableCell>
                    <TableCell className="min-w-0">{getStatusBadge(vendor.status)}</TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap tabular-nums">
                      {vendor.rating?.toFixed(1) || "N/A"}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex flex-wrap gap-1">
                        <Link to={`/vendors/${vendor._id}`}>
                          <Button variant="outline" size="sm" title="Full profile">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canApprove && vendor.status === "pending" && (
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorList;
