import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import useLiveData from '../../hooks/useLiveData';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import OrderDetails from '../OrderDetails';
import ErrorBoundary from '../../components/ErrorBoundary';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';
import ShipmentReceiptModal from '../../components/ShipmentReceiptModal';
import { Empty, ErrorBox, Field, Icon, PageHead, Spinner, StatCard, Tilt } from '../../components/UI';
import { STATUSES, fmtDate, rules, validate, deliveredAt, getPricing, calculateDeliveryFee, getDeliveryFeeDetails, evaluateDeliveryOffer } from '../../utils/helpers';
import OfferBanner from '../../components/OfferBanner';
import { getResilientDeviceLocation, reverseGeocodeCoords, parseMapLinkOrAddress } from '../../utils/geoHelper';
import { ALL_INDIAN_STATES, INDIA_STATES_DATA, isRegionEligible } from '../../utils/indiaGeoData';
import { haversineKm } from '../../utils/routing';

const cols = [
  { key: 'id', header: 'Order', render: (o) => <b>{o.id}</b> },
  { key: 'route', header: 'Route', render: (o) => (
    <span className="route-cell">
      {o.pickup?.address ? o.pickup.address.split(',')[0] : 'Pickup'} → {o.drop?.address ? o.drop.address.split(',')[0] : 'Drop'}
    </span>
  )},
  { key: 'fee', header: 'Pay Amount', render: (o) => (
    <div>
      <b style={{ color: o.itemValue > 0 ? '#581c87' : '#0f172a' }}>
        ₹{o.totalPayable != null ? o.totalPayable : (o.deliveryFee != null ? o.deliveryFee : 40)}
      </b>
      {o.itemValue > 0 ? (
        <small style={{ display: 'block', color: '#7e22ce', fontSize: 10.5, fontWeight: 700 }}>
          Item ₹{o.itemValue} + {o.deliveryFee === 0 ? <span style={{ color: '#059669' }}>Free Delivery</span> : `Fee ₹${o.deliveryFee}`}
        </small>
      ) : o.deliveryFee === 0 ? (
        <small style={{ display: 'block', color: '#059669', fontSize: 10.5, fontWeight: 700 }}>
          🎉 Free Delivery
        </small>
      ) : null}
    </div>
  )},
  { key: 'payment', header: 'Payment', render: (o) => {
    if (o.status === 'Cancelled') return <span className="badge cancelled">Cancelled</span>;
    if (o.paymentStatus === 'verified' || o.paymentStatus === 'paid') return <span className="badge delivered">✓ Paid ({o.paymentMethod === 'card' ? 'Card' : o.paymentMethod === 'cod' ? 'COD' : 'PhonePe'})</span>;
    if (o.paymentStatus === 'not_verified' || o.agentDisputed) return <span className="badge cancelled">⚠️ Payment Not Verified by Agent</span>;
    if (o.paymentStatus === 'pending_verification' || o.paymentStatus === 'pending_agent_verification') return <span className="badge pickedup">⏳ Pending Verification</span>;
    if (o.paymentStatus === 'pending_pickup') return <span className="badge intransit">{o.itemValue > 0 ? `💵 COD (₹${o.totalPayable})` : '💵 Pay on Delivery'}</span>;
    return <span className="badge intransit">Pay on Pickup</span>;
  }},
  { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  { key: 'createdAt', header: 'Placed', render: (o) => fmtDate(o.createdAt) },
  { key: 'go', header: '', render: (o) => (
    <Link
      className="link"
      to={`/user/orders/${o.id}`}
      onClick={() => sessionStorage.setItem('dt_user_active_order', o.id)}
    >
      Track
    </Link>
  )},
];

export function UserDashboard() {
  const { user } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLiveData(() => api.myOrders(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox msg={error} retry={reload} />;
  const active = data.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled');
  const done = data.filter((o) => o.status === 'Delivered');
  return (
    <>
      <PageHead title={`Hello, ${user?.name ? user.name.split(' ')[0] : 'there'}`} sub="Here's what's moving right now"><Link to="/user/new" className="btn"><Icon n="plus" size={18} />New order</Link></PageHead>
      <OfferBanner />
      <div className="stats">
        <StatCard label="Total orders" value={data.length} icon="box" tone="dark" />
        <StatCard label="Active" value={active.length} icon="truck" tone="red" />
        <StatCard label="Delivered" value={done.length} icon="check" tone="green" />
      </div>
      <h2 className="sec">Active orders</h2>
      {active.length === 0 ? <Empty title="No active orders" hint="Place an order and it will show up here."><Link to="/user/new" className="btn sm">Place an order</Link></Empty> : (
        <div className="cards">{active.map((o) => (
          <Tilt key={o.id} className="card order-card">
            <div
              onClick={() => {
                sessionStorage.setItem('dt_user_active_order', o.id);
                nav(`/user/orders/${o.id}`);
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="row">
                <b>{o.id}</b>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(o.paymentStatus === 'not_verified' || o.agentDisputed) && <span className="badge cancelled">⚠️ Payment Not Verified by Agent</span>}
                  <StatusBadge status={o.status} />
                </div>
              </div>
              <p className="addr"><i className="dot-p" />{o.pickup?.address || 'Pickup Point'}</p>
              <p className="addr"><i className="dot-d" />{o.drop?.address || 'Drop Location'}</p>
              <div className="bar"><span style={{ width: `${((STATUSES.indexOf(o.status) + 1) / 4) * 100}%` }} /></div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <small>{o.agentName ? `Agent: ${o.agentName}` : 'Waiting for agent assignment'}</small>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ fontWeight: 800, color: o.itemValue > 0 ? '#581c87' : '#1e293b' }}>
                    {o.itemValue > 0
                      ? `Total Due: ₹${o.totalPayable != null ? o.totalPayable : (o.deliveryFee + o.itemValue)}`
                      : o.deliveryFee === 0 ? 'Delivery: ₹0 (FREE 🎉)' : `Fee: ₹${o.deliveryFee || 40}`}
                  </small>
                  {o.itemValue > 0 && (
                    <small style={{ display: 'block', fontSize: 10.5, color: '#7e22ce', fontWeight: 600 }}>
                      (Item ₹{o.itemValue} + Delivery)
                    </small>
                  )}
                </div>
              </div>
            </div>
          </Tilt>
        ))}</div>
      )}
    </>
  );
}

export function PlaceOrder() {
  const nav = useNavigate();
  const { toast, user, socket } = useApp() || {};
  const [pricing, setPricing] = useState(() => getPricing());
  const [v, setV] = useState({
    pickup: '',
    drop: '',
    type: 'Documents',
    weight: '0.8',
    itemValue: '',
    desc: '',
    notes: '',
  });
  const [itemPaid, setItemPaid] = useState(false); // boolean: whether package item is already paid
  const [utrId, setUtrId] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(user?.name || '');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'upi_phonepe' | 'card' | 'cod'
  const [showGateway, setShowGateway] = useState(false);
  const [showLiveLocationModal, setShowLiveLocationModal] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [dropMapLink, setDropMapLink] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [pickupMapLink, setPickupMapLink] = useState('');
  const [resolvingPickupLink, setResolvingPickupLink] = useState(false);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [dropCoords, setDropCoords] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [acquiringPickupGps, setAcquiringPickupGps] = useState(false);

  const handleUseCurrentLocationForDrop = async (callbackAfterSuccess) => {
    setAcquiringGps(true);
    setLocationError('');
    try {
      const loc = await getResilientDeviceLocation();
      const coords = { lat: loc.lat, lng: loc.lng };
      setDropCoords(coords);
      const addr = await reverseGeocodeCoords(loc.lat, loc.lng);
      if (addr) {
        setV((prev) => ({ ...prev, drop: prev.drop || addr }));
      }
      const srcName = loc.source === 'satellite_gps' ? 'Device GPS' : loc.source === 'ip_network' ? 'Network' : 'WiFi';
      toast(`Location captured via ${srcName}: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, 'success');

      if (typeof callbackAfterSuccess === 'function') {
        callbackAfterSuccess(coords);
      }
    } catch (err) {
      setLocationError(err.message);
      toast(err.message, 'error');
    } finally {
      setAcquiringGps(false);
    }
  };

  const handleResolveMapLink = async (linkToParse) => {
    const link = linkToParse || dropMapLink;
    if (!link || !link.trim()) return null;
    setResolvingLink(true);
    setLocationError('');
    try {
      const parsed = await parseMapLinkOrAddress(link);
      if (parsed && parsed.lat != null && parsed.lng != null) {
        const coords = { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        setDropCoords(coords);
        if (parsed.address && !v.drop) {
          setV((prev) => ({ ...prev, drop: parsed.address }));
        }
        toast(`Google Maps drop pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, 'success');
        return { lat: coords.lat, lng: coords.lng, address: parsed.address };
      } else {
        const msg = 'Could not parse Google Maps link. Please verify the URL or enter coordinates.';
        setLocationError(msg);
        toast(msg, 'error');
        return null;
      }
    } catch (err) {
      const msg = `Map link error: ${err.message}`;
      setLocationError(msg);
      toast(msg, 'error');
      return null;
    } finally {
      setResolvingLink(false);
    }
  };

  const handleResolvePickupMapLink = async (linkToParse) => {
    const link = linkToParse || pickupMapLink;
    if (!link || !link.trim()) return null;
    setResolvingPickupLink(true);
    try {
      const parsed = await parseMapLinkOrAddress(link);
      if (parsed && parsed.lat != null && parsed.lng != null) {
        const coords = { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        setPickupCoords(coords);
        if (parsed.address && !v.pickup) {
          setV((prev) => ({ ...prev, pickup: parsed.address }));
        }
        toast(`Google Maps pickup pinned: ${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`, 'success');
        return { lat: coords.lat, lng: coords.lng, address: parsed.address };
      } else {
        toast('Could not parse Google Maps pickup link. Please verify the URL or enter coordinates.', 'error');
        return null;
      }
    } catch (err) {
      toast(`Pickup map link error: ${err.message}`, 'error');
      return null;
    } finally {
      setResolvingPickupLink(false);
    }
  };

  const handleEnableGpsAndProceed = () => {
    handleUseCurrentLocationForDrop((coords) => {
      setShowLiveLocationModal(false);
      submit(null, coords);
    });
  };

  const handleSkipLocationAndProceed = () => {
    setShowLiveLocationModal(false);
    submit(null, dropCoords, true);
  };

  const handleUseCurrentLocationForPickup = async () => {
    setAcquiringPickupGps(true);
    try {
      const loc = await getResilientDeviceLocation();
      const coords = { lat: loc.lat, lng: loc.lng };
      setPickupCoords(coords);
      const addr = await reverseGeocodeCoords(loc.lat, loc.lng);
      if (addr) {
        setV((prev) => ({ ...prev, pickup: prev.pickup || addr }));
      }
      toast(`Pickup location pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAcquiringPickupGps(false);
    }
  };

  useEffect(() => {
    api.getPricing().then(setPricing).catch(() => {});
    if (!socket) return;
    const onPricing = (p) => { if (p) setPricing(p); };
    const onOffer = (o) => {
      if (o) setPricing((prev) => ({ ...prev, delivery_offer: o }));
    };
    socket.on('pricingUpdated', onPricing);
    socket.on('offerUpdated', onOffer);
    return () => {
      socket.off('pricingUpdated', onPricing);
      socket.off('offerUpdated', onOffer);
    };
  }, [socket]);

  const set = (k) => (e) => {
    setV((prev) => ({ ...prev, [k]: e.target.value }));
    if (errs[k]) {
      setErrs((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const [pickupState, setPickupState] = useState(user?.state || 'Odisha');
  const [pickupDistrict, setPickupDistrict] = useState(user?.district || 'Khordha (Bhubaneswar)');
  const [dropState, setDropState] = useState(user?.state || 'Odisha');
  const [dropDistrict, setDropDistrict] = useState('');

  const calculatedDistanceKm = useMemo(() => {
    if (pickupCoords?.lat != null && dropCoords?.lat != null) {
      const d = haversineKm(pickupCoords, dropCoords);
      return Math.max(0.5, +(d * 1.25).toFixed(1));
    }
    return 3.5;
  }, [pickupCoords, dropCoords]);

  const feeDetails = useMemo(() => {
    return getDeliveryFeeDetails(v.weight, pricing, v.itemValue, calculatedDistanceKm);
  }, [v.weight, pricing, v.itemValue, calculatedDistanceKm]);
  const currentFee = feeDetails.fee;
  const weightNum = Number(v.weight) || 0;
  const currentTier = weightNum <= 1 ? 'under_1kg' : weightNum <= 5 ? '1kg_to_5kg' : 'above_5kg';

  const selectTier = (t) => {
    if (t === 'under_1kg') setV((prev) => ({ ...prev, weight: '0.8' }));
    else if (t === '1kg_to_5kg') setV((prev) => ({ ...prev, weight: '2.5' }));
    else setV((prev) => ({ ...prev, weight: '6.0' }));
  };

  const handlePickupStateChange = (nextState) => {
    setPickupState(nextState);
    setDropState(nextState); // Strictly locked: orders must travel in the same state only
    setPickupDistrict('');
    setDropDistrict('');
    setErrs((prev) => ({ ...prev, pickupState: '', dropState: '', pickupDistrict: '', dropDistrict: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!v.pickup || v.pickup.trim().length < 3) {
      errors.pickup = 'Please enter a valid pickup address (at least 3 characters)';
    }
    if (!pickupState) {
      errors.pickupState = 'Please select pickup state';
    }
    if (!pickupDistrict) {
      errors.pickupDistrict = 'Please select pickup district';
    }
    if (!v.drop || v.drop.trim().length < 3) {
      errors.drop = 'Please enter a valid drop address (at least 3 characters)';
    }
    if (!dropDistrict) {
      errors.dropDistrict = 'Please select drop district';
    }
    // Mandatory Google Maps Drop URL
    if (!dropMapLink || !dropMapLink.trim()) {
      errors.dropMapLink = 'Drop location Google Maps URL is compulsory / mandatory. Please paste the Maps link.';
    }
    // Strict intra-state delivery rule
    if (pickupState.trim().toLowerCase() !== dropState.trim().toLowerCase()) {
      errors.dropState = `Orders must travel in the same state only (${pickupState}). Delivery to another state is strictly prohibited.`;
    }
    const w = Number(v.weight);
    if (!w || w <= 0 || w > 50) {
      errors.weight = 'Weight must be between 0.1 and 50 kg';
    }
    if (itemPaid) {
      if (!utrId || utrId.trim().length < 5) {
        errors.utrId = 'Please enter a valid UTR ID / Transaction reference (min 5 chars)';
      }
      if (!accountHolderName || accountHolderName.trim().length < 2) {
        errors.accountHolderName = 'Please enter Account Holder / Payer Name';
      }
    }
    setErrs(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (e, directCoords, skipLocation = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) {
      toast('Please fill all required fields properly', 'error');
      return;
    }

    const effectiveDropCoords = directCoords || dropCoords;
    if (!effectiveDropCoords && !dropMapLink.trim() && !skipLocation) {
      setShowLiveLocationModal(true);
      return;
    }

    if (!itemPaid) {
      // Cash on Delivery only: item is not paid
      setBusy(true);
      try {
        const o = await api.createOrder({
          ...v,
          desc: v.desc || `${v.type} Package`,
          itemValue: v.itemValue ? Number(v.itemValue) : null,
          deliveryFee: currentFee,
          originalDeliveryFee: feeDetails.originalFee,
          offerApplied: feeDetails.isFree ? (feeDetails.offerApplied || 'Free Delivery Offer') : '',
          itemPaid: false,
          paymentMethod: 'cod',
          paymentStatus: 'pending_pickup',
          pickupState,
          pickupDistrict,
          dropState,
          dropDistrict,
          pickup: {
            address: v.pickup,
            state: pickupState,
            district: pickupDistrict,
            mapLink: pickupMapLink.trim(),
            lat: pickupCoords?.lat ?? null,
            lng: pickupCoords?.lng ?? null,
          },
          drop: {
            address: v.drop,
            state: dropState,
            district: dropDistrict,
            mapLink: dropMapLink.trim(),
            lat: effectiveDropCoords?.lat ?? null,
            lng: effectiveDropCoords?.lng ?? null,
          },
          distanceKm: calculatedDistanceKm,
          dropCoords: effectiveDropCoords,
          dropMapLink: dropMapLink.trim(),
          pickupCoords,
          pickupMapLink: pickupMapLink.trim(),
        });
        toast(`Order ${o.id} placed via COD! Agent will collect payment upon delivery.`, 'success');
        sessionStorage.setItem('dt_user_active_order', o.id);
        nav('/user/orders', { state: { orderId: o.id } });
      } catch (err) {
        toast(err.message || 'Failed to place order', 'error');
        setBusy(false);
      }
    } else {
      // Item Paid online/store: UTR ID provided
      if (paymentMethod === 'cod') {
        // Delivery fee via COD
        setBusy(true);
        try {
          const o = await api.createOrder({
            ...v,
            desc: v.desc || `${v.type} Package`,
            itemValue: v.itemValue ? Number(v.itemValue) : null,
            deliveryFee: currentFee,
            originalDeliveryFee: feeDetails.originalFee,
            offerApplied: feeDetails.isFree ? (feeDetails.offerApplied || 'Free Delivery Offer') : '',
            itemPaid: true,
            utrId,
            accountHolderName,
            paymentMethod: 'prepaid',
            paymentStatus: 'pending_agent_verification',
            pickupState,
            pickupDistrict,
            dropState,
            dropDistrict,
            pickup: {
              address: v.pickup,
              state: pickupState,
              district: pickupDistrict,
              mapLink: pickupMapLink.trim(),
              lat: pickupCoords?.lat ?? null,
              lng: pickupCoords?.lng ?? null,
            },
            drop: {
              address: v.drop,
              state: dropState,
              district: dropDistrict,
              mapLink: dropMapLink.trim(),
              lat: effectiveDropCoords?.lat ?? null,
              lng: effectiveDropCoords?.lng ?? null,
            },
            distanceKm: calculatedDistanceKm,
            dropCoords: effectiveDropCoords,
            dropMapLink: dropMapLink.trim(),
            pickupCoords,
            pickupMapLink: pickupMapLink.trim(),
          });
          toast(`Order ${o.id} placed! Awaiting agent Pre-Paid UTR verification. Your verified bill & invoice PDF will be emailed once approved.`, 'success');
          sessionStorage.setItem('dt_user_active_order', o.id);
          nav('/user/orders', { state: { orderId: o.id } });
        } catch (err) {
          toast(err.message || 'Failed to place order', 'error');
          setBusy(false);
        }
      } else {
        // Settle delivery fee via Gateway (PhonePe / Card)
        setShowGateway(true);
      }
    }
  };

  const handleGatewaySuccess = async (gatewayData) => {
    setShowGateway(false);
    setBusy(true);
    try {
      const o = await api.createOrder({
        ...v,
        desc: v.desc || `${v.type} Package`,
        itemValue: v.itemValue ? Number(v.itemValue) : null,
        deliveryFee: currentFee,
        originalDeliveryFee: feeDetails.originalFee,
        offerApplied: feeDetails.isFree ? (feeDetails.offerApplied || 'Free Delivery Offer') : '',
        itemPaid: true,
        utrId: utrId || gatewayData.txnId,
        accountHolderName: accountHolderName || gatewayData.payerName || user?.name || 'Customer',
        paymentMethod: gatewayData.method?.includes('Card') ? 'card' : 'upi_phonepe',
        paymentStatus: 'pending_agent_verification',
        txnId: gatewayData.txnId,
        payerName: gatewayData.payerName || user?.name || 'Customer',
        pickupState,
        pickupDistrict,
        dropState,
        dropDistrict,
        pickup: {
          address: v.pickup,
          state: pickupState,
          district: pickupDistrict,
          mapLink: pickupMapLink.trim(),
          lat: pickupCoords?.lat ?? null,
          lng: pickupCoords?.lng ?? null,
        },
        drop: {
          address: v.drop,
          state: dropState,
          district: dropDistrict,
          mapLink: dropMapLink.trim(),
          lat: dropCoords?.lat ?? null,
          lng: dropCoords?.lng ?? null,
        },
        distanceKm: calculatedDistanceKm,
        dropCoords,
        dropMapLink: dropMapLink.trim(),
        pickupCoords,
        pickupMapLink: pickupMapLink.trim(),
      });
      toast(`Order ${o.id} placed! Agent will verify your payment details and the verified bill will be sent to your email.`, 'success');
      sessionStorage.setItem('dt_user_active_order', o.id);
      nav('/user/orders', { state: { orderId: o.id } });
    } catch (err) {
      toast(err.message || 'Failed to place order', 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Place an order" sub="Schedule shipment and settle delivery fees" />
      <form className="card form" onSubmit={submit} noValidate>
        {/* Mandatory Delivery Fee Notice & Active Promotional Delivery Offer */}
        {feeDetails.isFree ? (
          <div className="fee-mandatory-banner free-offer-active" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderColor: '#34d399', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)' }}>
            <div className="fee-banner-icon" style={{ background: '#10b981', color: '#fff' }}>🎉</div>
            <div className="fee-banner-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: 0, color: '#064e3b' }}>100% FREE Delivery Offer Applied!</h4>
                <span className="offer-badge" style={{ background: '#059669', color: '#fff', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '12px' }}>₹0 FEE</span>
              </div>
              <p style={{ margin: '4px 0 0', color: '#047857' }}>
                <b>{feeDetails.offerApplied || 'Free Delivery Promotion'}</b> active! Standard fee was ₹{feeDetails.originalFee} (You save ₹{feeDetails.originalFee} on this delivery).
              </p>
            </div>
            <div className="fee-banner-amount">
              <span style={{ textDecoration: 'line-through', fontSize: 13, color: '#64748b', marginRight: 6 }}>
                ₹{feeDetails.originalFee}
              </span>
              <span style={{ color: '#059669', fontSize: 24, fontWeight: 900 }}>₹0</span>
              <small style={{ color: '#059669', fontWeight: 800 }}>Free Delivery</small>
            </div>
          </div>
        ) : (
          <div className="fee-mandatory-banner">
            <div className="fee-banner-icon">💳</div>
            <div className="fee-banner-content">
              <h4>Delivery Fee Payment Notice</h4>
              <p>Delivery fee must always be settled first before shipment dispatch. Current calculated fee: <b>₹{currentFee}</b>.</p>
            </div>
            <div className="fee-banner-amount">
              <span>₹{currentFee}</span>
              <small>Delivery Fee</small>
            </div>
          </div>
        )}

        {/* Intra-State Policy Callout Banner */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 26, background: '#dcfce7', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            🔒
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ color: '#166534', fontSize: 14.5 }}>Intra-State Delivery Rule (Mandatory Policy)</b>
              <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                SAME-STATE LOGISTICS ONLY
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: '#14532d', fontSize: 12.5, lineHeight: 1.4 }}>
              Packages must travel strictly within the same state (<b>{pickupState}</b>). Inter-state package transit is restricted. Destination drop state is automatically pinned to your origin state.
            </p>
          </div>
        </div>

        {/* Live Location / Google Maps Callout Banner */}
        <div className={`live-loc-requirement-box ${dropCoords || pickupCoords ? 'verified' : 'pending'}`}>
          <div className="loc-req-icon">
            {dropCoords && pickupCoords ? '✅' : dropCoords ? '📍' : '🗺️'}
          </div>
          <div className="loc-req-info">
            <b>{dropCoords && pickupCoords ? 'Pickup & Drop Coordinates Verified' : dropCoords ? 'Drop Location Verified (Mandatory)' : 'Drop Google Maps URL is Mandatory / Compulsory'}</b>
            <p>
              {dropCoords ? (
                <>Exact drop location verified: <code>{Number(dropCoords.lat).toFixed(5)}, {Number(dropCoords.lng).toFixed(5)}</code>. Courier will navigate directly to this destination via Google Maps.</>
              ) : (
                <>Drop Google Maps URL is <b>mandatory</b> for all deliveries. Please paste the drop Google Maps link or pin coordinates below so the courier partner can navigate accurately.</>
              )}
            </p>
          </div>
        </div>

        <div className="grid2">
          {/* Pickup Section */}
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📦</span> Pickup Origin Location
              </h4>
              <button
                type="button"
                className="btn xs ghost"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={handleUseCurrentLocationForPickup}
                disabled={acquiringPickupGps}
              >
                {acquiringPickupGps ? 'Acquiring GPS…' : '📍 Use Current GPS'}
              </button>
            </div>

            <div className="grid2" style={{ marginBottom: 12 }}>
              <Field label="Pickup State (All 36 States/UTs)" error={errs.pickupState}>
                <select
                  value={pickupState}
                  onChange={(e) => handlePickupStateChange(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    width: '100%',
                  }}
                >
                  <option value="">-- Select Pickup State --</option>
                  {ALL_INDIAN_STATES.map((st) => {
                    const isOk = isRegionEligible(st, null, settings?.serviceable_regions);
                    return (
                      <option key={st} value={st}>
                        {st} {isOk ? '✓ (Eligible)' : '⚠️ (Service Inactive)'}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field label="Pickup District" error={errs.pickupDistrict}>
                <select
                  value={pickupDistrict}
                  onChange={(e) => {
                    setPickupDistrict(e.target.value);
                    if (errs.pickupDistrict) setErrs((prev) => ({ ...prev, pickupDistrict: '' }));
                  }}
                  disabled={!pickupState}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: !pickupState ? '#f1f5f9' : '#ffffff',
                    width: '100%',
                  }}
                >
                  <option value="">{pickupState ? '-- Select Pickup District --' : '-- Choose State first --'}</option>
                  {(pickupState && INDIA_STATES_DATA[pickupState] ? INDIA_STATES_DATA[pickupState] : []).map((dist) => {
                    const isDistOk = isRegionEligible(pickupState, dist, settings?.serviceable_regions);
                    return (
                      <option key={dist} value={dist}>
                        {dist} {isDistOk ? '' : '(Pending Approval)'}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>

            <Field label="Pickup Street Address / House No." error={errs.pickup}>
              <textarea
                rows={3}
                value={v.pickup}
                onChange={set('pickup')}
                placeholder="House / Flat no, building, street, area, landmark"
              />
              {pickupCoords && (
                <small style={{ color: '#16a34a', fontWeight: 700, display: 'block', marginTop: 4 }}>
                  ✓ Pickup GPS Pinned: {Number(pickupCoords.lat).toFixed(5)}, {Number(pickupCoords.lng).toFixed(5)}
                </small>
              )}
            </Field>

            <div className="field" style={{ marginTop: -4, marginBottom: 4 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>🗺️ Google Maps Pickup Link (Optional)</span>
                {pickupCoords && pickupMapLink && (
                  <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>
                    ✓ Pinned ({Number(pickupCoords.lat).toFixed(4)}, {Number(pickupCoords.lng).toFixed(4)})
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={pickupMapLink}
                  onChange={(e) => setPickupMapLink(e.target.value)}
                  placeholder="e.g. https://maps.app.goo.gl/... or 20.2961, 85.8245"
                  style={{ flex: 1, padding: '9px 12px', fontSize: 13 }}
                />
                <button
                  type="button"
                  className="btn sm"
                  style={{ background: '#2563eb', color: '#fff', padding: '9px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={resolvingPickupLink || !pickupMapLink.trim()}
                  onClick={() => handleResolvePickupMapLink(pickupMapLink)}
                >
                  {resolvingPickupLink ? '🔍' : '📍 Pin'}
                </button>
              </div>
            </div>
          </div>

          {/* Drop Section */}
          <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏠</span> Delivery Drop Destination
              </h4>
              <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, border: '1px solid #fde68a' }}>
                🔒 Intra-State Only
              </span>
            </div>

            <div className="grid2" style={{ marginBottom: 12 }}>
              <Field label="Drop State (Intra-State Locked)" error={errs.dropState}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={`${pickupState || 'State Required'} 🔒 (Same State Only)`}
                    disabled
                    readOnly
                    style={{
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#f1f5f9',
                      color: '#334155',
                      fontWeight: 700,
                      width: '100%',
                    }}
                  />
                </div>
              </Field>

              <Field label="Drop District" error={errs.dropDistrict}>
                <select
                  value={dropDistrict}
                  onChange={(e) => {
                    setDropDistrict(e.target.value);
                    if (errs.dropDistrict) setErrs((prev) => ({ ...prev, dropDistrict: '' }));
                  }}
                  disabled={!pickupState}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: !pickupState ? '#f1f5f9' : '#ffffff',
                    width: '100%',
                  }}
                >
                  <option value="">{pickupState ? `-- Select Drop District in ${pickupState} --` : '-- Set Pickup State first --'}</option>
                  {(pickupState && INDIA_STATES_DATA[pickupState] ? INDIA_STATES_DATA[pickupState] : []).map((dist) => {
                    const isDistOk = isRegionEligible(pickupState, dist, settings?.serviceable_regions);
                    return (
                      <option key={dist} value={dist}>
                        {dist} {isDistOk ? '' : '(Pending Approval)'}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>

            <Field label="Drop Street Address / House No." error={errs.drop}>
              <textarea
                rows={3}
                value={v.drop}
                onChange={set('drop')}
                placeholder="House / Flat no, building, street, area, landmark"
              />
              {dropCoords && (
                <small style={{ color: '#16a34a', fontWeight: 700, display: 'block', marginTop: 4 }}>
                  ✓ Drop GPS Pinned: {Number(dropCoords.lat).toFixed(5)}, {Number(dropCoords.lng).toFixed(5)}
                </small>
              )}
            </Field>

            {/* MANDATORY / COMPULSORY DROP GOOGLE MAPS URL */}
            <div className="field" style={{ marginTop: -4, marginBottom: 4, background: '#fffbeb', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #fde68a' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🗺️</span> Drop Location Google Maps URL <span style={{ color: '#dc2626' }}>* (COMPULSORY / MANDATORY)</span>
                </span>
                {dropCoords && dropMapLink && (
                  <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 800 }}>
                    ✓ Pinned ({Number(dropCoords.lat).toFixed(4)}, {Number(dropCoords.lng).toFixed(4)})
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={dropMapLink}
                  onChange={(e) => {
                    setDropMapLink(e.target.value);
                    if (errs.dropMapLink) setErrs((prev) => ({ ...prev, dropMapLink: '' }));
                  }}
                  placeholder="Paste Google Maps URL: https://maps.app.goo.gl/... or https://maps.google.com/?q=..."
                  style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderColor: errs.dropMapLink ? '#dc2626' : '#cbd5e1', background: '#ffffff' }}
                  required
                />
                <button
                  type="button"
                  className="btn sm"
                  style={{ background: '#059669', color: '#fff', padding: '10px 16px', fontWeight: 800, whiteSpace: 'nowrap' }}
                  disabled={resolvingLink || !dropMapLink.trim()}
                  onClick={() => handleResolveMapLink(dropMapLink)}
                >
                  {resolvingLink ? '🔍 Pinning…' : '📍 Pin Drop URL'}
                </button>
              </div>
              {errs.dropMapLink && (
                <small style={{ color: '#dc2626', fontWeight: 700, display: 'block', marginTop: 4 }}>
                  ⚠️ {errs.dropMapLink}
                </small>
              )}
              <small style={{ display: 'block', color: '#78350f', fontSize: 11.5, marginTop: 4 }}>
                * Compulsory for navigation. Open Google Maps, find destination, tap <b>Share</b> → <b>Copy link</b>, and paste here.
              </small>
            </div>
          </div>
        </div>

        {/* DISTANCE BOUNDARY & DELIVERY FEE BREAKDOWN CARD */}
        <div
          className="field distance-fee-breakdown-card"
          style={{
            background: '#ffffff',
            border: '2px solid #3b82f6',
            borderRadius: 16,
            padding: '18px 22px',
            margin: '18px 0',
            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚡</span> Distance-Based Delivery Pricing Breakdown
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Admin-configured distance boundary formula: Base fee covers up to <b>{feeDetails.baseDistanceKm} km</b>. Extra distance is charged at <b>₹{feeDetails.extraPerKm} / km</b>.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>
                ₹{currentFee}
              </span>
              <small style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                Delivery Fee Total
              </small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontSize: 11.5, display: 'block' }}>📏 Trip Distance</small>
              <b style={{ fontSize: 16, color: '#0f172a' }}>{calculatedDistanceKm} km</b>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontSize: 11.5, display: 'block' }}>🛡️ Base Distance Boundary</small>
              <b style={{ fontSize: 16, color: '#1e40af' }}>Up to {feeDetails.baseDistanceKm} km</b>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>(₹{feeDetails.minDistanceFee})</span>
            </div>

            <div style={{ background: feeDetails.extraKm > 0 ? '#fffbeb' : '#f8fafc', padding: '10px 14px', borderRadius: 10, border: `1px solid ${feeDetails.extraKm > 0 ? '#fde68a' : '#e2e8f0'}` }}>
              <small style={{ color: feeDetails.extraKm > 0 ? '#92400e' : '#64748b', fontSize: 11.5, display: 'block' }}>➕ Extra Distance Rate</small>
              <b style={{ fontSize: 16, color: feeDetails.extraKm > 0 ? '#b45309' : '#0f172a' }}>
                {feeDetails.extraKm > 0 ? `+${feeDetails.extraKm} km (+₹${feeDetails.extraDistCharge})` : '₹0 Extra'}
              </b>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>(₹{feeDetails.extraPerKm}/km)</span>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontSize: 11.5, display: 'block' }}>⚖️ Package Weight</small>
              <b style={{ fontSize: 16, color: '#0f172a' }}>{v.weight} kg</b>
              {feeDetails.weightSurcharge > 0 && <span style={{ fontSize: 11, color: '#dc2626', marginLeft: 4 }}>+₹{feeDetails.weightSurcharge}</span>}
            </div>
          </div>

          {/* Boundary Status Banner */}
          {feeDetails.extraKm <= 0 ? (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🟢</span>
              <span><b>Within Distance Boundary:</b> Destination ({calculatedDistanceKm} km) is within the base {feeDetails.baseDistanceKm} km boundary. Flat minimum delivery fee of ₹{feeDetails.minDistanceFee} applies.</span>
            </div>
          ) : (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡</span>
              <span><b>Exceeds Distance Boundary:</b> Destination ({calculatedDistanceKm} km) exceeds the base {feeDetails.baseDistanceKm} km boundary by {feeDetails.extraKm} km. Extra distance charge of ₹{feeDetails.extraDistCharge} applied at ₹{feeDetails.extraPerKm}/km.</span>
            </div>
          )}
        </div>

        {/* Weight Tier Selection (Admin configured rates) */}
        <div className="field">
          <span>Select Weight Bracket & Rates (Admin Configured)</span>
          <div className="weight-tier-pills">
            <button
              type="button"
              className={`weight-pill ${currentTier === 'under_1kg' ? 'active' : ''}`}
              onClick={() => selectTier('under_1kg')}
            >
              <span className="tier-tag">Under 1 kg</span>
              <span className="tier-price">₹{pricing.under_1kg}</span>
            </button>
            <button
              type="button"
              className={`weight-pill ${currentTier === '1kg_to_5kg' ? 'active' : ''}`}
              onClick={() => selectTier('1kg_to_5kg')}
            >
              <span className="tier-tag">1 kg to 5 kg</span>
              <span className="tier-price">₹{pricing.tier_1_to_5kg}</span>
            </button>
            <button
              type="button"
              className={`weight-pill ${currentTier === 'above_5kg' ? 'active' : ''}`}
              onClick={() => selectTier('above_5kg')}
            >
              <span className="tier-tag">5 kg+</span>
              <span className="tier-price">₹{pricing.tier_above_5kg}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Field label="Package type">
            <select value={v.type} onChange={set('type')}>
              {['Documents', 'Electronics', 'Clothing', 'Grocery', 'Fragile', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Weight (kg)" error={errs.weight}>
            <input type="number" step="0.1" min="0.1" max="50" value={v.weight} onChange={set('weight')} />
          </Field>
          <Field
            label="Declared Item / Order Value (₹, optional)"
            hint="For Cash on Delivery / Declared Value"
          >
            <div className="input-prefix-wrap">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                min="0"
                step="10"
                value={v.itemValue || ''}
                onChange={set('itemValue')}
                placeholder="e.g. 500"
              />
            </div>
          </Field>
          <Field label="Description (optional)" error={errs.desc}>
            <input value={v.desc} onChange={set('desc')} placeholder="e.g. Laptop in sealed box" />
          </Field>
        </div>

        <Field label="Notes for the agent (optional)">
          <textarea rows={2} value={v.notes} onChange={set('notes')} placeholder="e.g. Call before delivery, handle with care" />
        </Field>

        {/* MAIN SECTION: Package / Item Payment Status */}
        <div
          className="field item-payment-status-card"
          style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: 16,
            padding: '18px 20px',
            margin: '18px 0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📦</span> Package / Item Payment Status
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Is the ordered item already paid for, or should the agent collect payment on delivery?
              </p>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 20,
                background: itemPaid ? '#ecfdf5' : '#fef3c7',
                color: itemPaid ? '#15803d' : '#b45309',
                border: `1px solid ${itemPaid ? '#86efac' : '#fde68a'}`,
              }}
            >
              {itemPaid ? '✓ Pre-Paid Item' : '💵 Cash on Delivery'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 14 }}>
            {/* OPTION A: Item Already Paid */}
            <div
              onClick={() => {
                setItemPaid(true);
                setPaymentMethod('upi_phonepe');
              }}
              style={{
                cursor: 'pointer',
                border: `2px solid ${itemPaid ? '#16a34a' : '#cbd5e1'}`,
                background: itemPaid ? '#f0fdf4' : '#ffffff',
                borderRadius: 14,
                padding: '14px 16px',
                transition: 'all .2s ease',
                boxShadow: itemPaid ? '0 4px 14px rgba(22, 163, 74, 0.15)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="radio"
                  name="itemPaidOption"
                  checked={itemPaid}
                  onChange={() => {
                    setItemPaid(true);
                    setPaymentMethod('upi_phonepe');
                  }}
                  style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                />
                <div>
                  <b style={{ color: itemPaid ? '#15803d' : '#1e293b', fontSize: 14.5 }}>
                    🟢 Item Already Paid
                  </b>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Paid online / shop · Enter UTR ID & account name for agent verification
                  </div>
                </div>
              </div>
            </div>

            {/* OPTION B: Item Not Paid (COD Only) */}
            <div
              onClick={() => {
                setItemPaid(false);
                setPaymentMethod('cod');
              }}
              style={{
                cursor: 'pointer',
                border: `2px solid ${!itemPaid ? '#d97706' : '#cbd5e1'}`,
                background: !itemPaid ? '#fffbeb' : '#ffffff',
                borderRadius: 14,
                padding: '14px 16px',
                transition: 'all .2s ease',
                boxShadow: !itemPaid ? '0 4px 14px rgba(217, 119, 6, 0.15)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="radio"
                  name="itemPaidOption"
                  checked={!itemPaid}
                  onChange={() => {
                    setItemPaid(false);
                    setPaymentMethod('cod');
                  }}
                  style={{ width: 18, height: 18, accentColor: '#d97706' }}
                />
                <div>
                  <b style={{ color: !itemPaid ? '#b45309' : '#1e293b', fontSize: 14.5 }}>
                    🟡 Item Not Paid (COD Only)
                  </b>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Agent will add item value · Pay on delivery via Cash / PhonePe QR
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional Input: If Item Already Paid -> Customer Enters UTR ID and Account Holder Name */}
          {itemPaid ? (
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #bbf7d0',
                borderRadius: 12,
                padding: '14px 16px',
                marginTop: 8,
              }}
            >
              <h5 style={{ margin: '0 0 10px', fontSize: 13.5, color: '#166534', fontWeight: 800 }}>
                📝 Payment Verification Details (Required for Agent Cross-Check)
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    UTR ID / Transaction Reference No. *
                  </label>
                  <input
                    type="text"
                    value={utrId}
                    onChange={(e) => setUtrId(e.target.value)}
                    placeholder="e.g. 429810293812 or UPI/9910"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13.5,
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  {errs.utrId && <small style={{ color: '#dc2626', fontSize: 11, display: 'block', marginTop: 3 }}>{errs.utrId}</small>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Account Holder / Payer Name *
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13.5,
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  {errs.accountHolderName && <small style={{ color: '#dc2626', fontSize: 11, display: 'block', marginTop: 3 }}>{errs.accountHolderName}</small>}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 8 }}>
                ℹ️ The delivery agent will verify this UTR ID & account name. If not verified, the agent may adjust the rupees payable.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12.5,
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              ℹ️ <b>Only Cash on Delivery (COD) is available</b> when the item is not paid. The delivery agent will add the ordered item's value during pickup, and you can pay the full amount (Item + Delivery) to the agent via Cash or PhonePe QR.
            </div>
          )}
        </div>

        {/* 3 Payment Gateway Options with Real Logos */}
        <div className="field payment-section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Select Payment Gateway</span>
            {!itemPaid && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: 6 }}>
                🔒 Locked to COD (Item not paid)
              </span>
            )}
          </div>
          <p className="section-sub">
            {!itemPaid
              ? `Since item is not paid, this order will be delivered via Cash on Delivery (COD). Total collection will be confirmed by agent.`
              : `Choose UPI, Card, or Cash on Delivery for settling delivery fee (₹${currentFee})`}
          </p>

          <div className="payment-gateways-list">
            {/* OPTION 1: UPI PhonePe */}
            <div
              className={`payment-gw-card ${paymentMethod === 'upi_phonepe' ? 'selected' : ''}`}
              onClick={() => {
                if (itemPaid) setPaymentMethod('upi_phonepe');
              }}
              style={{ opacity: !itemPaid ? 0.45 : 1, cursor: !itemPaid ? 'not-allowed' : 'pointer' }}
            >
              <div className="payment-gw-left">
                <input
                  type="radio"
                  name="paymentOption"
                  checked={paymentMethod === 'upi_phonepe'}
                  onChange={() => {
                    if (itemPaid) setPaymentMethod('upi_phonepe');
                  }}
                  disabled={!itemPaid}
                  className="payment-gw-radio"
                />
                <div className="payment-gw-logo-wrap phonepe-logo-wrap">
                  <img
                    src="/phonepe.svg"
                    alt="PhonePe"
                    className="phonepe-gw-img"
                  />
                </div>
                <div className="payment-gw-info">
                  <b>UPI (PhonePe)</b>
                  <small>{!itemPaid ? 'Only available when item is pre-paid' : 'Instant UPI transfer via PhonePe Gateway · Live verification'}</small>
                </div>
              </div>
              <span className="payment-gw-badge instant">⚡ Instant Verified</span>
            </div>

            {/* OPTION 2: Debit / Credit Card */}
            <div
              className={`payment-gw-card ${paymentMethod === 'card' ? 'selected card-mode' : ''}`}
              onClick={() => {
                if (itemPaid) setPaymentMethod('card');
              }}
              style={{ opacity: !itemPaid ? 0.45 : 1, cursor: !itemPaid ? 'not-allowed' : 'pointer' }}
            >
              <div className="payment-gw-left">
                <input
                  type="radio"
                  name="paymentOption"
                  checked={paymentMethod === 'card'}
                  onChange={() => {
                    if (itemPaid) setPaymentMethod('card');
                  }}
                  disabled={!itemPaid}
                  className="payment-gw-radio"
                />
                <div className="payment-gw-logo-wrap card-logos-wrap">
                  <img
                    src="/visa.svg"
                    alt="Visa"
                    className="card-badge-img"
                    title="Visa Card"
                  />
                  <img
                    src="/mastercard.svg"
                    alt="Mastercard"
                    className="card-badge-img"
                    title="Mastercard"
                  />
                  <img
                    src="/rupay.svg"
                    alt="RuPay"
                    className="card-badge-img"
                    title="RuPay Card"
                  />
                  <img
                    src="/major-banks.svg"
                    alt="All Major Banks"
                    className="banks-badge-img"
                    title="SBI, HDFC, ICICI & All Major Banks"
                  />
                </div>
                <div className="payment-gw-info">
                  <b>Debit / Credit Card</b>
                  <small>{!itemPaid ? 'Only available when item is pre-paid' : 'Visa, Mastercard, RuPay & all major banks (SBI, HDFC, ICICI, etc.)'}</small>
                </div>
              </div>
              <span className="payment-gw-badge card">💳 Card Gateway</span>
            </div>

            {/* OPTION 3: Cash on Delivery (COD) */}
            <div
              className={`payment-gw-card ${paymentMethod === 'cod' ? 'selected cod-mode' : ''}`}
              onClick={() => setPaymentMethod('cod')}
            >
              <div className="payment-gw-left">
                <input
                  type="radio"
                  name="paymentOption"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="payment-gw-radio"
                />
                <div className="payment-gw-logo-wrap cod-logo-wrap">
                  💵 COD
                </div>
                <div className="payment-gw-info">
                  <b>Cash on Delivery (COD) / Store Pickup</b>
                  <small>
                    {!itemPaid
                      ? `Pay full collection (Item value + ₹${currentFee} delivery fee) to agent via cash or PhonePe QR`
                      : `Pay ₹${currentFee} delivery fee in cash when the parcel is collected`}
                  </small>
                </div>
              </div>
              <span className="payment-gw-badge cod">📦 Pay on Pickup</span>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          <button
            type="submit"
            className="btn"
            style={{
              background: !itemPaid ? '#d97706' : paymentMethod === 'upi_phonepe' ? '#5f259f' : paymentMethod === 'card' ? '#1e3a8a' : '#16a34a',
              boxShadow: !itemPaid
                ? '0 4px 0 #b45309, 0 8px 16px -6px rgba(217,119,6,.5)'
                : paymentMethod === 'upi_phonepe'
                ? '0 4px 0 #3b1464, 0 8px 16px -6px rgba(95,37,159,.5)'
                : paymentMethod === 'card'
                ? '0 4px 0 #0f172a, 0 8px 16px -6px rgba(30,58,138,.5)'
                : '0 4px 0 #15803d, 0 8px 16px -6px rgba(22,163,74,.5)'
            }}
            disabled={busy}
          >
            {busy
              ? 'Processing…'
              : !itemPaid
              ? `Place Order via COD (Pay on Delivery)`
              : paymentMethod === 'upi_phonepe'
              ? `Pay via PhonePe (₹${currentFee}) & Place Order`
              : paymentMethod === 'card'
              ? `Pay via Card (₹${currentFee}) & Place Order`
              : `Submit Order with UTR Verification`}
          </button>
        </div>
      </form>

      {/* Demo Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={showGateway}
        amount={currentFee}
        method={paymentMethod}
        userName={user?.name}
        onClose={() => setShowGateway(false)}
        onSuccess={handleGatewaySuccess}
      />

      {/* Live Location / Map Link Choice Modal (Optional) */}
      {showLiveLocationModal && (
        <Modal
          isOpen={showLiveLocationModal}
          onClose={() => setShowLiveLocationModal(false)}
          title="📍 Set Delivery Location (Optional)"
        >
        <div style={{ padding: '8px 4px' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>📍</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, color: '#1e293b', fontWeight: 800 }}>
              Set Your Exact Drop Location
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              Setting an exact pin helps the courier partner navigate directly to your doorstep. You can auto-detect your location, paste a Google Maps link, or continue without a pin (tracking will start upon courier pickup).
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Paste Google Maps Drop Link (Optional):
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={dropMapLink}
                onChange={(e) => setDropMapLink(e.target.value)}
                placeholder="https://maps.app.goo.gl/... or 28.6139, 77.2090"
                style={{ flex: 1, padding: '8px 10px', fontSize: 12.5 }}
              />
              <button
                type="button"
                className="btn sm"
                style={{ background: '#2563eb', color: '#fff', fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
                disabled={resolvingLink || !dropMapLink.trim()}
                onClick={async () => {
                  const resolved = await handleResolveMapLink(dropMapLink);
                  if (resolved && resolved.lat != null) {
                    setShowLiveLocationModal(false);
                    submit(null, { lat: resolved.lat, lng: resolved.lng }, true);
                  }
                }}
              >
                {resolvingLink ? '🔍 Pinning…' : '📍 Pin & Order'}
              </button>
            </div>
          </div>

          {locationError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
              ⚠️ {locationError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="btn ghost"
              style={{ color: '#0f172a', fontWeight: 700, padding: '10px 18px' }}
              onClick={handleSkipLocationAndProceed}
            >
              ⏩ Continue without Pin (Track Courier on Pickup)
            </button>
            <button
              type="button"
              className="btn ghost sm"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                marginTop: 4,
                width: '100%',
                justifyContent: 'center',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setLocationError('');
                setShowLiveLocationModal(false);
              }}
            >
              ← Back to Order Form
            </button>
          </div>
        </div>
      </Modal>
      )}
    </>
  );
}

export function MyOrders() {
  const location = useLocation();
  const nav = useNavigate();
  const { user, toast } = useApp();
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [repayingOrder, setRepayingOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(() => {
    if (location.state?.resetList) return null;
    return location.state?.orderId || sessionStorage.getItem('dt_user_active_order') || null;
  });

  useEffect(() => {
    if (location.state?.resetList) {
      setActiveOrderId(null);
      sessionStorage.removeItem('dt_user_active_order');
    } else if (location.state?.orderId) {
      setActiveOrderId(location.state.orderId);
      sessionStorage.setItem('dt_user_active_order', location.state.orderId);
    }
  }, [location.state]);

  const handleBackToList = () => {
    setActiveOrderId(null);
    sessionStorage.removeItem('dt_user_active_order');
    nav('/user/orders', { replace: true, state: { resetList: true } });
  };

  const { data, loading, error, reload } = useLiveData(() => api.myOrders(), []);
  const [tab, setTab] = useState('All');
  const rows = useMemo(() => (data || []).filter((o) => tab === 'All' || o.status === tab), [data, tab]);

  const handleDeleteSingleOrder = async () => {
    if (!deletingOrder) return;
    setBusyDelete(true);
    try {
      await api.deleteOrder(deletingOrder.id);
      toast(`Order #${deletingOrder.id} permanently deleted from database & screen`, 'success');
      setDeletingOrder(null);
      await reload();
    } catch (err) {
      toast(err.message || 'Failed to delete order', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const myOrderCols = useMemo(() => [
    ...cols.slice(0, 6),
    {
      key: 'act',
      header: 'Actions',
      render: (o) => (
        <div className="row gap" style={{ justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="link"
            onClick={(e) => {
              e.stopPropagation();
              sessionStorage.setItem('dt_user_active_order', o.id);
              setActiveOrderId(o.id);
            }}
          >
            Track
          </button>
          <button
            type="button"
            className="btn sm ghost"
            style={{
              padding: '3px 8px',
              fontSize: 11.5,
              fontWeight: 700,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: '#0f172a',
              borderColor: '#cbd5e1',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setReceiptOrder(o);
            }}
            title="Print official Shipment & Payment Receipt"
          >
            <span>🖨️</span> Print
          </button>
          {(o.paymentStatus === 'verified' || o.paymentStatus === 'paid') && (
            <span
              style={{
                background: '#dcfce7',
                color: '#15803d',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 4,
                border: '1px solid #86efac',
              }}
              title="Payment verified & bill approved by agent"
            >
              ✓ Paid
            </span>
          )}
          {o.status !== 'Cancelled' && o.paymentStatus !== 'verified' && o.paymentStatus !== 'paid' && o.itemValue > 0 && (
            <button
              type="button"
              className="btn sm"
              style={{
                background: '#5f259f',
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(95, 37, 159, 0.3)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setRepayingOrder(o);
              }}
              title={`Agent added item price. Pay total bill of ₹${o.totalPayable} online now`}
            >
              💳 Pay Total (₹{o.totalPayable})
            </button>
          )}
          {o.status !== 'Cancelled' && (o.paymentStatus === 'not_verified' || o.agentDisputed) && !o.itemValue && (
            <button
              type="button"
              className="btn sm"
              style={{
                background: '#dc2626',
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setRepayingOrder(o);
              }}
              title="Re-pay delivery fee via PhonePe / Card"
            >
              💳 Pay Fee (₹{o.deliveryFee || 40})
            </button>
          )}
          {o.status !== 'Delivered' && o.status !== 'Cancelled' && o.paymentStatus !== 'not_verified' && !o.agentDisputed && (
            <button
              type="button"
              className="order-cancel-cell-btn"
              onClick={(e) => {
                e.stopPropagation();
                setCancellingOrder(o);
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            style={{
              padding: '3px 7px',
              fontSize: 11.5,
              fontWeight: 700,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingOrder(o);
            }}
            title="Permanently delete order from database & screen"
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      ),
    },
  ], []);

  if (activeOrderId) {
    return (
      <ErrorBoundary onReset={handleBackToList}>
        <OrderDetails orderId={activeOrderId} onBack={handleBackToList} />
      </ErrorBoundary>
    );
  }

  const handleCancelGatewaySuccess = async (gatewayData) => {
    const targetOrder = cancellingOrder;
    setCancellingOrder(null);
    if (!targetOrder) return;
    try {
      await api.cancelOrder(targetOrder.id, {
        txnId: gatewayData.txnId,
        method: gatewayData.method,
      });
      const fee = targetOrder.cancellationFee || 30;
      toast(`Order ${targetOrder.id} cancelled. Mandatory cancellation fee ₹${fee} paid via ${gatewayData.method}.`, 'success');
      await reload();
    } catch (err) {
      toast(err.message || 'Failed to cancel order', 'error');
    }
  };

  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead title="My orders" sub="Track every shipment"><Link to="/user/new" className="btn"><Icon n="plus" size={18} />New order</Link></PageHead>
      <div className="tabs">{['All', ...STATUSES].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="card">
        <DataTable
          columns={myOrderCols}
          rows={rows}
          loading={loading}
          onRowClick={(o) => {
            sessionStorage.setItem('dt_user_active_order', o.id);
            setActiveOrderId(o.id);
          }}
          empty="No orders in this view"
          hint="Try another status tab."
        />
      </div>

      {/* Mandatory Cancellation Fee Demo Payment Gateway (PhonePe UPI / Card, NO COD) */}
      {cancellingOrder && (
        <PaymentGatewayModal
          isOpen={Boolean(cancellingOrder)}
          amount={cancellingOrder.cancellationFee || 30}
          purpose="Order Cancellation Fee"
          title="Cancel Order & Pay Fee"
          subtitle={`Mandatory cancellation fee to cancel order #${cancellingOrder.id}`}
          method="upi_phonepe"
          userName={user?.name}
          onClose={() => setCancellingOrder(null)}
          onSuccess={handleCancelGatewaySuccess}
        />
      )}

      {/* Customer Delivery Fee / Total Bill Re-payment Gateway (PhonePe UPI / Card) */}
      {repayingOrder && (() => {
        const payAmount = Number(repayingOrder.totalPayable || ((repayingOrder.deliveryFee || 40) + (repayingOrder.itemValue || 0)));
        const hasItem = Number(repayingOrder.itemValue) > 0;
        return (
          <PaymentGatewayModal
            isOpen={Boolean(repayingOrder)}
            amount={payAmount}
            purpose={hasItem ? `Total Bill (Item ₹${repayingOrder.itemValue} + Delivery ₹${repayingOrder.deliveryFee || 40})` : "Delivery Fee Payment"}
            title={hasItem ? `Pay Total Bill: ₹${payAmount}` : "Pay Delivery Fee"}
            subtitle={hasItem ? `Pay total bill of ₹${payAmount} for order #${repayingOrder.id}` : `Pay delivery fee of ₹${payAmount} for order #${repayingOrder.id}`}
            method="upi_phonepe"
            userName={user?.name}
            onClose={() => setRepayingOrder(null)}
            onSuccess={async (gwData) => {
              try {
                await api.collectPickupPayment(repayingOrder.id, {
                  txnId: gwData.txnId,
                  method: gwData.method || 'PhonePe UPI',
                  amount: payAmount,
                });
                toast(`Payment of ₹${payAmount} confirmed! Verified bill & Tax Invoice PDF sent to your email.`, 'success');
                setRepayingOrder(null);
                await reload();
              } catch (err) {
                toast(err.message || 'Payment confirmation failed', 'error');
              }
            }}
          />
        );
      })()}

      {/* Permanent Order Delete Confirmation Modal */}
      {deletingOrder && (
        <Modal
          title={`Permanently Delete Order #${deletingOrder.id}?`}
          onClose={() => setDeletingOrder(null)}
          footer={
            <>
              <button type="button" className="btn outline sm" onClick={() => setDeletingOrder(null)} disabled={busyDelete}>
                Cancel
              </button>
              <button
                type="button"
                className="btn danger sm"
                disabled={busyDelete}
                onClick={handleDeleteSingleOrder}
              >
                {busyDelete ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0 }}>
              Are you sure you want to permanently delete order <b>#{deletingOrder.id}</b>?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#991b1b' }}>
              ⚠️ <b>Warning:</b> This order will be permanently erased from both the MongoDB database and your screen. This cannot be undone.
            </div>
          </div>
        </Modal>
      )}

      {/* Customer Shipment & Payment Receipt Modal */}
      {receiptOrder && (
        <ShipmentReceiptModal
          order={receiptOrder}
          isOpen={Boolean(receiptOrder)}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </>
  );
}

export function History() {
  const nav = useNavigate();
  const { toast } = useApp();
  const { data, loading, error, reload } = useLiveData(() => api.myOrders(), []);
  const [q, setQ] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [historyReceiptOrder, setHistoryReceiptOrder] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const handleDeleteHistoryOrder = async () => {
    if (!deletingOrder) return;
    setBusyDelete(true);
    try {
      await api.deleteOrder(deletingOrder.id);
      toast(`Order #${deletingOrder.id} permanently deleted from database & screen`, 'success');
      setDeletingOrder(null);
      await reload();
    } catch (err) {
      toast(err.message || 'Failed to delete order', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const rows = useMemo(() => (data || []).filter((o) => o.status === 'Delivered').filter((o) => {
    const t = new Date(deliveredAt(o));
    return (!q || `${o.id} ${o.pickup.address} ${o.drop.address} ${o.pkg.type}`.toLowerCase().includes(q.toLowerCase()))
      && (!from || t >= new Date(from)) && (!to || t <= new Date(`${to}T23:59:59`));
  }), [data, q, from, to]);
  const hcols = [
    ...cols.slice(0, 3),
    { key: 'del', header: 'Delivered', render: (o) => fmtDate(deliveredAt(o)) },
    { key: 'rate', header: 'Rating', render: (o) => (
      o.rating ? (
        <span className="stars" title={o.feedback ? `Customer review: "${o.feedback}"` : `${o.rating} Stars`}>
          <Icon n="star" size={14} /> {o.rating}★ {o.feedback ? <small style={{ color: '#64748b', fontStyle: 'italic', marginLeft: 4 }}>("{o.feedback.slice(0, 18)}{o.feedback.length > 18 ? '…' : ''}")</small> : null}
        </span>
      ) : (
        <small style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending review</small>
      )
    )},
    { key: 'go', header: 'Actions', render: (o) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link
          className="link"
          to="/user/orders"
          state={{ orderId: o.id }}
          onClick={(e) => {
            e.stopPropagation();
            sessionStorage.setItem('dt_user_active_order', o.id);
          }}
        >
          View
        </Link>
        <button
          type="button"
          className="btn sm ghost"
          style={{
            padding: '3px 8px',
            fontSize: 11.5,
            fontWeight: 700,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            color: '#0f172a',
            borderColor: '#cbd5e1',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setHistoryReceiptOrder(o);
          }}
          title="Print official Shipment & Payment Receipt"
        >
          <span>🖨️</span> Print
        </button>
        <button
          type="button"
          style={{
            padding: '3px 7px',
            fontSize: 11.5,
            fontWeight: 700,
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setDeletingOrder(o);
          }}
          title="Permanently delete from database"
        >
          <span>🗑️</span> Delete
        </button>
      </div>
    )},
  ];
  if (error) return <ErrorBox msg={error} retry={reload} />;
  return (
    <>
      <PageHead title="Delivery history" sub="Completed deliveries" />
      <div className="filters card">
        <div className="search"><Icon n="search" size={18} /><input placeholder="Search by order, address, package" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn ghost sm" onClick={() => { setQ(''); setFrom(''); setTo(''); }}>Reset</button>
      </div>
      <div className="card">
        <DataTable
          columns={hcols}
          rows={rows}
          loading={loading}
          onRowClick={(o) => {
            sessionStorage.setItem('dt_user_active_order', o.id);
            nav('/user/orders', { state: { orderId: o.id } });
          }}
          empty="No deliveries found"
          hint="Adjust your search or date range."
        />
      </div>

      {deletingOrder && (
        <Modal
          title={`Permanently Delete Order #${deletingOrder.id}?`}
          onClose={() => setDeletingOrder(null)}
          footer={
            <>
              <button type="button" className="btn outline sm" onClick={() => setDeletingOrder(null)} disabled={busyDelete}>
                Cancel
              </button>
              <button
                type="button"
                className="btn danger sm"
                disabled={busyDelete}
                onClick={handleDeleteHistoryOrder}
              >
                {busyDelete ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0 }}>
              Are you sure you want to permanently delete order <b>#{deletingOrder.id}</b> from delivery history?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#991b1b' }}>
              ⚠️ <b>Warning:</b> This order will be permanently erased from both the MongoDB database and your screen.
            </div>
          </div>
        </Modal>
      )}

      {/* History Delivery Shipment & Payment Receipt Modal */}
      {historyReceiptOrder && (
        <ShipmentReceiptModal
          order={historyReceiptOrder}
          isOpen={Boolean(historyReceiptOrder)}
          onClose={() => setHistoryReceiptOrder(null)}
        />
      )}
    </>
  );
}
