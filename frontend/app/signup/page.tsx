"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, fullName || undefined, wallet || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">UNC wallet address (optional)</label>
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Link your UNC wallet for member perks" className="input w-full" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-unc-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
