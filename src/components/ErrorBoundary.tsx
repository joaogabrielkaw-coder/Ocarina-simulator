import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0b1622] p-6 text-[#f6f0dc]">
          <div className="max-w-md border border-[#d4af37]/40 bg-[#112030] p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-[#fde68a]">
              Algo interrompeu a melodia
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {this.state.errorMessage.slice(0, 220)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 bg-[#d4af37] px-4 py-2 text-sm font-bold text-[#0b1622] transition-colors hover:bg-[#fde68a]"
            >
              Recarregar Templo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
