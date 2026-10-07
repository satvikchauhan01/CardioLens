// Boot states of PRODUCT_SPEC §6.1: a skeleton while loading, an error screen with Retry.

import type { ApiError } from "../../api/client";
import {
  BOOT_ERROR_TITLE,
  BOOT_LOADING,
  BOOT_NOT_READY_PREFIX,
  BOOT_START_COMMANDS,
  BOOT_START_HINT,
  RETRY,
} from "../../config/copy";
import { BUTTON_CLASS, Skeleton } from "./Feedback";

export function BootSkeleton() {
  return (
    <div role="status" aria-label={BOOT_LOADING}>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96 md:order-first md:col-span-2 xl:order-none xl:col-span-1" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

interface BootErrorProps {
  error: ApiError;
  onRetry: () => void;
}

export function BootError({ error, onRetry }: BootErrorProps) {
  // The service answered but cannot serve predictions (artifacts missing or incompatible).
  const notReady = error.code === "MODEL_UNAVAILABLE";

  return (
    <section
      role="alert"
      className="mx-auto max-w-2xl rounded-xl border border-line bg-surface p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-ink">
        {notReady ? `${BOOT_NOT_READY_PREFIX} ${error.message}` : BOOT_ERROR_TITLE}
      </h2>
      {!notReady && (
        <>
          <p className="mt-1 text-sm text-ink-muted">{error.message}</p>
          <p className="mt-4 text-sm text-ink">{BOOT_START_HINT}</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-3 text-xs text-ink">
            {BOOT_START_COMMANDS.join("\n")}
          </pre>
        </>
      )}
      <button type="button" onClick={onRetry} className={`mt-4 ${BUTTON_CLASS}`}>
        {RETRY}
      </button>
    </section>
  );
}
