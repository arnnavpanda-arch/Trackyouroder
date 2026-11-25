import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Field } from '../../components/UI';
import { homeFor, rules, validate, MOCK } from '../../utils/helpers';
import { ALL_INDIAN_STATES, INDIA_STATES_DATA, isRegionEligible } from '../../utils/indiaGeoData';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import Footer from '../../components/Footer';
import Modal from '../../components/Modal';

function useLiveParcelStats() {
  const [stats, setStats] = useState(() => {
    try {
      const raw = localStorage.getItem('dt_db_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.orders)) {
          const o = parsed.orders;
          return {
            total: o.length,
            preparing: o.filter((x) => x.status === 'Placed').length,
            onTheWay: o.filter((x) => x.status === 'Picked-up' || x.status === 'In-Transit').length,
            delivered: o.filter((x) => x.status === 'Delivered').length,
          };
        }
      }
    } catch {}
    return { total: 0, preparing: 0, onTheWay: 0, delivered: 0 };
  });

  useEffect(() => {
    const updateFromOrders = (orders) => {
      if (!Array.isArray(orders)) return;
      setStats({
        total: orders.length,
        preparing: orders.filter((x) => x.status === 'Placed').length,
        onTheWay: orders.filter((x) => x.status === 'Picked-up' || x.status === 'In-Transit').length,
        delivered: orders.filter((x) => x.status === 'Delivered').length,
      });
    };

    const fetchLatest = () => {
      if (api.publicStats) {
        api.publicStats()
          .then((data) => {
            if (data && typeof data.total === 'number') setStats(data);
          })
          .catch(() => {});
      } else {
        const tk = sessionStorage.getItem('dt_token') || sessionStorage.getItem('dt_token_v1');
        if (tk) {
          api.listOrders().then(updateFromOrders).catch(() => {});
        }
      }
    };

    fetchLatest();

    // Listen to real-time socket/bus events from agent or admin updates
    const socket = getSocket();
    const evts = ['orderStatusUpdated', 'orderAssigned', 'newNotification'];
    if (socket?.on) {
      evts.forEach((e) => socket.on(e, fetchLatest));
    }

    // Listen to cross-tab updates (e.g. agent or admin updates in another tab)
    const onStorage = (e) => {
      if (e.key === 'dt_db_v1' && e.newValue) {
        try {
          updateFromOrders(JSON.parse(e.newValue)?.orders);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    // Active polling interval every 2.5 seconds to guarantee live sync
    const interval = setInterval(fetchLatest, 2500);

    return () => {
      if (socket?.off) {
        evts.forEach((e) => socket.off(e, fetchLatest));
      }
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  return stats;
}

function ParcelSymbol() {
  return (
    <div className="parcel-symbol-panel">
      <div className="parcel-symbol-box">📦</div>
    </div>
  );
}

function Hero() {
  const videoRef = useRef(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const hasCelebratedRef = useRef(false);
  const stats = useLiveParcelStats();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});

    const onTimeUpdate = () => {
      // Trigger parcel symbol reveal right as one animation cycle finishes (~4s)
      if (!hasCelebratedRef.current && v.duration && v.currentTime >= v.duration - 0.25) {
        hasCelebratedRef.current = true;
        v.pause();
        setShowCelebration(true);
      }
    };

    const onEnded = () => {
      if (!hasCelebratedRef.current) {
        hasCelebratedRef.current = true;
        setShowCelebration(true);
      }
    };

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  return (
    <section className="hero">
      <div className="hero-copy hero-neon-wrap">
        <h1 className="neon-trackora-title">TRACKORA</h1>
      </div>
      <div className="freight-preview-card">
        {showCelebration ? (
          /* Animation closes here and ONLY shows the floating parcel symbol */
          <ParcelSymbol />
        ) : (
          <div className="freight-preview-media">
            <video
              ref={videoRef}
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/409763c0-95f4-49d3-a601-dc564d55072b.mp4"
              poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/2307e4bf-be39-42b4-b579-e168aeccabf0.jpg"
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={() => {
                hasCelebratedRef.current = true;
                setShowCelebration(true);
              }}
            />
            <div className="container-trackora-stencil">
              <div className="container-stencil-box">
                <span className="container-stencil-text">trackora</span>
                <span className="container-stencil-sub">40FT HC · ISO 6346</span>
              </div>
            </div>
            <div className="freight-preview-badge">
              <span className="live-dot" />
              Trackora Services
            </div>
          </div>
        )}
        <div className="freight-preview-stats four-cols">
          <div className="stat-col">
            <span className="stat-number">{stats.total}</span>
            <small>Total Parcels</small>
          </div>
          <div className="stat-col">
            <span className="stat-number text-amber">{stats.preparing}</span>
            <small>Preparing for Dispatch</small>
          </div>
          <div className="stat-col">
            <span className="stat-number text-blue">{stats.onTheWay}</span>
            <small>On the Way</small>
          </div>
          <div className="stat-col">
            <span className="stat-number text-green">{stats.delivered}</span>
            <small>Delivered</small>
          </div>
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  {
    id: 'user',
    label: 'Customer',
    icon: '👤',
    desc: 'Track shipments, place orders & monitor deliveries',
    demoEmail: 'user@demo.com',
    demoPassword: 'user123',
  },
  {
    id: 'agent',
    label: 'Agent',
    icon: '🚚',
    desc: 'Delivery driver, view assigned routes & update live status',
    demoEmail: 'agent@demo.com',
    demoPassword: 'agent123',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: '🛡️',
    desc: 'Fleet telemetry, operations control & user management',
    demoEmail: 'admin@demo.com',
    demoPassword: 'admin123',
  },
  {
    id: 'district_admin',
    label: 'District Admin',
    icon: '🏛️',
    desc: 'Local district dispatch, agent approval & live monitoring',
    demoEmail: 'districtadmin@demo.com',
    demoPassword: 'districtadmin123',
  }
];

function AuthFlow({ initialAction = 'signin' }) {
  const { user, login, register, toast, settings } = useApp();
  const nav = useNavigate();

  // step: 'action' (Sign In or Create Account) -> 'role' (Customer, Agent, Admin) -> 'form'
  const [step, setStep] = useState('action');
  const [action, setAction] = useState(initialAction); // 'signin' | 'register'
  const [selectedRole, setSelectedRole] = useState('user');

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalDocType, setLegalDocType] = useState('terms');

  const [v, setV] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    state: '',
    district: '',
    vehicleType: 'Bike',
    vehicleNumber: '',
    drivingLicense: '',
    emergencyContact: '',
    experienceYears: '1-2 Years',
  });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setV((prev) => ({ ...prev, [k]: e.target.value }));
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem('trackora_custom_logo') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'trackora_custom_logo') {
        setLogoUrl(e.newValue || null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const activeLogo = settings?.logo_url || logoUrl;
  const currentRole = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  const handleChooseAction = (chosenAction) => {
    setAction(chosenAction);
    setStep('role');
  };

  const handleChooseRole = (chosenRole) => {
    setSelectedRole(chosenRole);
    const roleInfo = ROLES.find((r) => r.id === chosenRole) || ROLES[0];
    if (action === 'signin' && MOCK) {
      setV({
        name: '',
        email: roleInfo.demoEmail,
        password: roleInfo.demoPassword,
        phone: '',
        state: '',
        district: '',
        vehicleType: 'Bike',
        vehicleNumber: '',
        drivingLicense: '',
        emergencyContact: '',
        experienceYears: '1-2 Years',
      });
    } else {
      setV({
        name: '',
        email: '',
        phone: '',
        password: '',
        state: '',
        district: '',
        vehicleType: 'Bike',
        vehicleNumber: '',
        drivingLicense: '',
        emergencyContact: '',
        experienceYears: '1-2 Years',
      });
    }
    setAgreeTerms(false);
    setErrs({});
    setStep('form');
  };

  const fillDemo = () => {
    setV((prev) => ({
      ...prev,
      email: currentRole.demoEmail,
      password: currentRole.demoPassword
    }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const er = validate(v, { email: rules.email, password: rules.required('Password') });
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const u = await login(v.email, v.password);
      nav(homeFor(u.role));
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const er = validate(v, {
      name: rules.min('Name', 2),
      email: rules.email,
      phone: rules.phone,
      password: rules.password
    });

    if (!agreeTerms) {
      er.terms = 'Please accept the Privacy Policy and Terms & Conditions to create your account.';
    }

    if (selectedRole === 'agent') {
      if (!v.vehicleNumber?.trim()) {
        er.vehicleNumber = 'Vehicle registration number is required for verification';
      }
      if (!v.drivingLicense?.trim()) {
        er.drivingLicense = 'Driving license number is required for verification';
      }
    }

    if (selectedRole !== 'admin') {
      if (!v.state) {
        er.state = 'Please select your State';
      }
      if (!v.district) {
        er.district = 'Please select your District';
      }
      if (v.state && !isRegionEligible(v.state, null, settings?.serviceable_regions)) {
        er.state = `Service is not active in ${v.state}. Only admin-approved states can create an account.`;
      } else if (v.state && v.district && !isRegionEligible(v.state, v.district, settings?.serviceable_regions)) {
        er.district = `Service is not active in ${v.district} (${v.state}). Only admin-approved districts can create an account.`;
      }
    }

    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const payload = {
        ...v,
        role: selectedRole,
        agentDetails: selectedRole === 'agent' ? {
          vehicleType: v.vehicleType || 'Bike',
          vehicleNumber: (v.vehicleNumber || '').trim(),
          drivingLicense: (v.drivingLicense || '').trim(),
          emergencyContact: (v.emergencyContact || '').trim(),
          experienceYears: v.experienceYears || '1-2 Years',
        } : undefined,
      };
      const u = await register(payload);
      if (selectedRole === 'agent') {
        toast('Delivery agent application submitted! Awaiting admin verification & approval.', 'info');
      } else {
        toast('Account created successfully! Welcome to Trackora.', 'success');
      }
      nav(homeFor(u.role));
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Hero />
      <section className="auth-card">
        {step === 'action' && (
          <div className="auth-choice-container">
            <div className="auth-logo-header">
              <div className="auth-round-logo-box" title="Trackora Logo">
                {activeLogo ? (
                  <img src={activeLogo} alt="Trackora Logo" className="auth-round-logo-img" />
                ) : (
                  <div className="auth-round-logo-placeholder">
                    <span>T</span>
                  </div>
                )}
              </div>
            </div>
            <h2>Welcome to Trackora</h2>
            <p className="sub">Select an option to continue</p>
            <div className="auth-action-buttons">
              <button
                type="button"
                className="btn-lightblue"
                onClick={() => handleChooseAction('signin')}
              >
                Sign In
              </button>

              <button
                type="button"
                className="btn-lightblue secondary"
                onClick={() => handleChooseAction('register')}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {step === 'role' && (
          <div className="auth-choice-container">
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => setStep('action')}
            >
              ← Back to options
            </button>
            <h2>Select Account Type</h2>
            <p className="sub">
              Choose your account to {action === 'signin' ? 'sign in' : 'create an account'}
            </p>

            <div className="auth-role-cards">
              {ROLES.filter((r) => action === 'signin' ? true : (r.id !== 'admin' && r.id !== 'district_admin')).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="role-choice-card"
                  onClick={() => handleChooseRole(r.id)}
                >
                  <div className={`choice-icon role-${r.id}`}>{r.icon}</div>
                  <div className="choice-info">
                    <h3>{r.label}</h3>
                    <p>{r.desc}</p>
                  </div>
                  <span className="choice-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'form' && action === 'signin' && (
          <form onSubmit={handleLoginSubmit} noValidate>
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => setStep('role')}
            >
              ← Back to account types
            </button>

            <div className={`role-badge-pill ${currentRole.id}`}>
              <span>{currentRole.icon}</span>
              <span>{currentRole.label} Account</span>
            </div>

            <h2>Sign in to Trackora</h2>
            <p className="sub">Enter your credentials for {currentRole.label} access</p>

            <Field label="Email address" error={errs.email}>
              <input
                type="email"
                value={v.email}
                onChange={set('email')}
                placeholder={`${currentRole.id}@demo.com`}
                autoComplete="email"
              />
            </Field>

            <Field label="Password" error={errs.password}>
              <input
                type="password"
                value={v.password}
                onChange={set('password')}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>

            <button className="btn block" disabled={busy}>
              {busy ? 'Signing in…' : `Sign in as ${currentRole.label}`}
            </button>

            {MOCK && (
              <div className="demo-quick-bar">
                <small>Quick demo credentials</small>
                <button type="button" className="demo-quick-btn" onClick={fillDemo}>
                  Auto-fill {currentRole.label}
                </button>
              </div>
            )}

            <p className="alt">
              Need a new account?{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setAction('register');
                  setErrs({});
                }}
              >
                Create account
              </button>
            </p>
          </form>
        )}

        {step === 'form' && action === 'register' && (
          <form onSubmit={handleRegisterSubmit} noValidate>
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => setStep('role')}
            >
              ← Back to account types
            </button>

            <div className={`role-badge-pill ${currentRole.id}`}>
              <span>{currentRole.icon}</span>
              <span>New {currentRole.label} Profile</span>
            </div>

            <h2>Create Account</h2>
            <p className="sub">Join Trackora as a {currentRole.label}</p>

            <Field label="Full name" error={errs.name}>
              <input
                value={v.name}
                onChange={set('name')}
                placeholder="e.g. John Doe"
              />
            </Field>

            <div className="grid2">
              <Field label="Email" error={errs.email}>
                <input
                  type="email"
                  value={v.email}
                  onChange={set('email')}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Phone number" error={errs.phone}>
                <input
                  inputMode="numeric"
                  maxLength={10}
                  value={v.phone}
                  onChange={set('phone')}
                  placeholder="10-digit phone"
                />
              </Field>
            </div>

            {selectedRole !== 'admin' && (
              <>
                <div className="grid2">
                  <Field label="State (All 36 States & UTs)" error={errs.state}>
                    <select
                      value={v.state}
                      onChange={(e) => {
                        const nextState = e.target.value;
                        setV((prev) => ({ ...prev, state: nextState, district: '' }));
                        setErrs((prev) => ({ ...prev, state: '' }));
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        background: '#ffffff',
                        width: '100%',
                      }}
                    >
                      <option value="">-- Select State / UT --</option>
                      {ALL_INDIAN_STATES.map((st) => {
                        const isOk = isRegionEligible(st, null, settings?.serviceable_regions);
                        return (
                          <option key={st} value={st}>
                            {st} {isOk ? '✓ (Eligible)' : '⚠️ (Service Unavailable)'}
                          </option>
                        );
                      })}
                    </select>
                  </Field>

                  <Field label="District" error={errs.district}>
                    <select
                      value={v.district}
                      onChange={(e) => {
                        setV((prev) => ({ ...prev, district: e.target.value }));
                        setErrs((prev) => ({ ...prev, district: '' }));
                      }}
                      disabled={!v.state}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        background: !v.state ? '#f1f5f9' : '#ffffff',
                        width: '100%',
                      }}
                    >
                      <option value="">{v.state ? '-- Select District --' : '-- Choose State first --'}</option>
                      {(v.state && INDIA_STATES_DATA[v.state] ? INDIA_STATES_DATA[v.state] : []).map((dist) => {
                        const isDistOk = isRegionEligible(v.state, dist, settings?.serviceable_regions);
                        return (
                          <option key={dist} value={dist}>
                            {dist} {isDistOk ? '' : '(Pending Approval)'}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                </div>

                {v.state && !isRegionEligible(v.state, null, settings?.serviceable_regions) && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#991b1b', fontSize: '0.82rem' }}>
                    <b>⚠️ State Restricted:</b> Delivery operations are not yet enabled in <b>{v.state}</b>. Only admin-approved states can create an account.
                  </div>
                )}
                {v.state && v.district && isRegionEligible(v.state, null, settings?.serviceable_regions) && !isRegionEligible(v.state, v.district, settings?.serviceable_regions) && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#92400e', fontSize: '0.82rem' }}>
                    <b>⚠️ District Pending Approval:</b> <b>{v.district}</b> ({v.state}) is currently pending admin operational approval. Please select an approved district.
                  </div>
                )}
              </>
            )}

            {selectedRole === 'agent' && (
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #fed7aa', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#c2410c', fontWeight: 800, fontSize: '0.88rem' }}>
                  <span>🛵</span> Delivery Courier Profile (Required for Admin Approval)
                </div>

                <div className="grid2">
                  <Field label="Vehicle Type" error={errs.vehicleType}>
                    <select
                      value={v.vehicleType || 'Bike'}
                      onChange={set('vehicleType')}
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.92rem', background: '#fff', width: '100%' }}
                    >
                      <option value="Bike">Motorcycle / Bike</option>
                      <option value="Scooter">Scooter / Activa</option>
                      <option value="Electric Scooter">Electric Two-Wheeler (EV)</option>
                      <option value="Van">Delivery Van / 3-Wheeler</option>
                      <option value="Bicycle">Bicycle</option>
                    </select>
                  </Field>

                  <Field label="Vehicle Reg. Number" error={errs.vehicleNumber}>
                    <input
                      value={v.vehicleNumber || ''}
                      onChange={set('vehicleNumber')}
                      placeholder="e.g. DL 01 AB 1234"
                    />
                  </Field>
                </div>

                <div className="grid2">
                  <Field label="Driving License Number" error={errs.drivingLicense}>
                    <input
                      value={v.drivingLicense || ''}
                      onChange={set('drivingLicense')}
                      placeholder="e.g. DL-1420110012345"
                    />
                  </Field>

                  <Field label="Delivery Experience" error={errs.experienceYears}>
                    <select
                      value={v.experienceYears || '1-2 Years'}
                      onChange={set('experienceYears')}
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.92rem', background: '#fff', width: '100%' }}
                    >
                      <option value="Fresher">Fresher / New to Courier</option>
                      <option value="1-2 Years">1 - 2 Years</option>
                      <option value="3-5 Years">3 - 5 Years</option>
                      <option value="5+ Years">5+ Years Experience</option>
                    </select>
                  </Field>
                </div>

                <Field label="Emergency Contact (Name & Phone)" error={errs.emergencyContact}>
                  <input
                    value={v.emergencyContact || ''}
                    onChange={set('emergencyContact')}
                    placeholder="e.g. Relative / Contact - 9876543210"
                  />
                </Field>
              </div>
            )}

            <Field label="Password" error={errs.password}>
              <input
                type="password"
                value={v.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Field>

            {/* Privacy Policy & Terms and Conditions Checkbox */}
            <div
              className="auth-terms-box"
              style={{
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${errs.terms ? '#fca5a5' : '#cbd5e1'}`,
                marginTop: 14,
                marginBottom: 16,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    if (e.target.checked) setErrs((prev) => ({ ...prev, terms: '' }));
                  }}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.45 }}>
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDocType('privacy'); setShowLegalModal(true); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}
                  >
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDocType('terms'); setShowLegalModal(true); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}
                  >
                    Terms & Conditions
                  </button>.
                </span>
              </label>
              {errs.terms && (
                <p style={{ margin: '6px 0 0', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>
                  ⚠️ {errs.terms}
                </p>
              )}
            </div>

            <button className="btn block" disabled={busy}>
              {busy ? 'Creating…' : `Register as ${currentRole.label}`}
            </button>

            <p className="alt">
              Already have an account?{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setAction('signin');
                  if (MOCK) {
                    setV({
                      name: '',
                      email: currentRole.demoEmail,
                      password: currentRole.demoPassword,
                      phone: ''
                    });
                  }
                  setErrs({});
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {showLegalModal && (
          <Modal
            title={legalDocType === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
            onClose={() => setShowLegalModal(false)}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Trackora Logistics Services
                </span>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setAgreeTerms(true);
                    setErrs((prev) => ({ ...prev, terms: '' }));
                    setShowLegalModal(false);
                  }}
                >
                  ✓ I Agree & Accept
                </button>
              </div>
            }
          >
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 6px', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              {legalDocType === 'privacy' ? (
                settings?.privacy_policy ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{settings.privacy_policy}</div>
                ) : (
                  <div>
                    <h4 style={{ margin: '0 0 8px', color: '#0f172a' }}>Privacy Policy — Trackora</h4>
                    <p>We respect your privacy and are committed to protecting personal data collected across our parcel tracking, consignment booking, and delivery platform.</p>
                    <p><strong>1. Information We Collect:</strong> We collect contact details (name, email, phone number) and consignment pickup and drop addresses to fulfill delivery requests.</p>
                    <p><strong>2. Location Services:</strong> Couriers and customers broadcast live location strictly during active deliveries to ensure turn-by-turn road visibility and accurate delivery ETAs.</p>
                    <p><strong>3. Payment Security:</strong> Payment information is processed via secure banking channels. We never sell your personal data to third parties.</p>
                  </div>
                )
              ) : (
                settings?.terms_and_conditions ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{settings.terms_and_conditions}</div>
                ) : (
                  <div>
                    <h4 style={{ margin: '0 0 8px', color: '#0f172a' }}>Terms & Conditions — Trackora</h4>
                    <p>By registering or using Trackora, you agree to comply with our platform policies and delivery service standards.</p>
                    <p><strong>1. Courier Obligations:</strong> Registered delivery agents must maintain a valid driving license, operational vehicle, and verify consignments with due care.</p>
                    <p><strong>2. Consignment Care:</strong> Prohibited or illegal goods may not be booked for transport. Fees are determined by minimum distance boundary and freight rates.</p>
                    <p><strong>3. Administrative Review:</strong> Delivery agent accounts require administrative verification and approval prior to activation.</p>
                  </div>
                )
              )}
            </div>
          </Modal>
        )}
        <Footer />
      </section>
    </div>
  );
}

export function Login() {
  return <AuthFlow initialAction="signin" />;
}

export function Register() {
  return <AuthFlow initialAction="register" />;
}
