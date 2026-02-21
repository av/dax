import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
/**
 * React Error Boundary — catches render crashes and shows a friendly fallback.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, errorMessage: error.message };
    }
    componentDidCatch(error, info) {
        console.error('[Dax] Uncaught render error:', error, info.componentStack);
    }
    handleReload = () => {
        window.location.reload();
    };
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: {
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
                }, children: [_jsx("div", { style: {
                            fontSize: '48px',
                            lineHeight: 1,
                            opacity: 0.5,
                        }, children: "\u26A0" }), _jsx("h1", { style: {
                            fontSize: '1.5rem',
                            fontWeight: 500,
                            margin: 0,
                            color: '#f7768e',
                        }, children: "Something went wrong" }), _jsx("p", { style: {
                            fontSize: '14px',
                            color: '#565f89',
                            maxWidth: '400px',
                            lineHeight: 1.6,
                            margin: 0,
                        }, children: this.state.errorMessage ?? 'An unexpected error occurred.' }), _jsx("button", { onClick: this.handleReload, style: {
                            marginTop: '8px',
                            padding: '10px 28px',
                            fontSize: '14px',
                            background: 'transparent',
                            color: '#7aa2f7',
                            border: '1px solid #7aa2f7',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                        }, children: "Reload" })] }));
        }
        return this.props.children;
    }
}
