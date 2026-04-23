"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HelpSection {
  title: string;
  items: string[];
}

export interface HelpShortcut {
  key: string;
  action: string;
}

interface PageHelpProps {
  title: string;
  description?: string;
  sections: HelpSection[];
  shortcuts?: HelpShortcut[];
}

export function PageHelp({ title, description, sections, shortcuts }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
      if (e.key === "F1") { e.preventDefault(); setOpen((v) => !v); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Aide (F1)"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-elevated transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Aide</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-2 mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {shortcuts && shortcuts.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Keyboard className="h-3.5 w-3.5" />
                Raccourcis clavier
              </h3>
              <div className="space-y-1.5">
                {shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">{s.action}</span>
                    <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] text-slate-400">
            Appuyez sur <kbd className="rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-mono">F1</kbd> pour ouvrir/fermer · <kbd className="rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-mono">Échap</kbd> pour fermer
          </p>
        </div>
      </div>
    </>
  );
}
