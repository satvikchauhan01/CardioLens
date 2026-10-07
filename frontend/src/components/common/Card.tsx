import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  aside?: ReactNode; // shown at the right of the title, e.g. a status
  children: ReactNode;
  className?: string;
}

export function Card({ title, aside, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 shadow-sm ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex min-h-6 flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
