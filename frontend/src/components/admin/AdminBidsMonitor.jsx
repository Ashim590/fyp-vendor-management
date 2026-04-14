import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
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
import { LoadingState } from "../ui/loading-state";
import { getApiErrorMessage } from "@/utils/apiError";
import { ExternalLink, Trash2 } from "lucide-react";

const bidStatusVariant = {
  SUBMITTED: "statusInfo",
  ACCEPTED: "statusSuccess",
  REJECTED: "statusDanger",
};

const BIDS_MONITOR_SEEN_KEY = "vn_bids_monitor_seen_bid_ids";

function loadSeenBidIds(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(
      Array.isArray(arr) ? arr.map((id) => String(id)) : [],
    );
  } catch {
    return new Set();
  }
}

function persistSeenBidIds(storageKey, set) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
  } catch {
    /* ignore quota / private mode */
  }
}

const HIGHLIGHT_FADE_MS = 520;

const AdminBidsMonitor = () => {
  const navigate = useNavigate();
  const fadeTimerRef = useRef(null);
  const { user } = useSelector((s) => s.auth);
  const seenStorageKey = useMemo(() => {
    const uid = user?._id || user?.id;
    return `${BIDS_MONITOR_SEEN_KEY}:${uid ? String(uid) : "session"}`;
  }, [user?._id, user?.id]);
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seenBidIds, setSeenBidIds] = useState(() => new Set());
  const [fadingOutBidId, setFadingOutBidId] = useState(null);
  const [selectedBidIds, setSelectedBidIds] = useState(() => new Set());

  useEffect(() => {
    setSeenBidIds(loadSeenBidIds(seenStorageKey));
  }, [seenStorageKey]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const markBidOpened = useCallback(
    (bidId) => {
      const id = String(bidId);
      setSeenBidIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persistSeenBidIds(seenStorageKey, next);
        return next;
      });
    },
    [seenStorageKey],
  );

  const openTenderWithOptionalFade = useCallback(
    (e, bidId, tenderPath) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const id = String(bidId);
      const isUnreadNew =
        bids.some(
          (x) =>
            String(x._id) === id &&
            x.status === "SUBMITTED" &&
            !seenBidIds.has(id),
        );

      if (!isUnreadNew) {
        return;
      }

      e.preventDefault();
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      setFadingOutBidId(id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fadeTimerRef.current = window.setTimeout(() => {
            fadeTimerRef.current = null;
            markBidOpened(bidId);
            setFadingOutBidId(null);
            navigate(tenderPath);
          }, HIGHLIGHT_FADE_MS);
        });
      });
    },
    [bids, seenBidIds, markBidOpened, navigate],
  );

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
      setError(getApiErrorMessage(err, "Failed to load bids monitor"));
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const available = new Set((bids || []).map((b) => String(b._id)));
    setSelectedBidIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (available.has(id)) next.add(id);
      });
      return next;
    });
  }, [bids]);

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
        toast.error(getApiErrorMessage(err, "Failed to delete bid")),
      );
  };

  const toggleSelectBid = (bidId, checked) => {
    const id = String(bidId);
    setSelectedBidIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = bids.length > 0 && selectedBidIds.size === bids.length;

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedBidIds(new Set());
      return;
    }
    setSelectedBidIds(new Set((bids || []).map((b) => String(b._id))));
  };

  const handleDeleteSelectedBids = async () => {
    if (selectedBidIds.size === 0) return;
    if (
      !confirm(
        `Delete ${selectedBidIds.size} selected bid(s) permanently? This action cannot be undone.`,
      )
    ) {
      return;
    }
    const ids = [...selectedBidIds];
    const results = await Promise.allSettled(
      ids.map((id) =>
        axios.delete(`${BID_API_END_POINT}/${id}`, {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        }),
      ),
    );
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.length - successCount;
    if (successCount > 0) {
      toast.success(`${successCount} bid(s) deleted.`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} bid(s) could not be deleted.`);
    }
    await load();
    setSelectedBidIds(new Set());
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Bids monitor" />

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {selectedBidIds.size > 0
            ? `${selectedBidIds.size} selected`
            : "Select bids to delete in bulk"}
        </p>
        <Button
          variant="outline"
          className="border-rose-200 text-rose-800 hover:bg-rose-50"
          disabled={selectedBidIds.size === 0}
          onClick={handleDeleteSelectedBids}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete selected
        </Button>
      </div>

      <Table
        className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}
      >
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Select all bids"
              />
            </TableHead>
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
              <TableCell colSpan={7} className="p-0">
                <LoadingState variant="table" label="Loading bids…" />
              </TableCell>
            </TableRow>
          ) : bids.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                No bids found.
              </TableCell>
            </TableRow>
          ) : (
            bids.map((b) => {
              const bidKey = String(b._id);
              const isNewUnreadQuotation =
                b.status === "SUBMITTED" && !seenBidIds.has(bidKey);
              const isFadingThisRow = fadingOutBidId === bidKey;
              const showNewHighlight =
                isNewUnreadQuotation && !isFadingThisRow;
              return (
              <TableRow
                key={b._id}
                className={cn(
                  "transition-[background-color,box-shadow] duration-500 ease-in-out",
                  showNewHighlight &&
                    "bg-sky-50/95 ring-1 ring-inset ring-sky-200/90",
                )}
              >
                <TableCell className="min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedBidIds.has(bidKey)}
                    onChange={(e) => toggleSelectBid(b._id, e.target.checked)}
                    aria-label={`Select bid ${b.deliveryNumber || b._id}`}
                  />
                </TableCell>
                <TableCell className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {b.tender?._id ? (
                      <Link
                        to={`/tenders/${b.tender._id}`}
                        onClick={(e) =>
                          openTenderWithOptionalFade(
                            e,
                            b._id,
                            `/tenders/${b.tender._id}`,
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg text-left outline-none hover:text-sky-900 focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        <div className="line-clamp-2 font-medium break-words text-slate-900">
                          {b.tender?.title || "—"}
                        </div>
                        <div className="truncate font-mono text-xs text-slate-500">
                          {b.tender?.referenceNumber}
                        </div>
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 font-medium break-words text-slate-900">
                          {b.tender?.title || "—"}
                        </div>
                        <div className="truncate font-mono text-xs text-slate-500">
                          {b.tender?.referenceNumber}
                        </div>
                      </div>
                    )}
                    {isNewUnreadQuotation ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white transition-opacity duration-500 ease-out",
                          isFadingThisRow && "pointer-events-none opacity-0",
                        )}
                      >
                        New
                      </span>
                    ) : null}
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
                        <Link
                          to={`/tenders/${b.tender._id}`}
                          title="Open tender"
                          onClick={(e) =>
                            openTenderWithOptionalFade(
                              e,
                              b._id,
                              `/tenders/${b.tender._id}`,
                            )
                          }
                        >
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
              );
            })
          )}
        </TableBody>
      </Table>
    </WorkspacePageLayout>
  );
};

export default AdminBidsMonitor;
