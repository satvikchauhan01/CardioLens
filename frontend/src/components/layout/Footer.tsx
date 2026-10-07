import { FOOTER_DATASET, FOOTER_NOTE, MODEL_VERSION_LABEL } from "../../config/copy";

export function Footer({ modelVersion }: { modelVersion?: string }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[100rem] flex-wrap justify-between gap-x-8 gap-y-1 px-6 py-3 text-xs text-ink-muted">
        <p>{FOOTER_DATASET}</p>
        <p>
          {modelVersion && `${MODEL_VERSION_LABEL} ${modelVersion} · `}
          {FOOTER_NOTE}
        </p>
      </div>
    </footer>
  );
}
