"use client";

import { useState } from "react";
import { describeError, StatusKind } from "@/lib/statusMessages";

const STYLES: Record<StatusKind, { bg: string; text: string; icon: string }> = {
  success: { bg: "bg-unc-50 border-unc-200", text: "text-unc-700", icon: "✓" },
  pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "⏳" },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "⚠" },
  error: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "✕" },
};

export function StatusBanner({ kind, summary, detail }: { kind: StatusKind; summary: string; detail?: string }) {
  const [showDetail, setShowDetail] = useState(false);
  const style = STYLES[kind];

  return (
    <div className={`border rounded-md px-3 py-2 text-sm ${style.bg}`}>
      <div className="flex items-start gap-2">
        <span className={`shrink-0 ${style.text}`}>{style.icon}</span>
        <div className="flex-1">
          <p className={style.text}>{summary}</p>
          {detail && (
            <>
              <button onClick={() => setShowDetail((v) => !v)} className="text-xs text-slate-500 hover:text-slate-700 underline mt-1">
                {showDetail ? "Hide details" : "Show technical details"}
              </button>
              {showDetail && <code className="block mt-1 text-xs break-all bg-white/60 border border-black/5 rounded p-2 text-slate-600">{detail}</code>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Convenience wrapper: pass the raw backend/ACME error string directly. */
export function ErrorBanner({ raw }: { raw: string | null | undefined }) {
  const described = describeError(raw);
  return <StatusBanner kind={described.kind} summary={described.summary} detail={described.detail} />;
}
