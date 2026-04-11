import React from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { AUTH_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { LoadingState } from "../ui/loading-state";
import { getApiErrorMessage } from "@/utils/apiError";
import { toast } from "sonner";

const USERS_PAGE_LIMIT = 25;

const AdminUsers = () => {
  const { user, token } = useSelector((store) => store.auth);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [cursor, setCursor] = React.useState(null);
  const [nextCursor, setNextCursor] = React.useState(null);
  const [cursorStack, setCursorStack] = React.useState([]);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState(null);

  const loadUsers = React.useCallback(
    async (options = {}) => {
      const silent = options.silent === true;
      const requestedCursor =
        Object.prototype.hasOwnProperty.call(options, "cursor")
          ? options.cursor
          : cursor;
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await axios.get(`${AUTH_API_END_POINT}/users`, {
          params: {
            limit: USERS_PAGE_LIMIT,
            ...(requestedCursor ? { cursor: requestedCursor } : {}),
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const raw = Array.isArray(res.data) ? res.data : res.data?.users || [];
        setUsers(raw.map((u) => ({ ...u, _id: u._id || u.id })));
        setNextCursor(res.data?.nextCursor || null);
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, cursor],
  );

  React.useEffect(() => {
    loadUsers({ cursor });
  }, [cursor, loadUsers]);

  const changeField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createOfficer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(
        `${AUTH_API_END_POINT}/users`,
        {
          name: form.name,
          email: form.email,
          password: form.password,
        },
        {
          params: { limit: USERS_PAGE_LIMIT },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = res?.data;
      const lp = data?.listPage;
      if (lp?.users && Array.isArray(lp.users)) {
        setUsers(lp.users.map((u) => ({ ...u, _id: u._id || u.id })));
        setNextCursor(lp.nextCursor ?? null);
      } else if (data?.id || data?._id) {
        setUsers((prev) => [
          {
            _id: data._id || data.id,
            id: data.id || data._id,
            name: data.name,
            email: data.email,
            role: data.role || "PROCUREMENT_OFFICER",
            isActive: true,
          },
          ...prev,
        ]);
        loadUsers({ silent: true, cursor: null });
      }
      toast.success("Officer created successfully.");
      setForm({ name: "", email: "", password: "" });
      setCursor(null);
      setCursorStack([]);
    } catch (err) {
      console.error("Failed to create officer", err);
      toast.error(
        getApiErrorMessage(err, "Failed to create procurement officer."),
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id) => {
    const idStr = String(id);
    if (!token || togglingId === idStr) return;

    const prevUsers = users;

    setUsers((list) =>
      list.map((u) =>
        String(u._id || u.id) === idStr ? { ...u, isActive: !u.isActive } : u,
      ),
    );
    setTogglingId(idStr);

    try {
      const res = await axios.patch(
        `${AUTH_API_END_POINT}/users/${id}/toggle-active`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const serverId = res?.data?.id;
      const serverActive = res?.data?.isActive;
      if (typeof serverActive === "boolean" && serverId != null) {
        const sid = String(serverId);
        setUsers((list) =>
          list.map((u) =>
            String(u._id || u.id) === sid
              ? { ...u, isActive: serverActive }
              : u,
          ),
        );
      }
    } catch (err) {
      setUsers(prevUsers);
      console.error("Failed to toggle user", err);
      toast.error(getApiErrorMessage(err, "Failed to update user status."));
    } finally {
      setTogglingId(null);
    }
  };

  const goNext = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor || ""]);
    setCursor(nextCursor);
  };

  const goPrev = () => {
    setCursorStack((prev) => {
      if (!prev.length) return prev;
      const copy = [...prev];
      const prevCursor = copy.pop() || null;
      setCursor(prevCursor);
      return copy;
    });
  };

  if (!user) return null;

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Create Procurement Officer
        </h2>
        <form
          onSubmit={createOfficer}
          className="grid gap-3 md:grid-cols-[minmax(0,1.2fr),minmax(0,1.4fr),minmax(0,1.1fr),auto]"
        >
          <input
            name="name"
            value={form.name}
            onChange={changeField}
            placeholder="Full name"
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            required
          />
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={changeField}
            placeholder="Email"
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            required
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={changeField}
            placeholder="Temporary password"
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            required
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Creating..." : "Add Officer"}
          </Button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          All users
        </h2>
        {loading ? (
          <LoadingState variant="inline" label="Loading users…" />
        ) : users.length === 0 ? (
          <p className="text-xs text-slate-500">
            No users found. Use the form above to create your first officer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 pr-2">Name</th>
                  <th className="text-left py-2 pr-2">Email</th>
                  <th className="text-left py-2 pr-2">Role</th>
                  <th className="text-left py-2 pr-2">Status</th>
                  <th className="text-right py-2 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const role =
                    u.role === "ADMIN"
                      ? "Admin"
                      : u.role === "PROCUREMENT_OFFICER"
                        ? "Procurement Officer"
                        : "Vendor";
                  return (
                    <tr
                      key={u._id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-2 text-slate-900">
                        {u.name || "-"}
                      </td>
                      <td className="py-2 pr-2 text-slate-700">{u.email}</td>
                      <td className="py-2 pr-2 text-slate-600">{role}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="outline" size="sm" className="text-xs" asChild>
                            <Link to={`/admin/users/${u._id}`}>View</Link>
                          </Button>
                          {u.role !== "ADMIN" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              disabled={togglingId === String(u._id || u.id)}
                              onClick={() => toggleActive(u._id)}
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || cursorStack.length === 0}
                onClick={goPrev}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !nextCursor}
                onClick={goNext}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminUsers;
