import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import useLiveData from '../../hooks/useLiveData';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import MapView from '../../components/MapView';
import AssignAgentModal from '../../components/AssignAgentModal';
import { DEFAULT_OFFER, DEFAULT_PRICING, STATUSES, computeStats, durH, evaluateDeliveryOffer, fmtDate, getPricing, rules, series, validate } from '../../utils/helpers';
import OfferBanner from '../../components/OfferBanner';
import AdminOfferEditor from '../../components/AdminOfferEditor';
import { PageHead, Spinner, ErrorBox, StatCard, Icon, Empty, Tilt, Field } from '../../components/UI';

const SC = ['#9aa3b2', '#d97706', '#2563eb', '#16a34a'];
const fetchAll = () => Promise.all([api.listOrders(), api.listUsers(), api.getPricing().catch(() => DEFAULT_PRICING)]);

export function AdminDashboard() {
  const { data, loading, error, reload } = useLiveData(fetchAll, []);
  const { toast, socket } = useApp() || {};
  const [logo, setLogo] = useState(() => {
    try {
      return localStorage.getItem('trackora_custom_logo') || null;
    } catch {
      return null;
    }
  });
  const [pricing, setPricing] = useState(() => getPricing());
  const [savingPricing, setSavingPricing] = useState(false);
  const [simDist, setSimDist] = useState(8);
  const [offer, setOffer] = useState(() => (pricing?.delivery_offer ? { ...DEFAULT_OFFER, ...pricing.delivery_offer } : DEFAULT_OFFER));
  const [savingOffer, setSavingOffer] = useState(false);

  useEffect(() => {
    if (data && data[2]) {
      setPricing(data[2]);
      if (data[2].delivery_offer) {
        setOffer({ ...DEFAULT_OFFER, ...data[2].delivery_offer });
      }
    }
  }, [data]);

  // Real-time socket sync for Admin
  useEffect(() => {
    if (!socket) return;
    const handleOfferUpdated = (updated) => {
      if (updated) {
        setOffer({ ...DEFAULT_OFFER, ...updated });
      }
    };
    socket.on('offerUpdated', handleOfferUpdated);
    return () => {
      socket.off('offerUpdated', handleOfferUpdated);
    };
  }, [socket]);

  const toDatetimeLocal = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (offer.active) {
      if (offer.type === 'timed_window') {
        if (!offer.end_date) {
          toast('Please select an expiration end date and time.', 'error');
          return;
        }
        const end = new Date(offer.end_date).getTime();
        const start = offer.start_date ? new Date(offer.start_date).getTime() : 0;
        if (end <= Date.now()) {
          toast('Offer end date/time has already passed. Please choose a future expiration date/time.', 'error');
          return;
        }
        if (start && end <= start) {
          toast('Offer end date/time must be strictly after the start date/time.', 'error');
          return;
        }
      }
    }

    setSavingOffer(true);
    try {
      const payload = {
        active: Boolean(offer.active),
        type: offer.type || 'none',
        min_amount: Math.max(0, Number(offer.min_amount) || 0),
        start_date: offer.start_date ? new Date(offer.start_date).toISOString() : null,
        end_date: offer.end_date ? new Date(offer.end_date).toISOString() : null,
        title: (offer.title || '').trim(),
        banner_text: (offer.banner_text || '').trim(),
      };
      await api.saveOffer(payload);
      toast('Delivery offer published! User dashboard banner and order fees updated.', 'success');
      reload();
    } catch (err) {
      toast(err.message || 'Failed to save offer', 'error');
    } finally {
      setSavingOffer(false);
    }
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      await api.savePricing(pricing);
      toast('Delivery & cancellation fee rates saved successfully!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save pricing', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const handleUploadLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('Please upload an image under 3MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setLogo(dataUrl);
      try {
        localStorage.setItem('trackora_custom_logo', dataUrl);
        toast('Portal logo uploaded successfully! It is now live on the login page.', 'success');
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setLogo(null);
    try {
      localStorage.removeItem('trackora_custom_logo');
      toast('Custom logo removed. Default Trackora logo restored.', 'info');
    } catch {}
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox msg={error} retry={reload} />;
  const [orders, users] = data;
  const s = computeStats(orders);
  const to = new Date(), from = new Date(); from.setDate(to.getDate() - 6);
  const perDay = series(orders, from, to);
  const pie = STATUSES.map((x) => ({ name: x, value: orders.filter((o) => o.status === x).length }));
  const agents = users.filter((u) => u.role === 'agent').map((a) => ({ name: a.name.split(' ')[0], delivered: orders.filter((o) => o.agentId === a.id && o.status === 'Delivered').length }));
  return (
    <>
      <PageHead title="Operations overview" sub="Live numbers across all deliveries">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/admin/regions" className="btn sm" style={{ background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>📍 Serviceable States & Districts</span>
          </Link>
          <Link to="/admin/offers" className="btn sm" style={{ background: '#059669', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon n="gift" size={16} />
            <span>🎁 Manage Delivery Offers</span>
          </Link>
        </div>
      </PageHead>
      <div className="card admin-branding-card" style={{ marginBottom: 18 }}>
        <div className="admin-branding-header">
          <div className="admin-branding-left">
            <div className="admin-logo-preview-round">
              {logo ? (
                <img src={logo} alt="Portal Logo" className="admin-logo-preview-img" />
              ) : (
                <div className="admin-logo-preview-placeholder">T</div>
              )}
            </div>
            <div className="admin-branding-text">
              <h3>Portal & Login Logo</h3>
              <p>Upload your company logo. This logo appears in the round shape on the login page and console.</p>
            </div>
          </div>
          <div className="admin-branding-actions">
            <label className="btn sm">
              Upload Logo
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadLogo}
                style={{ display: 'none' }}
              />
            </label>
            {logo && (
              <button type="button" className="btn sm ghost" onClick={handleResetLogo}>
                Reset to Default
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card admin-pricing-card" style={{ marginBottom: 18, borderRadius: 16 }}>
        <div className="admin-pricing-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Delivery Distance Boundary & Fee Configuration
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
              Set minimum distance boundary, base delivery fee, per-km charge for extra distance, and weight tiers.
            </p>
          </div>
          <button
            type="button"
            className="btn sm ghost"
            onClick={async () => {
              setPricing(DEFAULT_PRICING);
              await api.savePricing(DEFAULT_PRICING);
              toast('Reset fee rates to defaults', 'info');
            }}
          >
            Reset Defaults
          </button>
        </div>

        <form onSubmit={handleSavePricing} className="admin-pricing-form">
          {/* SECTION 1: DISTANCE BOUNDARY & PER-KM SURCHARGE */}
          <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📏</span> Minimum Distance Boundary & Extra Distance Rates
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
              Parcels within the minimum distance boundary are charged the base fee. If destination exceeds this boundary, the extra kilometers are charged at the specified per-km rate.
            </p>

            <div className="admin-pricing-grid">
              <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#3b82f6' }}>
                <label style={{ color: '#1e40af', fontWeight: 800 }}>Minimum Base Distance (km)</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 700 }}>km</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={pricing.base_distance_km ?? 5}
                    onChange={(e) => setPricing((p) => ({ ...p, base_distance_km: Math.max(0.5, Number(e.target.value) || 0) }))}
                    required
                  />
                </div>
                <span className="pricing-hint">Base boundary covered under minimum fee (e.g. 5 km)</span>
              </div>

              <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#10b981' }}>
                <label style={{ color: '#065f46', fontWeight: 800 }}>Minimum Distance Delivery Fee</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={pricing.min_distance_fee ?? 50}
                    onChange={(e) => setPricing((p) => ({ ...p, min_distance_fee: Math.max(0, Number(e.target.value) || 0) }))}
                    required
                  />
                </div>
                <span className="pricing-hint">Flat delivery fee for any trip within base distance</span>
              </div>

              <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#f59e0b' }}>
                <label style={{ color: '#92400e', fontWeight: 800 }}>Extra Distance Rate (₹ / km)</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix" style={{ background: '#fffbeb', color: '#d97706', fontWeight: 700 }}>₹/km</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={pricing.extra_per_km ?? 12}
                    onChange={(e) => setPricing((p) => ({ ...p, extra_per_km: Math.max(0, Number(e.target.value) || 0) }))}
                    required
                  />
                </div>
                <span className="pricing-hint">Charged per extra km exceeding the base boundary</span>
              </div>
            </div>

            {/* LIVE DISTANCE PRICING SIMULATOR */}
            <div style={{ marginTop: 16, background: '#ffffff', padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🧮</span> Interactive Pricing Calculator & Simulator:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Test Distance:</span>
                  <input
                    type="number"
                    min="0.5"
                    max="150"
                    step="0.5"
                    value={simDist}
                    onChange={(e) => setSimDist(Math.max(0.5, Number(e.target.value) || 0.5))}
                    style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid #94a3b8', fontSize: 13, fontWeight: 700, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>km</span>
                </div>
              </div>

              {(() => {
                const bDist = Number(pricing.base_distance_km) || 5;
                const mFee = Number(pricing.min_distance_fee) || 50;
                const pKm = Number(pricing.extra_per_km) || 12;
                const isOver = simDist > bDist;
                const extraKm = Math.max(0, +(simDist - bDist).toFixed(1));
                const extraCharge = Math.ceil(extraKm * pKm);
                const totalFee = mFee + extraCharge;

                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: isOver ? '#fffbeb' : '#ecfdf5', padding: '10px 14px', borderRadius: 8, border: `1px solid ${isOver ? '#fde68a' : '#a7f3d0'}` }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: isOver ? '#92400e' : '#065f46' }}>
                        {isOver ? `⚡ Beyond ${bDist} km Boundary (${extraKm} km extra)` : `🟢 Within ${bDist} km Boundary`}
                      </span>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        Base fee: ₹{mFee} (covers up to {bDist} km)
                        {isOver ? ` + Extra ${extraKm} km × ₹${pKm}/km = +₹${extraCharge}` : ' (No extra distance charge)'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: isOver ? '#b45309' : '#059669' }}>
                        ₹{totalFee}
                      </span>
                      <small style={{ display: 'block', fontSize: 11, color: '#64748b' }}>Delivery Charge</small>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SECTION 2: WEIGHT TIERS & CANCELLATION FEE */}
          <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
            ⚖️ Weight Brackets & Cancellation Penalty
          </h4>
          <div className="admin-pricing-grid">
            <div className="pricing-field-box">
              <label>Under 1 kg Base Rate</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.under_1kg}
                  onChange={(e) => setPricing((p) => ({ ...p, under_1kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Small parcels / pouches (&lt; 1 kg)</span>
            </div>

            <div className="pricing-field-box">
              <label>1 kg to 5 kg Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.tier_1_to_5kg}
                  onChange={(e) => setPricing((p) => ({ ...p, tier_1_to_5kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Medium cartons (1 kg - 5 kg)</span>
            </div>

            <div className="pricing-field-box">
              <label>5 kg+ Heavy Parcel Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.tier_above_5kg}
                  onChange={(e) => setPricing((p) => ({ ...p, tier_above_5kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Heavy / bulk cargo (&gt; 5 kg)</span>
            </div>

            <div className="pricing-field-box alert-box">
              <label>Order Cancellation Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.cancellation_fee}
                  onChange={(e) => setPricing((p) => ({ ...p, cancellation_fee: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Charged if customer cancels unverified order</span>
            </div>
          </div>

          <div className="admin-pricing-footer" style={{ marginTop: 18 }}>
            <button type="submit" className="btn sm" disabled={savingPricing} style={{ padding: '10px 24px', fontWeight: 800 }}>
              {savingPricing ? 'Saving Rates…' : 'Save Pricing Rates'}
            </button>
          </div>
        </form>
      </div>

      {/* Admin Delivery Offers & Promotions Card */}
      <AdminOfferEditor onOfferSaved={reload} />
      <div className="stats five">
        <StatCard label="On-time rate" value={`${s.onTime}%`} icon="check" tone="green" />
        <StatCard label="Avg. duration" value={`${s.avg} h`} icon="clock" tone="blue" />
        <StatCard label="Active deliveries" value={s.active} icon="truck" tone="red" />
        <StatCard label="Total orders" value={s.total} icon="box" tone="dark" />
        <StatCard label="Satisfaction" value={`${s.csat}/5`} icon="star" tone="amber" />
      </div>
      <div className="charts">
        <div className="card wide"><h3>Orders · last 7 days</h3>
          <ResponsiveContainer width="100%" height={260}><AreaChart data={perDay}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8212f" stopOpacity={0.35} /><stop offset="100%" stopColor="#e8212f" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7ec" /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} /><Tooltip />
            <Area type="monotone" dataKey="orders" stroke="#e8212f" strokeWidth={3} fill="url(#g)" name="Placed" /><Area type="monotone" dataKey="delivered" stroke="#15171d" strokeWidth={2} fill="none" name="Delivered" />
          </AreaChart></ResponsiveContainer></div>
        <div className="card"><h3>Status split</h3>
          <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{pie.map((_, i) => <Cell key={i} fill={SC[i]} />)}</Pie><Tooltip /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div>
        <div className="card wide"><h3>Deliveries by agent</h3>
          <ResponsiveContainer width="100%" height={220}><BarChart data={agents}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7ec" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} /><Tooltip /><Bar dataKey="delivered" fill="#15171d" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </div>
    </>
  );
}

export function ManageOrders() {
  const nav = useNavigate();
  const { toast } = useApp();
  const { data, loading, error, reload } = useLiveData(() => api.listOrders(), []);
  const [q, setQ] = useState(''), [st, setSt] = useState('All'), [target, setTarget] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const rows = useMemo(() => (data || []).filter((o) => (st === 'All' || o.status === st) && (!q || `${o.id} ${o.userName} ${o.agentName || ''} ${o.drop.address}`.toLowerCase().includes(q.toLowerCase()))), [data, q, st]);

  const handleDeleteSingleOrder = async () => {
    if (!deletingOrder) return;
    setBusyDelete(true);
    try {
      await api.deleteOrder(deletingOrder.id);
      toast(`Order ${deletingOrder.id} deleted successfully`, 'success');
      setDeletingOrder(null);
      await reload();
    } catch (err) {
      toast(err.message || 'Failed to delete order', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const handleDeleteAllOrders = async () => {
    setBusyDelete(true);
    try {
      const res = await api.deleteAllOrders();
      toast(`All orders (${res?.deletedCount ?? 'all'}) deleted successfully`, 'success');
      setShowDeleteAllModal(false);
      await reload();
    } catch (err) {
      toast(err.message || 'Failed to delete all orders', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const cols = [
    { key: 'id', header: 'Order', render: (o) => <b>{o.id}</b> },
    { key: 'userName', header: 'Customer' },
    { key: 'route', header: 'Route', render: (o) => <span className="route-cell">{o.pickup?.address ? o.pickup.address.split(',')[0] : 'Pickup'} → {o.drop?.address ? o.drop.address.split(',')[0] : 'Drop'}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    {
      key: 'payment',
      header: 'Fee & Payment',
      render: (o) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>₹{o.deliveryFee || 40} <span style={{ color: 'var(--muted, #6b7280)', fontWeight: 400, fontSize: 11 }}>({o.weight}kg)</span></span>
          {o.paymentStatus === 'verified' && <span className="badge verified" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Paid & Verified</span>}
          {o.paymentStatus === 'pending_verification' && <span className="badge warning" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Verify Payment</span>}
          {(o.paymentStatus === 'not_verified' || o.agentDisputed) && <span className="badge danger" style={{ fontSize: 10, alignSelf: 'flex-start' }}>⚠️ Payment Not Verified by Agent</span>}
          {o.paymentStatus === 'pay_on_pickup' && <span className="badge info" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Pay on Pickup</span>}
          {o.paymentStatus === 'cancelled' && <span className="badge cancelled" style={{ fontSize: 10, alignSelf: 'flex-start' }}>Cancelled</span>}
        </div>
      ),
    },
    { key: 'agent', header: 'Agent', render: (o) => o.agentName || <span className="muted">Unassigned</span> },
    {
      key: 'act',
      header: 'Actions',
      render: (o) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
          {/* Button 1: View */}
          <Link
            to={`/admin/orders/${o.id}`}
            style={{
              padding: '5px 11px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <span>👁️</span> View
          </Link>

          {/* Button 2: Assign / Reassign */}
          {o.status !== 'Delivered' && o.status !== 'Cancelled' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTarget(o);
              }}
              style={{
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                background: o.agentId ? '#faf5ff' : '#ecfdf5',
                color: o.agentId ? '#7e22ce' : '#047857',
                border: `1px solid ${o.agentId ? '#e9d5ff' : '#a7f3d0'}`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🛵</span> {o.agentId ? 'Reassign' : 'Assign'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              style={{
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: '#f8fafc',
                color: '#94a3b8',
                border: '1px solid #e2e8f0',
                cursor: 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{o.status === 'Delivered' ? '✓' : '✕'}</span> {o.status}
            </button>
          )}

          {/* Button 3: Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingOrder(o);
            }}
            style={{
              padding: '5px 11px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      ),
    },
  ];
  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead title="Manage orders" sub={`${data?.length ?? 0} orders in the system`}>
        {data && data.length > 0 && (
          <button
            type="button"
            className="btn sm"
            style={{
              background: '#dc2626',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
            }}
            onClick={() => setShowDeleteAllModal(true)}
          >
            <Icon n="trash" size={16} /> Delete All Orders
          </button>
        )}
      </PageHead>
      <div className="filters card">
        <div className="search"><Icon n="search" size={18} /><input placeholder="Search order, customer, agent, address" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={st} onChange={(e) => setSt(e.target.value)}>{['All', ...STATUSES].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="card"><DataTable columns={cols} rows={rows} loading={loading} onRowClick={(o) => nav(`/admin/orders/${o.id}`)} empty="No orders match" hint="Clear the search or filter." /></div>
      {target && <AssignAgentModal order={target} onClose={() => setTarget(null)} onDone={reload} />}

      {/* Single Order Delete Confirmation Modal */}
      {deletingOrder && (
        <Modal
          title={`Delete Order ${deletingOrder.id}?`}
          onClose={() => setDeletingOrder(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDeletingOrder(null)}>Cancel</button>
              <button className="btn danger" disabled={busyDelete} onClick={handleDeleteSingleOrder}>
                {busyDelete ? 'Deleting…' : 'Delete Order'}
              </button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>
            Are you sure you want to permanently delete order <b>{deletingOrder.id}</b> placed by <b>{deletingOrder.userName}</b>?
          </p>
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            ⚠️ This order and its entire tracking history will be permanently deleted from the system.
          </div>
        </Modal>
      )}

      {/* Central Bulk Delete All Orders Modal */}
      {showDeleteAllModal && (
        <Modal
          title="⚠️ Delete All Orders in System?"
          onClose={() => setShowDeleteAllModal(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setShowDeleteAllModal(false)}>Cancel</button>
              <button className="btn danger" disabled={busyDelete} onClick={handleDeleteAllOrders}>
                {busyDelete ? 'Deleting All…' : `Yes, Delete All ${data?.length || 0} Orders`}
              </button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>
            This action will permanently delete <b>all {data?.length || 0} orders</b> from the database.
          </p>
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            🚨 <b>Warning:</b> This bulk action is irreversible. All active, in-transit, and completed orders will be wiped immediately.
          </div>
        </Modal>
      )}
    </>
  );
}

export function ManageUsers() {
  const { toast, user: me } = useApp();
  const { data, loading, error, reload } = useLiveData(() => api.listUsers(), []);
  const [role, setRole] = useState('user'); // Default to 'user' (Customers)
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const customers = useMemo(() => (data || []).filter((u) => u.role === 'user'), [data]);
  const agents = useMemo(() => (data || []).filter((u) => u.role === 'agent'), [data]);
  const admins = useMemo(() => (data || []).filter((u) => u.role === 'admin'), [data]);

  const rows = useMemo(() => (data || []).filter((u) => (role === 'all' || u.role === role) && (!q || `${u.name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(q.toLowerCase()))), [data, role, q]);
  const act = async (fn, msg) => { try { await fn(); toast(msg, 'success'); reload(); } catch (e) { toast(e.message, 'error'); } };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setBusyDelete(true);
    try {
      await api.deleteUser(deletingUser.id);
      toast(`${deletingUser.role === 'agent' ? 'Delivery Agent' : 'Customer'} "${deletingUser.name}" deleted successfully`, 'success');
      setDeletingUser(null);
      await reload();
    } catch (e) {
      toast(e.message || 'Failed to delete user', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const cols = [
    { key: 'name', header: 'Name', render: (u) => <div className="who"><span className="avatar">{u.name[0]}</span><div><b>{u.name}</b><small>{u.email}</small></div></div> },
    { key: 'role', header: 'Role', render: (u) => (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          background: u.role === 'agent' ? '#fdf4ff' : u.role === 'admin' ? '#eff6ff' : '#f0fdf4',
          color: u.role === 'agent' ? '#86198f' : u.role === 'admin' ? '#1e40af' : '#166534',
          border: `1px solid ${u.role === 'agent' ? '#f0abfc' : u.role === 'admin' ? '#bfdbfe' : '#bbf7d0'}`,
        }}
      >
        {u.role === 'agent' ? '🛵 Delivery Agent' : u.role === 'admin' ? '🛡️ Admin' : '👤 Customer'}
      </span>
    )},
    { key: 'phone', header: 'Phone', render: (u) => u.phone || <span className="muted">—</span> },
    { key: 'active', header: 'Status', render: (u) => <span className={`pill ${u.active ? 'on' : 'off'}`}>{u.active ? 'Active' : 'Inactive'}</span> },
    { key: 'act', header: 'Actions', render: (u) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
        <button
          type="button"
          onClick={() => setForm({ ...u, password: '' })}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>✏️</span> Edit
        </button>
        {u.id !== me.id && (
          <button
            type="button"
            onClick={() => act(() => api.toggleUser(u.id), u.active ? 'User deactivated' : 'User activated')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              background: u.active ? '#fffbeb' : '#f0fdf4',
              color: u.active ? '#b45309' : '#15803d',
              border: `1px solid ${u.active ? '#fde68a' : '#bbf7d0'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{u.active ? '⏸' : '▶'}</span> {u.active ? 'Deactivate' : 'Activate'}
          </button>
        )}
        {u.id !== me.id && (
          <button
            type="button"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={() => setDeletingUser(u)}
          >
            <span>🗑️</span> Delete
          </button>
        )}
      </div>) },
  ];
  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead
        title={role === 'user' ? 'Customers' : role === 'agent' ? 'Delivery Agents' : role === 'admin' ? 'Administrators' : 'Users & Agents'}
        sub={role === 'user' ? `${customers.length} registered customers` : role === 'agent' ? `${agents.length} active delivery agents` : 'Create, edit and control access'}
      >
        <button
          className="btn"
          onClick={() => setForm({ name: '', email: '', phone: '', role: role === 'all' ? 'user' : role, password: '' })}
        >
          <Icon n="plus" size={18} />
          {role === 'user' ? 'Add Customer' : role === 'agent' ? 'Add Delivery Agent' : 'Add Account'}
        </button>
      </PageHead>

      {/* Segmented Role Tabs for separating Customers and Delivery Agents */}
      <div className="tabs" style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`tab ${role === 'user' ? 'active' : ''}`}
          onClick={() => setRole('user')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <span>👤 Customers</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: role === 'user' ? '#15171d' : '#f1f5f9', color: role === 'user' ? '#fff' : '#475569' }}>
            {customers.length}
          </span>
        </button>

        <button
          type="button"
          className={`tab ${role === 'agent' ? 'active' : ''}`}
          onClick={() => setRole('agent')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <span>🛵 Delivery Agents</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: role === 'agent' ? '#15171d' : '#f1f5f9', color: role === 'agent' ? '#fff' : '#475569' }}>
            {agents.length}
          </span>
        </button>

        <button
          type="button"
          className={`tab ${role === 'admin' ? 'active' : ''}`}
          onClick={() => setRole('admin')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <span>🛡️ Admins</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: role === 'admin' ? '#15171d' : '#f1f5f9', color: role === 'admin' ? '#fff' : '#475569' }}>
            {admins.length}
          </span>
        </button>

        <button
          type="button"
          className={`tab ${role === 'all' ? 'active' : ''}`}
          onClick={() => setRole('all')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <span>All Accounts</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: role === 'all' ? '#15171d' : '#f1f5f9', color: role === 'all' ? '#fff' : '#475569' }}>
            {data?.length || 0}
          </span>
        </button>
      </div>

      <div className="filters card">
        <div className="search"><Icon n="search" size={18} /><input placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">Customers Only</option>
          <option value="agent">Delivery Agents Only</option>
          <option value="admin">Admins Only</option>
          <option value="all">All Roles</option>
        </select>
      </div>
      <div className="card"><DataTable columns={cols} rows={rows} loading={loading} empty={`No ${role === 'user' ? 'customers' : role === 'agent' ? 'delivery agents' : 'users'} found`} /></div>
      {form && <UserForm init={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <Modal
          title={`Delete ${deletingUser.role === 'agent' ? 'Delivery Agent' : 'Customer'}?`}
          onClose={() => setDeletingUser(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDeletingUser(null)}>Cancel</button>
              <button className="btn danger" disabled={busyDelete} onClick={handleDeleteUser}>
                {busyDelete ? 'Deleting…' : 'Delete Account'}
              </button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>
            Are you sure you want to permanently delete <b>{deletingUser.name}</b> (<code>{deletingUser.email}</code>)?
          </p>
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            ⚠️ This action is permanent. This {deletingUser.role === 'agent' ? 'agent' : 'user'} will be removed and will no longer be able to log in.
          </div>
        </Modal>
      )}
    </>
  );
}

function UserForm({ init, onClose, onSaved }) {
  const { toast } = useApp();
  const [v, setV] = useState(init), [errs, setErrs] = useState({}), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async () => {
    const er = validate(v, { name: rules.min('Name', 2), email: rules.email, phone: rules.phone, ...(v.id ? {} : { password: rules.password }) });
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true);
    try { await api.saveUser(v); toast(v.id ? 'User updated' : 'User created', 'success'); onSaved(); }
    catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  return (
    <Modal title={v.id ? 'Edit user' : 'Add user'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <Field label="Full name" error={errs.name}><input value={v.name} onChange={set('name')} /></Field>
      <div className="grid2"><Field label="Email" error={errs.email}><input type="email" value={v.email} onChange={set('email')} /></Field><Field label="Phone" error={errs.phone}><input maxLength={10} value={v.phone} onChange={set('phone')} /></Field></div>
      <div className="grid2"><Field label="Role"><select value={v.role} onChange={set('role')}><option value="user">Customer</option><option value="agent">Delivery agent</option><option value="admin">Admin</option></select></Field>
        <Field label={v.id ? 'New password (optional)' : 'Password'} error={errs.password}><input type="password" value={v.password} onChange={set('password')} /></Field></div>
    </Modal>
  );
}

export function LiveMonitor() {
  const { socket } = useApp();
  const { data, loading, error, reload } = useLiveData(() => api.listOrders(), []);
  const [locs, setLocs] = useState({});
  useEffect(() => {
    const f = (p) => setLocs((l) => ({ ...l, [p.orderId]: { lat: p.lat, lng: p.lng } }));
    socket.on('agentLocationUpdated', f);
    return () => socket.off('agentLocationUpdated', f);
  }, [socket]);
  const active = useMemo(() => (data || []).filter((o) => o.status === 'Picked-up' || o.status === 'In-Transit'), [data]);
  const markers = useMemo(() => {
    const list = [];
    active.forEach((o) => {
      const p = locs[o.id] || o.agentLoc;
      if (p) {
        list.push({
          id: `agent-${o.id}`,
          lat: p.lat,
          lng: p.lng,
          type: 'agent',
          label: `${o.agentName} (🛵)`,
          title: `Courier: ${o.agentName} (#${o.id})`,
          address: `Heading to: ${o.drop?.address || ''}`,
          phone: o.agentPhone,
          details: `${o.status} · Delivering to ${o.userName}`,
        });
      }
      if (o.drop && o.drop.lat && o.drop.lng) {
        list.push({
          id: `drop-${o.id}`,
          lat: o.drop.lat,
          lng: o.drop.lng,
          type: 'drop',
          label: `${o.userName} (🏠)`,
          title: `Destination: ${o.userName} (#${o.id})`,
          address: o.drop.address,
          details: `Order #${o.id} drop point`,
        });
      }
    });
    return list;
  }, [active, locs]);
  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead title="Live monitoring" sub="Agent positions update in real time"><span className="live big"><i />{markers.length} live</span></PageHead>
      {loading ? <Spinner /> : (
        <div className="live-grid">
          <div className="card map-card"><MapView markers={markers} height={560} /></div>
          <div className="card side-list"><h3>Active deliveries</h3>
            {active.length === 0 ? <p className="muted">Nothing on the road right now.</p> : active.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="li"><div><b>{o.id}</b><small>{o.agentName} → {o.drop?.address ? o.drop.address.split(',')[0] : 'Drop'}</small></div><StatusBadge status={o.status} /></Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function Reports() {
  const { data, loading, error, reload } = useLiveData(fetchAll, []);
  const iso = (d) => d.toISOString().slice(0, 10);
  const t = new Date(), f = new Date(); f.setDate(t.getDate() - 29);
  const [from, setFrom] = useState(iso(f)), [to, setTo] = useState(iso(t));
  const [orders, users] = data || [[], []];
  const inRange = useMemo(() => orders.filter((o) => { const d = new Date(o.createdAt); return d >= new Date(from) && d <= new Date(`${to}T23:59:59`); }), [orders, from, to]);
  const s = computeStats(inRange);
  const perDay = useMemo(() => series(inRange, from, to), [inRange, from, to]);
  const perAgent = useMemo(() => users.filter((u) => u.role === 'agent').map((a) => {
    const mine = inRange.filter((o) => o.agentId === a.id), del = mine.filter((o) => o.status === 'Delivered'), st = computeStats(mine);
    return { id: a.id, name: a.name, assigned: mine.length, delivered: del.length, onTime: st.onTime, avg: st.avg, csat: st.csat };
  }), [inRange, users]);
  const exportCsv = () => {
    const head = 'Agent,Assigned,Delivered,OnTime%,AvgHours,Rating';
    const body = perAgent.map((a) => [a.name, a.assigned, a.delivered, a.onTime, a.avg, a.csat].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `report_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cols = [
    { key: 'name', header: 'Agent', render: (a) => <b>{a.name}</b> }, { key: 'assigned', header: 'Assigned' }, { key: 'delivered', header: 'Delivered' },
    { key: 'onTime', header: 'On-time', render: (a) => `${a.onTime}%` }, { key: 'avg', header: 'Avg. hours' }, { key: 'csat', header: 'Rating', render: (a) => a.csat || '—' },
  ];
  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead title="Performance reports" sub="Filter by order date"><button className="btn ghost" onClick={exportCsv} disabled={!perAgent.length}>Export CSV</button></PageHead>
      <div className="filters card">
        <label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        {[7, 30, 90].map((n) => <button key={n} className="btn ghost sm" onClick={() => { const a = new Date(); const b = new Date(); b.setDate(a.getDate() - n + 1); setFrom(iso(b)); setTo(iso(a)); }}>Last {n}d</button>)}
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="stats five">
            <StatCard label="Orders" value={s.total} icon="box" tone="dark" /><StatCard label="Delivered" value={s.delivered} icon="check" tone="green" />
            <StatCard label="On-time" value={`${s.onTime}%`} icon="clock" tone="blue" /><StatCard label="Avg. hours" value={s.avg} icon="truck" tone="red" /><StatCard label="Rating" value={s.csat || '—'} icon="star" tone="amber" />
          </div>
          <div className="charts">
            <div className="card wide"><h3>Orders vs deliveries</h3>
              <ResponsiveContainer width="100%" height={280}><LineChart data={perDay}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7ec" /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="orders" stroke="#e8212f" strokeWidth={3} dot={false} name="Placed" /><Line type="monotone" dataKey="delivered" stroke="#15171d" strokeWidth={3} dot={false} name="Delivered" /></LineChart></ResponsiveContainer></div>
            <div className="card"><h3>Avg. hours per agent</h3>
              <ResponsiveContainer width="100%" height={280}><BarChart data={perAgent.map((a) => ({ name: a.name.split(' ')[0], hours: a.avg }))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7ec" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={28} /><Tooltip /><Bar dataKey="hours" fill="#e8212f" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </div>
          <h2 className="sec">Agent performance</h2>
          <div className="card"><DataTable columns={cols} rows={perAgent} empty="No agents" pageSize={10} /></div>
        </>
      )}
    </>
  );
}
