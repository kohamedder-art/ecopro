import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { reportClientError } from '../utils/telemetry';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Auto-reload on chunk load failures (happens after deploy when old chunks are removed)
    const isChunkError =
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('import of') ||
      (error as any)?.name === 'ChunkLoadError' ||
      (error as any)?.name === 'TypeError' && (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('import')
      );

    if (isChunkError && import.meta.env.PROD) {
      window.location.reload();
      return;
    }
    
    // In production, report to server telemetry for the admin dashboard.
    // Use Vite env flags (process.env is not guaranteed in the browser).
    if (import.meta.env.PROD) {
      reportClientError({
        message: error?.message || String(error),
        name: (error as any)?.name,
        stack: (error as any)?.stack,
        componentStack: errorInfo?.componentStack,
      });
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
          <div className="max-w-lg w-full">
            {/* Error Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Something Went Wrong</h1>
                <p className="text-white/80 text-sm">An unexpected error occurred</p>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
                  We're sorry for the inconvenience. Please try refreshing the page or go back to the home page.
                </p>
                
                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <button
                    onClick={this.handleReload}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    <Home className="w-4 h-4" />
                    Go to Home
                  </button>
                </div>
                
                {/* Error details (dev only) */}
                {isDev && this.state.error && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                      <Bug className="w-4 h-4" />
                      <span className="font-medium">Error Details (Development Only)</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto">
                      <code className="text-xs text-red-600 dark:text-red-400 block whitespace-pre-wrap">
                        {this.state.error.toString()}
                      </code>
                      {this.state.errorInfo && (
                        <code className="text-xs text-slate-500 dark:text-slate-500 block mt-2 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </code>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Help text */}
            <p className="text-center text-sm text-slate-500 dark:text-slate-500 mt-4">
              If this problem persists, please{' '}
              <a href="/contact" className="text-primary hover:underline">contact support</a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
