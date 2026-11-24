# Delivery Tracker — Node.js & Express & MongoDB Backend

A production-ready REST API and real-time Socket.IO backend built for the **Trackora Delivery Tracker** application.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (ES Modules)
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Real-Time:** Socket.IO
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **Environment:** dotenv

---

## 🍃 MongoDB Connection

Connected to your cluster using:
```env
MONGODB_URI=mongodb+srv://bookpujaconnect_db_user:M3YQ5Vqw19a2LBVH@cluster0.b52rwhb.mongodb.net/pujaconnect?retryWrites=true&w=majority&appName=Cluster0
```

---

## 🚀 Quick Start

### 1. Start Backend Server
From the root directory:
```bash
npm run server
```
Or with auto-restart on changes:
```bash
npm run server:dev
```
Or directly from the `server/` directory:
```bash
cd server
npm start
```

### 2. Start Frontend
```bash
npm run dev
```

---

## 🔑 Default Accounts (Auto-Seeded)

The database automatically seeds these accounts if they do not exist:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@demo.com` | `admin123` |
| **Agent 1** | `agent@demo.com` | `agent123` |
| **Agent 2** | `sneha@demo.com` | `agent123` |
| **Agent 3** | `imran@demo.com` | `agent123` |
| **Customer 1** | `user@demo.com` | `user123` |
| **Customer 2** | `priya@demo.com` | `user123` |

---

## 📡 REST API Documentation

Base URL: `http://localhost:5001/api`

### 1. Authentication (`/api/auth`)
- `POST /api/auth/login` — Login with email and password, returns `{ token, user }`
- `POST /api/auth/register` — Register a new account
- `GET /api/auth/me` — Get current user profile (requires Bearer token)

### 2. Orders (`/api/orders`)
- `GET /api/orders` — List all orders (Admin / All)
- `GET /api/orders/my` — List orders placed by current user
- `GET /api/orders/assigned` — List orders assigned to current agent
- `GET /api/orders/:id` — Get single order details (e.g. `DL1001`)
- `POST /api/orders` — Place a new order (calculates dynamic pricing, generates order ID)
- `PATCH /api/orders/:id/status` — Update delivery status (`Placed`, `Picked-up`, `In-Transit`, `Delivered`)
- `PATCH /api/orders/:id/assign` — Assign an agent to an order
- `PATCH /api/orders/:id/payment-verification` — Agent/Admin verifies or disputes UTR payment
- `PATCH /api/orders/:id/item-value` — Agent adds/edits item description and value for COD orders
- `PATCH /api/orders/:id/resubmit-payment` — Customer resubmits payment reference
- `POST /api/orders/:id/cancel` — Cancel order & record cancellation fee
- `POST /api/orders/:id/collect-payment` — Collect COD or PhonePe QR payment

### 3. Pricing (`/api/pricing`)
- `GET /api/pricing` — Get current dynamic pricing rules
- `POST /api/pricing` — Update base fee, weight limits, extra fee, and cancellation fee (Admin)

### 4. User Management (`/api/users`)
- `GET /api/users` — List all users (Admin)
- `POST /api/users` — Create user
- `PUT /api/users/:id` — Update user
- `DELETE /api/users/:id` — Delete user
- `PATCH /api/users/:id/toggle` — Toggle user active/deactivated state

---

## ⚡ Socket.IO Real-Time Events

Connected on: `ws://localhost:5001`

- `orderCreated` — Emitted when a new order is created
- `orderStatusUpdated` — Emitted when an order changes status, is verified, or fee is updated
- `orderAssigned` — Emitted when an order is assigned to an agent
- `pricingUpdated` — Emitted when pricing changes
- `newNotification` — Live notifications sent to specific users or admins
- `agentLocation` — Incoming agent GPS coordinates
- `agentLocationUpdated` — Broadcasted to map view for live package tracking
