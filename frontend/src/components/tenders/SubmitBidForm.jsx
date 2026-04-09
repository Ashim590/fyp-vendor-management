import React, { useMemo, useState } from "react";
import axios from "axios";
import { BID_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { useEffect } from "react";

/**
 * Tender quotation submission (price + proposal + optional attachments).
 * Backend stores this as a Bid linked to tender + vendor.
 */
const SubmitBidForm = ({ tenderId, tender, onSuccess, onCancel }) => {
  const { user } = useSelector((store) => store.auth);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [compliance, setCompliance] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [quotationValidity, setQuotationValidity] = useState("");
  /** Numeric calendar days from contract award — used for automated quotation comparison on procurement side. */
  const [deliveryDaysOffer, setDeliveryDaysOffer] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [esewaId, setEsewaId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [files, setFiles] = useState([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const vendorOrCompanyName = useMemo(() => {
    const vp = user?.vendorProfile;
    if (vp && typeof vp === "object") {
      return String(vp.name || "").trim() || String(user?.name || "").trim();
    }
    return String(user?.name || "").trim();
  }, [user]);

  const VAT_RATE = 0.13;

  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

  const vatAmount = useMemo(() => {
    const n = Number(amount || 0);
    return n > 0 ? round2(n * VAT_RATE) : 0;
  }, [amount]);

  const totalAmount = useMemo(() => {
    const n = Number(amount || 0);
    return n > 0 ? round2(n + vatAmount) : 0;
  }, [amount, vatAmount]);

  const requirementText = useMemo(() => {
    if (Array.isArray(tender?.requirements) && tender.requirements.length) {
      return tender.requirements
        .map((r, i) => {
          const name = String(r?.itemName || "Item").trim();
          const qty = Number(r?.quantity || 0);
          const unit = String(r?.unit || "").trim();
          return `${i + 1}. ${name} x${qty || 0}${unit ? ` ${unit}` : ""}`;
        })
        .join("\n");
    }
    return "As per procurement requirement.";
  }, [tender]);

  const requiredDocs = useMemo(() => {
    if (!Array.isArray(tender?.requiredDocuments)) return [];
    return tender.requiredDocuments
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }, [tender]);

  const selectedDocNames = useMemo(
    () => files.map((f) => String(f?.name || "").toLowerCase()),
    [files],
  );

  const missingRequiredDocs = useMemo(() => {
    if (!requiredDocs.length) return [];
    return requiredDocs.filter((doc) => {
      const d = doc.toLowerCase();
      return !selectedDocNames.some((n) => n.includes(d));
    });
  }, [requiredDocs, selectedDocNames]);

  useEffect(() => {
    let mounted = true;
    const key = `quotationDraft:${tenderId}`;
    const fromLocal = localStorage.getItem(key);
    if (fromLocal) {
      try {
        const d = JSON.parse(fromLocal);
        if (!mounted) return;
        setAmount(String(d.amount || ""));
        setScopeOfWork(String(d.scopeOfWork || ""));
        setDeliveryTimeline(String(d.deliveryTimeline || ""));
        setCompliance(String(d.compliance || ""));
        setDifferentiators(String(d.differentiators || ""));
        setQuotationValidity(String(d.quotationValidity || ""));
        setPaymentTerms(String(d.paymentTerms || ""));
        setEsewaId(String(d.esewaId || ""));
        setMerchantName(String(d.merchantName || ""));
        setDeliveryDaysOffer(
          d.deliveryDaysOffer != null ? String(d.deliveryDaysOffer) : "",
        );
      } catch {
        // ignore local parse failures
      }
    }
    axios
      .get(`${BID_API_END_POINT}/draft/${tenderId}`, { withCredentials: true })
      .then((res) => {
        const b = res?.data?.bid;
        if (!mounted || !b) return;
        if (b.amountExcludingVat != null && Number(b.amountExcludingVat) >= 0) {
          setAmount(String(b.amountExcludingVat));
        } else {
          setAmount(String(b.amount ?? ""));
        }
        const tech = String(b.technicalProposal || "");
        setScopeOfWork(tech);
        setDeliveryTimeline("");
        if (b.deliveryDaysOffer != null && Number(b.deliveryDaysOffer) >= 0) {
          setDeliveryDaysOffer(String(b.deliveryDaysOffer));
        }
        setCompliance("");
        setDifferentiators("");
        setQuotationValidity("");
        setPaymentTerms(String(b.financialProposal || ""));
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setDraftLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [tenderId]);

  useEffect(() => {
    if (!draftLoaded) return;
    const key = `quotationDraft:${tenderId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        amount,
        scopeOfWork,
        deliveryTimeline,
        compliance,
        differentiators,
        quotationValidity,
        paymentTerms,
        esewaId,
        merchantName,
        deliveryDaysOffer,
      }),
    );
  }, [
    draftLoaded,
    tenderId,
    amount,
    scopeOfWork,
    deliveryTimeline,
    compliance,
    differentiators,
    quotationValidity,
    paymentTerms,
    esewaId,
    merchantName,
    deliveryDaysOffer,
  ]);

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const technicalProposal = [
        "SCOPE OF WORK",
        scopeOfWork.trim(),
        "",
        "DELIVERY TIMELINE",
        deliveryTimeline.trim(),
        "",
        "COMPLIANCE",
        compliance.trim(),
        "",
        "DIFFERENTIATORS",
        differentiators.trim(),
      ].join("\n");
      const formData = new FormData();
      formData.append("tenderId", tenderId);
      const base = Number(amount || 0);
      const vat = round2(base * VAT_RATE);
      const grand = round2(base + vat);
      if (base > 0) {
        formData.append("amount", String(grand));
        formData.append("amountExcludingVat", String(base));
        formData.append("vatAmount", String(vat));
        formData.append("vatRate", String(VAT_RATE));
      }
      if (technicalProposal.trim()) formData.append("proposal", technicalProposal);
      if (paymentTerms.trim()) formData.append("financialProposal", paymentTerms.trim());
      if (deliveryDaysOffer.trim() !== "") {
        formData.append("deliveryDaysOffer", deliveryDaysOffer.trim());
      }
      files.forEach((f) => formData.append("documents", f));
      await axios.post(`${BID_API_END_POINT}/draft`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid quoted price.");
      return;
    }
    if (
      !scopeOfWork.trim() ||
      !deliveryTimeline.trim() ||
      !compliance.trim() ||
      !differentiators.trim()
    ) {
      toast.error("Please complete all required proposal sections.");
      return;
    }
    if (missingRequiredDocs.length > 0) {
      toast.error(
        `Missing required documents: ${missingRequiredDocs.join(", ")}`,
      );
      return;
    }
    if (!declarationAccepted) {
      toast.error("Please accept the declaration before submitting.");
      return;
    }
    setLoading(true);
    try {
      const technicalProposal = [
        "SCOPE OF WORK",
        scopeOfWork.trim(),
        "",
        "DELIVERY TIMELINE",
        deliveryTimeline.trim(),
        "",
        "COMPLIANCE",
        compliance.trim(),
        "",
        "DIFFERENTIATORS",
        differentiators.trim(),
      ].join("\n");

      const financialNotes = [
        quotationValidity.trim()
          ? `QUOTATION VALIDITY\nValid until: ${quotationValidity.trim()}`
          : "",
        "PRICE BREAKDOWN",
        `Unit Price (excl. VAT): NPR ${Number(amount || 0).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `VAT (13%): NPR ${vatAmount.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `GRAND TOTAL: NPR ${totalAmount.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        paymentTerms.trim() ? `\nPAYMENT TERMS\n${paymentTerms.trim()}` : "",
        esewaId.trim() || merchantName.trim()
          ? `\nESEWA PAYMENT DETAILS\neSewa ID: ${esewaId.trim() || "—"}\nMerchant Name: ${merchantName.trim() || "—"}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const base = Number(amount || 0);
      const vat = round2(base * VAT_RATE);
      const grand = round2(base + vat);

      const formData = new FormData();
      formData.append("tenderId", tenderId);
      formData.append("amount", String(grand));
      formData.append("amountExcludingVat", String(base));
      formData.append("vatAmount", String(vat));
      formData.append("vatRate", String(VAT_RATE));
      formData.append("proposal", technicalProposal);
      if (financialNotes.trim()) {
        formData.append("financialProposal", financialNotes.trim());
      }
      if (deliveryDaysOffer.trim() !== "") {
        formData.append("deliveryDaysOffer", deliveryDaysOffer.trim());
      }
      files.forEach((f) => formData.append("documents", f));

      await axios.post(BID_API_END_POINT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      toast.success("Quotation submitted.");
      localStorage.removeItem(`quotationDraft:${tenderId}`);
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Online quotation submission
        </p>
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>
            <span className="font-semibold">Reference:</span>{" "}
            {tender?.referenceNumber || "—"}
          </p>
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {String(tender?.status || "").toUpperCase() || "—"}
          </p>
          <p>
            <span className="font-semibold">Procurement title:</span>{" "}
            {tender?.title || "—"}
          </p>
          <p>
            <span className="font-semibold">Category:</span>{" "}
            {tender?.category || "—"}
          </p>
          <p>
            <span className="font-semibold">Budget:</span> NPR{" "}
            {Number(tender?.budget || 0).toLocaleString("en-NP")}
          </p>
          <p>
            <span className="font-semibold">Vendor / Company:</span>{" "}
            {vendorOrCompanyName || "—"}
          </p>
        </div>
        <p className="mt-3 whitespace-pre-wrap rounded-md border bg-white p-3 text-sm text-slate-700">
          <span className="font-semibold">Requirement:</span>
          {"\n"}
          {requirementText}
        </p>
        {requiredDocs.length > 0 && (
          <div className="mt-3 rounded-md border bg-white p-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Required documents checklist
            </p>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
              {requiredDocs.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">Section 1: Quoted Price</h3>
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
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p className="rounded-md border bg-slate-50 px-3 py-2">
            VAT (13%): NPR{" "}
            {vatAmount.toLocaleString("en-NP", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="rounded-md border bg-slate-50 px-3 py-2 md:col-span-2">
            Total payable (incl. VAT): NPR{" "}
            {totalAmount.toLocaleString("en-NP", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Delivery lead time (optional)
          </label>
          <input
            type="number"
            min="0"
            value={deliveryDaysOffer}
            onChange={(e) => setDeliveryDaysOffer(e.target.value)}
            placeholder="Days"
            className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">Section 2: Proposal *</h3>
        <textarea
          value={scopeOfWork}
          onChange={(e) => setScopeOfWork(e.target.value)}
          rows={3}
          required
          placeholder="Scope of work"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={deliveryTimeline}
          onChange={(e) => setDeliveryTimeline(e.target.value)}
          rows={2}
          required
          placeholder="Delivery timeline"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={compliance}
          onChange={(e) => setCompliance(e.target.value)}
          rows={2}
          required
          placeholder="Compliance statement"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={differentiators}
          onChange={(e) => setDifferentiators(e.target.value)}
          rows={3}
          required
          placeholder="Differentiators"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">
          Section 3: Financial / Pricing Notes (Optional)
        </h3>
        <input
          type="text"
          value={quotationValidity}
          onChange={(e) => setQuotationValidity(e.target.value)}
          placeholder="Quotation validity (e.g., April 30, 2026)"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          rows={2}
          placeholder="Payment terms"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={esewaId}
            onChange={(e) => setEsewaId(e.target.value)}
            placeholder="eSewa ID (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="Merchant name (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">
          Section 4: Supporting Documents (Optional)
        </h3>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm"
        />
        {missingRequiredDocs.length > 0 && requiredDocs.length > 0 && (
          <p className="text-xs text-amber-700">
            Missing from upload: {missingRequiredDocs.join(", ")}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">Section 5: Declaration</h3>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={declarationAccepted}
            onChange={(e) => setDeclarationAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm that all information provided is true, accurate, and
            complete and I agree to the terms and conditions of Paropakar
            VendorNet.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" disabled={savingDraft} onClick={saveDraft}>
          {savingDraft ? "Saving draft..." : "Save draft"}
        </Button>
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
