import { useState } from "react";
import { BootError, BootSkeleton } from "./components/common/BootScreen";
import { Card } from "./components/common/Card";
import { DisclaimerBanner } from "./components/layout/DisclaimerBanner";
import { Footer } from "./components/layout/Footer";
import { Header, panelElementId, tabElementId } from "./components/layout/Header";
import { PatientAnalysisView } from "./components/layout/PatientAnalysisView";
import { TABS, VIEW_NOT_BUILT, type TabId } from "./config/copy";
import { MetaContext } from "./state/MetaContext";
import { useBoot } from "./state/useBoot";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const { state: boot, retry } = useBoot();
  const methodLabel = TABS.find((tab) => tab.id === "method")?.label;

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
        {boot.status === "booting" && <BootSkeleton />}
        {boot.status === "boot_error" && <BootError error={boot.error} onRetry={retry} />}
        {boot.status === "ready" && (
          <MetaContext.Provider value={boot.meta}>
            {/* Both views stay mounted, so the loaded patient survives a tab switch. */}
            <div hidden={activeTab !== "analysis"}>
              <PatientAnalysisView samples={boot.samples} />
            </div>
            <div hidden={activeTab !== "method"}>
              <Card title={methodLabel}>
                <p className="text-sm text-ink-muted">{VIEW_NOT_BUILT}</p>
              </Card>
            </div>
          </MetaContext.Provider>
        )}
      </main>
      <Footer modelVersion={boot.status === "ready" ? boot.meta.model_version : undefined} />
    </div>
  );
}
