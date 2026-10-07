import { FOOTER_DATASET, FOOTER_NOTE } from "../../config/copy";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[100rem] flex-wrap justify-between gap-x-8 gap-y-1 px-6 py-3 text-xs text-ink-muted">
        <p>{FOOTER_DATASET}</p>
        <p>{FOOTER_NOTE}</p>
      </div>
    </footer>
  );
}
