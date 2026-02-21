import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * React Error Boundary — catches render crashes and shows a friendly fallback.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Dax] Uncaught render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f',
            color: '#e0e0e0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            gap: '20px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              lineHeight: 1,
              opacity: 0.5,
            }}
          >
            ⚠
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 500,
              margin: 0,
              color: '#f7768e',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#565f89',
              maxWidth: '400px',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {this.state.errorMessage ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: '8px',
              padding: '10px 28px',
              fontSize: '14px',
              background: 'transparent',
              color: '#7aa2f7',
              border: '1px solid #7aa2f7',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
