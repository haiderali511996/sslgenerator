"use client";

import { ReactNode } from "react";

export function AccordionStep({
  title,
  complete,
  open,
  onToggle,
  children,
}: {
  title: string;
  complete: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        {complete ? (
          <span className="w-5 h-5 rounded-full bg-unc-500 text-white flex items-center justify-center text-xs shrink-0">✓</span>
        ) : (
          <span className="w-4 h-4 text-slate-400 shrink-0">{open ? "⌄" : "›"}</span>
        )}
        <span className="font-medium text-slate-800">{title}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
