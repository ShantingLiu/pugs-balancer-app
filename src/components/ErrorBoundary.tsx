import React, { Component } from "react";
import type { ReactNode } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-paper text-ink flex items-center justify-center p-8">
          <Card variant="surface" className="max-w-lg w-full p-3 text-center">
            <CardHeader className="items-center gap-3">
              <AlertOctagon className="size-12 text-bad" aria-hidden="true" />
              <CardTitle className="text-2xl text-bad">
                <h1>Something went wrong</h1>
              </CardTitle>
              <CardDescription className="text-base text-ink-2">
                The app encountered an error. This might be due to corrupted saved data.
              </CardDescription>
            </CardHeader>
            {this.state.error && (
              <CardContent>
                <pre className="text-left text-xs bg-bad-soft border border-bad-edge p-4 rounded-well overflow-auto max-h-48 text-bad">
                  {this.state.error.message}
                </pre>
              </CardContent>
            )}
            <CardFooter className="justify-center">
              <Button variant="primary" size="lg" onClick={this.handleReset}>
                Clear Data &amp; Reload
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
