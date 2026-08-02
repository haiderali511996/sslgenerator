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
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">UNC wallet address (optional)</label>
          <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Link your UNC wallet for member perks" className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button disabled={submitting} className="w-full bg-unc-600 hover:bg-unc-500 disabled:opacity-50 rounded-md py-2.5 font-medium text-white">
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-slate-400 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-unc-500 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
