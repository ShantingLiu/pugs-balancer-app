import React, { Component } from "react";
import type { ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App error:", error, errorInfo);
  }

  handleReset = () => {
    // Clear localStorage and reload
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex items-center justify-center p-8">
          <div className="max-w-lg text-center space-y-4">
            <AlertOctagon className="h-12 w-12 mx-auto text-bad" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-bad">Something went wrong</h1>
            <p className="text-muted">
              The app encountered an error. This might be due to corrupted saved data.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs app-card p-4 overflow-auto max-h-48 text-bad">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="app-primary px-6 py-3 font-medium"
            >
              Clear Data &amp; Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
