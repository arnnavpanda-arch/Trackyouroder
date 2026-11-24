import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import useLiveData from '../../hooks/useLiveData';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorBox, PageHead, Spinner, StatCard } from '../../components/UI';
import { NEXT } from '../../utils/helpers';
import { getRoadRoute } from '../../utils/routing';
import { getResilientDeviceLocation } from '../../utils/geoHelper';
import AgentQRModal from '../../components/AgentQRModal';
import AgentDisputeModal from '../../components/AgentDisputeModal';
import AddItemValueModal from '../../components/AddItemValueModal';
import Modal from '../../components/Modal';
import OrderDetails from '../OrderDetails';
import ErrorBoundary from '../../components/ErrorBoundary';

export function AgentDeliveries() {
  const { toast, socket } = useApp();
  const { data, loading, error, reload } = useLiveData(() => api.assignedOrders(), []);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [busy, setBusy] = useState('');
  const [qrOrder, setQrOrder] = useState(null);
  const [disputingOrder, setDisputingOrder] = useState(null);
  const [itemValOrder, setItemValOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [activeGpsOrders, setActiveGpsOrders] = useState({});
  const [orderDistances, setOrderDistances] = useState({});
  const [enablingGpsId, setEnablingGpsId] = useState(null);

  const handleEnableAgentGps = async (order) => {
    setEnablingGpsId(order.id);
    try {
      const loc = await getResilientDeviceLocation();
      const coords = { lat: loc.lat, lng: loc.lng };
      setActiveGpsOrders((prev) => ({ ...prev, [order.id]: coords }));

      // 1. Broadcast agent location to customer & server via socket
      if (socket) {
        socket.emit('agentLocation', {
          orderId: order.id,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: loc.accuracy || 50,
          isExact: true,
          ts: Date.now(),
        });
      }

      // 2. Calculate turn-by-turn road route and distance to customer drop location
      let distKm = null;
      let durMins = null;
      if (order.drop && order.drop.lat != null && order.drop.lng != null) {
        const routeRes = await getRoadRoute(coords, order.drop);
        distKm = routeRes?.distanceKm ? Number(routeRes.distanceKm) : null;
        durMins = routeRes?.durationMins ? Number(routeRes.durationMins) : null;

        if (distKm != null) {
          setOrderDistances((prev) => ({
            ...prev,
            [order.id]: { distanceKm: distKm, durationMins: durMins },
          }));
        }
      }

      // 3. Persist agent location and calculated distance in backend
      await api.updateOrderLocation(order.id, {
        agentLoc: coords,
        distanceKm: distKm,
        durationMins: durMins,
      });

      const srcName = loc.source === 'satellite_gps' ? 'Satellite GPS' : loc.source === 'ip_network' ? 'Network IP' : 'WiFi';
      toast(`Agent live location active via ${srcName}! ${distKm ? `Road distance: ${distKm} km (~${durMins} mins)` : 'Broadcasting GPS'}`, 'success');
      await reload();
    } catch (err) {
      toast(`Location notice: ${err.message}`, 'error');
    } finally {
      setEnablingGpsId(null);
    }
  };

  const handleDeleteAgentOrder = async () => {
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

  if (loading) return <Spinner />;
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (activeOrderId) {
    return (
      <ErrorBoundary onReset={() => setActiveOrderId(null)}>
        <OrderDetails orderId={activeOrderId} onBack={() => setActiveOrderId(null)} />
      </ErrorBoundary>
    );
  }
  const active = data.filter((o) => o.status !== 'Delivered');
  const done = data.filter((o) => o.status === 'Delivered');

  const quick = async (o) => {
    const nextStatus = NEXT[o.status];
    const isPrepaidUTR = o.itemPaid || o.paymentMethod === 'prepaid' || (Boolean(o.utrId) && o.paymentMethod !== 'cod');
    const isPaid = o.paymentStatus === 'paid' || o.paymentStatus === 'verified';
    if (nextStatus === 'Picked-up' && isPrepaidUTR && !isPaid) {
      if (o.paymentStatus === 'not_verified') {
        toast(`Cannot pick up order #${o.id}: Payment was rejected/not verified. The customer must pay the delivery fee first.`, 'error');
      } else {
        toast(`Cannot pick up order #${o.id}: Please verify customer pre-paid UTR payment first.`, 'error');
      }
      return;
    }
    setBusy(o.id);
    try {
      await api.updateStatus(o.id, nextStatus);
      toast(`${o.id} → ${nextStatus}`, 'success');
      await reload();

      // When order is marked Picked-up, immediately trigger live location and distance calculation!
      if (nextStatus === 'Picked-up') {
        handleEnableAgentGps({ ...o, status: 'Picked-up' });
      }
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy('');
  };

  const handleVerifyPayment = async (orderId, verified) => {
    try {
      await api.verifyPayment(orderId, verified);
      toast(`Payment for #${orderId} marked as ${verified ? 'Verified (Tax Invoice with PDF emailed to customer)' : 'Not Verified'}`, 'success');
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <PageHead title="My deliveries" sub="Assigned to you" />
      <div className="stats">
        <StatCard label="To do" value={active.length} icon="truck" tone="red" />
        <StatCard label="Completed" value={done.length} icon="check" tone="green" />
      </div>
      <h2 className="sec">Active</h2>
      {active.length === 0 ? <Empty title="No deliveries assigned" hint="New assignments appear here instantly." /> : (
        <div className="cards">{active.map((o) => {
          const isPrepaidUTR = o.itemPaid || o.paymentMethod === 'prepaid' || (Boolean(o.utrId) && o.paymentMethod !== 'cod');
          const isCodOrder = !isPrepaidUTR;
          const isPaid = o.paymentStatus === 'paid' || o.paymentStatus === 'verified';
          const fee = o.deliveryFee || 30;

          return (
            <div key={o.id} className="card agent-card">
              <div className="row">
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
                  onClick={() => setActiveOrderId(o.id)}
                  title="Click to view full order tracking and delivery map"
                >
                  <b>{o.id}</b>
                </button>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {o.paymentStatus === 'not_verified' && (
                    <span className="badge cancelled" style={{ fontSize: 11, fontWeight: 700 }}>
                      ⚠️ Payment Not Verified by Agent
                    </span>
                  )}
                  <StatusBadge status={o.status} />
                </div>
              </div>
              <p className="addr"><i className="dot-p" />{o.pickup.address}</p>
              <p className="addr"><i className="dot-d" />{o.drop.address}</p>
              <small>{o.pkg.type} · {o.pkg.weight} kg · {o.userName}</small>

              {/* Agent Live Location & Road Distance Calculation (When Picked-up or In-Transit) */}
              {(o.status === 'Picked-up' || o.status === 'In-Transit') && (
                <div className="agent-pickup-distance-panel">
                  {!(activeGpsOrders[o.id] || o.agentLoc || o.distanceKm) ? (
                    <div className="enable-gps-callout">
                      <div className="callout-text">
                        <span className="radar-icon">🛵</span>
                        <div>
                          <b>Order Picked Up — Enable Live Location</b>
                          <p>Turn on live location to start road delivery. Total road distance to customer drop will be calculated automatically.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn sm"
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12.5,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                          whiteSpace: 'nowrap',
                        }}
                        disabled={enablingGpsId === o.id}
                        onClick={() => handleEnableAgentGps(o)}
                      >
                        {enablingGpsId === o.id ? '📡 Acquiring GPS…' : '📍 Enable Live Location'}
                      </button>
                    </div>
                  ) : (
                    <div className="distance-display-box">
                      <div className="dist-top-row">
                        <span className="live-pulse-badge">
                          <i /> LIVE LOCATION ACTIVE
                        </span>
                        <button
                          type="button"
                          className="btn-recalc"
                          disabled={enablingGpsId === o.id}
                          onClick={() => handleEnableAgentGps(o)}
                        >
                          {enablingGpsId === o.id ? 'Updating GPS…' : '🔄 Recalculate Distance'}
                        </button>
                      </div>

                      <div className="dist-numbers-row">
                        <div className="dist-col">
                          <span className="dist-label">Total Road Distance</span>
                          <span className="dist-big">
                            {orderDistances[o.id]?.distanceKm || o.distanceKm || 'Calculating…'} {orderDistances[o.id]?.distanceKm || o.distanceKm ? 'km' : ''}
                          </span>
                        </div>
                        <span className="dist-sep">──────▶</span>
                        <div className="dist-col">
                          <span className="dist-label">Est. Travel Time</span>
                          <span className="dist-big" style={{ color: '#2563eb' }}>
                            ~{orderDistances[o.id]?.durationMins || o.durationMins || '...'} mins
                          </span>
                        </div>
                      </div>

                      <div className="dist-footer-info">
                        🛵 Agent GPS: {activeGpsOrders[o.id] && activeGpsOrders[o.id].lat != null ? `${Number(activeGpsOrders[o.id].lat).toFixed(5)}, ${Number(activeGpsOrders[o.id].lng).toFixed(5)}` : o.agentLoc && o.agentLoc.lat != null ? `${Number(o.agentLoc.lat).toFixed(5)}, ${Number(o.agentLoc.lng).toFixed(5)}` : 'Live satellite fix active'} · Route: Road-wise turn-by-turn
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CASE 1: Pre-Paid Item with UTR verification (NO QR CODE) */}
              {isPrepaidUTR && (
                <div style={{ marginTop: 8 }}>
                  {(o.paymentStatus === 'pending_agent_verification' || o.paymentStatus === 'pending_verification') && (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: 10,
                        padding: '10px 12px',
                        margin: '8px 0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ color: '#166534', fontSize: 13 }}>💳 Customer Paid Online (Verify UTR)</b>
                        <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          Pending Verification
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                        <div>UTR Ref: <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{o.utrId || o.txnId || 'N/A'}</code></div>
                        <div>Account Holder: <b>{o.accountHolderName || o.payerName || o.userName}</b></div>
                        <div>Delivery Fee: <b>₹{fee}</b></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn sm"
                          style={{ background: '#16a34a', color: '#fff', fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700 }}
                          onClick={() => handleVerifyPayment(o.id, true)}
                        >
                          ✓ Verify Payment
                        </button>
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: 12, padding: '5px 12px', borderRadius: 6, fontWeight: 700 }}
                          onClick={() => handleVerifyPayment(o.id, false)}
                          title="Reject payment: order cannot be picked up until user re-pays fee"
                        >
                          ✕ Reject / Not Verified
                        </button>
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={{ color: '#d97706', borderColor: '#fcd34d', fontSize: 12, padding: '5px 12px', borderRadius: 6 }}
                          onClick={() => setDisputingOrder(o)}
                        >
                          ⚠️ Adjust Fee
                        </button>
                      </div>
                    </div>
                  )}

                  {(o.paymentStatus === 'not_verified' || o.agentDisputed) && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        borderRadius: 10,
                        padding: '10px 12px',
                        margin: '8px 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <b style={{ color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ⚠️ Payment Not Verified by Agent
                          </b>
                          <div style={{ color: '#b91c1c', fontSize: 11.5, marginTop: 2 }}>
                            Updated Fee: <b>₹{fee}</b> {o.verificationNote ? `· ${o.verificationNote}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="link"
                          style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 700 }}
                          onClick={() => setDisputingOrder(o)}
                        >
                          Adjust Fee
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn sm"
                          style={{
                            background: '#5f259f',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '6px 14px',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(95, 37, 159, 0.3)',
                          }}
                          onClick={() => setQrOrder(o)}
                        >
                          <span>📱</span> Show PhonePe QR Code (₹{o.totalPayable || fee})
                        </button>
                      </div>
                    </div>
                  )}

                  {o.paymentStatus === 'verified' && (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 8,
                        padding: '6px 10px',
                        margin: '8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: '#15803d',
                      }}
                    >
                      <span>✓ Payment Verified (UTR: {o.utrId || o.txnId})</span>
                      <span style={{ fontWeight: 800 }}>₹{fee}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CASE 2: Cash on Delivery (COD) -> QR Code option ONLY for COD orders */}
              {isCodOrder && (
                <div
                  style={{
                    background: isPaid ? '#ecfdf5' : '#fdf4ff',
                    border: `1.5px solid ${isPaid ? '#a7f3d0' : '#f0abfc'}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    margin: '10px 0 6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{isPaid ? '✓' : '💵'}</span>
                      <b style={{ color: isPaid ? '#15803d' : '#86198f', fontSize: 13 }}>
                        {isPaid ? 'COD Paid' : 'Cash on Delivery (COD)'}
                      </b>
                    </div>
                    {isPaid ? (
                      <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6 }}>
                        PAID
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn sm ghost"
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, color: '#7e22ce', borderColor: '#d8b4fe' }}
                        onClick={() => setItemValOrder(o)}
                      >
                        {o.itemValue ? '✏️ Edit Item Value' : '➕ Add Item Value'}
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: isPaid ? '#166534' : '#581c87', lineHeight: 1.6 }}>
                    {o.itemValue ? (
                      <div>
                        <span>Item Value: <b>₹{o.itemValue}</b> ({o.itemDesc || 'Goods'})</span> • <span>Delivery: <b>₹{fee}</b></span>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#6b21a8', marginTop: 2 }}>
                          Total Due: ₹{o.totalPayable || (fee + o.itemValue)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span>Delivery Fee: <b>₹{fee}</b></span> · <span style={{ color: '#a21caf', fontStyle: 'italic' }}>Item value not added yet</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code button is strictly ONLY for COD orders */}
                  {!isPaid && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn sm"
                        style={{
                          background: '#5f259f',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '6px 14px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(95, 37, 159, 0.3)',
                        }}
                        onClick={() => setQrOrder(o)}
                      >
                        <span>📱</span> Show PhonePe QR Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {NEXT[o.status] === 'Picked-up' && isPrepaidUTR && !isPaid && (
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: o.paymentStatus === 'not_verified' ? '#dc2626' : '#b45309',
                  background: o.paymentStatus === 'not_verified' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${o.paymentStatus === 'not_verified' ? '#fecaca' : '#fde68a'}`,
                  borderRadius: 6,
                  padding: '5px 10px',
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span>🔒</span>
                  <span>
                    {o.paymentStatus === 'not_verified'
                      ? 'Pickup Locked: Payment rejected. Customer must re-pay delivery fee first.'
                      : 'Pickup Locked: Verify pre-paid UTR payment above to enable pickup.'}
                  </span>
                </div>
              )}

              <div className="row gap" style={{ marginTop: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn ghost sm" onClick={() => setActiveOrderId(o.id)}>
                    Details & Track
                  </button>
                  {NEXT[o.status] && (
                    <button
                      className="btn sm"
                      disabled={busy === o.id || (NEXT[o.status] === 'Picked-up' && isPrepaidUTR && !isPaid)}
                      onClick={() => quick(o)}
                      title={
                        NEXT[o.status] === 'Picked-up' && isPrepaidUTR && !isPaid
                          ? (o.paymentStatus === 'not_verified' ? 'Customer must re-pay fee before pickup' : 'Verify pre-paid UTR first')
                          : ''
                      }
                    >
                      {busy === o.id ? '…' : `Mark ${NEXT[o.status]}`}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  style={{
                    padding: '4px 8px',
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
            </div>
          );
        })}</div>
      )}
      {done.length > 0 && <><h2 className="sec">Completed</h2><div className="cards">{done.map((o) => (
        <div key={o.id} className="card agent-card dim" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row">
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
              onClick={() => setActiveOrderId(o.id)}
            >
              <b>{o.id}</b>
            </button>
            <StatusBadge status={o.status} />
          </div>
          <small>{o.drop.address}</small>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="link"
              style={{ fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onClick={() => setActiveOrderId(o.id)}
            >
              View
            </button>
            <button
              type="button"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingOrder(o);
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}</div></>}

      {/* Dynamic COD Collection QR Modal (STRICTLY FOR COD ONLY) */}
      <AgentQRModal
        order={qrOrder}
        isOpen={Boolean(qrOrder)}
        onClose={() => setQrOrder(null)}
        onPaymentReceived={async () => {
          await reload();
        }}
      />

      {/* Agent Dispute / Reject Payment & Update Rupees Modal */}
      <AgentDisputeModal
        order={disputingOrder}
        isOpen={Boolean(disputingOrder)}
        onClose={() => setDisputingOrder(null)}
        onDone={async () => {
          await reload();
        }}
      />

      {/* Agent Add Ordered Item Value Modal */}
      <AddItemValueModal
        order={itemValOrder}
        isOpen={Boolean(itemValOrder)}
        onClose={() => setItemValOrder(null)}
        onDone={async () => {
          await reload();
        }}
      />

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
                onClick={handleDeleteAgentOrder}
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
              ⚠️ <b>Warning:</b> This order will be permanently erased from both the MongoDB database and your screen.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
