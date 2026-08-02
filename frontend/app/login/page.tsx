"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button disabled={submitting} className="w-full bg-unc-600 hover:bg-unc-500 disabled:opacity-50 rounded-md py-2.5 font-medium text-white">
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="text-sm text-slate-400 mt-4">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-unc-500 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
