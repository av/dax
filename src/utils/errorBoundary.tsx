import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { theme } from '../theme';

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
            background: theme.colors.bgBase,
            color: theme.colors.textPrimary,
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
              color: theme.colors.statusError,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
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
              color: theme.colors.accentPrimary,
              border: `1px solid ${theme.colors.accentPrimary}`,
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
