import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { TENDER_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { toast } from "sonner";

const CreateTender = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    openDate: new Date().toISOString().slice(0, 10),
    closeDate: "",
    category: "",
    budget: "",
    requirements: "",
    status: "DRAFT",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.closeDate || !form.category) {
      toast.error("Title, description, close date, and category are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        TENDER_API_END_POINT,
        {
          ...form,
          budget: form.budget ? Number(form.budget) : undefined,
        },
        { withCredentials: true }
      );
      toast.success("Tender created.");
      navigate(`/tenders/${res.data.tender._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create tender");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1">
      <div className="max-w-2xl mx-auto p-6">
        <Link to="/tenders" className="text-teal-700 hover:underline text-sm mb-4 inline-block">
          ← Back to Tenders
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Create Tender</h1>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Open date *</label>
              <input
                type="date"
                name="openDate"
                value={form.openDate}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Close date *</label>
              <input
                type="date"
                name="closeDate"
                value={form.closeDate}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g. IT Equipment"
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Budget (optional)</label>
              <input
                type="number"
                name="budget"
                value={form.budget}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Requirements (optional)</label>
            <textarea
              name="requirements"
              value={form.requirements}
              onChange={handleChange}
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800">
              {loading ? "Creating..." : "Create Tender (Draft)"}
            </Button>
            <Link to="/tenders">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTender;
