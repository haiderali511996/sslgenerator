"use client";

import { FormEvent, useState } from "react";
import { api, SslCheckResult } from "@/lib/api";

export default function SslCheckerPage() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(443);
  const [result, setResult] = useState<SslCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await api.checkSsl(host.trim(), port);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">SSL Checker</h1>
      <p className="text-slate-500 mb-6">Check the SSL certificate on any host — no account needed.</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" required className="input flex-1" />
        <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="input w-24" />
        <button disabled={busy} className="btn-primary">
          {busy ? "Checking..." : "Check"}
        </button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {result && (
        <div className="card p-4 space-y-2 text-sm">
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <>
              <Row label="Valid" value={result.is_valid ? "Yes" : "No"} highlight={result.is_valid ? "good" : "bad"} />
              <Row label="Subject" value={result.subject} />
              <Row label="Issuer" value={result.issuer} />
              <Row label="Valid from" value={result.not_before ? new Date(result.not_before).toLocaleString() : "-"} />
              <Row label="Valid until" value={result.not_after ? new Date(result.not_after).toLocaleString() : "-"} />
              <Row label="Days until expiry" value={String(result.days_until_expiry)} />
              <Row label="TLS version" value={result.protocol_version} />
              <Row label="SAN entries" value={result.san.join(", ") || "-"} />
              {result.warnings.length > 0 && (
                <div className="pt-2">
                  {result.warnings.map((w) => (
                    <p key={w} className="text-amber-600">
                      ⚠ {w}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | null; highlight?: "good" | "bad" }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={highlight === "good" ? "text-unc-600 font-medium" : highlight === "bad" ? "text-red-600 font-medium" : ""}>{value || "-"}</span>
    </div>
  );
}
