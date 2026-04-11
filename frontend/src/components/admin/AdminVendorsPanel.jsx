import React from "react";
import axios from "axios";
import { ADMIN_VENDORS_API_END_POINT } from "@/utils/constant";
import { LoadingState } from "../ui/loading-state";
import { getApiErrorMessage } from "@/utils/apiError";
import { toast } from "sonner";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";

const AdminVendorsPanel = () => {
  const [vendors, setVendors] = React.useState([]);
  const [filter, setFilter] = React.useState("pending");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaderFromStorage();
      const res = await axios.get(ADMIN_VENDORS_API_END_POINT, {
        params: {
          ...(filter ? { status: filter } : {}),
          limit: 50,
        },
        withCredentials: true,
        headers,
      });
      setVendors(res.data?.vendors || (Array.isArray(res.data) ? res.data : []));
    } catch (error) {
      console.error("Failed to load vendors", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const setVerified = async (vendor, isVerified) => {
    try {
      const headers = getAuthHeaderFromStorage();
      await axios.patch(
        `${ADMIN_VENDORS_API_END_POINT}/${vendor._id}/verify`,
        { isVerified },
        { withCredentials: true, headers }
      );
      toast.success(
        isVerified
          ? "Vendor approved. They can sign in and use the platform."
          : "Vendor set back to pending. They cannot sign in until approved again."
      );
      await load();
    } catch (error) {
      console.error("Failed to update vendor status", error);
      toast.error(
        getApiErrorMessage(error, "Could not update vendor status."),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Vendor Approvals</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-2 py-1 text-xs"
        >
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="">All</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden text-xs md:text-sm">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Organization</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <LoadingState variant="table" />
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  No vendors found.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v._id} className="border-t">
                  <td className="px-3 py-2">{v.name}</td>
                  <td className="px-3 py-2">
                    {v.contactPerson?.name || v.contactPerson?.email || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.email}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] ${
                        v.status === "approved" || v.isVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {v.status === "approved" || v.isVerified
                        ? "Verified"
                        : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.isVerified ? (
                      <button
                        onClick={() => setVerified(v, false)}
                        className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                      >
                        Mark Pending
                      </button>
                    ) : (
                      <button
                        onClick={() => setVerified(v, true)}
                        className="text-xs px-2 py-1 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminVendorsPanel;

