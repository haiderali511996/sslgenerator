"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import UncLogo from "./UncLogo";
import AvatarMenu from "./AvatarMenu";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <UncLogo />
        </Link>
        <nav className="flex items-center gap-5 text-sm text-slate-600">
          <Link href="/ssl-checker" className="hover:text-unc-600">
            SSL Checker
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-unc-600">
                Dashboard
              </Link>
              <Link href="/dashboard/certificates" className="hover:text-unc-600">
                Certificates
              </Link>
              <Link href="/dashboard/developer" className="hover:text-unc-600">
                Developer
              </Link>
              <AvatarMenu />
            </>
          ) : (
            <>
              <Link href="/login" className="border border-slate-300 hover:border-slate-400 rounded-md px-3 py-1.5 text-slate-700">
                Log In
              </Link>
              <Link href="/signup" className="bg-unc-500 hover:bg-unc-600 px-4 py-1.5 rounded-md text-white font-medium">
                Get Free SSL
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
