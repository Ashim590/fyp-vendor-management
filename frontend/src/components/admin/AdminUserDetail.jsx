import React from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AUTH_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { toast } from "sonner";

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useSelector((store) => store.auth);
  const [detailUser, setDetailUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [detailForm, setDetailForm] = React.useState({
    name: "",
    email: "",
    phoneNumber: "",
  });
  const [savingDetail, setSavingDetail] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setDetailUser(null);
    try {
      const res = await axios.get(`${AUTH_API_END_POINT}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = res.data?.user || null;
      setDetailUser(u);
      if (u?.role === "PROCUREMENT_OFFICER") {
        setDetailForm({
          name: u.name || "",
          email: u.email || "",
          phoneNumber: u.phoneNumber || "",
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load user details.");
      navigate("/admin/users", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [token, id, navigate]);

  React.useEffect(() => {
    load();
  }, [load]);

  const detailFieldChange = (e) => {
    const { name, value } = e.target;
    setDetailForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveOfficerDetails = async (e) => {
    e.preventDefault();
    if (!detailUser || detailUser.role !== "PROCUREMENT_OFFICER") return;
    const uid = detailUser._id || detailUser.id;
    if (!uid || !token) return;
    setSavingDetail(true);
    try {
      const res = await axios.patch(
        `${AUTH_API_END_POINT}/users/${uid}`,
        {
          name: detailForm.name.trim(),
          email: detailForm.email.trim(),
          phoneNumber: detailForm.phoneNumber.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const next = res.data?.user || null;
      setDetailUser(next);
      if (next) {
        setDetailForm({
          name: next.name || "",
          email: next.email || "",
          phoneNumber: next.phoneNumber || "",
        });
      }
      toast.success("Officer updated.");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save officer details.",
      );
    } finally {
      setSavingDetail(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/users" className="text-xs">
            ← Back to all users
          </Link>
        </Button>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <h1 className="text-sm font-semibold text-slate-900 mb-3">User details</h1>
        {loading ? (
          <p className="text-xs text-slate-500">Loading details...</p>
        ) : !detailUser ? (
          <p className="text-xs text-slate-500">No user loaded.</p>
        ) : detailUser.role === "VENDOR" ? (
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Vendor-linked account — read-only summary. Manage approval and
              organization data from vendor admin workflows.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Name</p>
                <p className="font-medium text-slate-900">{detailUser.name || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="text-slate-800">{detailUser.email || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p className="text-slate-800">
                  {detailUser.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Role</p>
                <p className="text-slate-800">Vendor</p>
              </div>
            </div>
            {detailUser.vendorProfile &&
              typeof detailUser.vendorProfile === "object" && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Organization
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-slate-500">Company name</p>
                      <p className="font-medium text-slate-900">
                        {detailUser.vendorProfile.name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Vendor email</p>
                      <p className="text-slate-800">
                        {detailUser.vendorProfile.email || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Status</p>
                      <p className="text-slate-800">
                        {detailUser.vendorProfile.status || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Category</p>
                      <p className="text-slate-800">
                        {detailUser.vendorProfile.category || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-slate-500">Address</p>
                      <p className="text-slate-800">
                        {detailUser.vendorProfile.address || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        ) : detailUser.role === "PROCUREMENT_OFFICER" ? (
          <form className="space-y-3 max-w-lg" onSubmit={saveOfficerDetails}>
            <p className="text-xs text-slate-500">
              Edit officer contact details. Use Activate/Deactivate on the users
              list for access control.
            </p>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Full name
              </label>
              <input
                name="name"
                value={detailForm.name}
                onChange={detailFieldChange}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                value={detailForm.email}
                onChange={detailFieldChange}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Phone
              </label>
              <input
                name="phoneNumber"
                value={detailForm.phoneNumber}
                onChange={detailFieldChange}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <Button type="submit" size="sm" disabled={savingDetail}>
              {savingDetail ? "Saving…" : "Save changes"}
            </Button>
          </form>
        ) : (
          <div className="text-xs text-slate-600 space-y-2">
            <p className="text-slate-500">
              Administrator account — displayed as read-only.
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{detailUser.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd>{detailUser.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>{detailUser.isActive ? "Active" : "Inactive"}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminUserDetail;
