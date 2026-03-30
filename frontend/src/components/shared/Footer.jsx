import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react";

const Footer = () => {
  const socialLinks = [
    { name: "LinkedIn", href: "https://www.linkedin.com", icon: Linkedin },
    { name: "Facebook", href: "https://www.facebook.com", icon: Facebook },
    { name: "YouTube", href: "https://www.youtube.com", icon: Youtube },
    { name: "Email", href: "mailto:admin@paropakar.org", icon: Mail },
  ];

  const quickLinks = [
    { name: "Dashboard", to: "/" },
    { name: "Tenders", to: "/tenders" },
    { name: "Bids Monitor", to: "/bids-monitor" },
    { name: "Deliveries", to: "/deliveries" },
  ];

  return (
    <footer className="mt-auto shrink-0 border-t border-[#17366f] bg-[#0b1f4d] text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <section>
            <div className="flex items-center gap-2">
              <img
                src="/Logo.png"
                alt="Paropakar VendorNet logo"
                className="h-8 w-8 object-contain"
              />
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Paropakar <span className="text-[#5eead4]">VendorNet</span>
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Professional vendor and procurement management with secure,
              transparent and auditable workflows.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#5eead4]">
              Quick Links
            </h3>
            <ul className="mt-3 space-y-2">
              {quickLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-slate-200 transition hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#5eead4]">
              Contact
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#5eead4]" />
                <span>Kathmandu, Nepal</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#5eead4]" />
                <span>+977-1-0000000</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#5eead4]" />
                <span>admin@paropakar.org</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#5eead4]">
              Follow Us
            </h3>
            <div className="mt-3 flex items-center gap-3">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.name}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2a4b87] text-slate-200 transition hover:border-[#5eead4] hover:text-[#5eead4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-300">
              Mon - Fri, 9:00 AM to 5:00 PM
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-[#17366f] pt-4 text-xs text-slate-300">
          <p>
            &copy; {new Date().getFullYear()} Paropakar NGO. All rights
            reserved.
          </p>
          <p className="mt-1 text-slate-400">
            Digital procurement &amp; vendor management.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
