"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiKeyStatus } from "@/lib/api";

export default function DeveloperPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) api.apiKeyStatus().then(setStatus).catch(() => {});
  }, [user]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createApiKey();
      setNewKey(result.api_key);
      setStatus({ prefix: result.prefix, created_at: result.created_at, has_key: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await api.revokeApiKey();
      setStatus({ prefix: null, created_at: null, has_key: false });
      setNewKey(null);
    } finally {
      setBusy(false);
    }
  }

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Developer</h1>

      <div className="card p-6 mb-6">
        <h2 className="font-medium mb-2">API Key</h2>
        <p className="text-sm text-slate-500 mb-4">
          Required to call the UNC SSL REST API for automated certificate issuance. Send it as{" "}
          <code className="bg-slate-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code> — the same header used for
          interactive login.
        </p>

        {newKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm">
            <p className="font-medium text-amber-800 mb-1">Copy this key now — it won&apos;t be shown again.</p>
            <code className="block break-all bg-white border border-amber-200 rounded px-2 py-1">{newKey}</code>
          </div>
        )}

        {status?.has_key ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-mono">{status.prefix}…</span>
              <span className="text-slate-400 ml-2">
                created {status.created_at ? new Date(status.created_at).toLocaleDateString() : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleGenerate} disabled={busy} className="btn-secondary text-sm">
                Reset Key
              </button>
              <button onClick={handleRevoke} disabled={busy} className="text-sm text-red-600 hover:underline">
                Revoke
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleGenerate} disabled={busy} className="btn-primary">
            {busy ? "Generating..." : "Generate API Key"}
          </button>
        )}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      <div className="card p-6">
        <h2 className="font-medium mb-3">Example: list your domains</h2>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-4 overflow-x-auto">
{`curl -H "Authorization: Bearer ${newKey || status?.prefix ? (newKey || status?.prefix + "…") : "<your-api-key>"}" \\
  ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/domains`}
        </pre>
        <h2 className="font-medium mb-3 mt-6">Example: request a certificate</h2>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-4 overflow-x-auto">
{`curl -X POST \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"domain_id": "<domain-id>", "wildcard": false}' \\
  ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/certificates`}
        </pre>
      </div>
    </div>
  );
}
