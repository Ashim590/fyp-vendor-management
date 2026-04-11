import React from "react";

const LandingContact = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f6faff]">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 md:py-20">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Get in touch
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Talk to the team
          </h1>
          <p className="mt-4 text-slate-600">
            Whether you are preparing a donor demo, piloting with a single NGO,
            or planning a network-wide rollout, we can help you adapt Paropakar
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
      </main>
    </div>
  );
};

export default LandingContact;
