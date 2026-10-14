import type { KeyboardEvent } from "react";
import {
  APP_NAME,
  RESET_DEMO,
  TABS,
  TAGLINE,
  THEME_TO_DARK,
  THEME_TO_LIGHT,
  TOUR_START,
  type TabId,
} from "../../config/copy";
import type { Theme } from "../../state/useTheme";
import { BUTTON_CLASS } from "../common/Feedback";
import { Icon } from "../common/Icon";

export const tabElementId = (tab: TabId) => `tab-${tab}`;
export const panelElementId = (tab: TabId) => `panel-${tab}`;

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  theme: Theme;
  onToggleTheme: () => void;
  // Shown once the app has booted.
  onResetDemo?: () => void;
  onStartTour?: () => void;
}

export function Header({ activeTab, onSelectTab, theme, onToggleTheme, onResetDemo, onStartTour }: HeaderProps) {
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
      {/* A thin line in the two accent colours; decoration only. */}
      <div aria-hidden="true" className="h-1 bg-linear-to-r from-brand via-accent to-brand" />
      {/* Two rows: who we are and the actions that are always there, then the pages. */}
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 pt-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-brand text-surface shadow-sm">
            <Icon name="heart" className="size-5" />
          </span>
          <div>
            <h1 className="text-lg leading-tight font-semibold tracking-tight text-ink">{APP_NAME}</h1>
            <p className="text-sm leading-tight text-ink-muted">{TAGLINE}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onStartTour && (
            <button type="button" onClick={onStartTour} className={`${BUTTON_CLASS} inline-flex items-center gap-1.5`}>
              <Icon name="tour" />
              {TOUR_START}
            </button>
          )}
          {onResetDemo && (
            <button type="button" onClick={onResetDemo} className={`${BUTTON_CLASS} inline-flex items-center gap-1.5`}>
              <Icon name="reset" />
              {RESET_DEMO}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? THEME_TO_LIGHT : THEME_TO_DARK}
            title={theme === "dark" ? THEME_TO_LIGHT : THEME_TO_DARK}
            className={`${BUTTON_CLASS} px-2`}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="size-5" />
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-[100rem] px-6">
        <div role="tablist" aria-label="Views" className="-mx-3 mt-1 flex flex-wrap gap-1">
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
                className={`-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${
                  selected
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:border-line hover:text-ink"
                }`}
              >
                <Icon name={tab.id} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
