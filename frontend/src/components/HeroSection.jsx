import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

/** Unused by main router (public home is `LandingHome` at `/`); kept for legacy `Home.jsx`. */
const HeroSection = () => {
  return (
    <div className="my-10 text-center">
      <h1 className="text-4xl font-bold text-slate-900">Paropakar VendorNet</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">
        Vendor registration, tenders, and procurement in one place.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-[#0b1f4d] hover:bg-[#0b1f4d]/90">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/signup">Vendor registration</Link>
        </Button>
      </div>
    </div>
  );
};

export default HeroSection;
