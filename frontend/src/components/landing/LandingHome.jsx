import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { landingHeroStats } from "./landingContent";
import {
  LandingAboutStorySection,
  LandingFeaturesGridSection,
  LandingHowItWorksSection,
  LandingContactSection,
} from "./LandingScrollSections";

/**
 * Public home — full single-page scroll: hero → stats → about → features →
 * process → contact. Navbar links to `/about`, `/features`, etc. open separate pages.
 */
const LandingHome = () => {
  const { hash, pathname } = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname !== "/" || !hash) return;
    const id = hash.replace("#", "");
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash, pathname]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f6faff]">
      <main className="min-h-0 w-full flex-1">
        <section id="home" className="relative overflow-hidden bg-[#0b1f4d]">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=1920&q=80')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#12306b]/55 via-[#0b1f4d]/72 to-[#0b1f4d]/82" />

          <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 text-center lg:pb-32 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="mx-auto max-w-3xl space-y-6"
            >
              <p className="text-sm font-medium uppercase tracking-wide text-[#5eead4]">
                Paropakar NGO Vendor Procurement Portal
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Transparent Procurement,{" "}
                <span className="text-[#5eead4]">Better Outcomes</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-slate-300">
                Streamline your procurement process with transparency and
                efficiency. Publish tenders, collect bids, verify vendors, and
                maintain a complete audit trail.
              </p>
              <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 bg-[#14b8a6] px-8 text-base text-white hover:bg-[#0f9f90]"
                >
                  <Link to="/signup">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 border-white/30 bg-white/10 px-8 text-base text-white backdrop-blur hover:bg-white/20"
                >
                  <Link to="/login">Login to System</Link>
                </Button>
              </div>
              <p className="pt-2 text-sm text-slate-400">
                New to the platform?{" "}
                <a
                  href="#how-it-works"
                  className="font-medium text-[#5eead4] underline-offset-2 hover:underline"
                >
                  See how it works
                </a>{" "}
                <span className="text-slate-500">— or jump to</span>{" "}
                <a
                  href="#contact"
                  className="font-medium text-[#5eead4] underline-offset-2 hover:underline"
                >
                  contact
                </a>
              </p>
            </motion.div>
          </div>
        </section>

        <section className="relative z-10 -mt-12 mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {landingHeroStats.map((stat) => (
              <motion.div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-lg"
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
                <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <LandingAboutStorySection />
        <LandingFeaturesGridSection />
        <LandingHowItWorksSection />
        <LandingContactSection />
      </main>
    </div>
  );
};

export default LandingHome;
