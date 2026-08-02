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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">SSL Checker</h1>
      <p className="text-slate-400 mb-6">Check the SSL certificate on any host — no account needed.</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="example.com"
          required
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
        />
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value))}
          className="w-24 bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
        />
        <button disabled={busy} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
          {busy ? "Checking..." : "Check"}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
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
                    <p key={w} className="text-amber-400">
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
    <div className="flex justify-between border-b border-slate-800/60 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={highlight === "good" ? "text-unc-500" : highlight === "bad" ? "text-red-400" : ""}>{value || "-"}</span>
    </div>
  );
}
