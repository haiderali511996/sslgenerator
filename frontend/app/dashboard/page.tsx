"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, Domain } from "@/lib/api";
import WalletConnect from "@/components/WalletConnect";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  function refresh() {
    api.listDomains().then(setDomains).catch((err) => setError(err.message));
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

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (!user)
    return (
      <p className="text-slate-400">
        Please{" "}
        <Link href="/login" className="text-unc-500 hover:underline">
          log in
        </Link>{" "}
        to manage your domains and certificates.
      </p>
    );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Your domains</h1>
      <p className="text-slate-400 mb-6">
        {user.is_unc_member ? "UNC member — premium cert options unlocked." : "Add a domain, verify ownership, then generate an SSL certificate."}
      </p>

      <div className="mb-8">
        <WalletConnect />
      </div>

      <form onSubmit={handleAddDomain} className="flex gap-2 mb-8">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          required
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
        />
        <button disabled={submitting} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md font-medium text-white">
          Add domain
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {domains.length === 0 && <p className="text-slate-500">No domains yet.</p>}
        {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/dashboard/domains/${domain.id}`}
            className="block border border-slate-800 hover:border-unc-600 rounded-lg px-4 py-3 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{domain.name}</span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  domain.is_verified ? "bg-unc-900 text-unc-500" : "bg-slate-800 text-slate-400"
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
