export const TK = 'dt_token';
import { getDefaultServiceableRegions } from './indiaGeoData';
export const MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const STATUSES = ['Placed', 'Picked-up', 'In-Transit', 'Delivered'];
export const NEXT = { Placed: 'Picked-up', 'Picked-up': 'In-Transit', 'In-Transit': 'Delivered' };
export const SLA_H = 8;
export const homeFor = (role) => ({ user: '/user', agent: '/agent', admin: '/admin' }[role] || '/login');
export const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_OFFER = {
  active: false,
  type: 'none', // 'min_amount' | 'timed_window' | 'none'
  min_amount: 500,
  start_date: null,
  end_date: null,
  title: '',
  banner_text: '',
  updatedAt: null,
};

export const DEFAULT_PRICING = {
  under_1kg: 40,
  tier_1_to_5kg: 80,
  tier_above_5kg: 150,
  base_distance_km: 5,
  min_distance_fee: 50,
  extra_per_km: 12,
  cancellation_fee: 30,
  delivery_offer: DEFAULT_OFFER,
};

export const getPricing = () => {
  try {
    const raw = localStorage.getItem('dt_pricing_v1');
    if (raw) return { ...DEFAULT_PRICING, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PRICING;
};

export const savePricing = (p) => {
  try {
    localStorage.setItem('dt_pricing_v1', JSON.stringify(p));
  } catch {}
  return p;
};

export function evaluateDeliveryOffer(offer, itemValue = 0) {
  if (!offer || !offer.active || offer.type === 'none') {
    return { active: false, eligible: false, isExpired: false };
  }
  const now = new Date();

  if (offer.type === 'timed_window') {
    const start = offer.start_date ? new Date(offer.start_date) : null;
    const end = offer.end_date ? new Date(offer.end_date) : null;
    if (start && now < start) {
      return { active: false, eligible: false, isExpired: false, notStarted: true };
    }
    if (end && now > end) {
      return { active: false, eligible: false, isExpired: true };
    }
    return {
      active: true,
      eligible: true,
      isExpired: false,
      type: 'timed_window',
      title: offer.title || 'Limited-Time Free Delivery Offer',
      banner_text: offer.banner_text || 'Free delivery available for a limited time on all orders!',
      expiresAt: end,
    };
  }

  return { active: false, eligible: false, isExpired: false };
}

export function calculateDeliveryFee(weight, pricing = getPricing(), itemValue = 0, distanceKm = null) {
  const w = Number(weight) || 0;
  const d = distanceKm != null ? Math.max(0.5, Number(distanceKm)) : 3.5;
  const baseDist = Number(pricing?.base_distance_km) || 5;
  const minDistanceFee = Number(pricing?.min_distance_fee) || Number(pricing?.under_1kg) || 50;
  const extraPerKm = Number(pricing?.extra_per_km) || 12;

  let distFee = minDistanceFee;
  if (d > baseDist) {
    distFee = minDistanceFee + Math.ceil((d - baseDist) * extraPerKm);
  }

  let weightSurcharge = 0;
  if (w > 5) {
    weightSurcharge = (Number(pricing?.tier_above_5kg) || 150) - (Number(pricing?.under_1kg) || 40);
  } else if (w > 1) {
    weightSurcharge = (Number(pricing?.tier_1_to_5kg) || 80) - (Number(pricing?.under_1kg) || 40);
  }
  const base = distFee + Math.max(0, weightSurcharge);

  const offer = pricing?.delivery_offer;
  const evalResult = evaluateDeliveryOffer(offer, itemValue);

  if (evalResult.eligible) {
    return 0;
  }
  return base;
}

export function getDeliveryFeeDetails(weight, pricing = getPricing(), itemValue = 0, distanceKm = null) {
  const w = Number(weight) || 0;
  const d = distanceKm != null ? Math.max(0.5, Number(distanceKm)) : 3.5;
  const baseDist = Number(pricing?.base_distance_km) || 5;
  const minDistanceFee = Number(pricing?.min_distance_fee) || Number(pricing?.under_1kg) || 50;
  const extraPerKm = Number(pricing?.extra_per_km) || 12;

  let distFee = minDistanceFee;
  const extraKm = Math.max(0, +(d - baseDist).toFixed(1));
  const extraDistCharge = extraKm > 0 ? Math.ceil(extraKm * extraPerKm) : 0;
  if (d > baseDist) {
    distFee = minDistanceFee + extraDistCharge;
  }

  let weightSurcharge = 0;
  if (w > 5) {
    weightSurcharge = (Number(pricing?.tier_above_5kg) || 150) - (Number(pricing?.under_1kg) || 40);
  } else if (w > 1) {
    weightSurcharge = (Number(pricing?.tier_1_to_5kg) || 80) - (Number(pricing?.under_1kg) || 40);
  }
  const base = distFee + Math.max(0, weightSurcharge);

  const offer = pricing?.delivery_offer;
  const evalResult = evaluateDeliveryOffer(offer, itemValue);

  return {
    fee: evalResult.eligible ? 0 : base,
    originalFee: base,
    distanceKm: d,
    baseDistanceKm: baseDist,
    minDistanceFee,
    extraPerKm,
    extraKm,
    extraDistCharge,
    weightSurcharge: Math.max(0, weightSurcharge),
    isFree: evalResult.eligible,
    offerActive: evalResult.active,
    offerApplied: evalResult.eligible ? evalResult.title : '',
    offerType: evalResult.type,
    minAmount: evalResult.minAmount,
    neededMore: evalResult.neededMore,
    expiresAt: evalResult.expiresAt,
  };
}

export const rules = {
  email: (v) => (/^\S+@\S+\.\S+$/.test(v || '') ? '' : 'Enter a valid email'),
  password: (v) => ((v || '').length >= 6 ? '' : 'At least 6 characters'),
  required: (label) => (v) => ((v || '').toString().trim() ? '' : `${label} is required`),
  min: (label, n) => (v) => ((v || '').trim().length >= n ? '' : `${label} must be at least ${n} characters`),
  phone: (v) => (/^\d{10}$/.test(v || '') ? '' : 'Enter a 10-digit phone number'),
};
export const validate = (values, schema) => {
  const errors = {};
  Object.entries(schema).forEach(([k, fn]) => { const m = fn(values[k]); if (m) errors[k] = m; });
  return errors;
};

export const deliveredAt = (o) => o.history.find((h) => h.status === 'Delivered')?.at;
export const durH = (o) => { const d = deliveredAt(o); return d ? (new Date(d) - new Date(o.createdAt)) / 36e5 : null; };

export function computeStats(orders) {
  const del = orders.filter((o) => o.status === 'Delivered');
  const d = del.map(durH);
  const rated = del.filter((o) => o.rating);
  return {
    total: orders.length,
    active: orders.filter((o) => o.status === 'Picked-up' || o.status === 'In-Transit').length,
    placed: orders.filter((o) => o.status === 'Placed').length,
    delivered: del.length,
    onTime: del.length ? Math.round((d.filter((x) => x <= SLA_H).length / del.length) * 100) : 0,
    avg: d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) : 0,
    csat: rated.length ? +(rated.reduce((a, o) => a + o.rating, 0) / rated.length).toFixed(1) : 0,
  };
}

export function series(orders, from, to) {
  const out = [];
  const s = new Date(from); s.setHours(0, 0, 0, 0);
  const e = new Date(to); e.setHours(0, 0, 0, 0);
  for (let d = new Date(s); d <= e && out.length < 62; d.setDate(d.getDate() + 1)) {
    const k = d.toDateString();
    out.push({
      day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      orders: orders.filter((o) => new Date(o.createdAt).toDateString() === k).length,
      delivered: orders.filter((o) => { const t = deliveredAt(o); return t && new Date(t).toDateString() === k; }).length,
    });
  }
  return out;
}

export const DEFAULT_SETTINGS = {
  company_name: 'Delivery Tracker Logistics Services Pvt. Ltd.',
  company_address: 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India',
  company_pan: 'AABCD1234E',
  company_gstin: '21AABCD1234E1Z5',
  copyright_text: '© 2026 Delivery Tracker Logistics. All rights reserved.',
  support_email: 'trackoradelivery@gmail.com',
  support_phone: '+91 94370 00099',
  logo_url: '',
  google_maps_api_key: 'AIzaSyBP8VFAuzKqFeiRg77Jg7razxXYMWKpu94',
  serviceable_regions: getDefaultServiceableRegions(),
  privacy_policy: `### 1. Information We Collect
We collect personal information that you provide to us when placing an order, registering an account, or interacting with our delivery services. This includes:
- **Contact Details:** Full name, phone number, email address, and delivery coordinates.
- **Shipment Details:** Package description, weight, item declared value, and sender/recipient addresses.
- **Payment & UTR Verification:** Bank transfer reference/UTR numbers, transaction identifiers, and payment method details.
- **Location Information:** Real-time GPS location of active delivery agents for live tracking.

### 2. How We Use Your Information
- To dispatch, route, track, and complete delivery of your packages.
- To facilitate digital payment verification (UPI, PhonePe, Cards, Cash on Delivery).
- To send SMS, email, and live in-app notifications regarding parcel pickup, in-transit progress, and delivery confirmation.
- To detect, prevent, and resolve delivery disputes or fraudulent activities.

### 3. Data Protection & Security
We implement strict industry-standard security practices, encrypted SSL communication, and secure MongoDB storage. Your payment information and personal contact numbers are strictly guarded and never sold to third parties.

### 4. Contact Us
If you have questions regarding this Privacy Policy, please contact our Data Protection Team at support@trackora.com.`,
  terms_conditions: `### 1. Acceptance of Terms
By placing an order or using Trackora Delivery Services, you agree to comply with and be bound by these Terms and Conditions.

### 2. Package Inspection & Prohibited Items
- Customers must accurately declare package type and contents.
- Hazardous substances, illegal narcotics, unregistered weapons, explosive materials, and perishable items without proper insulation are strictly prohibited.
- Delivery agents reserve the right to inspect outer packaging to ensure safe transit.

### 3. Pricing, Delivery Fees & Item Values
- Delivery fees are computed dynamically based on package weight, distance, and selected service speed.
- For Cash on Delivery (COD) orders, any added item cost must be settled in full with the assigned agent upon package handover via Cash or verified PhonePe QR.
- If a pre-paid UTR payment cannot be verified in banking statements, an adjusted fee will apply and must be cleared prior to final delivery.

### 4. Cancellation Policy
- Orders can be cancelled prior to final delivery subject to a mandatory cancellation processing fee.
- If an agent has already picked up the parcel, cancellation fee covers logistics and return transit costs.

### 5. Limitation of Liability
Trackora shall not be liable for delivery delays caused by force majeure, extreme weather, road blockages, or incorrect address information provided by the customer.`,
};

export const getSettings = () => {
  try {
    const raw = localStorage.getItem('dt_settings_v1');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
};

export const saveSettings = (s) => {
  try {
    localStorage.setItem('dt_settings_v1', JSON.stringify(s));
  } catch {}
  return s;
};

