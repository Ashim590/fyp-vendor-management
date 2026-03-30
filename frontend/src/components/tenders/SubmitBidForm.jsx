import React, { useState } from "react";
import axios from "axios";
import { BID_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { toast } from "sonner";

/**
 * Tender quotation submission (price + proposal + optional attachments).
 * Backend stores this as a Bid linked to tender + vendor.
 */
const SubmitBidForm = ({ tenderId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [proposal, setProposal] = useState("");
  const [financialNotes, setFinancialNotes] = useState("");
  const [files, setFiles] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid quoted price.");
      return;
    }
    if (!proposal.trim()) {
      toast.error("Please describe your proposal.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("tenderId", tenderId);
      formData.append("amount", String(Number(amount)));
      formData.append("proposal", proposal.trim());
      if (financialNotes.trim()) {
        formData.append("financialProposal", financialNotes.trim());
      }
      files.forEach((f) => formData.append("documents", f));

      await axios.post(BID_API_END_POINT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      toast.success("Quotation submitted.");
      onSuccess();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to submit quotation.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Quoted price (NPR) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Proposal <span className="text-red-500">*</span>
        </label>
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          rows={5}
          required
          placeholder="Scope, delivery timeline, compliance with requirements, and any differentiators."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Financial / pricing notes (optional)
        </label>
        <textarea
          value={financialNotes}
          onChange={(e) => setFinancialNotes(e.target.value)}
          rows={2}
          placeholder="Breakdown, taxes, validity, or payment terms."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Supporting documents (optional)
        </label>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm"
        />
        <p className="text-xs text-slate-500 mt-1">
          Up to 10 files, 5 MB each. PDF or images recommended.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="submit"
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {loading ? "Submitting…" : "Submit quotation"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default SubmitBidForm;
