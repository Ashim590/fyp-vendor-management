import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { aboutProseParagraphs } from "./LandingScrollSections";

const LandingAbout = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f6faff]">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 md:py-20">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          About
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Built for NGO procurement
        </h1>
        <div className="mt-8 space-y-4 text-slate-600 leading-relaxed">
          {aboutProseParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90">
            <Link to="/features">View capabilities</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/how-it-works">How it works</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default LandingAbout;
