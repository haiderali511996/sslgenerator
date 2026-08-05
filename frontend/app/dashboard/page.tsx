"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, Certificate, Domain } from "@/lib/api";
import { BUCKET_LABELS, bucketFor, CertBucket } from "@/lib/certStatus";
import WalletConnect from "@/components/WalletConnect";

const STAT_ORDER: CertBucket[] = ["expiring_soon", "draft", "issued", "pending_validation", "expired"];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  function refresh() {
    api.listDomains().then(setDomains).catch((err) => setError(err.message));
    api.listCertificates().then(setCertificates).catch(() => {});
  }

  async function handleAddDomain(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createDomain(newDomain.trim().toLowerCase());
      setNewDomain("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add domain");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-slate-500 px-4 py-8">Loading...</p>;
  if (!user)
    return (
      <p className="text-slate-500 px-4 py-8">
        Please{" "}
        <Link href="/login" className="text-unc-600 hover:underline">
          log in
        </Link>{" "}
        to manage your domains and certificates.
      </p>
    );

  const counts = STAT_ORDER.reduce<Record<string, number>>((acc, bucket) => {
    acc[bucket] = certificates.filter((c) => bucketFor(c) === bucket).length;
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-6">
        {user.is_unc_member ? "UNC member — free certificates unlocked." : "Add a domain, verify ownership, then generate an SSL certificate."}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {STAT_ORDER.map((bucket) => (
          <Link key={bucket} href="/dashboard/certificates" className="card p-4 hover:border-unc-400 transition">
            <div className="text-2xl font-semibold text-slate-900">{counts[bucket] ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">{BUCKET_LABELS[bucket]}</div>
          </Link>
        ))}
      </div>

      <div className="mb-8">
        <WalletConnect />
      </div>

      <div className="card p-5 mb-8">
        <h2 className="font-medium mb-3">Add a domain</h2>
        <form onSubmit={handleAddDomain} className="flex gap-2">
          <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" required className="input flex-1" />
          <button disabled={submitting} className="btn-primary">
            Add domain
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      <div className="space-y-3">
        {domains.length === 0 && <p className="text-slate-400">No domains yet.</p>}
        {domains.map((domain) => (
          <Link key={domain.id} href={`/dashboard/domains/${domain.id}`} className="card block px-4 py-3 hover:border-unc-400 transition">
            <div className="flex items-center justify-between">
              <span className="font-medium">{domain.name}</span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  domain.is_verified ? "bg-unc-100 text-unc-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {domain.is_verified ? `Verified (${domain.verification_method})` : "Not verified"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
