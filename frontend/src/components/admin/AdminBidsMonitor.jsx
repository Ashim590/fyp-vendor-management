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
} from "../layout/WorkspacePageLayout";

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
      <WorkspacePageHeader
        title="Bids monitor"
        description="Track all tender bids (admin and procurement). Open a tender for full bid detail, or remove a bid from this list when required."
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Tender</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
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
                <TableCell>
                  <div className="font-medium text-slate-900">
                    {b.tender?.title || "—"}
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    {b.tender?.referenceNumber}
                  </div>
                </TableCell>
                <TableCell className="text-slate-700">{b.vendor?.name || "—"}</TableCell>
                <TableCell className="tabular-nums font-medium text-slate-900">
                  {typeof b.amount === "number" ? formatCurrency(b.amount) : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={bidStatusVariant[b.status] || "statusNeutral"}
                    className="whitespace-nowrap"
                  >
                    {b.status || "UNKNOWN"}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600">
                  {b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString("en-NP")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    {b.tender?._id && (
                      <Button variant="outline" size="sm" className="h-8 border-slate-200" asChild>
                        <Link to={`/tenders/${b.tender._id}`}>Tender</Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-rose-200 text-rose-800 hover:bg-rose-50"
                      onClick={() => handleDeleteBid(b._id)}
                    >
                      Delete
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
