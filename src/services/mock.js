// Demo backend: in-browser data + simulated socket events so the UI works with no server.
import { TK, STATUSES, uid, getPricing, savePricing, calculateDeliveryFee, evaluateDeliveryOffer, getSettings, saveSettings } from '../utils/helpers';

const L = {};
export const bus = {
  on(e, f) { (L[e] ??= new Set()).add(f); },
  off(e, f) { L[e]?.delete(f); },
  emit(e, p) { L[e]?.forEach((f) => f(p)); },
};

const C = [20.2961, 85.8245];
const H = 36e5;
const places = ['Patia', 'Saheed Nagar', 'Jaydev Vihar', 'Khandagiri', 'Nayapalli', 'Chandrasekharpur', 'Old Town', 'Rasulgarh', 'Baramunda', 'Mancheswar'];
const pts = places.map((n, i) => ({ n: `${n}, Bhubaneswar`, lat: 20.24 + ((i * 37) % 10) * 0.0105, lng: 85.77 + ((i * 53) % 10) * 0.0125 }));

function seed() {
  const now = Date.now();
  const mk = (id, name, email, password, role, phone) => ({ id, name, email, password, role, phone, active: true });
  const users = [
    mk('u1', 'Aarav Mishra', 'user@demo.com', 'user123', 'user', '9437000001'),
    mk('u2', 'Priya Das', 'priya@demo.com', 'user123', 'user', '9437000002'),
    mk('a1', 'Ravi Kumar', 'agent@demo.com', 'agent123', 'agent', '9437000011'),
    mk('a2', 'Sneha Nayak', 'sneha@demo.com', 'agent123', 'agent', '9437000012'),
    mk('a3', 'Imran Sheikh', 'imran@demo.com', 'agent123', 'agent', '9437000013'),
    mk('ad1', 'Admin Control', 'admin@demo.com', 'admin123', 'admin', '9437000099'),
  ];
  const st = ['Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'In-Transit', 'In-Transit', 'Picked-up', 'Picked-up', 'Placed', 'Placed', 'In-Transit', 'Placed'];
  const pricing = getPricing();
  const orders = st.map((status, i) => {
    const p = pts[i % 10], d = pts[(i + 5) % 10], created = now - (14 - i) * 11 * H;
    const u = users[i % 2], ag = users[2 + (i % 3)];
    const assigned = !(status === 'Placed' && i % 2 === 1);
    const idx = STATUSES.indexOf(status), dur = 2 + ((i * 5) % 9);
    const history = STATUSES.slice(0, idx + 1).map((s, k) => ({ status: s, at: new Date(created + ((k * dur) / 3) * H).toISOString() }));
    const t = status === 'Picked-up' ? 0 : 0.35 + (i % 3) * 0.15;
    const live = status === 'Picked-up' || status === 'In-Transit';
    const weight = 1 + (i % 6);
    const fee = calculateDeliveryFee(weight, pricing);
    const itemPaid = i % 2 === 0;
    const paymentMethod = itemPaid ? 'prepaid' : 'cod';
    const paymentStatus = status === 'Delivered'
      ? 'verified'
      : itemPaid
      ? (i === 11 ? 'not_verified' : 'pending_agent_verification')
      : 'pending_pickup';
    const itemValue = !itemPaid && i % 3 === 0 ? 150 + i * 20 : null;
    const totalPayable = fee + (itemValue || 0);

    return {
      id: `DL${1001 + i}`, userId: u.id, userName: u.name,
      pickup: { address: p.n, lat: p.lat, lng: p.lng }, drop: { address: d.n, lat: d.lat, lng: d.lng },
      pkg: { type: ['Documents', 'Electronics', 'Clothing', 'Grocery'][i % 4], weight, desc: 'Sealed carton' },
      notes: i % 3 ? '' : 'Call before arrival', status,
      agentId: assigned ? ag.id : null, agentName: assigned ? ag.name : null,
      createdAt: new Date(created).toISOString(), history,
      agentLoc: live && assigned ? { lat: p.lat + (d.lat - p.lat) * t, lng: p.lng + (d.lng - p.lng) * t } : null,
      rating: status === 'Delivered' ? 3 + (i % 3) : null,
      deliveryFee: fee,
      itemPaid,
      utrId: itemPaid ? (i === 11 ? 'UTR/INVALID_901' : `UTR${498210000000 + i}`) : '',
      accountHolderName: itemPaid ? u.name : '',
      itemValue,
      itemDesc: itemValue ? 'Ordered Goods / Store items' : '',
      totalPayable,
      paymentMethod,
      paymentStatus,
      txnId: itemPaid ? (i === 11 ? 'UTR/INVALID_901' : `UTR${498210000000 + i}`) : '',
      payerName: itemPaid ? u.name : '',
      cancellationFee: pricing.cancellation_fee,
    };
  });
  return { users, orders, seq: 1015 };
}

let db = JSON.parse(localStorage.getItem('dt_db_v1') || 'null') || seed();
const save = () => localStorage.setItem('dt_db_v1', JSON.stringify(db));
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 250));
const fail = (m) => new Promise((_, j) => setTimeout(() => j(new Error(m)), 250));
const strip = ({ password, ...u }) => u;
const cur = () => db.users.find((u) => 'mock-' + u.id === sessionStorage.getItem(TK));
const find = (id) => db.orders.find((o) => o.id === id);
const notify = (to, message, orderId) => bus.emit('newNotification', { id: uid(), to, message, orderId, time: Date.now() });

export const mockApi = {
  login: async (email, password) => {
    const u = db.users.find((x) => x.email === email.toLowerCase() && x.password === password);
    if (!u) return fail('Invalid email or password');
    if (!u.active) return fail('This account has been deactivated');
    return wait({ token: 'mock-' + u.id, user: strip(u) });
  },
  register: async (b) => {
    if (db.users.some((x) => x.email === b.email.toLowerCase())) return fail('Email already registered');
    const u = { id: uid(), name: b.name, email: b.email.toLowerCase(), password: b.password, role: b.role || 'user', phone: b.phone, active: true };
    db.users.push(u); save();
    return wait({ token: 'mock-' + u.id, user: strip(u) });
  },
  me: () => { const u = cur(); return u ? wait(strip(u)) : fail('Not authenticated'); },
  publicStats: () => wait({
    total: db.orders.length,
    preparing: db.orders.filter((x) => x.status === 'Placed').length,
    onTheWay: db.orders.filter((x) => x.status === 'Picked-up' || x.status === 'In-Transit').length,
    delivered: db.orders.filter((x) => x.status === 'Delivered').length,
  }),
  listOrders: () => wait(db.orders),
  myOrders: () => wait(db.orders.filter((o) => o.userId === cur()?.id)),
  assignedOrders: () => wait(db.orders.filter((o) => o.agentId === cur()?.id)),
  getOrder: (id) => (find(id) ? wait(find(id)) : fail('Order not found')),
  createOrder: async (b) => {
    const r = () => (Math.random() - 0.5) * 0.12;
    const u = cur();
    const pricing = getPricing();
    const weightNum = Number(b.weight) || 1;
    const itemValue = b.itemValue ? Number(b.itemValue) : null;
    const fee = calculateDeliveryFee(weightNum, pricing, itemValue);
    const evalResult = evaluateDeliveryOffer(pricing?.delivery_offer, itemValue);
    const offerApplied = evalResult.eligible ? (evalResult.title || 'Free Delivery Offer') : (b.offerApplied || '');
    const itemPaid = Boolean(b.itemPaid);
    const paymentMethod = itemPaid ? (b.paymentMethod || 'prepaid') : 'cod';
    const paymentStatus = itemPaid ? 'pending_agent_verification' : 'pending_pickup';
    const utrId = b.utrId || b.txnId || '';
    const accountHolderName = b.accountHolderName || b.payerName || u.name;
    const totalPayable = itemValue ? (fee + itemValue) : fee;

    const pAddress = typeof b.pickup === 'object' ? b.pickup.address : (b.pickup || '');
    const dAddress = typeof b.drop === 'object' ? b.drop.address : (b.drop || '');
    const pState = b.pickupState || b.pickup?.state || u.state || 'Odisha';
    const dState = b.dropState || b.drop?.state || pState;
    const pDistrict = b.pickupDistrict || b.pickup?.district || u.district || 'Khordha (Bhubaneswar)';
    const dDistrict = b.dropDistrict || b.drop?.district || '';
    const pMapLink = b.pickupMapLink || b.pickup?.mapLink || '';
    const dMapLink = b.dropMapLink || b.drop?.mapLink || '';

    const o = {
      id: `DL${db.seq++}`, userId: u.id, userName: u.name,
      pickup: { address: pAddress, state: pState, district: pDistrict, mapLink: pMapLink, lat: C[0] + r(), lng: C[1] + r() },
      drop: { address: dAddress, state: dState, district: dDistrict, mapLink: dMapLink, lat: C[0] + r(), lng: C[1] + r() },
      distanceKm: b.distanceKm || 3.5,
      pkg: { type: b.type, weight: weightNum, desc: b.desc }, notes: b.notes, status: 'Placed',
      agentId: null, agentName: null, createdAt: new Date().toISOString(),
      history: [{ status: 'Placed', at: new Date().toISOString() }], agentLoc: null, rating: null,
      deliveryFee: fee,
      originalDeliveryFee: calculateDeliveryFee(weightNum, pricing, 0),
      offerApplied,
      itemPaid,
      utrId,
      accountHolderName,
      itemValue,
      itemDesc: b.itemDesc || (itemValue ? `${b.type} Items` : ''),
      totalPayable,
      paymentMethod,
      paymentStatus,
      txnId: utrId || b.txnId || (paymentStatus === 'verified' ? `PP${Date.now()}` : ''),
      payerName: accountHolderName,
      cancellationFee: pricing.cancellation_fee,
    };
    db.orders.unshift(o); save();
    bus.emit('orderCreated', o);
    bus.emit('orderStatusUpdated', { orderId: o.id, order: o });
    notify('admin', `New order ${o.id} from ${u.name} (Fee: ₹${fee})`, o.id);
    return wait(o);
  },
  updateStatus: async (id, status) => {
    const o = find(id); if (!o) return fail('Order not found');
    o.status = status; o.history.push({ status, at: new Date().toISOString() });
    if (status === 'Picked-up') o.agentLoc = { lat: o.pickup.lat, lng: o.pickup.lng };
    if (status === 'Delivered') { o.agentLoc = null; o.rating = 3 + Math.round(Math.random() * 2); }
    save();
    bus.emit('orderStatusUpdated', { orderId: id, status, order: o });
    notify(o.userId, `Order ${id} is now ${status}`, id);
    notify('admin', `Order ${id} marked ${status} by ${o.agentName}`, id);
    return wait(o);
  },
  assignAgent: async (id, agentId) => {
    const o = find(id), a = db.users.find((u) => u.id === agentId);
    if (!o || !a) return fail('Order or agent not found');
    o.agentId = a.id; o.agentName = a.name; save();
    bus.emit('orderAssigned', { orderId: id, agentId, order: o });
    notify(a.id, `New delivery assigned: ${id}`, id);
    notify(o.userId, `${a.name} was assigned to order ${id}`, id);
    return wait(o);
  },
  getPricing: () => wait(getPricing()),
  savePricing: async (p) => {
    savePricing(p);
    bus.emit('pricingUpdated', p);
    return wait(p);
  },
  saveOffer: async (offer) => {
    const cur = getPricing();
    const updated = {
      ...cur,
      delivery_offer: {
        ...offer,
        updatedAt: new Date().toISOString(),
      },
    };
    savePricing(updated);
    bus.emit('pricingUpdated', updated);
    bus.emit('offerUpdated', updated.delivery_offer);
    return wait(updated);
  },
  verifyPayment: async (id, verified, payload = {}) => {
    const o = find(id); if (!o) return fail('Order not found');
    o.paymentStatus = verified ? 'verified' : 'not_verified';
    if (!verified) {
      if (payload.updatedAmount) {
        o.deliveryFee = Number(payload.updatedAmount);
        o.totalPayable = Number(payload.updatedAmount) + (o.itemValue || 0);
        o.updatedFee = Number(payload.updatedAmount);
      }
      if (payload.reason) o.verificationNote = payload.reason;
      o.agentDisputed = true;
    } else {
      o.verificationNote = 'Verified by agent/admin';
      o.agentDisputed = false;
      o.itemPaid = true;
      o.paidAt = new Date().toISOString();
    }
    save();
    bus.emit('orderStatusUpdated', { orderId: id, order: o });
    notify(o.userId, verified ? `Payment verified for order ${id}. Tax invoice PDF sent to your email.` : `Payment could NOT be verified for order ${id}. Updated fee: ₹${o.deliveryFee}. Please pay again.`, id);
    return wait(o);
  },
  updateItemValue: async (id, { itemValue, itemDesc }) => {
    const o = find(id); if (!o) return fail('Order not found');
    o.itemValue = Number(itemValue) || 0;
    if (itemDesc) o.itemDesc = itemDesc;
    o.totalPayable = (o.deliveryFee || 30) + o.itemValue;
    save();
    bus.emit('orderStatusUpdated', { orderId: id, order: o });
    notify(o.userId, `Agent added item value: ₹${o.itemValue}. Total COD due: ₹${o.totalPayable}`, id);
    notify('admin', `Agent updated item value for order ${id}: ₹${o.itemValue}`, id);
    return wait(o);
  },
  resubmitPayment: async (id, { txnId, payerName }) => {
    const o = find(id); if (!o) return fail('Order not found');
    o.txnId = txnId;
    o.payerName = payerName;
    o.paymentStatus = 'pending_verification';
    save();
    bus.emit('orderStatusUpdated', { orderId: id, order: o });
    notify('admin', `Payment resubmitted for order ${id} by ${o.userName}`, id);
    return wait(o);
  },
  cancelOrder: async (id, paymentData = {}) => {
    const o = find(id); if (!o) return fail('Order not found');
    const pricing = getPricing();
    o.status = 'Cancelled';
    o.cancellationFeeApplied = o.cancellationFee || pricing.cancellation_fee;
    o.cancellationTxnId = paymentData.txnId || `CAN${Date.now()}`;
    o.cancellationPaymentMethod = paymentData.method || 'PhonePe UPI';
    o.cancellationFeePaid = true;
    o.history.push({ status: 'Cancelled', at: new Date().toISOString() });
    save();
    bus.emit('orderStatusUpdated', { orderId: id, status: 'Cancelled', order: o });
    notify(o.userId, `Order ${id} cancelled. Mandatory fee ₹${o.cancellationFeeApplied} paid via ${o.cancellationPaymentMethod}.`, id);
    notify('admin', `Order ${id} cancelled by ${o.userName} (Fee ₹${o.cancellationFeeApplied} paid via ${o.cancellationPaymentMethod})`, id);
    return wait(o);
  },
  collectPickupPayment: async (id, paymentData = {}) => {
    const o = find(id); if (!o) return fail('Order not found');
    o.paymentStatus = 'verified';
    o.agentDisputed = false;
    if (paymentData.txnId) o.txnId = paymentData.txnId;
    if (paymentData.method) o.paymentMethod = paymentData.method;
    o.paidAt = new Date().toISOString();
    save();
    bus.emit('orderStatusUpdated', { orderId: id, order: o });
    const collectedAmt = paymentData.amount || o.totalPayable || o.deliveryFee || 30;
    notify(o.userId, `Payment of ₹${collectedAmt} received via PhonePe QR for order ${id}`, id);
    notify('admin', `Payment of ₹${collectedAmt} collected via PhonePe QR for order ${id}`, id);
    if (o.agentId) notify(o.agentId, `Payment of ₹${collectedAmt} received for order ${id}`, id);
    return wait(o);
  },
  listUsers: () => wait(db.users.map(strip)),
  saveUser: async (u) => {
    if (db.users.some((x) => x.email === u.email.toLowerCase() && x.id !== u.id)) return fail('Email already in use');
    if (u.id) { const t = db.users.find((x) => x.id === u.id); Object.assign(t, { ...u, email: u.email.toLowerCase(), password: u.password || t.password }); }
    else db.users.push({ ...u, id: uid(), email: u.email.toLowerCase(), active: true });
    save(); return wait({ ok: true });
  },
  deleteUser: async (id) => {
    db.users = db.users.filter((u) => u.id !== id);
    save();
    bus.emit('userDeleted', { userId: id, id });
    return wait({ ok: true, id, permanentlyDeleted: true });
  },
  toggleUser: async (id) => { const u = db.users.find((x) => x.id === id); u.active = !u.active; save(); return wait(strip(u)); },
  deleteOrder: async (id) => {
    db.orders = db.orders.filter((o) => o.id !== id);
    save();
    bus.emit('orderDeleted', { orderId: id, id });
    bus.emit('orderStatusUpdated', { orderId: id, deleted: true });
    return wait({ ok: true, id, permanentlyDeleted: true });
  },
  deleteAllOrders: async () => {
    const count = db.orders.length;
    db.orders = [];
    save();
    bus.emit('allOrdersDeleted', { deletedCount: count });
    bus.emit('orderStatusUpdated', { orderId: null, allDeleted: true });
    return wait({ ok: true, deletedCount: count, permanentlyDeleted: true });
  },
  getSettings: async () => wait(getSettings()),
  saveSettings: async (s) => {
    const updated = saveSettings(s);
    bus.emit('settingsUpdated', updated);
    return wait(updated);
  },
  sendInvoiceEmail: async (id) => {
    return wait({ ok: true, message: 'Tax invoice email sent to registered email' });
  },
  sendDeliveredEmail: async (id) => {
    return wait({ ok: true, message: 'Delivered celebration email sent to registered email' });
  },
  submitFeedback: async (id, { rating, feedback }) => {
    const o = find(id);
    if (o) {
      o.rating = rating;
      o.feedback = feedback || '';
      o.feedbackAt = new Date().toISOString();
      save();
    }
    return wait({ ok: true, message: 'Feedback submitted successfully', order: o });
  },
};

// Simulated socket server: agent GPS -> broadcast; idle in-transit agents drift toward the drop point.
const shared = {};
bus.on('agentLocation', (p) => {
  const o = find(p.orderId); if (!o) return;
  o.agentLoc = { lat: p.lat, lng: p.lng }; shared[o.id] = Date.now(); save();
  bus.emit('agentLocationUpdated', { orderId: o.id, agentId: o.agentId, lat: p.lat, lng: p.lng });
});
setInterval(() => {
  db.orders.filter((o) => o.status === 'In-Transit' && o.agentLoc && Date.now() - (shared[o.id] || 0) > 10000).forEach((o) => {
    const { lat, lng } = o.agentLoc;
    o.agentLoc = { lat: lat + (o.drop.lat - lat) * 0.06, lng: lng + (o.drop.lng - lng) * 0.06 };
    bus.emit('agentLocationUpdated', { orderId: o.id, agentId: o.agentId, ...o.agentLoc });
  });
}, 3000);
