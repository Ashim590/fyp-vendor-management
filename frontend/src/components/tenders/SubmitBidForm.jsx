import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { BID_API_END_POINT } from "@/utils/constant";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { useSelector } from "react-redux";
import { ChevronDown } from "lucide-react";
import {
  buildTechnicalProposalBlob,
  mergeSectionsToProposalText,
  parseTechnicalProposalSections,
} from "@/utils/technicalProposal";

const VAT_RATE = 0.13;

function parseFinancialProposalNotes(fin) {
  const s = String(fin || "");
  const out = {
    quotationValidity: "",
    paymentTerms: "",
    esewaId: "",
    merchantName: "",
  };
  const qm = s.match(/Valid until:\s*([^\n]+)/i);
  if (qm) out.quotationValidity = qm[1].trim();
  const payIdx = s.search(/PAYMENT TERMS\s*\n/i);
  if (payIdx >= 0) {
    let chunk = s.slice(payIdx).replace(/^PAYMENT TERMS\s*\n/i, "");
    const esewaIdx = chunk.search(/ESEWA PAYMENT DETAILS/i);
    if (esewaIdx >= 0) chunk = chunk.slice(0, esewaIdx);
    out.paymentTerms = chunk.trim();
  }
  const eid = s.match(/eSewa ID:\s*([^\n]+)/i);
  if (eid) out.esewaId = eid[1].replace(/[—\-]/g, "").trim();
  const mn = s.match(/Merchant Name:\s*([^\n]+)/i);
  if (mn) out.merchantName = mn[1].replace(/[—\-]/g, "").trim();
  return out;
}

/**
 * Tender quotation: price + one proposal field + optional extras.
 */
const SubmitBidForm = ({ tenderId, tender, onSuccess, onCancel, existingBid = null }) => {
  const { user } = useSelector((store) => store.auth);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  /** Single box replaces four separate proposal fields. */
  const [proposalText, setProposalText] = useState("");
  const [quotationValidity, setQuotationValidity] = useState("");
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

  const existingAttachmentNames = useMemo(() => {
    if (!Array.isArray(existingBid?.documents)) return [];
    return existingBid.documents.map((d) =>
      String(d.name || "").toLowerCase(),
    );
  }, [existingBid]);

  const selectedDocNames = useMemo(
    () => [
      ...existingAttachmentNames,
      ...files.map((f) => String(f?.name || "").toLowerCase()),
    ],
    [existingAttachmentNames, files],
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

    const hydrateFromSubmittedBid = (bid) => {
      if (bid.amountExcludingVat != null && Number(bid.amountExcludingVat) >= 0) {
        setAmount(String(bid.amountExcludingVat));
      } else if (bid.amount != null && Number(bid.amount) > 0) {
        const grand = Number(bid.amount);
        const ex = round2(grand / (1 + VAT_RATE));
        setAmount(String(ex));
      }
      const sections = parseTechnicalProposalSections(bid.technicalProposal);
      const hasSections = Object.values(sections).some(Boolean);
      if (hasSections) {
        setProposalText(mergeSectionsToProposalText(sections));
      } else if (String(bid.technicalProposal || "").trim()) {
        setProposalText(String(bid.technicalProposal).trim());
      }
      if (bid.deliveryDaysOffer != null && Number(bid.deliveryDaysOffer) >= 0) {
        setDeliveryDaysOffer(String(bid.deliveryDaysOffer));
      } else {
        setDeliveryDaysOffer("");
      }
      const fin = parseFinancialProposalNotes(bid.financialProposal);
      setQuotationValidity(fin.quotationValidity);
      setPaymentTerms(fin.paymentTerms || String(bid.financialProposal || "").trim());
      setEsewaId(fin.esewaId);
      setMerchantName(fin.merchantName);
      setDeclarationAccepted(true);
      setFiles([]);
    };

    const bidTenderId = existingBid
      ? String(existingBid.tender?._id || existingBid.tender || "")
      : "";
    if (existingBid && bidTenderId === String(tenderId)) {
      hydrateFromSubmittedBid(existingBid);
      setDraftLoaded(true);
      return () => {
        mounted = false;
      };
    }

    const key = `quotationDraft:${tenderId}`;
    const fromLocal = localStorage.getItem(key);
    if (fromLocal) {
      try {
        const d = JSON.parse(fromLocal);
        if (!mounted) return;
        setAmount(String(d.amount || ""));
        setProposalText(String(d.proposalText ?? d.scopeOfWork ?? ""));
        setQuotationValidity(String(d.quotationValidity || ""));
        setPaymentTerms(String(d.paymentTerms || ""));
        setEsewaId(String(d.esewaId || ""));
        setMerchantName(String(d.merchantName || ""));
        setDeliveryDaysOffer(
          d.deliveryDaysOffer != null ? String(d.deliveryDaysOffer) : "",
        );
      } catch {
        // ignore
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
        const sections = parseTechnicalProposalSections(b.technicalProposal);
        const merged = mergeSectionsToProposalText(sections);
        setProposalText(
          merged || String(b.technicalProposal || "").trim(),
        );
        if (b.deliveryDaysOffer != null && Number(b.deliveryDaysOffer) >= 0) {
          setDeliveryDaysOffer(String(b.deliveryDaysOffer));
        }
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
  }, [tenderId, existingBid?._id]);

  useEffect(() => {
    if (!draftLoaded) return;
    const key = `quotationDraft:${tenderId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        amount,
        proposalText,
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
    proposalText,
    quotationValidity,
    paymentTerms,
    esewaId,
    merchantName,
    deliveryDaysOffer,
  ]);

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const technicalProposal = buildTechnicalProposalBlob(proposalText);
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
      toast.error(getApiErrorMessage(err, "Failed to save draft."));
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
    if (!proposalText.trim()) {
      toast.error("Please complete your technical proposal.");
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
      const technicalProposal = buildTechnicalProposalBlob(proposalText);

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
      const isUpdate = Boolean(existingBid?._id);
      toast.success(isUpdate ? "Quotation updated." : "Quotation submitted.");
      localStorage.removeItem(`quotationDraft:${tenderId}`);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to submit quotation."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Tender
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">
          {tender?.title || "—"}{" "}
          <span className="font-normal text-slate-500">
            ({tender?.referenceNumber || "—"})
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>Budget: NPR {Number(tender?.budget || 0).toLocaleString("en-NP")}</span>
          <span>·</span>
          <span>{tender?.category || "—"}</span>
          <span>·</span>
          <span>{vendorOrCompanyName || "—"}</span>
        </div>
        <details className="mt-3 rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-800">
            Requirement details
          </summary>
          <div className="border-t border-slate-100 px-3 py-2">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {requirementText}
            </p>
            {requiredDocs.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {requiredDocs.map((d) => (
                  <li key={d}>Required file: {d}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Price (NPR, excl. VAT)</h3>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
        />
        <p className="text-sm text-slate-600">
          VAT 13%: NPR{" "}
          {vatAmount.toLocaleString("en-NP", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          · Total incl. VAT: NPR{" "}
          {totalAmount.toLocaleString("en-NP", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Delivery lead time (days, optional)
          </label>
          <input
            type="number"
            min="0"
            value={deliveryDaysOffer}
            onChange={(e) => setDeliveryDaysOffer(e.target.value)}
            placeholder="e.g. 14"
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Technical proposal <span className="text-red-500">*</span>
        </h3>
        <p className="text-xs text-slate-500">
          Describe how you will meet the requirement: scope, timeline, standards, and what
          differentiates your offer. One field is enough.
        </p>
        <textarea
          value={proposalText}
          onChange={(e) => setProposalText(e.target.value)}
          rows={8}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800 [&::-webkit-details-marker]:hidden">
          <span>Optional: validity, payment terms, eSewa, attachments</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-2">
          <input
            type="text"
            value={quotationValidity}
            onChange={(e) => setQuotationValidity(e.target.value)}
            placeholder="Quotation valid until (date)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            rows={2}
            placeholder="Payment terms (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={esewaId}
              onChange={(e) => setEsewaId(e.target.value)}
              placeholder="eSewa ID (optional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Merchant name (optional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Attachments</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm"
            />
            {missingRequiredDocs.length > 0 && requiredDocs.length > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Still needed: {missingRequiredDocs.join(", ")}
              </p>
            )}
          </div>
        </div>
      </details>

      <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={declarationAccepted}
          onChange={(e) => setDeclarationAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I confirm this quotation is accurate and I agree to Paropakar VendorNet terms.
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" disabled={savingDraft} onClick={saveDraft}>
          {savingDraft ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {loading
            ? existingBid?._id
              ? "Updating…"
              : "Submitting…"
            : existingBid?._id
              ? "Update quotation"
              : "Submit quotation"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default SubmitBidForm;
