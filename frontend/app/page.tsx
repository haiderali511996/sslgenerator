"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [domain, setDomain] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const target = user ? "/dashboard" : "/signup";
    router.push(domain.trim() ? `${target}?domain=${encodeURIComponent(domain.trim())}` : target);
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="bg-slate-900 rounded-xl p-6 md:p-8">
          <h2 className="text-white font-semibold mb-4">Create Free SSL Certificate</h2>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-md px-4 py-3">
              <span className="text-slate-400 text-sm font-medium">🔒 HTTPS</span>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Enter Primary Domain"
                className="flex-1 outline-none text-slate-900 placeholder-slate-400"
              />
            </div>
            <button className="bg-unc-500 hover:bg-unc-600 text-white font-semibold px-6 py-3 rounded-md whitespace-nowrap">
              Next Step →
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-start">
        <div>
          <p className="flex items-center gap-2 text-sm text-slate-500 mb-4">🔒 Trusted Certificate Authority</p>
          <div className="bg-unc-500 rounded-lg p-8 mb-6">
            <h1 className="text-4xl font-extrabold text-white leading-tight">
              SSL Protection
              <br />
              For Anyone
              <br />
              Fast. Reliable. Free.
            </h1>
          </div>
          <p className="text-slate-600">
            Easily secure any domain by putting SSL management on autopilot, powered by the UNC ecosystem —
            supporting one-step domain validation, wildcard certificates, and renewal via REST API.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StepCard number={1} title="Select Cert & Domain" items={["Select domains", "Single-domain cert", "Wildcard certificate"]} />
          <StepCard number={2} title="CSR & Validation" items={["Auto-generate CSR", "One-step validation"]} />
          <StepCard number={3} title="Certificate Issued" items={["Install certificate", "Site secured"]} />
        </div>
      </div>

      <div className="bg-slate-100 py-16">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <Feature title="Full Protection" desc="Secure any domain in under 5 minutes using UNC SSL, the easiest way to issue free SSL certificates." />
          <Feature title="Quick Validation" desc="Get new certificates approved in seconds using one-step DNS, HTTP, or email validation." />
          <Feature title="ACME Integrations" desc="Automate issuance and renewal through the standard ACME protocol against Let's Encrypt." />
          <Feature title="REST API" desc="Automate certificate management end-to-end with an API key — no manual steps required." />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-slate-800 rounded-xl p-8 md:p-10 text-white">
          <h3 className="text-xl font-semibold mb-2">All the SSL tools you'll ever need, in one place</h3>
          <p className="text-slate-300 mb-6">Issue and renew free 90-day SSL certificates in minutes, automated through the UNC ecosystem.</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {["90-Day Certificates", "Wildcard Certificates", "ACME Integrations", "REST API", "One-Step Validation", "SSL Checker", "Pay with UNC coin", "Free for UNC holders"].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-unc-400">✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 py-14 text-center">
        <h3 className="text-white text-2xl font-semibold mb-2">Built for the UNC Ecosystem</h3>
        <p className="text-slate-400 mb-6">Free SSL for UNC holders and miners — pay-per-certificate in UNC for everyone else.</p>
        <Link href="/signup" className="bg-unc-500 hover:bg-unc-600 text-white font-semibold px-6 py-3 rounded-md inline-block">
          Secure Your Website — It's Free
        </Link>
      </div>
    </div>
  );
}

function StepCard({ number, title, items }: { number: number; title: string; items: string[] }) {
  return (
    <div className="card p-4">
      <div className="text-unc-500 font-bold text-lg mb-1">{number}</div>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <ul className="text-xs text-slate-500 space-y-1">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div className="w-9 h-9 rounded-md bg-unc-100 text-unc-600 flex items-center justify-center mb-3">●</div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}
