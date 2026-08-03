export function UncBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="UNC">
      <circle cx="100" cy="100" r="98" fill="#F5821F" stroke="#ffffff" strokeWidth="3" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
      <g stroke="#fbb26a" strokeWidth="1.5" fill="none" opacity="0.8">
        <path d="M46 46 L62 46 L74 58 L88 58" />
        <circle cx="46" cy="46" r="2.5" fill="#fbb26a" />
        <circle cx="62" cy="46" r="2.5" fill="#fbb26a" />
        <path d="M154 46 L138 46 L126 58 L112 58" />
        <circle cx="154" cy="46" r="2.5" fill="#fbb26a" />
        <circle cx="138" cy="46" r="2.5" fill="#fbb26a" />
      </g>
      <g transform="translate(80,40)">
        <rect x="0" y="24" width="40" height="32" rx="6" fill="#ffffff" />
        <path d="M8 24 V16 a12 12 0 0 1 24 0 V24" fill="none" stroke="#ffffff" strokeWidth="8" />
        <circle cx="20" cy="38" r="4.5" fill="#F5821F" />
        <rect x="17.5" y="40" width="5" height="8" fill="#F5821F" />
      </g>
      <text x="100" y="128" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="46" fill="#ffffff">
        UNC
      </text>
      <line x1="42" y1="142" x2="158" y2="142" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
      <text x="100" y="158" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="13" fill="#ffffff" letterSpacing="1">
        SSL CERTIFICATE
      </text>
      <text x="100" y="172" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="600" fontSize="9" fill="#fde3c8" letterSpacing="1.5">
        FOR UNC COINS
      </text>
    </svg>
  );
}

export default function UncLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className || ""}`}>
      <UncBadge className="w-8 h-8 shrink-0" />
      <span className="font-extrabold italic text-lg tracking-tight">
        UNC <span className="font-semibold not-italic text-unc-500">SSL</span>
      </span>
    </span>
  );
}
