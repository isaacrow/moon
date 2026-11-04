import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030408] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full p-8 rounded-3xl bg-white/05 border border-white/15 backdrop-blur-2xl text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>
              <p className="text-sm text-white/60">
                {this.state.error?.message || "An unexpected error occurred while rendering this view."}
              </p>
            </div>

            {this.state.error?.stack && (
              <div className="text-left bg-black/40 p-4 rounded-xl border border-white/10 text-xs font-mono text-rose-300/80 overflow-auto max-h-40">
                {this.state.error.stack}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </button>

              {this.props.onReset && (
                <button
                  type="button"
                  onClick={this.props.onReset}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
