"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ChainConfig, Certificate, Domain, Payment, VerificationChallenge, WalletStatus } from "@/lib/api";
import { sendUncPayment } from "@/lib/wallet";
import { AccordionStep } from "@/components/AccordionStep";

type Method = "http" | "dns" | "email";
type Step = "domains" | "type" | "payment" | "finalize";

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const domainId = params.id;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [method, setMethod] = useState<Method>("http");
  const [targetEmail, setTargetEmail] = useState("");
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [code, setCode] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [downloaded, setDownloaded] = useState<{ certificate_pem: string; chain_pem: string | null; private_key_pem: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [wantWildcard, setWantWildcard] = useState(false);
  const [keySize, setKeySize] = useState(2048);
  const [additionalDomainIds, setAdditionalDomainIds] = useState<string[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [typeConfirmed, setTypeConfirmed] = useState(false);

  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [chainConfig, setChainConfig] = useState<ChainConfig | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

  const [openStep, setOpenStep] = useState<Step>("domains");

  useEffect(() => {
    refreshDomain();
    api.listDomains().then(setAllDomains).catch(() => {});
    api.listCertificates().then((certs) => {
      const latest = certs.filter((c) => c.domain_id === domainId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (latest) {
        setCertificate(latest);
        setWantWildcard(latest.is_wildcard);
        setKeySize(latest.key_size);
        setTypeConfirmed(true);
      }
    });
    api.walletStatus().then(setWalletStatus).catch(() => {});
    api.walletConfig().then(setChainConfig).catch(() => {});
    refreshPayment();
  }, [domainId]);

  const eligibleAdditionalDomains = allDomains.filter(
    (d) => d.id !== domainId && d.is_verified && domain && d.verification_method === domain.verification_method
  );

  const domainVerified = !!domain?.is_verified;
  const paymentSatisfied = chainConfig?.payments_enabled === false || !!(walletStatus?.is_unc_member || payment?.status === "confirmed");

  useEffect(() => {
    if (!domainVerified) setOpenStep("domains");
    else if (!typeConfirmed) setOpenStep("type");
    else if (!paymentSatisfied && !certificate) setOpenStep("payment");
    else setOpenStep("finalize");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainVerified, typeConfirmed, paymentSatisfied, certificate?.status]);

  function refreshPayment() {
    api.listPayments().then((payments) => {
      const relevant = payments
        .filter((p) => p.domain_id === domainId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (relevant) setPayment(relevant);
    });
  }

  async function payWithWallet() {
    if (!walletStatus?.address || !chainConfig) return;
    setError(null);
    setBusy(true);
    try {
      const txHash = await sendUncPayment(walletStatus.address, chainConfig.treasury_address, chainConfig.cert_price, chainConfig.decimals);
      const result = await api.submitUncPayment(domainId, txHash);
      setPayment(result);
      if (result.status === "failed") setError(result.error_message || "Payment could not be verified yet — try again in a moment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

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
      setCheckedOnce(false);
      setLastCheckedAt(null);
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
      setCheckedOnce(true);
      setLastCheckedAt(new Date());
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
      const cert = await api.requestCertificate({
        domain_id: domainId,
        wildcard: wantWildcard,
        additional_domain_ids: additionalDomainIds,
        key_size: keySize,
      });
      setCertificate(cert);
      refreshPayment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request certificate");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCertificate() {
    if (!certificate) return;
    setError(null);
    setBusy(true);
    try {
      const cert = await api.cancelCertificate(certificate.id);
      setCertificate(cert);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel certificate");
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

  function downloadAll() {
    if (!downloaded) return;
    downloadFile("certificate.crt", downloaded.certificate_pem);
    if (downloaded.chain_pem) downloadFile("ca_bundle.crt", downloaded.chain_pem);
    downloadFile("private.key", downloaded.private_key_pem);
  }

  if (!domain) return <p className="text-slate-500 px-4 py-8">Loading domain...</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{domain.name}</h1>
        <p className="text-slate-500 text-sm">SSL Certificate Setup — complete the steps below to issue your certificate.</p>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="card overflow-hidden">
        <AccordionStep title="Domain Validation" complete={domainVerified} open={openStep === "domains"} onToggle={() => setOpenStep("domains")}>
          {domainVerified ? (
            <p className="text-sm text-unc-600">Verified via {domain.verification_method}.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(["http", "dns", "email"] as Method[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m);
                      setChallenge(null);
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      method === m ? "border-unc-500 text-unc-600 bg-unc-50" : "border-slate-300 text-slate-500"
                    }`}
                  >
                    {m === "http" ? "Upload file" : m === "dns" ? "DNS TXT record" : "Email"}
                  </button>
                ))}
              </div>

              {method === "email" && !challenge && (
                <input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder={`admin@${domain.name}`} className="input w-full" />
              )}

              {!challenge && (
                <button disabled={busy} onClick={startVerification} className="btn-primary">
                  Start verification
                </button>
              )}

              {challenge && challenge.status !== "verified" && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-2">
                  {challenge.method === "http" && (
                    <>
                      <p>Upload a file to your web server at:</p>
                      <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">
                        http://{domain.name}/.well-known/unc-ssl-challenge/{challenge.token}
                      </code>
                      <p>With exactly this content:</p>
                      <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">{challenge.expected_value}</code>
                    </>
                  )}
                  {challenge.method === "dns" && (
                    <>
                      <p>Add a TXT record:</p>
                      <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">_unc-ssl-challenge.{domain.name}</code>
                      <p>With value:</p>
                      <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">{challenge.expected_value}</code>
                    </>
                  )}
                  {challenge.method === "email" && (
                    <>
                      <p>
                        We sent a 6-digit code to <strong>{challenge.target_email}</strong>. Enter it below.
                      </p>
                      <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="input w-32" />
                    </>
                  )}
                  <button disabled={busy} onClick={checkVerification} className="btn-primary">
                    {busy ? "Checking..." : "Check now"}
                  </button>
                  {checkedOnce && challenge.status !== "verified" && challenge.method !== "email" && (
                    <p className="text-amber-600">
                      Not found yet{lastCheckedAt ? ` (last checked ${lastCheckedAt.toLocaleTimeString()})` : ""}. DNS and file
                      changes can take a few minutes — sometimes longer depending on your provider — to become visible. Please
                      wait a bit and click <strong>Check now</strong> again.
                    </p>
                  )}
                  {checkedOnce && challenge.status === "failed" && challenge.method === "email" && (
                    <p className="text-red-600">That code didn&apos;t match. Double-check it and try again.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </AccordionStep>

        <AccordionStep title="Certificate Type" complete={typeConfirmed} open={openStep === "type"} onToggle={() => domainVerified && setOpenStep("type")}>
          <div className="space-y-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={wantWildcard}
                disabled={!!certificate}
                onChange={(e) => setWantWildcard(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">I need a wildcard certificate</span> (*.{domain.name})
                <p className="text-slate-500">
                  Secures the domain and every subdomain in one certificate. Requires DNS TXT validation — the ACME protocol
                  forbids validating wildcards over HTTP.
                </p>
              </span>
            </label>
            {wantWildcard && domain.verification_method !== "dns" && (
              <p className="text-amber-600">
                This domain was verified via {domain.verification_method}. Re-verify using the DNS TXT method above before
                requesting a wildcard certificate.
              </p>
            )}

            {eligibleAdditionalDomains.length > 0 && (
              <div>
                <p className="font-medium mb-1">Add other domains to this certificate (SAN)</p>
                <p className="text-slate-500 mb-2">
                  Only domains verified via the same method ({domain.verification_method}) can share one certificate.
                </p>
                <div className="space-y-1">
                  {eligibleAdditionalDomains.map((d) => (
                    <label key={d.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={!!certificate}
                        checked={additionalDomainIds.includes(d.id)}
                        onChange={(e) =>
                          setAdditionalDomainIds((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)))
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-medium mb-1">Encryption Algorithm</p>
              <div className="space-y-1">
                {[2048, 3072, 4096].map((size) => (
                  <label key={size} className="flex items-center gap-2">
                    <input type="radio" name="key_size" disabled={!!certificate} checked={keySize === size} onChange={() => setKeySize(size)} />
                    RSA {size} {size === 2048 && "(Maximum Compatibility)"}
                    {size === 4096 && "(Strongest)"}
                  </label>
                ))}
              </div>
            </div>

            <p className="text-slate-500">
              <strong>Validity:</strong> 90 days. Let&apos;s Encrypt (and the CA/Browser Forum baseline requirements every public
              CA follows) does not issue longer-lived &quot;annual&quot; certificates — renew before expiry, or automate renewal
              with your <Link href="/dashboard/developer" className="text-unc-600 hover:underline">API key</Link>.
            </p>
            {!certificate && (
              <button
                onClick={() => setTypeConfirmed(true)}
                disabled={wantWildcard && domain.verification_method !== "dns"}
                className="btn-primary"
              >
                Next Step →
              </button>
            )}
          </div>
        </AccordionStep>

        <AccordionStep
          title="Payment"
          complete={paymentSatisfied}
          open={openStep === "payment"}
          onToggle={() => typeConfirmed && setOpenStep("payment")}
        >
          <div className="text-sm space-y-3">
            {chainConfig?.payments_enabled === false ? (
              <p className="text-unc-600">90-day SSL certificates are free — no UNC payment required.</p>
            ) : walletStatus?.is_unc_member ? (
              <p className="text-unc-600">UNC member — this certificate is free.</p>
            ) : payment?.status === "confirmed" ? (
              <p className="text-unc-600">Payment confirmed — ready to generate.</p>
            ) : chainConfig ? (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                <p>
                  This domain requires a payment of{" "}
                  <strong>
                    {chainConfig.cert_price} {chainConfig.native_symbol}
                  </strong>{" "}
                  (or a linked wallet holding {chainConfig.min_balance_for_free}+ {chainConfig.native_symbol} for free access).
                </p>
                {!walletStatus?.address ? (
                  <p className="text-amber-600">
                    Link a UNC wallet from the{" "}
                    <Link href="/dashboard" className="underline">
                      dashboard
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <button disabled={busy} onClick={payWithWallet} className="btn-primary">
                    {busy ? "Waiting for payment..." : `Pay ${chainConfig.cert_price} ${chainConfig.native_symbol}`}
                  </button>
                )}
                {payment?.status === "failed" && <p className="text-red-600">{payment.error_message}</p>}
              </div>
            ) : null}
          </div>
        </AccordionStep>

        <AccordionStep
          title="Finalize & Issue"
          complete={certificate?.status === "issued"}
          open={openStep === "finalize"}
          onToggle={() => paymentSatisfied && setOpenStep("finalize")}
        >
          <div className="text-sm space-y-3">
            {(!certificate || certificate.status === "cancelled") && (
              <button disabled={busy || !paymentSatisfied} onClick={requestCertificate} className="btn-primary">
                {busy ? "Starting..." : "Create Certificate"}
              </button>
            )}

            {certificate && certificate.status === "awaiting_challenge" && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-3">
                <p>Publish the following on each domain so Let&apos;s Encrypt can validate it:</p>
                {certificate.challenge_items.map((item, i) => (
                  <div key={i} className="border-t border-slate-200 pt-2 first:border-0 first:pt-0">
                    <p className="font-medium">{item.domain || domain.name}</p>
                    {certificate.validation_method === "http" ? (
                      <>
                        <p>
                          File at:{" "}
                          <code className="bg-white border border-slate-200 px-2 py-1 rounded break-all">
                            http://{item.domain || domain.name}
                            {item.url_path}
                          </code>
                        </p>
                        <p>Content:</p>
                        <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">{item.content}</code>
                      </>
                    ) : (
                      <>
                        <p>
                          TXT record <code className="bg-white border border-slate-200 px-2 py-1 rounded">{item.record_name}</code> with
                          value:
                        </p>
                        <code className="block break-all bg-white border border-slate-200 px-2 py-1 rounded">{item.record_value}</code>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-3">
                  <button disabled={busy} onClick={finalizeCertificate} className="btn-primary">
                    {busy ? "Verifying with Let's Encrypt..." : "I've published it — finalize"}
                  </button>
                  <button disabled={busy} onClick={cancelCertificate} className="btn-secondary text-red-600">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {certificate && certificate.status === "failed" && (
              <div className="space-y-2">
                <p className="text-red-600">{certificate.error_message}</p>
                <button disabled={busy} onClick={cancelCertificate} className="btn-secondary text-sm">
                  Dismiss
                </button>
              </div>
            )}

            {certificate && certificate.status === "cancelled" && <p className="text-slate-500">This certificate request was cancelled.</p>}

            {certificate && certificate.status === "issued" && (
              <div className="space-y-3">
                <p className="text-unc-600">
                  Certificate issued. Valid until {certificate.not_after ? new Date(certificate.not_after).toLocaleDateString() : "-"}.
                </p>
                {!downloaded ? (
                  <button disabled={busy} onClick={download} className="btn-primary">
                    Prepare download
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button onClick={downloadAll} className="btn-primary">
                      Download All (certificate.crt + ca_bundle.crt + private.key)
                    </button>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => downloadFile("certificate.crt", downloaded.certificate_pem)} className="btn-secondary text-sm">
                        certificate.crt
                      </button>
                      {downloaded.chain_pem && (
                        <button onClick={() => downloadFile("ca_bundle.crt", downloaded.chain_pem!)} className="btn-secondary text-sm">
                          ca_bundle.crt
                        </button>
                      )}
                      <button onClick={() => downloadFile("private.key", downloaded.private_key_pem)} className="btn-secondary text-sm">
                        private.key
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionStep>
      </div>
    </div>
  );
}
