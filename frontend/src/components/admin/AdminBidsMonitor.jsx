import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { BID_API_END_POINT } from "@/utils/constant";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "sonner";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import { cn } from "@/lib/utils";
import { ExternalLink, Trash2 } from "lucide-react";

const bidStatusVariant = {
  SUBMITTED: "statusInfo",
  ACCEPTED: "statusSuccess",
  REJECTED: "statusDanger",
};

const AdminBidsMonitor = () => {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(BID_API_END_POINT, {
        params: { limit: 50 },
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      });
      setBids(res.data?.bids || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load bids monitor");
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteBid = (bidId) => {
    if (
      !confirm(
        "Delete this bid permanently? Tender detail and payments (if any) follow the same rules.",
      )
    ) {
      return;
    }
    axios
      .delete(`${BID_API_END_POINT}/${bidId}`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      })
      .then(() => {
        toast.success("Bid deleted.");
        load();
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to delete bid"),
      );
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Bids monitor" />

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <Table
        className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}
      >
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[20%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left">Tender</TableHead>
            <TableHead className="text-left">Vendor</TableHead>
            <TableHead className="text-left">Total (incl. VAT)</TableHead>
            <TableHead className="text-left">Status</TableHead>
            <TableHead className="text-left">Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                Loading bids…
              </TableCell>
            </TableRow>
          ) : bids.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                No bids found.
              </TableCell>
            </TableRow>
          ) : (
            bids.map((b) => (
              <TableRow key={b._id}>
                <TableCell className="min-w-0">
                  <div className="line-clamp-2 font-medium break-words text-slate-900">
                    {b.tender?.title || "—"}
                  </div>
                  <div className="truncate font-mono text-xs text-slate-500">
                    {b.tender?.referenceNumber}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 text-slate-700">
                  <span className="line-clamp-2 break-words">{b.vendor?.name || "—"}</span>
                </TableCell>
                <TableCell className="min-w-0 tabular-nums text-sm font-medium text-slate-900">
                  {typeof b.amount === "number" ? formatCurrency(b.amount) : "—"}
                </TableCell>
                <TableCell className="min-w-0">
                  <Badge
                    variant={bidStatusVariant[b.status] || "statusNeutral"}
                    className="whitespace-nowrap text-xs"
                  >
                    {b.status || "UNKNOWN"}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-slate-600">
                  {b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString("en-NP")
                    : "—"}
                </TableCell>
                <TableCell className="min-w-0 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {b.tender?._id && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 border-slate-200"
                        asChild
                      >
                        <Link to={`/tenders/${b.tender._id}`} title="Open tender">
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Tender</span>
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 border-rose-200 text-rose-800 hover:bg-rose-50"
                      title="Delete bid"
                      onClick={() => handleDeleteBid(b._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
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

export default AdminBidsMonitor;
