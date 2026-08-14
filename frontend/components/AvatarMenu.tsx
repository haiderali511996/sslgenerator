"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function AvatarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const initials = (user.full_name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-unc-500 text-white text-xs font-semibold flex items-center justify-center"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-sm z-20">
          <div className="px-3 py-2 text-slate-500 border-b border-slate-100 truncate">{user.email}</div>
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-slate-50">
            Dashboard
          </Link>
          <Link href="/dashboard/developer" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-slate-50">
            Developer / API Key
          </Link>
          <button onClick={logout} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-red-600">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
