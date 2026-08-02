"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Certificate, Domain, VerificationChallenge } from "@/lib/api";

type Method = "http" | "dns" | "email";

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const domainId = params.id;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [method, setMethod] = useState<Method>("http");
  const [targetEmail, setTargetEmail] = useState("");
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [code, setCode] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [downloaded, setDownloaded] = useState<{ certificate_pem: string; chain_pem: string | null; private_key_pem: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshDomain();
    api.listCertificates().then((certs) => {
      const latest = certs.filter((c) => c.domain_id === domainId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (latest) setCertificate(latest);
    });
  }, [domainId]);

  function refreshDomain() {
    api.listDomains().then((domains) => {
      const found = domains.find((d) => d.id === domainId) || null;
      setDomain(found);
    });
  }

  async function startVerification() {
    setError(null);
    setBusy(true);
    try {
      const result = await api.startVerification(domainId, method, method === "email" ? targetEmail : undefined);
      setChallenge(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  }

  async function checkVerification() {
    if (!challenge) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.checkVerification(domainId, challenge.id, method === "email" ? code : undefined);
      setChallenge(result);
      if (result.status === "verified") refreshDomain();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification check failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestCertificate() {
    setError(null);
    setBusy(true);
    try {
      const cert = await api.requestCertificate(domainId);
      setCertificate(cert);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request certificate");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeCertificate() {
    if (!certificate) return;
    setError(null);
    setBusy(true);
    try {
      const cert = await api.finalizeCertificate(certificate.id);
      setCertificate(cert);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!certificate) return;
    setBusy(true);
    try {
      const files = await api.downloadCertificate(certificate.id);
      setDownloaded(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download certificate");
    } finally {
      setBusy(false);
    }
  }

  function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!domain) return <p className="text-slate-400">Loading domain...</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{domain.name}</h1>
        <p className={domain.is_verified ? "text-unc-500" : "text-slate-400"}>
          {domain.is_verified ? `Verified via ${domain.verification_method}` : "Ownership not verified yet"}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!domain.is_verified && (
        <section className="border border-slate-800 rounded-lg p-4 space-y-4">
          <h2 className="font-medium">1. Verify domain ownership</h2>
          <div className="flex gap-2">
            {(["http", "dns", "email"] as Method[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  setChallenge(null);
                }}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  method === m ? "border-unc-500 text-unc-500" : "border-slate-700 text-slate-400"
                }`}
              >
                {m === "http" ? "Upload file" : m === "dns" ? "DNS TXT record" : "Email"}
              </button>
            ))}
          </div>

          {method === "email" && !challenge && (
            <input
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder={`admin@${domain.name}`}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
            />
          )}

          {!challenge && (
            <button disabled={busy} onClick={startVerification} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
              Start verification
            </button>
          )}

          {challenge && challenge.status !== "verified" && (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-3 text-sm space-y-2">
              {challenge.method === "http" && (
                <>
                  <p>Upload a file to your web server at:</p>
                  <code className="block break-all bg-black/40 px-2 py-1 rounded">
                    http://{domain.name}/.well-known/unc-ssl-challenge/{challenge.token}
                  </code>
                  <p>With exactly this content:</p>
                  <code className="block break-all bg-black/40 px-2 py-1 rounded">{challenge.expected_value}</code>
                </>
              )}
              {challenge.method === "dns" && (
                <>
                  <p>Add a TXT record:</p>
                  <code className="block break-all bg-black/40 px-2 py-1 rounded">_unc-ssl-challenge.{domain.name}</code>
                  <p>With value:</p>
                  <code className="block break-all bg-black/40 px-2 py-1 rounded">{challenge.expected_value}</code>
                </>
              )}
              {challenge.method === "email" && (
                <>
                  <p>
                    We sent a 6-digit code to <strong>{challenge.target_email}</strong>. Enter it below.
                  </p>
                  <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 w-32" />
                </>
              )}
              <button disabled={busy} onClick={checkVerification} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
                {busy ? "Checking..." : "Check now"}
              </button>
            </div>
          )}
        </section>
      )}

      {domain.is_verified && (
        <section className="border border-slate-800 rounded-lg p-4 space-y-4">
          <h2 className="font-medium">2. Generate SSL certificate</h2>

          {domain.verification_method === "email" && !certificate && (
            <p className="text-amber-400 text-sm">
              Let&apos;s Encrypt can&apos;t validate ownership by email. Re-verify this domain using the HTTP file or DNS TXT method
              above to issue a real certificate.
            </p>
          )}

          {!certificate && domain.verification_method !== "email" && (
            <button disabled={busy} onClick={requestCertificate} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
              Request certificate
            </button>
          )}

          {certificate && certificate.status === "awaiting_challenge" && (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-3 text-sm space-y-2">
              <p>Publish this on your domain so Let&apos;s Encrypt can validate it:</p>
              {certificate.validation_method === "http" ? (
                <>
                  <p>
                    File at: <code className="bg-black/40 px-2 py-1 rounded">http://{domain.name}{certificate.challenge_target}</code>
                  </p>
                  <p>Content:</p>
                </>
              ) : (
                <p>
                  TXT record <code className="bg-black/40 px-2 py-1 rounded">{certificate.challenge_target}</code> with value:
                </p>
              )}
              <code className="block break-all bg-black/40 px-2 py-1 rounded">{certificate.challenge_value}</code>
              <button disabled={busy} onClick={finalizeCertificate} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
                {busy ? "Verifying with Let's Encrypt..." : "I've published it — finalize"}
              </button>
            </div>
          )}

          {certificate && certificate.status === "failed" && (
            <p className="text-red-400 text-sm">{certificate.error_message}</p>
          )}

          {certificate && certificate.status === "issued" && (
            <div className="space-y-3">
              <p className="text-unc-500">
                Certificate issued. Valid until {certificate.not_after ? new Date(certificate.not_after).toLocaleDateString() : "-"}.
              </p>
              {!downloaded ? (
                <button disabled={busy} onClick={download} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-white">
                  Download certificate files
                </button>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => downloadFile("certificate.crt", downloaded.certificate_pem)} className="border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-sm">
                    certificate.crt
                  </button>
                  {downloaded.chain_pem && (
                    <button onClick={() => downloadFile("chain.crt", downloaded.chain_pem!)} className="border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-sm">
                      chain.crt
                    </button>
                  )}
                  <button onClick={() => downloadFile("private.key", downloaded.private_key_pem)} className="border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-sm">
                    private.key
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
