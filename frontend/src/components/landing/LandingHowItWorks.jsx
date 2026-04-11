import React from "react";
import { landingSteps, landingProcessStats } from "./landingContent";

const LandingHowItWorks = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f6faff]">
      <main className="w-full flex-1 bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-teal-700">
              Simple process
            </p>
            <h1 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              How it works
            </h1>
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
                <span className="text-4xl font-bold text-teal-100">
                  {step.num}
                </span>
                <h2 className="mb-2 mt-2 text-lg font-semibold text-slate-900">
                  {step.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {step.desc}
                </p>
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
      </main>
    </div>
  );
};

export default LandingHowItWorks;
