import {
  Shield,
  FileText,
  Users,
  BarChart3,
  Bell,
  Lock,
} from "lucide-react";

export const landingHeroStats = [
  {
    label: "Roles Supported",
    value: "3",
    sub: "Admin, Officer, Vendor",
  },
  {
    label: "Full Audit Trail",
    value: "100%",
    sub: "Every decision tracked",
  },
  {
    label: "eSewa Payments",
    value: "Integrated",
    sub: "Secure online payments",
  },
];

export const landingFeatures = [
  {
    title: "Vendor Onboarding",
    body: "Register vendors with company details, contact info, and documents, then verify them through an admin-controlled approval flow.",
    icon: Users,
  },
  {
    title: "Purchase Request to Tender",
    body: "Convert approved purchase requests into tenders, then manage publication, deadlines, and closure from one workspace.",
    icon: FileText,
  },
  {
    title: "Bid Monitoring & Evaluation",
    body: "Track bid submissions, compare vendor offers, and shortlist candidates using transparent criteria and decision notes.",
    icon: BarChart3,
  },
  {
    title: "Approvals & Governance",
    body: "Enforce role-based approvals so procurement actions are reviewed, controlled, and traceable for accountability.",
    icon: Shield,
  },
  {
    title: "Delivery, Receipt & Inspection",
    body: "Track shipping updates, confirm receipt, inspect deliveries, and keep vendor communication logs in a single timeline.",
    icon: Bell,
  },
  {
    title: "Payments & Audit-ready Reports",
    body: "Record payment milestones and generate report-ready records with complete audit trails for review and compliance.",
    icon: Lock,
  },
];

export const landingSteps = [
  {
    num: "01",
    title: "Officer Creates Purchase Request",
    desc: "Procurement officer prepares an internal request with required items, quantities, and budget details.",
  },
  {
    num: "02",
    title: "Admin Reviews and Approves",
    desc: "Administrator reviews the request and approves it for sourcing. Approved requests proceed to tender stage.",
  },
  {
    num: "03",
    title: "System Creates and Publishes Tender",
    desc: "A tender is generated from the approved request, then published so verified vendors can submit bids.",
  },
  {
    num: "04",
    title: "Vendors Submit Bids",
    desc: "Vendors review tender requirements, submit formal bids, and track bid status from their portal.",
  },
  {
    num: "05",
    title: "Evaluation and Award Decision",
    desc: "Procurement reviews bids, records evaluation outcomes, and finalizes the award with traceable decision logs.",
  },
  {
    num: "06",
    title: "Payment, Delivery, and Closure",
    desc: "Payment is processed, delivery is tracked through receipt and inspection, and the procurement cycle is closed with complete records.",
  },
];

export const landingProcessStats = [
  {
    value: "60%",
    label: "Reduction in manual follow-ups",
  },
  {
    value: "2x",
    label: "Faster tender evaluation cycles",
  },
  {
    value: "100%",
    label: "Audit-ready procurement records",
  },
];
