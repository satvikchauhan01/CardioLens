import { DISCLAIMER_BANNER } from "../../config/copy";

// Shown under the header on every tab; not dismissible (PRODUCT_SPEC §4.1, F10).
export function DisclaimerBanner() {
  return (
    <div role="note" aria-label="Disclaimer" className="border-b border-line bg-brand-soft">
      <p className="mx-auto max-w-[100rem] px-6 py-2 text-sm text-ink">{DISCLAIMER_BANNER}</p>
    </div>
  );
}
