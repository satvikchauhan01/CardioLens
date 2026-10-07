import { useState } from "react";
import { DisclaimerBanner } from "./components/layout/DisclaimerBanner";
import { Footer } from "./components/layout/Footer";
import { Header, panelElementId, tabElementId } from "./components/layout/Header";
import { TABS, VIEW_NOT_BUILT, type TabId } from "./config/copy";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const activeLabel = TABS.find((tab) => tab.id === activeTab)?.label;

  return (
    <div className="flex min-h-screen flex-col">
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />
      <DisclaimerBanner />
      <main
        role="tabpanel"
        id={panelElementId(activeTab)}
        aria-labelledby={tabElementId(activeTab)}
        className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-6"
      >
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">{activeLabel}</h2>
          <p className="mt-1 text-sm text-ink-muted">{VIEW_NOT_BUILT}</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
