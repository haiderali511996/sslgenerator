import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h1 className="text-4xl font-bold mb-4">
        Free SSL certificates for the <span className="text-unc-500">UNC</span> ecosystem
      </h1>
      <p className="text-slate-400 mb-8">
        Generate, verify, and manage Let&apos;s Encrypt SSL certificates for your domains — built for UNC miners,
        holders, and everyone else.
      </p>
      <div className="flex justify-center gap-3">
        <Link href="/signup" className="bg-unc-600 hover:bg-unc-500 px-5 py-2.5 rounded-md font-medium text-white">
          Get started
        </Link>
        <Link href="/ssl-checker" className="border border-slate-700 hover:border-slate-500 px-5 py-2.5 rounded-md font-medium">
          Check an SSL certificate
        </Link>
      </div>
    </div>
  );
}
