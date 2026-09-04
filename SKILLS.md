# SKILLS.md — Picky Developer Guide

> **Project:** Picky — Single-Vendor E-Commerce Platform
> **Stack:** MERN (MongoDB, Express.js, React 18, Node.js)
> **Architecture:** Modular Monolith · 2 Separate Repos
> **Pattern:** Controller → Service → Repository → Database

---

## Table of Contents

1. [Two Repos Overview](#1-two-repos-overview)
2. [Getting Started](#2-getting-started)
3. [Backend Guide — picky-server](#3-backend-guide--picky-server)
4. [Frontend Guide — picky_client](#4-frontend-guide--picky_client)
5. [Order Tracking Feature](#5-order-tracking-feature)
6. [API Contract Process](#6-api-contract-process)
7. [Database Rules](#7-database-rules)
8. [Naming Conventions](#8-naming-conventions)
9. [Environment Variables](#9-environment-variables)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Two Repos Overview

| Repo | Purpose | Deploy |
|------|---------|--------|
| **picky_client** | Customer App + Admin Panel | Vercel |
| **picky-server** | REST API Server | Render / Railway |

### Who works where

| Developer | Primary Repo | Modules |
|-----------|-------------|---------|
| **Dev 1** | picky_client | All customer pages, Cart, Checkout, Order Tracking UI |
| **Dev 2** | picky_client | Admin panel pages (`/pickyadmin-softnova2026/*`) |
| **Dev 3** | picky-server | auth, product, category, cart modules + all Mongoose models |
| **Dev 4** | picky-server | order, discount, coupon, report + WhatsApp notifications + tracking API |

### Cross-repo coordination
- Dev 3/4 define API shape **first** (write in WhatsApp group or api.md)
- Dev 1/2 mock with static data while server is being built
- Integration happens when real API is ready — swap mock with Axios call

---

## 2. Getting Started

### Prerequisites
- Node.js 20 LTS
- npm 10+
- MongoDB (Atlas connection string)
- Redis (local or Upstash URL)

### Setup picky-server

```bash
cd picky-server
npm install
cp .env.example .env
# Fill all values (MongoDB URI, Redis, Twilio, Cloudinary, JWT secrets)
npm run dev
# Runs on http://localhost:5000
```

### Setup picky_client

```bash
cd picky_client
npm install
cp .env.example .env
# Edit .env → set VITE_API_URL=http://localhost:5000/api/v1
npm run dev
# Runs on http://localhost:3000
```

---

## 3. Backend Guide — picky-server

### Module File Structure (5 files per module — ALWAYS)

```
modules/<module>/
  <module>.controller.js   ← Only req/res. No business logic.
  <module>.service.js      ← ALL business logic here.
  <module>.repository.js   ← DB queries ONLY.
  <module>.routes.js       ← Express Router.
  <module>.schema.js       ← Zod validation schemas.
```

### Controller Pattern (THIN)

```js
// modules/order/order.controller.js
const OrderService = require('./order.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getTracking = async (req, res, next) => {
  try {
    const tracking = await OrderService.getTracking(req.params.id, req.user.id);
    return res.json(ApiResponse.success(tracking));
  } catch (err) {
    next(err);
  }
};

const addTracking = async (req, res, next) => {
  try {
    const order = await OrderService.addTracking(req.params.id, req.body);
    return res.json(ApiResponse.success(order, 'Tracking updated. WhatsApp sent.'));
  } catch (err) {
    next(err);
  }
};
```

### Service Pattern (Business Logic)

```js
// modules/order/order.service.js

async getTracking(orderId, userId) {
  const order = await OrderRepo.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.user.toString() !== userId) throw new AppError('Not authorized', 403);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    trackingId: order.trackingId || null,
    courier: order.courier || null,
    statusHistory: order.statusHistory || [],
  };
}

async addTracking(orderId, { trackingId, courier }) {
  const order = await OrderRepo.addTracking(orderId, { trackingId, courier });
  // Trigger WhatsApp (async — don't block response)
  NotificationService.sendOrderShipped(order).catch(console.error);
  return order;
}
```

### Repository Pattern (DB Only)

```js
// modules/order/order.repository.js
async addTracking(id, { trackingId, courier }) {
  return Order.findByIdAndUpdate(
    id,
    {
      trackingId,
      courier,
      status: 'shipped',
      $push: { statusHistory: { status: 'shipped', timestamp: new Date() } },
    },
    { new: true }
  );
}

async getTracking(id) {
  return Order.findById(id)
    .select('orderNumber status trackingId courier statusHistory user')
    .lean();
}
```

### Error Handling

```js
// Always use AppError for controlled errors
throw new AppError('Order not found', 404);
throw new AppError('Insufficient stock', 400);
throw new AppError('Invalid coupon code', 400);

// Global handler in app.js catches all
// Returns: { success: false, error: "message", statusCode: 404 }
```

### Standard API Response Format

```json
// Success:
{ "success": true, "data": { ... }, "message": "Optional message" }

// Error:
{ "success": false, "error": "Order not found", "statusCode": 404 }
```

### Admin Routes Pattern

```js
// All admin routes are prefixed /api/v1/admin/
// Protected by: authenticate + requireRole('admin')

router.patch('/admin/orders/:id/tracking',
  authenticate,
  requireRole('admin'),
  validate(trackingSchema),
  orderController.addTracking
);
```

---

## 4. Frontend Guide — picky_client

### URL Structure

| URL | Who can access |
|-----|---------------|
| `/` | Public — All customers |
| `/pickyadmin-softnova2026` | Admin only — protected |
| `/pickyadmin-softnova2026/*` | Admin only — protected |

### Folder Structure

```
src/
  components/
    ui/                  ← Button, Input, Modal, Toast, Spinner, Badge
    layout/              ← Navbar, Footer, PageWrapper, ProtectedRoute, AdminProtectedRoute
    product/             ← ProductCard, Gallery, PriceDisplay
    order/               ← OrderTracker, TrackingStepper, AWBBox, StatusTimeline
  pages/                 ← One file per route
    admin/               ← All admin pages (/pickyadmin-softnova2026/*)
  store/                 ← Zustand stores
  services/              ← Axios API calls
  hooks/                 ← Custom React hooks
  styles/                ← CSS files (index.css, admin.css)
  utils/                 ← formatPrice, slugify, formatDate
```

### Zustand Store Pattern

```js
// store/orderStore.js
import { create } from 'zustand';

export const useOrderStore = create((set) => ({
  orders: [],
  activeOrder: null,
  trackingInfo: null,

  setOrders: (orders) => set({ orders }),
  setActiveOrder: (order) => set({ activeOrder: order }),
  setTrackingInfo: (info) => set({ trackingInfo: info }),
}));
```

### TanStack Query Pattern

```js
// hooks/useOrderTracking.js
import { useQuery } from '@tanstack/react-query';
import { orderService } from '../services/order.service';

export function useOrderTracking(orderId) {
  return useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: () => orderService.getTracking(orderId),
    enabled: !!orderId,
    staleTime: 30_000,
    refetchInterval: 30_000,    // Poll every 30s while page is open
  });
}
```

### Axios Service Pattern

```js
// services/order.service.js
import api from './api';

export const orderService = {
  list: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  getTracking: (id) => api.get(`/orders/${id}/tracking`),
  checkout: (body) => api.post('/orders', body),
};
```

### Protected Route

```jsx
// components/layout/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// components/layout/AdminProtectedRoute.jsx
export function AdminProtectedRoute({ children }) {
  const { isLoggedIn, user } = useAuthStore();
  if (!isLoggedIn || user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
```

---

## 5. Order Tracking Feature

### Customer Flow (picky_client)
1. Customer goes to **My Orders** (`/orders`)
2. Clicks any order → goes to **Order Detail** (`/orders/:id`)
3. Page shows `OrderTracker` component which calls `GET /orders/:id/tracking`
4. Visual 3-step stepper: **Confirmed → Shipped → Delivered**
5. If status is `shipped`: AWB number displayed, courier name shown, copy-to-clipboard button
6. Status timeline (chronological, newest first)
7. Page auto-refreshes tracking every 30 seconds

### Admin Flow (picky_client + picky-server)
1. Admin opens `/pickyadmin-softnova2026/orders/:id`
2. Enters AWB number + selects courier from dropdown
3. Clicks "Mark as Shipped" → calls `PATCH /admin/orders/:id/tracking`
4. Server: updates status, pushes to `statusHistory[]`, triggers WhatsApp to customer

### Tracking API Contract

```
GET /api/v1/orders/:id/tracking
Auth: Bearer token (customer — owns the order)

Response 200:
{
  "success": true,
  "data": {
    "orderNumber": "PKY-20260903-0042",
    "status": "shipped",
    "trackingId": "D123456789IN",
    "courier": "DTDC Express",
    "statusHistory": [
      { "status": "shipped",   "timestamp": "2026-09-03T08:40:00Z" },
      { "status": "confirmed", "timestamp": "2026-09-03T04:54:00Z" }
    ]
  }
}

PATCH /api/v1/admin/orders/:id/tracking
Auth: Bearer token (admin)
Body: { "trackingId": "D123456789IN", "courier": "DTDC Express" }

Side effects:
  - order.status → "shipped"
  - order.statusHistory[] → push { status: "shipped", timestamp: now }
  - WhatsApp sent to customer with AWB number
```

### WhatsApp Message Templates (Twilio)

```
OTP:
"Your Picky OTP is: {{otp}}. Valid for 5 minutes. Do not share."

Order Confirmed:
"Hi {{name}}! Your Picky order #{{orderNumber}} is confirmed!
Total: Rs.{{amount}}. We'll notify when shipped."

Order Shipped:
"Order #{{orderNumber}} shipped!
Courier: {{courier}}
AWB: {{trackingId}}"

Order Delivered:
"Picky order #{{orderNumber}} delivered!
Thank you for shopping with us!"
```

---

## 6. API Contract Process

**Rule: API Contract FIRST, Code SECOND**

1. Dev 3 or Dev 4 writes the endpoint shape in WhatsApp group or `api.md`
2. Team reviews (async, 5 min)
3. Dev 1/2 build the UI with **mock/hardcoded data**
4. Dev 3/4 implement the real API
5. Dev 1/2 swap mock for real Axios call → test integration

---

## 7. Database Rules

1. **`.lean()`** on all read-only queries (performance)
2. **Never `find()` without limit** — always paginate
3. **Order items = SNAPSHOT** — copy name, image, price at time of purchase
4. **`statusHistory[]`** — always push on every status change, never overwrite
5. **`trackingId` and `courier`** — null by default, set only when admin enters AWB
6. **First-order gift** — NEVER expose in API response. Type `first_order` is internal only
7. **Soft delete products** — `isActive: false`, never hard delete
8. **Validate ObjectId** — `mongoose.isValidObjectId(id)` before any query

### Required MongoDB Indexes

```js
db.users.createIndex({ phone: 1 }, { unique: true })
db.categories.createIndex({ slug: 1 }, { unique: true })
db.products.createIndex({ slug: 1 }, { unique: true })
db.products.createIndex({ category: 1 })
db.products.createIndex({ isActive: 1 })
db.products.createIndex({ name: 'text', tags: 'text' })
db.orders.createIndex({ user: 1, createdAt: -1 })
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ orderNumber: 1 }, { unique: true })
db.coupons.createIndex({ code: 1 }, { unique: true })
db.coupon_usages.createIndex({ coupon: 1, user: 1 }, { unique: true })
db.inventory.createIndex({ product: 1 }, { unique: true })
```

---

## 8. Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Backend files | kebab-case | `order.service.js` |
| React components | PascalCase | `OrderTracker.jsx` |
| JS variables | camelCase | `trackingId` |
| Constants | UPPER_SNAKE_CASE | `MAX_OTP_ATTEMPTS` |
| CSS classes | kebab-case | `awb-box` |
| MongoDB collections | snake_case plural | `coupon_usages` |
| API endpoints | kebab-case | `/send-otp` |
| Admin URL prefix | fixed | `/pickyadmin-softnova2026` |

---

## 9. Environment Variables

### picky-server/.env.example

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/picky
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OTP_EXPIRE_SECONDS=300
OTP_MAX_ATTEMPTS=3
ALLOWED_ORIGINS=http://localhost:3000
```

### picky_client/.env.example

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_APP_NAME=Picky
VITE_ADMIN_PATH=pickyadmin-softnova2026
```

> **NEVER commit `.env`** — only `.env.example`. Share actual secrets via WhatsApp or secure channel. Set production secrets directly in Vercel/Render dashboard.

---

## 10. Testing Checklist

### Tracking Feature

- [ ] Place order → status = `confirmed`
- [ ] Call `GET /orders/:id/tracking` → `{ status: "confirmed", trackingId: null, courier: null }`
- [ ] Customer sees step 1 highlighted in stepper
- [ ] Admin enters AWB: `PATCH /admin/orders/:id/tracking` → `{ trackingId: "D123", courier: "DTDC" }`
- [ ] Order status becomes `shipped`
- [ ] `statusHistory[]` has both `confirmed` and `shipped` entries
- [ ] WhatsApp received with AWB number
- [ ] Customer sees step 2 highlighted (Shipped), AWB box shows, copy button works
- [ ] Admin marks as delivered → WhatsApp delivery notification sent
- [ ] All 3 steps shown as done in stepper

### Auth Flow
- [ ] Send OTP → receive WhatsApp/SMS
- [ ] Wrong OTP 3 times → blocked
- [ ] Verify OTP → JWT returned
- [ ] Expired token → 401 → auto refresh → retry succeeds

### Cart & Order
- [ ] Add → Login (merge guest cart) → Checkout → Order confirmed
- [ ] Apply valid coupon → discount applied
- [ ] First-order customer → gift applied silently (no label in response)
- [ ] Checkout with out-of-stock item → 400 error

---

*Last updated: 2026-09-04 | Version: 2.0.0*
*See `index.html` for the full visual architecture with interactive diagrams.*
