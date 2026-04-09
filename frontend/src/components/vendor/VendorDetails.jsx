import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  getVendorById,
  approveVendor,
  rejectVendor,
} from "@/redux/vendorSlice";
import { VENDOR_REVIEW_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "sonner";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Star,
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
} from "lucide-react";

const VendorDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const canApprove = user?.role === "admin";
  const canReviewVendor =
    (user?.role === "admin" || user?.role === "staff") &&
    user?.role !== "vendor";
  const {
    currentVendor: vendor,
    loading,
    error,
  } = useSelector((store) => store.vendor);
  const [activeTab, setActiveTab] = useState("details");
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [scoreDelivery, setScoreDelivery] = useState("5");
  const [scoreQuality, setScoreQuality] = useState("5");
  const [scoreCommunication, setScoreCommunication] = useState("5");
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (id) {
      dispatch(getVendorById(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await axios.get(
        `${VENDOR_REVIEW_API_END_POINT}/vendor/${id}`,
        { withCredentials: true },
      );
      setReviews(res.data?.reviews || []);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Could not load review history.",
      );
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "reviews" && id) {
      loadReviews();
    }
  }, [activeTab, id, loadReviews]);

  const handleApprove = async () => {
    try {
      await dispatch(approveVendor(id)).unwrap();
      toast.success("Vendor approved successfully");
      dispatch(getVendorById(id));
    } catch (err) {
      toast.error(err || "Failed to approve vendor");
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!id || !canReviewVendor) return;
    const d = Number(scoreDelivery);
    const q = Number(scoreQuality);
    const c = Number(scoreCommunication);
    if (![d, q, c].every((n) => n >= 1 && n <= 5 && Number.isInteger(n))) {
      toast.error("Scores must be whole numbers from 1 to 5.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await axios.post(
        VENDOR_REVIEW_API_END_POINT,
        {
          vendorId: id,
          deliveryScore: d,
          qualityScore: q,
          communicationScore: c,
          comment: reviewComment.trim(),
        },
        { withCredentials: true },
      );
      toast.success("Review saved. Vendor rating updated.");
      setReviewComment("");
      loadReviews();
      dispatch(getVendorById(id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await dispatch(
          rejectVendor({ vendorId: id, rejectionReason: reason }),
        ).unwrap();
        toast.success("Vendor rejected");
        dispatch(getVendorById(id));
      } catch (err) {
        toast.error(err || "Failed to reject vendor");
      }
    }
  };

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

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-gray-300"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-10">Loading vendor details...</div>
        </div>
      </div>
    );
  }

  if (!vendor || String(vendor._id) !== String(id)) {
    return (
      <div>
        <div className="max-w-7xl mx-auto p-6">
          <Link
            to="/vendors"
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Link>
          <div className="text-center py-10 text-slate-600">
            {error
              ? String(error)
              : "This vendor profile could not be loaded."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Link
            to="/vendors"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              {vendor.logo ? (
                <img
                  src={vendor.logo}
                  alt={vendor.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Building className="h-10 w-10 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{vendor.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(vendor.status)}
                  <span className="text-gray-500 capitalize">
                    - {vendor.category?.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {renderStars(vendor.rating || 0)}
                  <span className="text-sm text-gray-500 ml-2">
                    ({vendor.rating?.toFixed(1) || "0.0"})
                  </span>
                </div>
              </div>
            </div>
            {canApprove && vendor.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button onClick={handleReject} variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b flex-wrap">
          {["details", "contact", "banking", "documents", "reviews"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 px-1 capitalize ${
                  activeTab === tab
                    ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {tab === "reviews" ? "Reviews" : tab}
              </button>
            ),
          )}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeTab === "details" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Description</label>
                    <p>{vendor.description || "No description provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Website</label>
                    <p className="flex items-center gap-2">
                      {vendor.website ? (
                        <a
                          href={vendor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.website}
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Location</label>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {vendor.address || "Not provided"}
                    </p>
                    {(vendor.province || vendor.district) && (
                      <p className="mt-1 text-sm text-gray-600">
                        {[vendor.district, vendor.province]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">PAN Number</label>
                    <p>{vendor.panNumber || vendor.taxId || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Registration Number
                    </label>
                    <p>
                      {vendor.registrationNumber ||
                        vendor.businessLicense ||
                        "Not provided"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Total Orders
                    </label>
                    <p className="font-medium">{vendor.totalOrders || 0}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "contact" && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{vendor.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{vendor.phoneNumber}</span>
                </div>
                {vendor.contactPerson && (
                  <>
                    <hr />
                    <h4 className="font-medium">Contact Person</h4>
                    <div className="space-y-2">
                      <p>
                        <span className="text-gray-500">Name:</span>{" "}
                        {vendor.contactPerson.name}
                      </p>
                      <p>
                        <span className="text-gray-500">Email:</span>{" "}
                        {vendor.contactPerson.email}
                      </p>
                      <p>
                        <span className="text-gray-500">Phone:</span>{" "}
                        {vendor.contactPerson.phone}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "banking" && (
            <Card>
              <CardHeader>
                <CardTitle>Banking Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.bankDetails ? (
                  <>
                    <div>
                      <label className="text-sm text-gray-500">eSewa ID</label>
                      <p>{vendor.bankDetails.esewaId || "Not provided"}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Bank Name</label>
                      <p>{vendor.bankDetails.bankName}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Account Number
                      </label>
                      <p>{vendor.bankDetails.accountNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Account Name
                      </label>
                      <p>{vendor.bankDetails.accountName}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">
                        Routing Number
                      </label>
                      <p>{vendor.bankDetails.routingNumber}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">
                    No banking information provided
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "documents" && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {vendor.documents && vendor.documents.length > 0 ? (
                  <ul className="space-y-2">
                    {vendor.documents.map((doc, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span>{doc.name}</span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No documents uploaded</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "reviews" && (
            <div className="md:col-span-2 space-y-6">
              {canReviewVendor && vendor.status === "approved" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add performance review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={submitReview}
                      className="space-y-4 max-w-xl"
                    >
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Delivery
                          </label>
                          <select
                            value={scoreDelivery}
                            onChange={(e) => setScoreDelivery(e.target.value)}
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Quality
                          </label>
                          <select
                            value={scoreQuality}
                            onChange={(e) => setScoreQuality(e.target.value)}
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Communication
                          </label>
                          <select
                            value={scoreCommunication}
                            onChange={(e) =>
                              setScoreCommunication(e.target.value)
                            }
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Comments (optional)
                        </label>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={3}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <Button type="submit" disabled={reviewSubmitting}>
                        {reviewSubmitting ? "Saving…" : "Submit review"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Review history</CardTitle>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-gray-500">No reviews yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {reviews.map((r) => (
                        <li
                          key={r._id}
                          className="border rounded-lg p-3 text-sm bg-gray-50/80"
                        >
                          <div className="flex flex-wrap gap-2 text-gray-700">
                            <span>
                              Delivery {r.deliveryScore}/5 · Quality{" "}
                              {r.qualityScore}/5 · Communication{" "}
                              {r.communicationScore}/5
                            </span>
                            <span className="text-gray-400">·</span>
                            <span>
                              {r.createdBy?.name || "Staff"} ·{" "}
                              {r.createdAt
                                ? new Date(r.createdAt).toLocaleString()
                                : ""}
                            </span>
                          </div>
                          {r.purchaseOrder?.orderNumber && (
                            <p className="text-xs text-gray-500 mt-1">
                              PO {r.purchaseOrder.orderNumber}
                            </p>
                          )}
                          {r.comment ? (
                            <p className="mt-2 text-gray-800">{r.comment}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorDetails;
