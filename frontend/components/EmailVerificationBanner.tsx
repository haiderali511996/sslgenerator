"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function EmailVerificationBanner() {
  const { user, refreshUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || user.is_email_verified) return null;

  async function handleSend() {
    setError(null);
    setBusy(true);
    try {
      await api.requestEmailVerification();
      setSent(true);
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      await api.confirmEmailVerification(code);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-unc-50 border border-unc-200 rounded-md px-4 py-3 text-sm mb-6">
      {!showForm ? (
        <p>
          Your email address is not verified.{" "}
          <button onClick={handleSend} disabled={busy} className="text-unc-700 underline font-medium">
            {busy ? "Sending..." : "Please verify it"}
          </button>{" "}
          to unlock additional features.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>{sent ? "Code sent — enter it below:" : "Enter your verification code:"}</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="input w-28" />
          <button onClick={handleConfirm} disabled={busy || code.length === 0} className="btn-primary text-sm">
            Confirm
          </button>
          <button onClick={handleSend} disabled={busy} className="text-unc-700 underline text-xs">
            Resend
          </button>
        </div>
      )}
      {error && <p className="text-red-600 mt-1">{error}</p>}
    </div>
  );
}
