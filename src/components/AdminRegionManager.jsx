import { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { ALL_INDIAN_STATES, INDIA_STATES_DATA, getDefaultServiceableRegions } from '../utils/indiaGeoData';
import { Icon } from './UI';

export default function AdminRegionManager() {
  const { toast, settings, setSettings } = useApp() || {};
  const [regions, setRegions] = useState(() => {
    if (settings?.serviceable_regions && Array.isArray(settings.serviceable_regions) && settings.serviceable_regions.length > 0) {
      return settings.serviceable_regions;
    }
    return getDefaultServiceableRegions();
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'approved' | 'disabled'
  const [expandedState, setExpandedState] = useState(null);

  useEffect(() => {
    if (settings?.serviceable_regions && Array.isArray(settings.serviceable_regions) && settings.serviceable_regions.length > 0) {
      setRegions(settings.serviceable_regions);
    }
  }, [settings]);

  // Compute stats
  const totalStates = ALL_INDIAN_STATES.length;
  const approvedStates = useMemo(() => {
    return regions.filter((r) => r.enabled).length;
  }, [regions]);

  const filteredStates = useMemo(() => {
    return ALL_INDIAN_STATES.filter((state) => {
      const q = search.trim().toLowerCase();
      const stateObj = regions.find((r) => r.state.toLowerCase() === state.toLowerCase()) || { enabled: true, districts: [] };
      
      if (filter === 'approved' && !stateObj.enabled) return false;
      if (filter === 'disabled' && stateObj.enabled) return false;

      if (!q) return true;
      if (state.toLowerCase().includes(q)) return true;
      const dists = INDIA_STATES_DATA[state] || [];
      return dists.some((d) => d.toLowerCase().includes(q));
    });
  }, [search, filter, regions]);

  const toggleState = (stateName) => {
    setRegions((prev) => {
      const existing = prev.find((r) => r.state.toLowerCase() === stateName.toLowerCase());
      if (existing) {
        return prev.map((r) =>
          r.state.toLowerCase() === stateName.toLowerCase()
            ? { ...r, enabled: !r.enabled }
            : r
        );
      }
      return [...prev, { state: stateName, enabled: false, districts: [...(INDIA_STATES_DATA[stateName] || [])] }];
    });
  };

  const toggleDistrict = (stateName, districtName) => {
    setRegions((prev) => {
      const allDists = INDIA_STATES_DATA[stateName] || [];
      const existing = prev.find((r) => r.state.toLowerCase() === stateName.toLowerCase());
      const currentDists = existing?.districts?.length ? [...existing.districts] : [...allDists];
      
      let nextDists;
      if (currentDists.some((d) => d.toLowerCase() === districtName.toLowerCase())) {
        nextDists = currentDists.filter((d) => d.toLowerCase() !== districtName.toLowerCase());
      } else {
        nextDists = [...currentDists, districtName];
      }

      if (existing) {
        return prev.map((r) =>
          r.state.toLowerCase() === stateName.toLowerCase()
            ? { ...r, districts: nextDists }
            : r
        );
      }
      return [...prev, { state: stateName, enabled: true, districts: nextDists }];
    });
  };

  const handleSelectAllDistricts = (stateName) => {
    const allDists = INDIA_STATES_DATA[stateName] || [];
    setRegions((prev) => {
      return prev.map((r) =>
        r.state.toLowerCase() === stateName.toLowerCase()
          ? { ...r, districts: [...allDists] }
          : r
      );
    });
  };

  const handleDeselectAllDistricts = (stateName) => {
    setRegions((prev) => {
      return prev.map((r) =>
        r.state.toLowerCase() === stateName.toLowerCase()
          ? { ...r, districts: [] }
          : r
      );
    });
  };

  const handleApproveAll = () => {
    setRegions(ALL_INDIAN_STATES.map((state) => ({
      state,
      enabled: true,
      districts: [...(INDIA_STATES_DATA[state] || [])],
    })));
    toast('All 36 States & Union Territories set to Approved.', 'info');
  };

  const handleDisableAll = () => {
    setRegions(ALL_INDIAN_STATES.map((state) => ({
      state,
      enabled: false,
      districts: [],
    })));
    toast('All States set to Inactive/Disabled.', 'info');
  };

  const handleResetDefaults = () => {
    const def = getDefaultServiceableRegions();
    setRegions(def);
    toast('Reset regions to nationwide defaults.', 'info');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings({ serviceable_regions: regions });
      if (setSettings) {
        setSettings((prev) => ({ ...prev, serviceable_regions: regions }));
      }
      toast('Serviceable States & Districts saved successfully! Registration restrictions updated.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save serviceable regions', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card admin-region-manager-card" style={{ marginBottom: 24, padding: '24px 26px', borderRadius: 16 }}>
      {/* Header */}
      <div className="region-mgr-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 18, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>📍</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Serviceable States & Districts (Eligible Operational Areas)
            </h3>
          </div>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: 650 }}>
            Configure approved Indian States & Districts where customers and agents can create accounts. Deliveries are restricted strictly to within the same state (intra-state logistics).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm ghost"
            onClick={handleResetDefaults}
            title="Reset to nationwide coverage"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            className="btn sm"
            style={{ background: '#059669', color: '#fff', fontWeight: 700, padding: '9px 18px' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving Areas…' : 'Save Approved Regions'}
          </button>
        </div>
      </div>

      {/* Stats & Quick Action Bar */}
      <div className="region-stat-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, background: '#f8fafc', padding: '14px 18px', borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b' }}>
              <b>{approvedStates}</b> of <b>{totalStates}</b> States / UTs Approved
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn xs ${filter === 'all' ? '' : 'ghost'}`}
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              onClick={() => setFilter('all')}
            >
              All ({totalStates})
            </button>
            <button
              type="button"
              className={`btn xs ${filter === 'approved' ? '' : 'ghost'}`}
              style={{ padding: '3px 10px', fontSize: '0.75rem', color: filter === 'approved' ? '#fff' : '#059669' }}
              onClick={() => setFilter('approved')}
            >
              Approved ({approvedStates})
            </button>
            <button
              type="button"
              className={`btn xs ${filter === 'disabled' ? '' : 'ghost'}`}
              style={{ padding: '3px 10px', fontSize: '0.75rem', color: filter === 'disabled' ? '#fff' : '#dc2626' }}
              onClick={() => setFilter('disabled')}
            >
              Disabled ({totalStates - approvedStates})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn xs ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px', border: '1px solid #cbd5e1' }}
            onClick={handleApproveAll}
          >
            ✓ Approve All States
          </button>
          <button
            type="button"
            className="btn xs ghost"
            style={{ fontSize: '0.75rem', padding: '4px 10px', border: '1px solid #cbd5e1', color: '#dc2626' }}
            onClick={handleDisableAll}
          >
            ✕ Disable All
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search state name or district (e.g. Odisha, Khordha, Mumbai, Bengaluru, Delhi)..."
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1.5px solid #cbd5e1',
            fontSize: '0.92rem',
            background: '#ffffff',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* States List Grid */}
      <div className="region-states-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredStates.map((state) => {
          const stateObj = regions.find((r) => r.state.toLowerCase() === state.toLowerCase()) || { enabled: true, districts: [] };
          const allDistricts = INDIA_STATES_DATA[state] || [];
          const enabledDistricts = stateObj.districts || allDistricts;
          const isExpanded = expandedState === state;
          const isStateEnabled = Boolean(stateObj.enabled);

          return (
            <div
              key={state}
              className={`region-state-card ${isStateEnabled ? 'active-region' : 'inactive-region'}`}
              style={{
                border: `1.5px solid ${isStateEnabled ? '#a7f3d0' : '#e2e8f0'}`,
                background: isStateEnabled ? '#fcfdfd' : '#f8fafc',
                borderRadius: 12,
                padding: '14px 18px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isStateEnabled}
                    className={`switch ${isStateEnabled ? 'on' : ''}`}
                    onClick={() => toggleState(state)}
                    title={`Click to ${isStateEnabled ? 'Disable' : 'Approve'} ${state}`}
                  >
                    <span />
                  </button>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isStateEnabled ? '#0f172a' : '#64748b' }}>
                        {state}
                      </h4>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: isStateEnabled ? '#ecfdf5' : '#f1f5f9',
                          color: isStateEnabled ? '#059669' : '#94a3b8',
                          border: `1px solid ${isStateEnabled ? '#6ee7b7' : '#e2e8f0'}`
                        }}
                      >
                        {isStateEnabled ? '● APPROVED' : 'DISABLED'}
                      </span>
                    </div>
                    <small style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      {enabledDistricts.length} of {allDistricts.length} districts active
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn xs ghost"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      background: isExpanded ? '#e2e8f0' : '#ffffff',
                      border: '1px solid #cbd5e1'
                    }}
                    onClick={() => setExpandedState(isExpanded ? null : state)}
                  >
                    {isExpanded ? '▲ Hide Districts' : `▼ Manage Districts (${enabledDistricts.length}/${allDistricts.length})`}
                  </button>
                </div>
              </div>

              {/* District Expansion Panel */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px dashed #cbd5e1',
                    background: '#ffffff',
                    padding: '16px',
                    borderRadius: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                      District Coverage for {state} ({enabledDistricts.length} Active):
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn xs ghost"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => handleSelectAllDistricts(state)}
                      >
                        ✓ Select All
                      </button>
                      <button
                        type="button"
                        className="btn xs ghost"
                        style={{ padding: '2px 8px', fontSize: '0.72rem', color: '#dc2626' }}
                        onClick={() => handleDeselectAllDistricts(state)}
                      >
                        ✕ Deselect All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {allDistricts.map((dist) => {
                      const isDistActive = enabledDistricts.some((d) => d.toLowerCase() === dist.toLowerCase());
                      return (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => toggleDistrict(state, dist)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: isDistActive ? '#ecfdf5' : '#f1f5f9',
                            color: isDistActive ? '#065f46' : '#64748b',
                            border: `1.5px solid ${isDistActive ? '#34d399' : '#e2e8f0'}`,
                            transition: 'all 0.15s ease'
                          }}
                          title={`Click to ${isDistActive ? 'Deactivate' : 'Activate'} ${dist}`}
                        >
                          {isDistActive ? '✓ ' : '+ '}{dist}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredStates.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
            No states or districts match "{search}".
          </div>
        )}
      </div>

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn sm"
          style={{ background: '#059669', color: '#fff', fontWeight: 700, padding: '10px 22px' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving Areas…' : 'Save Approved Regions'}
        </button>
      </div>
    </div>
  );
}
