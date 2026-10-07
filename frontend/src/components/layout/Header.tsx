import type { KeyboardEvent } from "react";
import { APP_NAME, RESET_DEMO, TABS, TAGLINE, type TabId } from "../../config/copy";
import { BUTTON_CLASS } from "../common/Feedback";

export const tabElementId = (tab: TabId) => `tab-${tab}`;
export const panelElementId = (tab: TabId) => `panel-${tab}`;

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onResetDemo?: () => void; // shown once the app has booted
}

export function Header({ activeTab, onSelectTab, onResetDemo }: HeaderProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    onSelectTab(next.id);
    document.getElementById(tabElementId(next.id))?.focus();
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-end justify-between gap-x-8 px-6 pt-4">
        <div className="pb-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>
          <p className="text-sm text-ink-muted">{TAGLINE}</p>
        </div>
        <div className="flex flex-wrap items-end gap-x-6">
          <div role="tablist" aria-label="Views" className="flex gap-1">
            {TABS.map((tab, index) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={tabElementId(tab.id)}
                  aria-selected={selected}
                  aria-controls={selected ? panelElementId(tab.id) : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSelectTab(tab.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`-mb-px cursor-pointer border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                    selected
                      ? "border-brand text-brand"
                      : "border-transparent text-ink-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {onResetDemo && (
            <button type="button" onClick={onResetDemo} className={`mb-2 ${BUTTON_CLASS}`}>
              {RESET_DEMO}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
