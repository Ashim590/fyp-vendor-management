import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  landingFeatures,
  landingSteps,
  landingProcessStats,
} from "./landingContent";

/** About copy — shown on home scroll + standalone /about page */
export const aboutProseParagraphs = [
  "Paropakar VendorNet supports Paropakar NGO and partner organizations that need clear, fair, and traceable procurement—from internal purchase requests through tendering, vendor engagement, delivery, and payment.",
  "The system is designed around three roles: administrators who govern access and approvals, procurement officers who run day-to-day sourcing, and verified vendors who participate in open tenders and manage their profile and deliveries in one place.",
  "Every critical step leaves an audit-friendly record so teams can demonstrate accountability to donors, boards, and regulators without relying on scattered spreadsheets or informal channels.",
];

/**
 * Story block on the full landing scroll (placed before the feature grid).
 */
export function LandingAboutStorySection() {
  return (
    <section
      id="about"
      className="scroll-mt-24 bg-white py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            About
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built for NGO procurement
          </h2>
        </div>
        <div className="mx-auto mt-8 max-w-3xl space-y-4 text-slate-600 leading-relaxed">
          {aboutProseParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Feature cards — id="features" for in-page navigation on `/`.
 */
export function LandingFeaturesGridSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      id="features"
      className="scroll-mt-24 bg-[#f6faff] py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-teal-700">
            What we offer
          </p>
          <h2 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
            Built for transparent procurement
          </h2>
          <p className="mx-auto max-w-2xl text-slate-600">
            Every feature is designed to make NGO procurement more structured,
            auditable, and vendor-friendly.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {landingFeatures.map((item) => (
            <motion.div
              key={item.title}
              className="group rounded-xl border border-slate-200 bg-slate-50 p-6 transition-shadow hover:shadow-md"
              initial={{ opacity: 0, y: 12 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35 }}
              whileHover={{ y: -4 }}
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-700 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingHowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-slate-50 py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-teal-700">
            Simple process
          </p>
          <h2 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto max-w-2xl text-slate-600">
            From purchase request to closure—transparent steps your team and
            vendors can follow.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {landingSteps.map((step) => (
            <div
              key={step.num}
              className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="text-4xl font-bold text-teal-100">{step.num}</span>
              <h3 className="mb-2 mt-2 text-lg font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {landingProcessStats.map((s, i) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm"
            >
              <p
                className={`text-3xl font-bold ${i === 1 ? "text-slate-900" : "text-teal-700"}`}
              >
                {s.value}
              </p>
              <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingContactSection() {
  return (
    <section id="contact" className="scroll-mt-24 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Get in touch
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Talk to the team
        </h2>
        <p className="mt-4 text-slate-600">
          Whether you are preparing a donor demo, piloting with a single NGO, or
          planning a network-wide rollout, we can help you adapt Paropakar
          VendorNet to your procurement policies.
        </p>
        <div className="mt-8 inline-block rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
          <p className="mb-1 font-medium text-slate-900">Email</p>
          <a
            href="mailto:admin@paropakar.org"
            className="text-sm text-teal-700 hover:text-teal-600"
          >
            admin@paropakar.org
          </a>
        </div>
      </div>
    </section>
  );
}
