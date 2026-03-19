import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          errorDetails = parsed;
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-red-100">
            <h2 className="text-xl font-bold text-red-600 mb-4">Si è verificato un errore</h2>
            <p className="text-slate-600 mb-4">
              Ci scusiamo per l'inconveniente. Riprova più tardi o contatta l'amministratore.
            </p>
            {errorDetails && (
              <div className="bg-slate-100 p-3 rounded text-xs font-mono text-slate-800 overflow-auto">
                <strong>Operazione:</strong> {errorDetails.operationType}<br />
                <strong>Path:</strong> {errorDetails.path}<br />
                <strong>Errore:</strong> {errorDetails.error}
              </div>
            )}
            {!errorDetails && this.state.error && (
              <div className="bg-slate-100 p-3 rounded text-xs font-mono text-slate-800 overflow-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              onClick={() => window.location.href = '/'}
            >
              Torna alla Home
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
