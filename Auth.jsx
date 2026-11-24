import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Field } from '../../components/UI';
import { homeFor, rules, validate, MOCK } from '../../utils/helpers';
import { ALL_INDIAN_STATES, INDIA_STATES_DATA, isRegionEligible } from '../../utils/indiaGeoData';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import Footer from '../../components/Footer';

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
  }
];

function AuthFlow({ initialAction = 'signin' }) {
  const { user, login, register, toast, settings } = useApp();
  const nav = useNavigate();

  // step: 'action' (Sign In or Create Account) -> 'role' (Customer, Agent, Admin) -> 'form'
  const [step, setStep] = useState('action');
  const [action, setAction] = useState(initialAction); // 'signin' | 'register'
  const [selectedRole, setSelectedRole] = useState('user');

  const [v, setV] = useState({ name: '', email: '', phone: '', password: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

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
      });
    } else {
      setV({ name: '', email: '', phone: '', password: '', state: '', district: '' });
    }
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
      const u = await register({ ...v, role: selectedRole });
      toast('Account created successfully!', 'success');
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
              {ROLES.map((r) => (
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

            <Field label="Password" error={errs.password}>
              <input
                type="password"
                value={v.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Field>

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
