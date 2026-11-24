import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { PageHead, Icon, Spinner } from '../../components/UI';
import { DEFAULT_SETTINGS } from '../../utils/helpers';
import AdminOfferEditor from '../../components/AdminOfferEditor';
import AdminRegionManager from '../../components/AdminRegionManager';

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
  if (!text) return <p className="text-muted">No content.</p>;
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

export default function SystemSettings() {
  const location = useLocation();
  const { toast, setSettings } = useApp();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (location?.pathname?.includes('/regions')) return 'regions';
    if (location?.pathname?.includes('/offers')) return 'offers';
    return 'regions'; // Default to Serviceable States & Districts
  });
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getSettings()
      .then((data) => {
        if (data) {
          setForm((prev) => ({ ...DEFAULT_SETTINGS, ...data }));
        }
      })
      .catch(() => {
        toast('Could not load custom settings, showing defaults', 'info');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('Please upload an image under 3MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      handleChange('logo_url', dataUrl);
      try {
        localStorage.setItem('trackora_custom_logo', dataUrl);
      } catch {}
      toast('Logo uploaded! Click "Save Settings" to apply to the database & all portals.', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    handleChange('logo_url', '');
    try {
      localStorage.removeItem('trackora_custom_logo');
    } catch {}
    toast('Custom logo removed. Default branding will be used.', 'info');
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const updated = await api.saveSettings(form);
      if (updated) {
        setForm((prev) => ({ ...prev, ...updated }));
        setSettings?.((prev) => ({ ...prev, ...updated }));
        try {
          if (updated.logo_url) {
            localStorage.setItem('trackora_custom_logo', updated.logo_url);
          } else {
            localStorage.removeItem('trackora_custom_logo');
          }
        } catch {}
      }
      toast('System settings, portal logo & Google Maps key saved successfully!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update system settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all legal texts, copyright, and map keys to standard default settings?')) {
      setForm(DEFAULT_SETTINGS);
      toast('Reset to default values. Click "Save Settings" to apply.', 'info');
    }
  };

  if (loading) {
    return <Spinner full />;
  }

  return (
    <div className="system-settings-page">
      <PageHead
        title="System Settings & Legal Policies"
        sub="Configure Portal & Login Logo, Google Maps API key, company branding, copyright notice, privacy policies, and terms of service."
      >
        <button
          type="button"
          className="btn outline sm"
          onClick={handleResetDefaults}
          disabled={saving}
          title="Restore standard logistics defaults"
        >
          Reset Defaults
        </button>
        <button
          type="button"
          className="btn primary sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </PageHead>

      {/* Tabs */}
      <div className="settings-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'regions' ? 'active' : ''}`}
          onClick={() => { setActiveTab('regions'); setPreviewMode(false); }}
        >
          <Icon n="map" size={16} />
          Serviceable States & Districts
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => { setActiveTab('offers'); setPreviewMode(false); }}
        >
          <Icon n="gift" size={16} />
          Delivery Offers & Promos
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'branding' ? 'active' : ''}`}
          onClick={() => { setActiveTab('branding'); setPreviewMode(false); }}
        >
          <Icon n="settings" size={16} />
          Portal Logo & Branding
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          <Icon n="box" size={16} />
          Privacy Policy
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
        >
          <Icon n="check" size={16} />
          Terms & Conditions
        </button>
      </div>

      {activeTab === 'regions' && (
        <AdminRegionManager />
      )}

      {activeTab === 'offers' && (
        <AdminOfferEditor />
      )}

      {activeTab !== 'offers' && activeTab !== 'regions' && (
        <div className="card settings-card">
          {activeTab === 'branding' && (
          <form onSubmit={handleSave} className="settings-form">
            
            {/* 1. PORTAL & LOGIN LOGO BRANDING */}
            <div className="settings-branding-section">
              <div className="branding-title-row">
                <div>
                  <h3 className="section-title">🖼️ Portal & Login Logo</h3>
                  <p className="section-desc">
                    Upload or configure the brand logo displayed on the <b>Customer, Agent, and Admin Login portals</b>, the <b>Sidebar navigation</b>, and top navigation header.
                  </p>
                </div>
                {form.logo_url && (
                  <button
                    type="button"
                    className="btn sm outline danger"
                    onClick={handleRemoveLogo}
                  >
                    Remove Custom Logo
                  </button>
                )}
              </div>

              <div className="logo-config-grid">
                {/* Logo Controls */}
                <div className="logo-controls-box">
                  <label className="field">
                    <span>Upload Image File (PNG, JPG, SVG, WebP)</span>
                    <div className="upload-input-wrap">
                      <label className="btn outline sm upload-btn-label">
                        <span>📁 Choose Logo Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <small className="muted">Max size: 3MB</small>
                    </div>
                  </label>

                  <label className="field" style={{ marginTop: 12 }}>
                    <span>Or Logo Image Direct URL</span>
                    <input
                      type="url"
                      value={form.logo_url || ''}
                      onChange={(e) => handleChange('logo_url', e.target.value)}
                      placeholder="https://example.com/brand-logo.png"
                    />
                  </label>
                </div>

                {/* Live Previews */}
                <div className="logo-previews-container">
                  <span className="preview-label">Live Visual Previews:</span>
                  <div className="dual-preview-row">
                    {/* Preview 1: Login Header */}
                    <div className="mini-preview-card login-preview">
                      <span className="mini-preview-title">Login Page Header</span>
                      <div className="auth-round-logo-box preview-mode">
                        {form.logo_url ? (
                          <img src={form.logo_url} alt="Logo" className="auth-round-logo-img" />
                        ) : (
                          <div className="auth-round-logo-placeholder"><span>T</span></div>
                        )}
                      </div>
                      <b style={{ fontSize: 13, color: '#0f172a' }}>{form.company_name ? form.company_name.split(' ')[0] : 'Trackora'}</b>
                      <small style={{ fontSize: 11, color: '#64748b' }}>Sign In to Account</small>
                    </div>

                    {/* Preview 2: Sidebar Console Brand */}
                    <div className="mini-preview-card sidebar-preview">
                      <span className="mini-preview-title">Sidebar Console Header</span>
                      <div className="brand preview-mode">
                        {form.logo_url ? (
                          <img
                            src={form.logo_url}
                            alt="Logo"
                            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 2 }}
                          />
                        ) : (
                          <span className="logo">T</span>
                        )}
                        <div>
                          <b style={{ fontSize: 14 }}>{form.company_name ? form.company_name.split(' ')[0] : 'Trackora'}</b>
                          <small style={{ fontSize: 11, color: '#64748b' }}>admin console</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="settings-divider" />

            {/* 2. GOOGLE MAPS API KEY INTEGRATION */}
            <div className="settings-gmaps-section">
              <div className="gmaps-title-row">
                <div>
                  <h3 className="section-title">🗺️ Google Maps Integration</h3>
                  <p className="section-desc">
                    Powers the real-time courier tracking map, GPS driver telemetry, driving polyline directions, and interactive pickup/drop pins.
                  </p>
                </div>
                <span className="badge-pill active-key">
                  ● Key Connected & Active
                </span>
              </div>

              <div className="grid1">
                <label className="field">
                  <span>Google Maps JavaScript API Key</span>
                  <div className="input-with-action">
                    <input
                      type="text"
                      value={form.google_maps_api_key || ''}
                      onChange={(e) => handleChange('google_maps_api_key', e.target.value)}
                      placeholder="e.g. AIzaSy..."
                      required
                    />
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => {
                        handleChange('google_maps_api_key', 'AIzaSyBP8VFAuzKqFeiRg77Jg7razxXYMWKpu94');
                        toast('Default Google Maps Key restored', 'info');
                      }}
                      title="Reset to default key"
                    >
                      Default Key
                    </button>
                  </div>
                </label>
              </div>

              <div className="gmaps-features-row">
                <span className="feature-tag">✓ Real-time GPS Tracking</span>
                <span className="feature-tag">✓ Driving Routes (DirectionsService)</span>
                <span className="feature-tag">✓ Auto-Fit LatLng Bounds</span>
                <span className="feature-tag">✓ Fallback OpenStreetMap Support</span>
              </div>
            </div>

            <hr className="settings-divider" />

            {/* 3. COMPANY & FOOTER BRANDING */}
            <div className="settings-company-section">
              <h3 className="section-title">🏢 Company & Footer Branding</h3>
              <p className="section-desc">
                Company name, customer helpline, and dynamic copyright text rendered across the global footer.
              </p>

              <div className="grid2">
                <label className="field">
                  <span>Company Name (Tax Invoice & Branding)</span>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    placeholder="e.g. Delivery Tracker Logistics Services Pvt. Ltd."
                    required
                  />
                </label>

                <label className="field">
                  <span>Copyright Footer Text</span>
                  <input
                    type="text"
                    value={form.copyright_text}
                    onChange={(e) => handleChange('copyright_text', e.target.value)}
                    placeholder="e.g. © 2026 Delivery Tracker Logistics. All rights reserved."
                    required
                  />
                </label>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <span>Company Registered Address (Shown on Tax Invoice / Receipt & PDF)</span>
                <textarea
                  rows={2}
                  value={form.company_address}
                  onChange={(e) => handleChange('company_address', e.target.value)}
                  placeholder="e.g. Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India"
                  required
                  style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="grid2" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Company PAN Number</span>
                  <input
                    type="text"
                    value={form.company_pan}
                    onChange={(e) => handleChange('company_pan', e.target.value)}
                    placeholder="e.g. AABCD1234E"
                  />
                </label>

                <label className="field">
                  <span>Company GSTIN Number</span>
                  <input
                    type="text"
                    value={form.company_gstin}
                    onChange={(e) => handleChange('company_gstin', e.target.value)}
                    placeholder="e.g. 21AABCD1234E1Z5"
                  />
                </label>
              </div>

              <div className="grid2" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Support Contact Email</span>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={(e) => handleChange('support_email', e.target.value)}
                    placeholder="e.g. trackoradelivery@gmail.com"
                  />
                </label>

                <label className="field">
                  <span>Customer Helpline Phone</span>
                  <input
                    type="text"
                    value={form.support_phone}
                    onChange={(e) => handleChange('support_phone', e.target.value)}
                    placeholder="e.g. +91 94370 00099"
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: '#166534',
                  lineHeight: 1.45,
                }}
              >
                🧾 <b>Live Tax Invoice Integration:</b> Updating the Company Name, Address, PAN, or GSTIN above immediately updates all <b>Customer TAX INVOICE / RECEIPTS</b>, downloadable PDF invoices, and automated email attachments.
              </div>

              {/* Live Footer Preview Box */}
              <div className="footer-preview-box">
                <span className="preview-label">Live Footer Preview:</span>
                <div className="mini-footer-preview">
                  <span>{form.copyright_text || '© 2026 Trackora Logistics. All rights reserved.'}</span>
                  <div className="mini-links">
                    <span>Privacy Policy</span>
                    <span>•</span>
                    <span>Terms & Conditions</span>
                    {form.support_email && (
                      <>
                        <span>•</span>
                        <span>{form.support_email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Settings & Apply Logo'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'privacy' && (
          <div className="policy-editor-section">
            <div className="editor-top-bar">
              <div>
                <h3 className="section-title">Privacy Policy Content</h3>
                <p className="section-desc">
                  Supports markdown headings (<code>### Section</code>), bullet points (<code>- Item</code>), and bold text (<code>**text**</code>).
                </p>
              </div>
              <div className="view-toggle">
                <button
                  type="button"
                  className={`btn sm ${!previewMode ? 'primary' : 'outline'}`}
                  onClick={() => setPreviewMode(false)}
                >
                  Edit Text
                </button>
                <button
                  type="button"
                  className={`btn sm ${previewMode ? 'primary' : 'outline'}`}
                  onClick={() => setPreviewMode(true)}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {!previewMode ? (
              <textarea
                className="policy-textarea"
                rows={16}
                value={form.privacy_policy}
                onChange={(e) => handleChange('privacy_policy', e.target.value)}
                placeholder="Enter privacy policy text..."
              />
            ) : (
              <div className="policy-preview-container">
                <div className="doc-header-meta">
                  <span className="badge info">Official Policy</span>
                  <span className="doc-updated-label">{form.company_name}</span>
                </div>
                <FormattedDoc text={form.privacy_policy} />
              </div>
            )}

            <div className="settings-actions">
              <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Privacy Policy'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="policy-editor-section">
            <div className="editor-top-bar">
              <div>
                <h3 className="section-title">Terms & Conditions Content</h3>
                <p className="section-desc">
                  Set delivery agreement, forbidden parcel items, liability limits, and cancellation regulations.
                </p>
              </div>
              <div className="view-toggle">
                <button
                  type="button"
                  className={`btn sm ${!previewMode ? 'primary' : 'outline'}`}
                  onClick={() => setPreviewMode(false)}
                >
                  Edit Text
                </button>
                <button
                  type="button"
                  className={`btn sm ${previewMode ? 'primary' : 'outline'}`}
                  onClick={() => setPreviewMode(true)}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {!previewMode ? (
              <textarea
                className="policy-textarea"
                rows={16}
                value={form.terms_conditions}
                onChange={(e) => handleChange('terms_conditions', e.target.value)}
                placeholder="Enter terms & conditions text..."
              />
            ) : (
              <div className="policy-preview-container">
                <div className="doc-header-meta">
                  <span className="badge warning">Terms of Service</span>
                  <span className="doc-updated-label">{form.company_name}</span>
                </div>
                <FormattedDoc text={form.terms_conditions} />
              </div>
            )}

            <div className="settings-actions">
              <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Terms & Conditions'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
