import { useCallback, useEffect, useState } from "react";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { BootError, BootSkeleton } from "./components/common/BootScreen";
import { DisclaimerBanner } from "./components/layout/DisclaimerBanner";
import { Footer } from "./components/layout/Footer";
import { Header, panelElementId, tabElementId } from "./components/layout/Header";
import { Workspace } from "./components/layout/Workspace";
import { Tour } from "./components/tour/Tour";
import { DEFAULT_TAB, TABS, type TabId } from "./config/copy";
import { MetaContext } from "./state/MetaContext";
import { useBoot } from "./state/useBoot";
import { useTheme } from "./state/useTheme";

/** The page named in the address ("#patients"), if it names one. */
function pageInAddress(): TabId | null {
  const name = window.location.hash.slice(1);
  return TABS.find((tab) => tab.id === name)?.id ?? null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => pageInAddress() ?? DEFAULT_TAB);
  const [resetCount, setResetCount] = useState(0);
  const [touring, setTouring] = useState(false);
  const { state: boot, retry } = useBoot();
  const { theme, toggleTheme } = useTheme();

  // Each page has its own address, so the browser's Back and Forward buttons move between pages.
  useEffect(() => {
    const follow = () => setActiveTab(pageInAddress() ?? DEFAULT_TAB);
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  const navigate = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (pageInAddress() !== tab) window.location.hash = tab;
    // A new page starts at its top.
    document.documentElement.scrollTop = 0;
  }, []);

  // Reset demo (PRODUCT_SPEC §5): back to the analysis of the first sample, as on arrival.
  const resetDemo = useCallback(() => {
    navigate("analysis");
    setResetCount((count) => count + 1);
  }, [navigate]);

  // The tour is about the Analysis page, so it opens there.
  const startTour = useCallback(() => {
    navigate("analysis");
    setTouring(true);
  }, [navigate]);
  const endTour = useCallback(() => setTouring(false), []);
  // Leaving the page, by a tab or by the browser's Back button, ends the tour.
  useEffect(() => {
    if (activeTab !== "analysis") setTouring(false);
  }, [activeTab]);

  const ready = boot.status === "ready";

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        onResetDemo={ready ? resetDemo : undefined}
        onStartTour={ready ? startTour : undefined}
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
              <Workspace
                samples={boot.samples}
                activeTab={activeTab}
                onNavigate={navigate}
                onStartTour={startTour}
                resetCount={resetCount}
              />
            </MetaContext.Provider>
          )}
        </AppErrorBoundary>
      </main>
      <Footer modelVersion={boot.status === "ready" ? boot.meta.model_version : undefined} />
      <Tour open={touring && ready && activeTab === "analysis"} onClose={endTour} />
    </div>
  );
}
