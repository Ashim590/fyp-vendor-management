import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { landingFeatures } from "./landingContent";

const LandingFeatures = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f6faff]">
      <main className="w-full flex-1 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-teal-700">
              What we offer
            </p>
            <h1 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Built for transparent procurement
            </h1>
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
                <h2 className="mb-2 font-semibold text-slate-900">
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingFeatures;
