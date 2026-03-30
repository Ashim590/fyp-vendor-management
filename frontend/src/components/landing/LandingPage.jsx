import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { motion } from "framer-motion";
import {
  Shield,
  FileText,
  Users,
  BarChart3,
  Bell,
  Lock,
  ArrowRight,
} from "lucide-react";

const LandingPage = () => {
  const { hash } = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (hash) {
      const id = hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash]);

  const features = [
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

  const steps = [
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

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 bg-[#f6faff]">
      <main className="flex-1 w-full min-h-0">
        {/* Hero */}
        <section id="home" className="relative overflow-hidden bg-[#0b1f4d]">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=1920&q=80')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#12306b]/55 via-[#0b1f4d]/72 to-[#0b1f4d]/82" />

          <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 lg:pt-28 lg:pb-32 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <p className="text-sm font-medium text-[#5eead4] tracking-wide uppercase">
                Paropakar NGO Vendor Procurement Portal
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Transparent Procurement,{" "}
                <span className="text-[#5eead4]">Better Outcomes</span>
              </h1>
              <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                Streamline your procurement process with transparency and
                efficiency. Publish tenders, collect bids, verify vendors, and
                maintain a complete audit trail.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-[#14b8a6] hover:bg-[#0f9f90] text-white px-8 h-12 text-base"
                >
                  <Link to="/signup">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 px-8 h-12 text-base backdrop-blur"
                >
                  <Link to="/login">Login to System</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Quick stat cards overlapping hero */}
        <section className="relative -mt-12 z-10 max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
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
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className="bg-white rounded-xl shadow-lg border border-slate-200 p-5 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <p className="text-2xl font-bold text-slate-900">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-teal-700">
                  {stat.label}
                </p>
                <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* About / Features */}
        <section id="about" className="py-16 md:py-20 bg-white scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <p className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-2">
                What We Offer
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Built for Transparent Procurement
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Every feature is designed to make NGO procurement more
                structured, auditable, and vendor-friendly.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((item) => (
                <motion.div
                  key={item.title}
                  className="bg-slate-50 rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-700 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20" />

        {/* How It Works */}
        <section
          id="how-it-works"
          className="py-16 md:py-20 bg-slate-50 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <p className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-2">
                Simple Process
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                How It Works
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Three simple steps to bring transparency and control to your
                procurement.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="relative bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
                >
                  <span className="text-4xl font-bold text-teal-100">
                    {step.num}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900 mt-2 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-teal-700">60%</p>
                <p className="text-sm text-slate-600 mt-1">
                  Reduction in manual follow-ups
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-slate-900">2x</p>
                <p className="text-sm text-slate-600 mt-1">
                  Faster tender evaluation cycles
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-teal-700">100%</p>
                <p className="text-sm text-slate-600 mt-1">
                  Audit-ready procurement records
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact & CTA */}
        <section id="contact" className="py-16 md:py-20 bg-white scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 space-y-10">
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-sm font-medium text-teal-700 uppercase tracking-wide mb-2">
                Get In Touch
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Talk to the Team
              </h2>
              <p className="text-slate-600 mb-6">
                Whether you are preparing a donor demo, piloting with a single
                NGO, or planning a network-wide rollout, we can help you adapt
                Paropakar VendorNet to your procurement policies.
              </p>
              <div className="inline-block rounded-xl bg-slate-50 border border-slate-200 px-6 py-4">
                <p className="font-medium text-slate-900 mb-1">Email</p>
                <a
                  href="mailto:admin@paropakar.org"
                  className="text-teal-700 hover:text-teal-600 text-sm"
                >
                  admin@paropakar.org
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
