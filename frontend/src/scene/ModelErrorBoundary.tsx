// F11: if the heart mesh cannot be loaded, render the fallback instead and tell the caller once.

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}

export class ModelErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
