import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import Modal from './Modal';
import { Icon } from './UI';
import { DEFAULT_SETTINGS } from '../utils/helpers';

function renderBold(str) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function FormattedDoc({ text }) {
  if (!text) return <p className="text-muted">No content available.</p>;
  const lines = text.split('\n');
  return (
    <div className="doc-content">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="doc-spacer" />;
        if (trimmed.startsWith('### ')) {
          return <h4 key={i} className="doc-h3">{trimmed.replace(/^###\s+/, '')}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={i} className="doc-h2">{trimmed.replace(/^##\s+/, '')}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={i} className="doc-h1">{trimmed.replace(/^#\s+/, '')}</h2>;
        }
        if (trimmed.startsWith('- ')) {
          const content = trimmed.replace(/^-\s+/, '');
          return (
            <div key={i} className="doc-bullet">
              <span className="bullet-dot">•</span>
              <span>{renderBold(content)}</span>
            </div>
          );
        }
        return <p key={i} className="doc-p">{renderBold(trimmed)}</p>;
      })}
    </div>
  );
}

export default function Footer() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [modalType, setModalType] = useState(null); // 'privacy' | 'terms' | null
  const { socket } = useApp() || {};

  const loadSettings = () => {
    api.getSettings()
      .then((s) => {
        if (s && (s.company_name || s.copyright_text)) {
          setSettings((prev) => ({ ...prev, ...s }));
        }
      })
      .catch(() => {
        // Fallback to default settings
      });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onUpdated = (updated) => {
      if (updated) {
        setSettings((prev) => ({ ...prev, ...updated }));
      } else {
        loadSettings();
      }
    };
    socket.on('settingsUpdated', onUpdated);
    return () => socket.off('settingsUpdated', onUpdated);
  }, [socket]);

  return (
    <>
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-copy">
            <span>{settings.copyright_text || '© 2026 Trackora Logistics. All rights reserved.'}</span>
          </div>

          <div className="footer-nav">
            <button
              type="button"
              className="footer-btn"
              onClick={() => setModalType('privacy')}
            >
              Privacy Policy
            </button>
            <span className="footer-sep">•</span>
            <button
              type="button"
              className="footer-btn"
              onClick={() => setModalType('terms')}
            >
              Terms & Conditions
            </button>
            {settings.support_email && (
              <>
                <span className="footer-sep">•</span>
                <a
                  href={`mailto:${settings.support_email}`}
                  className="footer-btn footer-support"
                  title="Contact Support"
                >
                  {settings.support_email}
                </a>
              </>
            )}
          </div>
        </div>
      </footer>

      {modalType === 'privacy' && (
        <Modal
          title="Privacy Policy"
          onClose={() => setModalType(null)}
          footer={
            <button className="btn primary sm" onClick={() => setModalType(null)}>
              Close
            </button>
          }
        >
          <div className="doc-wrapper">
            <div className="doc-header-meta">
              <span className="badge info">Official Policy</span>
              <span className="doc-updated-label">{settings.company_name || 'Trackora Logistics'}</span>
            </div>
            <FormattedDoc text={settings.privacy_policy} />
          </div>
        </Modal>
      )}

      {modalType === 'terms' && (
        <Modal
          title="Terms & Conditions"
          onClose={() => setModalType(null)}
          footer={
            <button className="btn primary sm" onClick={() => setModalType(null)}>
              I Understand & Close
            </button>
          }
        >
          <div className="doc-wrapper">
            <div className="doc-header-meta">
              <span className="badge warning">Terms of Service</span>
              <span className="doc-updated-label">{settings.company_name || 'Trackora Logistics'}</span>
            </div>
            <FormattedDoc text={settings.terms_conditions} />
          </div>
        </Modal>
      )}
    </>
  );
}
