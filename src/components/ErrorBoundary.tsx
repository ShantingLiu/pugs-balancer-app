import React, { Component } from "react";
import type { ReactNode } from "react";

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
        <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-8">
          <div className="max-w-lg text-center space-y-4">
            <div className="text-6xl">💥</div>
            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-gray-400">
              The app encountered an error. This might be due to corrupted saved data.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-gray-800 p-4 rounded-lg overflow-auto max-h-48 text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Clear Data & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
