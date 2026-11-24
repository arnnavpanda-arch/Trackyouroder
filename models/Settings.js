import mongoose from 'mongoose';
import { getDefaultServiceableRegions } from '../utils/indiaGeoData.js';

const DEFAULT_PRIVACY = `### 1. Information We Collect
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
If you have questions regarding this Privacy Policy, please contact our Data Protection Team at support@trackora.com.`;

const DEFAULT_TERMS = `### 1. Acceptance of Terms
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
Trackora shall not be liable for delivery delays caused by force majeure, extreme weather, road blockages, or incorrect address information provided by the customer.`;

const settingsSchema = new mongoose.Schema(
  {
    company_name: {
      type: String,
      default: 'Delivery Tracker Logistics Services Pvt. Ltd.',
    },
    company_address: {
      type: String,
      default: 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India',
    },
    company_pan: {
      type: String,
      default: 'AABCD1234E',
    },
    company_gstin: {
      type: String,
      default: '21AABCD1234E1Z5',
    },
    copyright_text: {
      type: String,
      default: '© 2026 Delivery Tracker Logistics. All rights reserved.',
    },
    support_email: {
      type: String,
      default: 'support@trackora.com',
    },
    support_phone: {
      type: String,
      default: '+91 94370 00099',
    },
    privacy_policy: {
      type: String,
      default: DEFAULT_PRIVACY,
    },
    terms_conditions: {
      type: String,
      default: DEFAULT_TERMS,
    },
    logo_url: {
      type: String,
      default: '',
    },
    google_maps_api_key: {
      type: String,
      default: 'AIzaSyBP8VFAuzKqFeiRg77Jg7razxXYMWKpu94',
    },
    serviceable_regions: {
      type: [
        {
          state: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          districts: [{ type: String }],
        },
      ],
      default: () => getDefaultServiceableRegions(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
