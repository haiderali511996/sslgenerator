"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, Certificate, Domain } from "@/lib/api";
import { BUCKET_LABELS, bucketFor, CertBucket } from "@/lib/certStatus";

const TABS: CertBucket[] = ["draft", "pending_validation", "expiring_soon", "issued", "expired", "failed"];

export default function CertificatesPage() {
  const { user, loading } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tab, setTab] = useState<CertBucket>("issued");

  useEffect(() => {
    if (!user) return;
    api.listCertificates().then(setCertificates).catch(() => {});
    api.listDomains().then(setDomains).catch(() => {});
  }, [user]);

  const domainNameById = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [domains]);

  const filtered = certificates.filter((c) => bucketFor(c) === tab);

  if (loading) return <p className="text-slate-500 px-4 py-8">Loading...</p>;
  if (!user)
    return (
      <p className="text-slate-500 px-4 py-8">
        Please{" "}
        <Link href="/login" className="text-unc-600 hover:underline">
          log in
        </Link>
        .
      </p>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <Link href="/dashboard" className="btn-primary">
          New Certificate
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === t ? "border-unc-500 text-unc-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {BUCKET_LABELS[t]}
            {t === tab && filtered.length > 0 ? ` (${filtered.length})` : ""}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No results.{" "}
            <Link href="/dashboard" className="text-unc-600 hover:underline">
              Create Certificate →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Validation</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <tr key={cert.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {domainNameById.get(cert.domain_id) || cert.domain_id}
                    {cert.is_wildcard && <span className="ml-2 text-xs text-unc-600 bg-unc-50 px-1.5 py-0.5 rounded">wildcard</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">90-Day</td>
                  <td className="px-4 py-3 text-slate-500 uppercase text-xs">{cert.validation_method}</td>
                  <td className="px-4 py-3 text-slate-500">{cert.not_after ? new Date(cert.not_after).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/domains/${cert.domain_id}`} className="text-unc-600 hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
