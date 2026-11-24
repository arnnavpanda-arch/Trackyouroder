import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import useLiveData from '../hooks/useLiveData';
import useGeoShare from '../hooks/useGeoShare';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import AssignAgentModal from '../components/AssignAgentModal';
import PaymentGatewayModal from '../components/PaymentGatewayModal';
import AgentQRModal from '../components/AgentQRModal';
import AgentDisputeModal from '../components/AgentDisputeModal';
import AddItemValueModal from '../components/AddItemValueModal';
import ShipmentReceiptModal from '../components/ShipmentReceiptModal';
import Modal from '../components/Modal';
import { ErrorBox, Spinner } from '../components/UI';
import { NEXT, fmtDate } from '../utils/helpers';
import { getResilientDeviceLocation, parseMapLinkOrAddress } from '../utils/geoHelper';
import DeliveryCelebration from '../components/DeliveryCelebration';
import './OrderDetails.css';

export default function OrderDetails({ orderId: propOrderId, onBack }) {
  const { id: paramId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const id = propOrderId || paramId || location.state?.orderId || sessionStorage.getItem('dt_user_active_order');
  const { user, socket, toast, settings } = useApp() || {};
  const { data: order, loading, error, reload } = useLiveData(
    () => (id ? api.getOrder(id) : Promise.reject(new Error('No order selected'))),
    [id]
  );

  const [loc, setLoc] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assign, setAssign] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showItemVal, setShowItemVal] = useState(false);
  const [showRePayGateway, setShowRePayGateway] = useState(false);
  const [showCustomerPayTotal, setShowCustomerPayTotal] = useState(false);
  const [newTxn, setNewTxn] = useState('');
  const [newPayer, setNewPayer] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showCancelGateway, setShowCancelGateway] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showQuickBill, setShowQuickBill] = useState(false);

  const share = useGeoShare(id, socket, order);

  const handleDeleteOrder = async () => {
    if (!order) return;
    setBusyDelete(true);
    try {
      await api.deleteOrder(order.id);
      toast(`Order #${order.id} permanently deleted from database & screen`, 'success');
      setShowDeleteConfirm(false);
      handleBack();
    } catch (err) {
      toast(err.message || 'Failed to delete order', 'error');
    } finally {
      setBusyDelete(false);
    }
  };

  const [userLiveCoords, setUserLiveCoords] = useState(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [showUpdateLinkModal, setShowUpdateLinkModal] = useState(false);
  const [customMapLink, setCustomMapLink] = useState('');

  useEffect(() => {
    setLoc(order?.agentLoc || null);
  }, [order]);

  useEffect(() => {
    if (!socket || !id) return;
    const f = (p) => {
      if (p.orderId === id) {
        setLoc({ lat: p.lat, lng: p.lng, accuracy: p.accuracy, isExact: p.isExact });
      }
    };
    const onLocUpdated = (p) => {
      if (p.orderId === id) {
        if (p.agentLoc) setLoc(p.agentLoc);
        if (p.distanceKm) setRouteInfo((prev) => ({ ...prev, distanceKm: p.distanceKm, durationMins: p.durationMins }));
      }
    };
    socket.on('agentLocationUpdated', f);
    socket.on('orderLocationUpdated', onLocUpdated);
    return () => {
      socket.off('agentLocationUpdated', f);
      socket.off('orderLocationUpdated', onLocUpdated);
    };
  }, [socket, id]);

  // Store customer device location for optional reference
  useEffect(() => {
    if (!order || user?.role !== 'user') return;
    getResilientDeviceLocation()
      .then((coords) => {
        setUserLiveCoords(coords);
      })
      .catch(() => {});
  }, [order?.id, user?.role]);

  // Auto-sync real Agent GPS when agent views the order
  useEffect(() => {
    if (!order || user?.role !== 'agent' || !socket) return;
    getResilientDeviceLocation()
      .then((agentCoords) => {
        setLoc(agentCoords);
        socket.emit('agentLocation', {
          orderId: order.id,
          lat: agentCoords.lat,
          lng: agentCoords.lng,
          isExact: true,
          accuracy: agentCoords.accuracy || 20,
          ts: Date.now(),
        });
        api.updateOrderLocation(order.id, { agentLoc: agentCoords }).catch(() => {});
      })
      .catch(() => {});
  }, [order?.id, user?.role, socket]);

  // Save live road distance & duration whenever road path calculates
  const handleRouteInfo = useCallback(
    (info) => {
      if (!info) return;
      setRouteInfo(info);
      if (
        order &&
        info.distanceKm &&
        (order.distanceKm !== Number(info.distanceKm) || order.durationMins !== Number(info.durationMins))
      ) {
        api.updateOrderLocation(order.id, {
          distanceKm: Number(info.distanceKm),
          durationMins: Number(info.durationMins),
        }).catch(() => {});
      }
    },
    [order?.id, order?.distanceKm, order?.durationMins]
  );

  // Update drop location to customer's exact current device location
  const handleSetDropToMyLiveGPS = async () => {
    setUpdatingLocation(true);
    try {
      const locRes = await getResilientDeviceLocation();
      const coords = { lat: locRes.lat, lng: locRes.lng };
      setUserLiveCoords(coords);
      const safeDropAddr = order.drop?.address ? order.drop.address.split('(📍')[0].trim() : 'Customer destination';
      await api.updateOrderLocation(order.id, {
        dropCoords: coords,
        dropAddress: `${safeDropAddr} (📍 Exact Live Pinned)`,
      });
      toast(`Delivery drop location pinned to GPS: ${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`, 'success');
      await reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleUpdateDropViaMapLink = async (link) => {
    const val = link || customMapLink;
    if (!val || !val.trim()) return;
    setUpdatingLocation(true);
    try {
      let parsed = await parseMapLinkOrAddress(val);
      if (!parsed || parsed.lat == null) {
        try {
          const directRes = await api.resolveLocation(val.trim());
          if (directRes && directRes.lat != null) {
            parsed = { lat: directRes.lat, lng: directRes.lng, address: directRes.formattedAddress };
          }
        } catch (e) {}
      }

      if (parsed && parsed.lat != null && parsed.lng != null) {
        const safeAddr =
          parsed.address ||
          (order.drop?.address ? `${order.drop.address.split('(📍')[0].trim()} (📍 Maps Link Pinned)` : 'Google Maps Pinned');
        await api.updateOrderLocation(order.id, {
          dropCoords: { lat: parsed.lat, lng: parsed.lng },
          dropMapLink: val.trim(),
          dropAddress: safeAddr,
        });
        toast(
          `Drop location updated via Google Maps link! (${Number(parsed.lat).toFixed(5)}, ${Number(parsed.lng).toFixed(5)})`,
          'success'
        );
        setShowUpdateLinkModal(false);
        setCustomMapLink('');
        await reload();
      } else {
        const updated = await api.updateOrderLocation(order.id, { dropMapLink: val.trim() });
        if (updated && updated.drop && updated.drop.lat != null) {
          toast(
            `Drop location updated! (${Number(updated.drop.lat).toFixed(5)}, ${Number(updated.drop.lng).toFixed(5)})`,
            'success'
          );
          setShowUpdateLinkModal(false);
          setCustomMapLink('');
          await reload();
        } else {
          toast('Could not extract coordinates from link. Please check the URL.', 'error');
        }
      }
    } catch (err) {
      toast(`Map link notice: ${err.message}`, 'error');
    } finally {
      setUpdatingLocation(false);
    }
  };

  // Map markers
  const markers = useMemo(() => {
    if (!order) return [];
    const list = [];
    if (order.pickup?.lat != null && order.pickup?.lng != null) {
      list.push({
        id: 'p',
        lat: Number(order.pickup.lat),
        lng: Number(order.pickup.lng),
        type: 'pickup',
        label: 'Pickup Store (📦)',
        title: 'Merchant / Pickup Point',
        address: order.pickup.address || 'Pickup Point',
        details: order.items?.length ? `${order.items.length} item(s) to collect` : 'Pickup source',
      });
    }
    if (order.drop?.lat != null && order.drop?.lng != null) {
      list.push({
        id: 'd',
        lat: Number(order.drop.lat),
        lng: Number(order.drop.lng),
        type: 'drop',
        label: `${order.userName || 'Customer'} (Drop 🏠)`,
        title: `Customer: ${order.userName || 'Delivery Destination'}`,
        address: order.drop.address || 'Drop Location',
        phone: user?.role === 'admin' ? order.userPhone : null,
        details: 'Delivery Destination (Drop Location)',
      });
    }

    if (loc && loc.lat != null && loc.lng != null && order.status !== 'Delivered' && order.status !== 'Cancelled') {
      const latNum = Number(loc.lat);
      const lngNum = Number(loc.lng);
      list.push({
        id: 'a',
        lat: latNum,
        lng: lngNum,
        type: 'agent',
        label: `${order.agentName || 'Agent'} (Courier 🛵)`,
        title: `Courier: ${order.agentName || 'Delivery Partner'}`,
        address: `Live GPS: ${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
        phone: order.agentPhone,
        accuracy: loc.accuracy,
        isExact: true,
        details:
          order.status === 'In-Transit'
            ? 'En route to customer drop destination'
            : order.status === 'Picked-up'
            ? 'Package in transit · On road'
            : 'En route to store pickup point',
      });
    }
    return list;
  }, [order, loc, user?.role]);

  // Route path
  const route = useMemo(() => {
    if (!order) return [];
    const hasAgent = loc && loc.lat != null && loc.lng != null && order.status !== 'Delivered' && order.status !== 'Cancelled';
    if (hasAgent && order.drop?.lat != null && order.drop?.lng != null) {
      return [[Number(loc.lat), Number(loc.lng)], [Number(order.drop.lat), Number(order.drop.lng)]];
    }
    if (order.pickup?.lat != null && order.drop?.lat != null) {
      return [[Number(order.pickup.lat), Number(order.pickup.lng)], [Number(order.drop.lat), Number(order.drop.lng)]];
    }
    return [];
  }, [order, loc]);

  if (loading && !order) return <Spinner />;
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!order) return <Spinner />;

  const next = NEXT[order.status];
  const advance = async () => {
    const isPrepaidUTR = order.itemPaid || order.paymentMethod === 'prepaid' || (Boolean(order.utrId) && order.paymentMethod !== 'cod');
    const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'verified';
    if (next === 'Picked-up' && isPrepaidUTR && !isPaid) {
      if (order.paymentStatus === 'not_verified') {
        toast('Cannot pick up order: Payment was rejected/not verified. The customer must re-pay the delivery fee first.', 'error');
      } else {
        toast('Cannot pick up order: Please verify customer pre-paid UTR payment first.', 'error');
      }
      return;
    }
    setBusy(true);
    try {
      await api.updateStatus(order.id, next);
      toast(`Marked as ${next}`, 'success');
      if (next === 'Picked-up' && !share.on) {
        share.toggle(true);
      }
      if (next === 'Delivered') share.toggle(false);
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  const handleAdminVerifyPayment = async (verified) => {
    setBusy(true);
    try {
      await api.verifyPayment(order.id, verified);
      toast(verified ? 'Payment approved & verified' : 'Payment marked as not verified', verified ? 'success' : 'info');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  const handleResubmitPayment = async (e) => {
    e.preventDefault();
    if (!newTxn.trim() || !newPayer.trim()) {
      toast('Please enter both Transaction ID and Payer Name', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.resubmitPayment(order.id, { txnId: newTxn.trim(), payerName: newPayer.trim() });
      toast('Payment details resubmitted for admin verification', 'success');
      setShowResubmit(false);
      setNewTxn('');
      setNewPayer('');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  const handleCancelGatewaySuccess = async (gatewayData) => {
    setShowCancelGateway(false);
    setBusy(true);
    try {
      await api.cancelOrder(order.id, {
        txnId: gatewayData.txnId,
        method: gatewayData.method,
      });
      const fee = order.cancellationFee || 30;
      toast(`Order ${order.id} cancelled! Cancellation fee ₹${fee} paid via ${gatewayData.method}.`, 'success');
      setConfirmCancel(false);
      await reload();
    } catch (e) {
      toast(e.message || 'Failed to cancel order', 'error');
    }
    setBusy(false);
  };

  const handleCollectPickupPayment = async () => {
    setBusy(true);
    try {
      await api.collectPickupPayment(order.id);
      toast('Store pickup payment collected successfully', 'success');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  const back = user?.role === 'admin' ? '/admin/orders' : user?.role === 'agent' ? '/agent' : '/user/orders';
  const isAgent = user?.role === 'agent';
  const isAdmin = user?.role === 'admin';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (user?.role === 'user') {
      sessionStorage.removeItem('dt_user_active_order');
      nav('/user/orders', { replace: true, state: { resetList: true } });
    } else {
      nav(back);
    }
  };

  const handleCopyId = () => {
    if (!order?.id) return;
    navigator.clipboard.writeText(order.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Stepper calculations
  const orderSteps = [
    { key: 'Placed', label: 'Order Placed', icon: '📦' },
    { key: 'Assigned', label: 'Partner Assigned', icon: '🛵' },
    { key: 'Picked-up', label: 'Picked Up', icon: '🛣️' },
    { key: 'Delivered', label: 'Delivered', icon: '🎉' },
  ];

  let currentStepIdx = 0;
  if (order.status === 'Delivered') {
    currentStepIdx = 4;
  } else if (order.status === 'In-Transit') {
    currentStepIdx = 2; // Active on en-route
  } else if (order.status === 'Picked-up') {
    currentStepIdx = 2;
  } else if (order.agentId || order.agentName) {
    currentStepIdx = 1;
  } else {
    currentStepIdx = 0;
  }

  const fillPercentage = order.status === 'Delivered' ? 76 : Math.min(76, (currentStepIdx / 3) * 76);

  // Status-driven ETA Headline
  const durationMins = routeInfo?.durationMins || order.durationMins || 12;
  const distanceKm = routeInfo?.distanceKm || order.distanceKm || 3.4;

  const totalBillAmount = Number(
    order.totalPayable || ((order.deliveryFee || 40) + (order.itemValue || 0))
  ).toFixed(2);

  return (
    <div className="trk-page">
      {/* Top Navigation Bar */}
      <div className="trk-nav-bar">
        <button type="button" onClick={handleBack} className="trk-back-btn">
          <span>←</span> Back to Orders
        </button>
        <div className="trk-nav-meta">
          <button type="button" onClick={handleCopyId} className="trk-copy-id-chip" title="Click to copy tracking ID">
            <span>📋</span> {order.id} {copiedId ? '✓ Copied' : ''}
          </button>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Header Info Card */}
      <div className="trk-header-card">
        <div className="trk-header-left">
          <h1>
            Order #{order.id}
          </h1>
          <p className="trk-header-sub">
            <span>Placed {fmtDate(order.createdAt)}</span>
            <span>•</span>
            <span>Customer: <b>{order.userName || user?.name || 'Customer'}</b></span>
            {order.agentName && (
              <>
                <span>•</span>
                <span>Courier: <b>{order.agentName}</b></span>
              </>
            )}
          </p>
        </div>

        <div className="trk-header-actions">
          {user?.role === 'user' &&
            order.status !== 'Delivered' &&
            order.status !== 'Cancelled' &&
            order.paymentStatus !== 'not_verified' &&
            !order.agentDisputed && (
              <button
                type="button"
                className="trk-btn trk-btn-danger-ghost"
                onClick={() => setShowCancelGateway(true)}
              >
                ✕ Cancel Order (₹{order.cancellationFee || 30})
              </button>
            )}

          <button
            type="button"
            className="trk-btn trk-btn-outline"
            onClick={() => setShowReceiptModal(true)}
            title="Print official Shipment & Payment Receipt / Invoice"
          >
            <span>🖨️</span> Print Receipt
          </button>

          {(isAdmin || user?.role === 'user') && (
            <button
              type="button"
              className="trk-btn trk-btn-outline"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={() => setShowDeleteConfirm(true)}
              title="Permanently remove order"
            >
              <span>🗑️</span> Delete
            </button>
          )}
        </div>
      </div>

      {/* Delivered Order Celebration & Thank You / Order Again Banner */}
      {order.status === 'Delivered' && (
        <DeliveryCelebration order={order} onOpenReceipt={() => setShowReceiptModal(true)} />
      )}

      {/* Hero ETA & Journey Stepper HUD */}
      <div className="trk-eta-hud">
        <div className="trk-eta-top-row">
          <div className="trk-eta-main">
            <div className="trk-eta-icon-wrap">
              {order.status === 'Delivered' ? '🎉' : order.status === 'Cancelled' ? '🚫' : '🛵'}
            </div>
            <div className="trk-eta-titles">
              <h2>
                {order.status === 'Delivered'
                  ? 'Package Delivered'
                  : order.status === 'Cancelled'
                  ? 'Order Cancelled'
                  : order.status === 'In-Transit'
                  ? `Estimated Arrival: ~${durationMins} mins`
                  : order.status === 'Picked-up'
                  ? `Out for Delivery: ~${durationMins} mins`
                  : 'Preparing for Pickup'}
              </h2>
              <p>
                {order.status === 'Delivered' ? (
                  'Shipment successfully received and completed'
                ) : order.status === 'Cancelled' ? (
                  'This delivery request was cancelled'
                ) : (
                  <>
                    <span>{distanceKm} km road remaining</span>
                    <span className="trk-eta-pill">Road Transit</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="trk-eta-signal">
            <span className="trk-pulse-dot" />
            <span>
              {order.status === 'Delivered'
                ? 'Delivery Complete'
                : order.status === 'Cancelled'
                ? 'Cancelled'
                : loc
                ? 'Live Courier GPS Connected'
                : 'Awaiting Courier Signal'}
            </span>
          </div>
        </div>

        {/* Stepper */}
        {order.status !== 'Cancelled' && (
          <div className="trk-stepper">
            <div className="trk-stepper-fill" style={{ width: `${fillPercentage}%` }} />
            {orderSteps.map((s, idx) => {
              const isDone = currentStepIdx > idx;
              const isActive = currentStepIdx === idx;
              const historyItem = (order.history || []).find((h) => h.status === s.key);
              return (
                <div key={s.key} className={`trk-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                  <div className="trk-step-node">
                    {isDone ? '✓' : s.icon}
                  </div>
                  <div className="trk-step-label">{s.label}</div>
                  <div className="trk-step-time">
                    {historyItem ? fmtDate(historyItem.at) : isActive ? 'In Progress' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="trk-grid">
        {/* Left Column: Live Road Tracking Map */}
        <div className="trk-map-card">
          <div className="trk-map-header">
            <h3>
              <span>🗺️</span> Live Road Route Tracking
            </h3>
            <span className="trk-eta-pill" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
              🛣️ {distanceKm} km · ~{durationMins} mins
            </span>
          </div>

          {/* Courier Telemetry Banner */}
          <div className="trk-courier-banner">
            <div className="trk-courier-profile">
              <div className="trk-courier-avatar">🛵</div>
              <div className="trk-courier-meta">
                <span className="trk-courier-tag">Delivery Partner</span>
                <span className="trk-courier-name">{order.agentName || 'Awaiting Partner Assignment'}</span>
                <span className="trk-courier-gps-txt">
                  {loc && loc.lat != null
                    ? `● Satellite GPS: ${Number(loc.lat).toFixed(4)}, ${Number(loc.lng).toFixed(4)}`
                    : 'Signal standby'}
                </span>
              </div>
            </div>

            <div className="trk-courier-actions">
              {order.agentPhone && (
                <a href={`tel:${order.agentPhone}`} className="trk-call-btn">
                  <span>📞</span> Call Agent
                </a>
              )}
              {user?.role === 'user' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                <button
                  type="button"
                  className="trk-pin-btn"
                  onClick={handleSetDropToMyLiveGPS}
                  disabled={updatingLocation}
                  title="Update delivery drop pin to your live device GPS"
                >
                  <span>📍</span> {updatingLocation ? 'Updating…' : 'Detect GPS'}
                </button>
              )}
              {user?.role === 'user' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                <button
                  type="button"
                  className="trk-pin-btn"
                  onClick={() => setShowUpdateLinkModal(true)}
                  title="Paste Google Maps link to pin destination"
                >
                  <span>🗺️</span> Maps Link
                </button>
              )}
            </div>
          </div>

          {/* Interactive Map View */}
          <div className="trk-map-frame">
            <MapView
              markers={markers}
              route={route}
              height={440}
              onRouteInfo={handleRouteInfo}
            />
          </div>

          {/* Telemetry Bottom Details */}
          <div className="trk-telemetry-bottom">
            <div className="trk-telemetry-item">
              <span>🛣️ Road Distance:</span>
              <strong>{distanceKm} km</strong>
            </div>
            <div className="trk-telemetry-item">
              <span>⏱️ Travel Time:</span>
              <strong>~{durationMins} mins</strong>
            </div>
            <div className="trk-telemetry-item">
              <span>🎯 Drop Destination:</span>
              <strong>{order.drop?.address ? order.drop.address.split(',')[0] : 'Pinned Destination'}</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Billing, Stops & Consignment */}
        <div className="trk-side-col">
          {/* Billing & Payment Card */}
          <div className="trk-card">
            <div className="trk-card-head">
              <h3>
                <span>💳</span> Payment & Billing
              </h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="trk-btn trk-btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 8, gap: 4 }}
                  onClick={() => setShowReceiptModal(true)}
                  title="Open official itemized bill & invoice"
                >
                  <span>📄</span> Preview Bill
                </button>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background:
                      order.paymentStatus === 'verified' || order.paymentStatus === 'paid'
                        ? '#dcfce7'
                        : order.paymentStatus === 'not_verified' || order.agentDisputed
                        ? '#fee2e2'
                        : '#f3e8ff',
                    color:
                      order.paymentStatus === 'verified' || order.paymentStatus === 'paid'
                        ? '#15803d'
                        : order.paymentStatus === 'not_verified' || order.agentDisputed
                        ? '#991b1b'
                        : '#6b21a8',
                  }}
                >
                  {order.paymentStatus === 'verified' || order.paymentStatus === 'paid'
                    ? '✓ PAID & VERIFIED'
                    : order.paymentStatus === 'not_verified' || order.agentDisputed
                    ? '⚠️ VERIFICATION REQUIRED'
                    : 'PENDING VERIFICATION'}
                </span>
              </div>
            </div>

            {/* Payment Status Notification Banner */}
            {order.status === 'Cancelled' ? (
              <div className="trk-pay-banner cancelled">
                <span className="trk-pay-icon">🚫</span>
                <div className="trk-pay-info">
                  <h4>Order Cancelled</h4>
                  <p>
                    Cancellation fee of <b>₹{order.cancellationFeeApplied || order.cancellationFee || 30}</b> was paid via{' '}
                    <b>{order.cancellationPaymentMethod || 'PhonePe UPI'}</b>.
                  </p>
                </div>
              </div>
            ) : order.paymentStatus === 'verified' || order.paymentStatus === 'paid' ? (
              <div className="trk-pay-banner verified">
                <span className="trk-pay-icon">✅</span>
                <div className="trk-pay-info">
                  <h4>Tax Invoice Ready</h4>
                  <p>
                    Your payment of <b>₹{totalBillAmount}</b> is verified. Official tax invoice with PDF has been sent to your email.
                  </p>
                </div>
              </div>
            ) : order.paymentStatus === 'not_verified' || order.agentDisputed ? (
              <div className="trk-pay-banner dispute">
                <span className="trk-pay-icon">⚠️</span>
                <div className="trk-pay-info">
                  <h4>Payment Not Verified</h4>
                  <p>
                    {order.verificationNote || 'Submitted payment details could not be verified by the agent.'} Please pay the fee to continue delivery.
                  </p>
                </div>
              </div>
            ) : order.itemValue > 0 ? (
              <div className="trk-pay-banner due">
                <span className="trk-pay-icon">📦</span>
                <div className="trk-pay-info">
                  <h4>Item Cost Added by Agent</h4>
                  <p>
                    The agent confirmed your items for <b>₹{order.itemValue}</b>. Total due: <b>₹{totalBillAmount}</b>.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Breakdown */}
            <div className="trk-breakdown">
              {order.itemValue > 0 && (
                <div className="trk-line-item">
                  <span>Ordered Goods ({order.itemDesc || 'Items'})</span>
                  <strong>₹{order.itemValue}</strong>
                </div>
              )}
              <div className="trk-line-item">
                <span>Delivery Logistics Fee</span>
                {order.deliveryFee === 0 ? (
                  <span style={{ color: '#059669', fontWeight: 800 }}>
                    {order.originalDeliveryFee ? <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: 5, fontSize: '0.85rem' }}>₹{order.originalDeliveryFee}</span> : null}
                    ₹0 <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>FREE OFFER</span>
                  </span>
                ) : (
                  <strong>₹{order.deliveryFee || 40}</strong>
                )}
              </div>
              {order.offerApplied && (
                <div className="trk-line-item" style={{ color: '#059669', fontSize: '0.82rem' }}>
                  <span>Offer Applied</span>
                  <span style={{ fontWeight: 700 }}>🎉 {order.offerApplied}</span>
                </div>
              )}
              <div className="trk-line-item">
                <span>Payment Mode</span>
                <strong>{order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : order.paymentMethod || 'PhonePe UPI'}</strong>
              </div>
              {order.txnId && (
                <div className="trk-line-item">
                  <span>Txn Ref</span>
                  <code style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{order.txnId}</code>
                </div>
              )}

              <div className="trk-line-divider" />

              <div className="trk-total-row">
                <span className="trk-total-label">Total Payable</span>
                <span className={`trk-total-val ${order.itemValue > 0 ? 'purple' : ''}`}>₹{totalBillAmount}</span>
              </div>

              {/* Inline Expandable Bill / Order Details */}
              <button
                type="button"
                className="trk-quick-bill-toggle"
                onClick={() => setShowQuickBill(!showQuickBill)}
              >
                <span>{showQuickBill ? '▲ Hide Bill & Order Details' : '▼ View Full Bill & Order Details Breakdown'}</span>
              </button>

              {showQuickBill && (
                <div className="trk-quick-bill-box">
                  <div className="trk-quick-bill-row">
                    <span>Order Tracking ID:</span>
                    <strong>#{order.id}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Customer Name:</span>
                    <strong>{order.userName || user?.name || 'Customer'}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Package / Weight:</span>
                    <strong>{order.pkg?.type || 'Standard'} ({order.pkg?.weight || 1} kg)</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Pickup Point:</span>
                    <strong style={{ maxWidth: 200, textAlign: 'right' }} title={order.pickup?.address}>{order.pickup?.address?.split(',')[0] || 'Pickup Point'}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Drop Destination:</span>
                    <strong style={{ maxWidth: 200, textAlign: 'right' }} title={order.drop?.address}>{order.drop?.address?.split(',')[0] || 'Drop Destination'}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Courier Assigned:</span>
                    <strong>{order.agentName || 'Awaiting assignment'}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Merchandise Cost:</span>
                    <strong>₹{order.itemValue || 0}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Logistics Freight Fee:</span>
                    <strong>₹{order.deliveryFee || 40}</strong>
                  </div>
                  <div className="trk-quick-bill-row">
                    <span>Tax (GST):</span>
                    <strong>Included in Logistics</strong>
                  </div>
                  <div className="trk-quick-bill-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Grand Total:</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹{totalBillAmount}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Bill / Order Details Primary Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="trk-preview-bill-btn"
                onClick={() => setShowReceiptModal(true)}
                title="Preview printable official invoice & shipment receipt"
              >
                <span>📄</span> Preview Bill / Order Details
              </button>

              {/* Call to Action Buttons */}
              {user?.role === 'user' && order.status !== 'Cancelled' && (
                <>
                  {order.paymentStatus === 'paid' || order.paymentStatus === 'verified' ? (
                    <a
                      href={`http://localhost:5001/api/orders/${order.id}/invoice-pdf`}
                      target="_blank"
                      rel="noreferrer"
                      download={`Tax_Invoice_${order.id}.pdf`}
                      className="trk-pay-cta green"
                      style={{ textDecoration: 'none' }}
                    >
                      <span>📥</span> Download Tax Invoice (PDF)
                    </a>
                  ) : order.paymentStatus === 'not_verified' || order.agentDisputed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        type="button"
                        className="trk-pay-cta purple"
                        onClick={() => setShowRePayGateway(true)}
                      >
                        <span>💳</span> Pay Verified Fee (₹{order.deliveryFee || 30}) Online
                      </button>
                      {!showResubmit ? (
                        <button
                          type="button"
                          className="trk-btn trk-btn-outline"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => setShowResubmit(true)}
                        >
                          Resubmit New UTR Reference
                        </button>
                      ) : (
                        <form onSubmit={handleResubmitPayment} style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                            <input
                              value={newTxn}
                              onChange={(e) => setNewTxn(e.target.value)}
                              placeholder="New Transaction / UTR ID"
                              required
                              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                            <input
                              value={newPayer}
                              onChange={(e) => setNewPayer(e.target.value)}
                              placeholder="Account Holder Name"
                              required
                              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="trk-btn trk-btn-outline" onClick={() => setShowResubmit(false)}>
                              Cancel
                            </button>
                            <button className="trk-btn trk-btn-primary" disabled={busy}>
                              {busy ? 'Submitting…' : 'Submit UTR'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="trk-pay-cta purple"
                      onClick={() => setShowCustomerPayTotal(true)}
                    >
                      <span>💳</span> Pay Total Bill (₹{totalBillAmount}) Now
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Route Stops & Consignment Details */}
          <div className="trk-card">
            <div className="trk-card-head">
              <h3>
                <span>📍</span> Route Stops & Consignment
              </h3>
            </div>

            <div className="trk-route-list">
              {/* Pickup Stop */}
              <div className="trk-stop-item">
                <div className="trk-stop-line" />
                <div className="trk-stop-icon-box pickup">📦</div>
                <div className="trk-stop-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="trk-stop-tag">Pickup Origin</span>
                    {(order.pickup?.state || order.pickup?.district) && (
                      <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                        📍 {[order.pickup.district, order.pickup.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="trk-stop-addr">{order.pickup?.address || 'Pickup Point'}</p>
                  {order.pickup?.mapLink && (
                    <a href={order.pickup.mapLink} target="_blank" rel="noreferrer" className="trk-stop-link">
                      <span>🗺️</span> Open Pickup in Google Maps ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Drop Stop */}
              <div className="trk-stop-item">
                <div className="trk-stop-icon-box drop">🏠</div>
                <div className="trk-stop-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="trk-stop-tag">Delivery Destination</span>
                    {(order.drop?.state || order.drop?.district) && (
                      <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                        🔒 Intra-State: {[order.drop.district, order.drop.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="trk-stop-addr">{order.drop?.address || 'Customer destination'}</p>
                  {order.drop?.mapLink ? (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={order.drop.mapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn sm"
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12.5,
                          padding: '7px 14px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          textDecoration: 'none',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                        }}
                      >
                        <span>🗺️</span> Open Drop Location in Google Maps ↗
                      </a>
                      <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 3 }}>
                        Mandatory Drop URL verified for courier GPS navigation
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                      ⚠️ No Google Maps Drop link available
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Consignment Tags */}
            <div className="trk-pkg-tags">
              <span className="trk-pkg-chip">📦 {order.pkg?.type || 'Standard Parcel'}</span>
              <span className="trk-pkg-chip">⚖️ {order.pkg?.weight || 1} kg</span>
              {order.pkg?.desc && <span className="trk-pkg-chip">📝 {order.pkg.desc}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Deliveries Control Section (Visible when viewed by Courier Agent) */}
      {isAgent && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
        <div className="trk-control-box agent">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛵</span> Courier Dispatch & Location Broadcast
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#7f1d1d' }}>
                {share.on ? (
                  share.pos ? (
                    <>Broadcasting Live GPS: <b>{Number(share.pos.lat).toFixed(6)}, {Number(share.pos.lng).toFixed(6)}</b> (±{Math.round(share.accuracy || 15)}m)</>
                  ) : (
                    'Acquiring precise satellite GPS fix…'
                  )
                ) : (
                  'Turn switch ON to stream vehicle position to customer.'
                )}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {share.on && (
                <button type="button" className="trk-btn trk-btn-outline" onClick={share.refreshExactFix}>
                  🎯 Refresh GPS
                </button>
              )}
              <button
                role="switch"
                aria-checked={share.on}
                className={`switch ${share.on ? 'on' : ''}`}
                onClick={() => share.toggle(!share.on)}
              >
                <span />
              </button>
            </div>
          </div>

          {/* COD QR Code Trigger for Agent */}
          {(!order.itemPaid && (order.paymentMethod === 'cod' || order.paymentStatus === 'pending_pickup')) && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
                <b>Collect COD:</b> Total Due ₹{totalBillAmount}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="trk-btn trk-btn-outline" onClick={() => setShowItemVal(true)}>
                  {order.itemValue ? '✏️ Edit Item Price' : '➕ Add Item Price'}
                </button>
                <button type="button" className="trk-pay-cta purple" style={{ width: 'auto', padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setShowQR(true)}>
                  <span>📱</span> Show PhonePe QR
                </button>
              </div>
            </div>
          )}

          {/* Advance Step Action Button */}
          {next && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="trk-btn trk-btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', justifyContent: 'center' }}
                disabled={busy}
                onClick={advance}
              >
                {busy ? 'Updating…' : `Advance Delivery: Mark as ${next}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin Verification Controls (Visible when viewed by Admin) */}
      {isAdmin && order.status !== 'Cancelled' && (
        <div className="trk-control-box admin">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛡️</span> Admin Verification & Operations
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#3b82f6' }}>
                Customer: <b>{order.userName}</b> ({order.userEmail}) · Payment: <b>{order.paymentStatus}</b>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="trk-btn trk-btn-outline" onClick={() => setAssign(true)}>
                {order.agentId ? 'Reassign Partner' : 'Assign Partner'}
              </button>
              {order.paymentStatus !== 'verified' && (
                <button type="button" className="trk-btn trk-btn-primary" onClick={() => handleAdminVerifyPayment(true)}>
                  ✓ Override & Mark Verified
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      {assign && <AssignAgentModal order={order} onClose={() => setAssign(false)} onDone={reload} />}

      {/* Cancellation Gateway Modal */}
      <PaymentGatewayModal
        isOpen={showCancelGateway}
        amount={order.cancellationFee || 30}
        purpose="Order Cancellation Fee"
        title="Cancel Order & Pay Fee"
        subtitle={`Mandatory cancellation fee to cancel order #${order.id}`}
        method="upi_phonepe"
        userName={user?.name}
        onClose={() => setShowCancelGateway(false)}
        onSuccess={handleCancelGatewaySuccess}
      />

      {/* Agent Dynamic QR Modal */}
      <AgentQRModal
        order={order}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        onPaymentReceived={async () => {
          await reload();
        }}
      />

      {/* Agent Dispute Modal */}
      <AgentDisputeModal
        order={order}
        isOpen={showDispute}
        onClose={() => setShowDispute(false)}
        onDone={async () => {
          await reload();
        }}
      />

      {/* Agent Add/Edit Item Value Modal */}
      <AddItemValueModal
        order={order}
        isOpen={showItemVal}
        onClose={() => setShowItemVal(false)}
        onDone={async () => {
          await reload();
        }}
      />

      {/* Customer Re-Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={showRePayGateway}
        amount={order.deliveryFee || 30}
        purpose="Delivery Fee Payment"
        title="Pay Updated Delivery Fee"
        subtitle={`Paying fee of ₹${order.deliveryFee || 30} for order #${order.id}`}
        method="upi_phonepe"
        userName={user?.name}
        onClose={() => setShowRePayGateway(false)}
        onSuccess={async () => {
          try {
            await api.verifyPayment(order.id, true);
            toast(`Payment of ₹${order.deliveryFee} verified!`, 'success');
            setShowRePayGateway(false);
            await reload();
          } catch (e) {
            toast(e.message, 'error');
          }
        }}
      />

      {/* Customer Pay Total COD Amount Modal */}
      <PaymentGatewayModal
        isOpen={showCustomerPayTotal}
        amount={order.totalPayable || ((order.deliveryFee || 30) + (order.itemValue || 0))}
        purpose={`Order #${order.id} - Total Payment (Item + Delivery)`}
        title="Pay Order Total"
        subtitle={`Paying total amount for ${order.itemDesc || 'ordered goods'} and delivery`}
        method="upi_phonepe"
        userName={user?.name}
        onClose={() => setShowCustomerPayTotal(false)}
        onSuccess={async (gwData) => {
          try {
            const tot = order.totalPayable || ((order.deliveryFee || 30) + (order.itemValue || 0));
            await api.collectPickupPayment(order.id, {
              txnId: gwData.txnId,
              method: gwData.method || 'PhonePe UPI',
              amount: tot,
            });
            toast(`Total payment of ₹${tot} received!`, 'success');
            setShowCustomerPayTotal(false);
            await reload();
          } catch (e) {
            toast(e.message, 'error');
          }
        }}
      />

      {/* Permanent Delete Modal */}
      {showDeleteConfirm && (
        <Modal
          title={`Permanently Delete Order #${order.id}?`}
          onClose={() => setShowDeleteConfirm(false)}
          footer={
            <>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busyDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger sm"
                disabled={busyDelete}
                onClick={handleDeleteOrder}
              >
                {busyDelete ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0 }}>
              Are you sure you want to permanently delete order <b>#{order.id}</b>?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#991b1b' }}>
              ⚠️ <b>Warning:</b> This order will be permanently erased from both the MongoDB database and your screen.
            </div>
          </div>
        </Modal>
      )}

      {/* Update Drop Location Modal */}
      {showUpdateLinkModal && (
        <Modal
          title="🗺️ Pin Drop Destination via Google Maps Link"
          onClose={() => setShowUpdateLinkModal(false)}
        >
          <div style={{ padding: '8px 2px' }}>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
              Paste any Google Maps link or coordinates for your delivery destination. The map and courier road route will update live immediately.
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <input
                type="text"
                value={customMapLink}
                onChange={(e) => setCustomMapLink(e.target.value)}
                placeholder="e.g. https://maps.app.goo.gl/... or 28.6139, 77.2090"
                style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn ghost sm" onClick={() => setShowUpdateLinkModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ background: '#0f172a', color: '#fff', padding: '8px 16px', fontWeight: 700 }}
                disabled={updatingLocation || !customMapLink.trim()}
                onClick={() => handleUpdateDropViaMapLink(customMapLink)}
              >
                {updatingLocation ? 'Updating…' : '✓ Update Drop Pin'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Shipment & Payment Receipt Modal */}
      <ShipmentReceiptModal
        order={order}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
}
