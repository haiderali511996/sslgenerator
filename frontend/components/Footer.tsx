import Link from "next/link";
import { UncBadge } from "./UncLogo";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <UncBadge className="w-8 h-8" />
          <span className="font-extrabold italic text-white text-lg">
            UNC <span className="font-semibold not-italic text-unc-500">SSL</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Ready to secure your site?</span>
          <Link href="/signup" className="bg-unc-500 hover:bg-unc-600 text-white text-sm font-medium px-4 py-2 rounded-md">
            Get Free SSL
          </Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h4 className="text-white font-semibold mb-3">UNC SSL</h4>
          <ul className="space-y-2 text-slate-400">
            <li>
              <Link href="/" className="hover:text-white">
                About
              </Link>
            </li>
            <li>
              <Link href="/ssl-checker" className="hover:text-white">
                SSL Checker
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Developer</h4>
          <ul className="space-y-2 text-slate-400">
            <li>
              <Link href="/dashboard/developer" className="hover:text-white">
                REST API
              </Link>
            </li>
            <li>
              <Link href="/dashboard/developer" className="hover:text-white">
                ACME Automation
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Product</h4>
          <ul className="space-y-2 text-slate-400">
            <li>
              <Link href="/dashboard/certificates" className="hover:text-white">
                SSL Certificates
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-white">
                Wildcard Certificates
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">UNC Ecosystem</h4>
          <ul className="space-y-2 text-slate-400">
            <li>Universal Network Coin</li>
            <li>Mobile Mining</li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-slate-500">
        © {new Date().getFullYear()} UNC — Universal Network Coin. All rights reserved.
      </div>
    </footer>
  );
}
