// The last line of defence: an error nobody expected while drawing a view. Instead of an empty
// window the page says so and offers to load again. The header, the disclaimer and the footer
// are outside this boundary and stay on screen.

import { Component, type ReactNode } from "react";
import { CRASH_TEXT, CRASH_TITLE, RELOAD } from "../../config/copy";
import { BUTTON_CLASS } from "./Feedback";

interface Props {
  children: ReactNode;
  onReload?: () => void;
}

export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
        <p className="font-semibold text-ink">{CRASH_TITLE}</p>
        <p className="mt-1 text-sm text-ink-muted">{CRASH_TEXT}</p>
        <button type="button" onClick={reload} className={`mt-4 ${BUTTON_CLASS}`}>
          {RELOAD}
        </button>
      </div>
    );
  }
}
