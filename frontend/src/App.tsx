import { useCallback, useState } from "react";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { BootError, BootSkeleton } from "./components/common/BootScreen";
import { MethodView } from "./components/evaluation/MethodView";
import { DisclaimerBanner } from "./components/layout/DisclaimerBanner";
import { Footer } from "./components/layout/Footer";
import { Header, panelElementId, tabElementId } from "./components/layout/Header";
import { PatientAnalysisView } from "./components/layout/PatientAnalysisView";
import type { TabId } from "./config/copy";
import { MetaContext } from "./state/MetaContext";
import { useBoot } from "./state/useBoot";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const [resetCount, setResetCount] = useState(0);
  const { state: boot, retry } = useBoot();

  // Reset demo (PRODUCT_SPEC §5): back to the first view with the first sample, as on arrival.
  const resetDemo = useCallback(() => {
    setActiveTab("analysis");
    setResetCount((count) => count + 1);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onResetDemo={boot.status === "ready" ? resetDemo : undefined}
      />
      <DisclaimerBanner />
      <main
        role="tabpanel"
        id={panelElementId(activeTab)}
        aria-labelledby={tabElementId(activeTab)}
        className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-6"
      >
        <AppErrorBoundary>
          {boot.status === "booting" && <BootSkeleton />}
          {boot.status === "boot_error" && <BootError error={boot.error} onRetry={retry} />}
          {boot.status === "ready" && (
            <MetaContext.Provider value={boot.meta}>
              {/* Both views stay mounted, so the loaded patient and the metrics survive a tab switch. */}
              <div hidden={activeTab !== "analysis"}>
                <PatientAnalysisView samples={boot.samples} resetCount={resetCount} />
              </div>
              <div hidden={activeTab !== "method"}>
                <MethodView active={activeTab === "method"} />
              </div>
            </MetaContext.Provider>
          )}
        </AppErrorBoundary>
      </main>
      <Footer modelVersion={boot.status === "ready" ? boot.meta.model_version : undefined} />
    </div>
  );
}
