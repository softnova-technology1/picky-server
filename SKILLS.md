# SKILLS.md — Picky Developer Collaboration Guide

> **Project:** Picky — Single-Vendor E-Commerce Platform  
> **Stack:** MERN (MongoDB, Express.js, React 18, Node.js)  
> **Architecture:** Modular Monolith · 2 Separate Repos  
> **Pattern:** Controller → Service → Repository → Database

---

## Table of Contents

1. [Two Repos Overview](#1-two-repos-overview)
2. [Getting Started](#2-getting-started)
3. [Git & GitHub Workflow](#3-git--github-workflow)
4. [Backend Guide — picky-server](#4-backend-guide--picky-server)
5. [Frontend Guide — picky-client](#5-frontend-guide--picky-client)
6. [Order Tracking Feature](#6-order-tracking-feature)
7. [API Contract Process](#7-api-contract-process)
8. [Database Rules](#8-database-rules)
9. [Naming Conventions](#9-naming-conventions)
10. [Environment Variables](#10-environment-variables)
11. [Testing Checklist](#11-testing-checklist)
12. [Deployment Guide](#12-deployment-guide)

---

## 1. Two Repos Overview

| Repo | URL | Deploy | Who Leads |
|------|-----|--------|-----------|
| **picky-client** | github.com/your-org/picky-client | Vercel | Dev 1 |
| **picky-server** | github.com/your-org/picky-server | Render / Railway | Dev 3 + Dev 4 |

### Who works where

| Developer | Primary Repo | Modules |
|-----------|-------------|---------|
| **Dev 1** | picky-client (Lead) | All customer pages, Cart, Checkout, Order Tracking UI |
| **Dev 2** | picky-client (Support) | Shared components, UI review; Admin panel built separately or as part of client |
| **Dev 3** | picky-server (Lead) | auth, product, category, cart modules + all Mongoose models |
| **Dev 4** | picky-server (Lead) | order, discount, coupon, report + WhatsApp notifications + tracking API |

### Cross-repo coordination
- Dev 3/4 define API shape **first** in README or api.md
- Dev 1 mocks the API with static data while server is being built
- Integration happens when real API is ready — swap mock with Axios call

---

## 2. Getting Started

### Prerequisites
- Node.js 20 LTS
- npm 10+
- Git
- MongoDB (local or Atlas connection string)
- Redis (local or Upstash URL)

### Setup picky-client

```bash
git clone https://github.com/your-org/picky-client.git
cd picky-client
npm install
cp .env.example .env
# Edit .env → set VITE_API_URL=http://localhost:5000/api/v1
npm run dev
# Runs on http://localhost:3000
```

### Setup picky-server

```bash
git clone https://github.com/your-org/picky-server.git
cd picky-server
npm install
cp .env.example .env
# Fill all values (MongoDB URI, Redis, Twilio, Cloudinary, JWT secrets)
npm run dev
# Runs on http://localhost:5000
```

### First-Time GitHub Setup (Project Lead does this ONCE)

```bash
# picky-client
git clone https://github.com/your-org/picky-client.git
cd picky-client
git checkout -b develop
git push origin develop
# On GitHub: Settings → Branches → Protect main + develop → Require PR + 1 review

# picky-server (same steps)
git clone https://github.com/your-org/picky-server.git
cd picky-server
git checkout -b develop
git push origin develop
```

---

## 3. Git & GitHub Workflow

### Branch Strategy (BOTH repos follow this)

```
main      ← Production (PROTECTED — no direct push, no direct merge)
  └── develop  ← Integration branch (all features merge here first)
        ├── feat/client/home-page
        ├── feat/client/order-tracking-ui
        ├── feat/server/auth-otp
        ├── feat/server/order-checkout
        ├── feat/server/order-tracking      ← AWB entry + tracking API
        ├── fix/client/cart-qty-sync
        ├── fix/server/otp-rate-limit
        └── chore/server/add-indexes
```

### Branch Naming Convention

```
feat/<repo>/<feature>           → New feature
fix/<repo>/<module>/<bug>       → Bug fix
chore/<repo>/<description>      → Maintenance
refactor/<repo>/<description>   → Refactoring

Examples:
feat/client/order-tracking-ui
feat/server/order-tracking
feat/server/wa-notifications
fix/client/awb-copy-button
fix/server/stock-deduction
chore/server/update-mongoose
```

### Commit Message Format (Conventional Commits — MANDATORY)

```
type(scope): short description

Types: feat | fix | chore | refactor | docs | test

Examples:
feat(order): add GET /orders/:id/tracking endpoint
feat(order): add AWB entry + WhatsApp trigger on ship
feat(ui): add 3-step visual tracking stepper
feat(ui): add AWB copy button with clipboard API
fix(cart): correct qty validation against available stock
fix(tracking): show correct courier name in WA message
chore(deps): upgrade mongoose to 8.x
refactor(order): extract pricing logic to _calculatePricing()
```

### Daily Git Workflow (Every Dev, Every Day)

```bash
# START OF DAY — sync with latest develop
git checkout develop
git pull origin develop

# Switch to or create your feature branch
git checkout feat/server/order-tracking
# OR create new:
git checkout -b feat/server/order-tracking

# Keep your branch up to date (do this daily)
git rebase develop

# Write code...

# Save progress
git add .
git commit -m "feat(order): add statusHistory[] to order model"

# Push your branch
git push origin feat/server/order-tracking

# WHEN FEATURE IS DONE — create PR on GitHub
# Target: develop (NEVER main)
# Add description with: What changed, Why, How to test
```

### Pull Request Rules

| Rule | Details |
|------|---------|
| Target branch | Always `develop`, never `main` |
| Reviewer | Minimum 1 team member must approve |
| CI check | Lint must pass before merge |
| PR title | Must follow Conventional Commit format |
| Description | What changed + how to test (required) |
| No `.env` | Never commit env files |
| No debug code | Remove `console.log` before PR |

### Adding a Team Member to GitHub Repo

```
1. Go to: github.com/your-org/picky-server
2. Settings → Collaborators → Add people
3. Enter their GitHub username or email
4. They accept the invite
5. They clone and set up locally
```

---

## 4. Backend Guide — picky-server

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

---

## 5. Frontend Guide — picky-client

### Folder Structure

```
src/
  components/
    ui/                  ← Button, Input, Modal, Toast, Spinner
    layout/              ← Navbar, Footer, PageWrapper
    product/             ← ProductCard, Gallery, PriceDisplay
    order/               ← OrderTracker, TrackingStepper, AWBBox, StatusTimeline
  pages/                 ← One file per route
  store/                 ← Zustand stores
  services/              ← Axios API calls
  hooks/                 ← Custom React hooks
  styles/                ← CSS files
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
    staleTime: 30_000,          // 30 seconds
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
  getTracking: (id) => api.get(`/orders/${id}/tracking`),  // ← TRACKING
  checkout: (body) => api.post('/orders', body),
};
```

### Protected Route

```jsx
// components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
```

---

## 6. Order Tracking Feature

This is a core feature. Both repos must implement it correctly.

### Customer Flow (picky-client)
1. Customer goes to **My Orders** (`/orders`)
2. Clicks any order → goes to **Order Detail** (`/orders/:id`)
3. Page shows `OrderTracker` component which calls `GET /orders/:id/tracking`
4. Visual 3-step stepper: **Confirmed → Shipped → Delivered**
5. If status is `shipped`: AWB number displayed prominently, courier name shown, copy-to-clipboard button
6. Status timeline (chronological, newest first)
7. Page auto-refreshes tracking every 30 seconds (TanStack Query `refetchInterval`)

### Admin Flow (picky-server)
1. Admin views order detail
2. Enters AWB number + selects courier from dropdown
3. Clicks "Mark as Shipped" → calls `PATCH /admin/orders/:id/tracking`
4. Server: updates status, pushes to `statusHistory[]`, triggers WhatsApp to customer

### Tracking Component Tree (picky-client)

```jsx
// pages/OrderDetail.jsx
<OrderDetail>
  <OrderHeader />         // Order#, date, total, COD pill
  <OrderTracker>          // Calls useOrderTracking(orderId)
    <TrackingStepper />   // 3 dots: Confirmed / Shipped / Delivered
    <AWBBox />            // Shows AWB + copy btn (only when shipped)
    <StatusTimeline />    // List of { status, timestamp }
  </OrderTracker>
  <OrderItems />          // Snapshot items list
  <ShippingAddress />
</OrderDetail>
```

### TrackingStepper Logic

```jsx
// components/order/TrackingStepper.jsx
const STEPS = ['confirmed', 'shipped', 'delivered'];

function StepIcon({ step, currentStatus }) {
  const stepIndex = STEPS.indexOf(step);
  const currentIndex = STEPS.indexOf(currentStatus);
  if (stepIndex < currentIndex) return <DoneIcon />;      // past step ✅
  if (stepIndex === currentIndex) return <ActiveIcon />;  // current 🔄
  return <PendingIcon />;                                  // future ⏳
}
```

### AWBBox Logic

```jsx
// components/order/AWBBox.jsx
// Only render if status is 'shipped' or 'delivered'
function AWBBox({ trackingId, courier, status }) {
  if (status === 'confirmed') return <AwaitingShipmentBox />;
  return (
    <div className="awb-box">
      <div className="awb-num">{trackingId}</div>
      <div className="awb-courier">via {courier}</div>
      <button onClick={() => navigator.clipboard.writeText(trackingId)}>
        Copy AWB
      </button>
    </div>
  );
}
```

---

## 7. API Contract Process

**Rule: API Contract FIRST, Code SECOND**

1. Dev 3 or Dev 4 writes the endpoint shape in README or api.md
2. Team quickly reviews (async, 5 min)
3. Dev 1 builds the UI with **mock/hardcoded data**
4. Dev 3/4 implements the real API
5. Dev 1 swaps mock for real Axios call → test integration

### Tracking API Contract Example

```
GET /api/v1/orders/:id/tracking
Auth: Bearer token (customer — owns the order)

Response 200:
{
  "success": true,
  "data": {
    "orderNumber": "PKY-20260903-0042",
    "status": "shipped",           // confirmed | shipped | delivered
    "trackingId": "D123456789IN",  // null if not shipped yet
    "courier": "DTDC Express",     // null if not shipped yet
    "statusHistory": [
      { "status": "shipped",   "timestamp": "2026-09-03T08:40:00Z" },
      { "status": "confirmed", "timestamp": "2026-09-03T04:54:00Z" }
    ]
  }
}

PATCH /api/v1/admin/orders/:id/tracking
Auth: Bearer token (admin)
Body: { "trackingId": "D123456789IN", "courier": "DTDC Express" }

Response 200:
{ "success": true, "data": { <updated order> }, "message": "Tracking updated. WhatsApp sent." }
Side effects:
  - order.status → "shipped"
  - order.statusHistory[] → push { status: "shipped", timestamp: now }
  - WhatsApp sent to customer: "Order shipped! AWB: D123456789IN via DTDC Express"
```

---

## 8. Database Rules

1. **`.lean()`** on all read-only queries (performance)
2. **Never `find()` without limit** — always paginate
3. **Order items = SNAPSHOT** — copy name, image, price at time of purchase
4. **`statusHistory[]`** — always push to this array on every status change, never overwrite
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

## 9. Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Backend files | kebab-case | `order.service.js` |
| React components | PascalCase | `OrderTracker.jsx` |
| JS variables | camelCase | `trackingId` |
| Constants | UPPER_SNAKE_CASE | `MAX_OTP_ATTEMPTS` |
| CSS classes | kebab-case | `awb-box` |
| MongoDB collections | snake_case plural | `coupon_usages` |
| API endpoints | kebab-case | `/send-otp`, `/order-tracking` |
| Git branches | kebab with prefix | `feat/server/order-tracking` |
| Commits | Conventional Commits | `feat(order): add tracking API` |

---

## 10. Environment Variables

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
TWILIO_PHONE_NUMBER=+1415XXXXXXX
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OTP_EXPIRE_SECONDS=300
OTP_MAX_ATTEMPTS=3
ALLOWED_ORIGINS=http://localhost:3000
```

### picky-client/.env.example

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_APP_NAME=Picky
```

> **NEVER commit `.env`** — only `.env.example`. Share actual secrets via password manager or secure channel (1Password, Bitwarden). Set production secrets directly in Vercel/Render dashboard.

---

## 11. Testing Checklist

### Tracking Feature

- [ ] Place order → status = `confirmed`
- [ ] Call `GET /orders/:id/tracking` → `{ status: "confirmed", trackingId: null, courier: null }`
- [ ] Customer sees step 1 highlighted in stepper
- [ ] Admin enters AWB: `PATCH /admin/orders/:id/tracking` → `{ trackingId: "D123", courier: "DTDC" }`
- [ ] Order status becomes `shipped`
- [ ] `statusHistory[]` has both `confirmed` and `shipped` entries
- [ ] WhatsApp received with AWB number
- [ ] Call `GET /orders/:id/tracking` → returns AWB + courier + full statusHistory
- [ ] Customer sees step 2 highlighted (Shipped), AWB box shows, copy button works
- [ ] Admin marks as delivered → `PATCH /admin/orders/:id/status { status: "delivered" }`
- [ ] WhatsApp delivered notification sent
- [ ] All 3 steps shown as done in stepper

### Auth Flow
- [ ] Send OTP → receive SMS
- [ ] Wrong OTP 3 times → blocked
- [ ] Verify OTP → JWT returned
- [ ] Expired token → 401 → auto refresh → retry succeeds

### Cart & Order
- [ ] Add → Login (merge guest cart) → Checkout → Order confirmed
- [ ] Apply valid coupon → discount applied
- [ ] First-order customer → gift applied silently (no label in response)
- [ ] Checkout with out-of-stock item → 400 error

---

## 12. Deployment Guide

| Service | What | URL |
|---------|------|-----|
| Vercel | picky-client | vercel.app |
| Render / Railway | picky-server | onrender.com |
| MongoDB Atlas | Database | cloud.mongodb.com |
| Upstash | Redis | upstash.com |
| Cloudinary | Images | cloudinary.com |
| Twilio | WA + SMS | twilio.com |

### GitHub Actions CI (add to both repos)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
```

### Deployment Checklist (Go Live)

- [ ] All env vars set in Vercel (client) and Render (server)
- [ ] CORS `ALLOWED_ORIGINS` updated to production Vercel URL
- [ ] MongoDB Atlas IP whitelist: allow Render outbound IPs (or allow all: 0.0.0.0/0 for dev)
- [ ] Twilio WA number approved for production (not sandbox)
- [ ] Cloudinary upload preset created
- [ ] GitHub branch protection confirmed on main
- [ ] OTP rate limit tuned (3 per 15min in prod)
- [ ] Winston log level: `warn` in production
- [ ] Test complete order + tracking flow end-to-end on production before announcing go-live

---

## Quick Reference

```
picky-client → github.com/your-org/picky-client → Vercel → :3000 dev
picky-server → github.com/your-org/picky-server → Render  → :5000 dev

Auth: Phone → OTP (Redis 5min) → JWT access (15m) + refresh (7d)
Cart: localStorage (guest) → DB (logged in) → merge on login
Order: Confirmed → Shipped (AWB entered by admin) → Delivered
Track: GET /orders/:id/tracking → { status, trackingId, courier, statusHistory[] }
WA:   OTP + Confirmed + Shipped(AWB) + Delivered — all via Twilio
Gift: First-order discount is SILENT — never shown to customer

Git:
  main ← develop ← feat/* (all PRs via develop, never direct to main)
  Commit: feat(scope): description
  PR: min 1 review + lint pass required

Deploy:
  npm run dev:client → :3000
  npm run dev:server → :5000
  Both .env files must be filled before running
```

---

*Last updated: 2026-09-03 | Version: 1.1.0*  
*See `index.html` for the full visual architecture with interactive diagrams including Order Tracking UI.*
