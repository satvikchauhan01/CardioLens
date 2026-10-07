// Small shared pieces for loading and error states.

import { RETRY } from "../../config/copy";

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-ink-muted">
      <span
        aria-hidden="true"
        className="size-3.5 animate-spin rounded-full border-2 border-line border-t-brand motion-reduce:animate-none"
      />
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}

export const BUTTON_CLASS =
  "cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

interface ErrorNoticeProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export function ErrorNotice({ title, message, onRetry }: ErrorNoticeProps) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-ink-muted">{message}</p>
      <button type="button" onClick={onRetry} className={`mt-2 ${BUTTON_CLASS}`}>
        {RETRY}
      </button>
    </div>
  );
}
