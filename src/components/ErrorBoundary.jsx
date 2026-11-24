import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: '32px 24px',
            margin: '20px auto',
            maxWidth: 600,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid #fee2e2',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#991b1b', marginBottom: 8 }}>
            Unable to display order details
          </h2>
          <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn sm"
              style={{
                background: '#2563eb',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
              }}
              onClick={() => {
                this.resetError();
                window.location.reload();
              }}
            >
              🔄 Refresh Page
            </button>
            <button
              type="button"
              className="btn sm ghost"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => {
                this.resetError();
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
            >
              ← Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
