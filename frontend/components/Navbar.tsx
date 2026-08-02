"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-unc-500">
          UNC SSL
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ssl-checker" className="hover:text-unc-500">
            SSL Checker
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-unc-500">
                Dashboard
              </Link>
              <button onClick={logout} className="text-slate-400 hover:text-white">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-unc-500">
                Log in
              </Link>
              <Link href="/signup" className="bg-unc-600 hover:bg-unc-500 px-3 py-1.5 rounded-md text-white">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
