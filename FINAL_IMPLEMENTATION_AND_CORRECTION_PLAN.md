# PICKY — FINAL MASTER IMPLEMENTATION & CORRECTION PLAN
> **Document Status**: Production-Ready Architectural & Operational Blueprint  
> **Target System**: Picky E-Commerce (Single-Vendor Multi-Courier Fashion / Lifestyle Platform)  
> **Author**: Senior Principal Full-Stack Architect  
> **Target Repositories**: `picky-server` & `picky_client`  
> **Date**: October 2026  
> **Primary Rule**: No generic advice. Every single item references real files, real variables, real endpoints, and real code paths.

---

## TABLE OF CONTENTS
1. [Current Project Status](#1-current-project-status)
   - [1.1 What is Already Completed](#11-what-is-already-completed)
   - [1.2 What is Partially Completed](#12-what-is-partially-completed)
   - [1.3 What is Still Missing](#13-what-is-still-missing)
   - [1.4 Active Mock / Static Data Dependency Inventory](#14-active-mock--static-data-dependency-inventory)
2. [All Required Corrections](#2-all-required-corrections)
   - [2.1 Critical Security Corrections](#21-critical-security-corrections)
   - [2.2 Backend & API Corrections](#22-backend--api-corrections)
   - [2.3 Database & Model Corrections](#23-database--model-corrections)
   - [2.4 Frontend & UI/UX Corrections](#24-frontend--uiux-corrections)
   - [2.5 Routing & Protected Route Corrections](#25-routing--protected-route-corrections)
   - [2.6 State Management & Store Corrections](#26-state-management--store-corrections)
   - [2.7 Environment & Configuration Corrections](#27-environment--configuration-corrections)
3. [Implementation Plan (Phase-by-Phase)](#3-implementation-plan-phase-by-phase)
   - [Phase 0: Immediate Security & Configuration Unblocking](#phase-0-immediate-security--configuration-unblocking)
   - [Phase 1: Database Initialization & Seeding](#phase-1-database-initialization--seeding)
   - [Phase 2: Missing Backend Endpoints Implementation](#phase-2-missing-backend-endpoints-implementation)
   - [Phase 3: Frontend Service Decoupling & Real API Wiring](#phase-3-frontend-service-decoupling--real-api-wiring)
   - [Phase 4: Admin Panel Complete Real-Data Integration](#phase-4-admin-panel-complete-real-data-integration)
   - [Phase 5: Payment Gateway & Order Lifecycle Verification](#phase-5-payment-gateway--order-lifecycle-verification)
   - [Phase 6: Production Infrastructure & Real Services](#phase-6-production-infrastructure--real-services)
4. [Data Flow & Integration Architecture](#4-data-flow--integration-architecture)
   - [4.1 Customer Authentication Flow (Phone OTP)](#41-customer-authentication-flow-phone-otp)
   - [4.2 Admin Authentication Flow (Email + Password)](#42-admin-authentication-flow-email--password)
   - [4.3 Product Catalog, Hierarchy & Filtering Flow](#43-product-catalog-hierarchy--filtering-flow)
   - [4.4 Cart Synchronization Flow (Guest -> Logged In)](#44-cart-synchronization-flow-guest---logged-in)
   - [4.5 Server-Side Coupon & Discount Calculation Flow](#45-server-side-coupon--discount-calculation-flow)
   - [4.6 Order Checkout & Razorpay Atomic Transaction Flow](#46-order-checkout--razorpay-atomic-transaction-flow)
   - [4.7 Admin Order Tracking & Courier Assignment Flow](#47-admin-order-tracking--courier-assignment-flow)
   - [4.8 Inventory Stock Management & Audit Flow](#48-inventory-stock-management--audit-flow)
5. [Exact File-by-File Audit & Checklist](#5-exact-file-by-file-audit--checklist)
   - [5.1 Backend (`picky-server`) File Matrix](#51-backend-picky-server-file-matrix)
   - [5.2 Frontend (`picky_client`) File Matrix](#52-frontend-picky_client-file-matrix)
6. [Testing & Verification Plan](#6-testing--verification-plan)
   - [6.1 Backend API Verification Script (Automated CLI)](#61-backend-api-verification-script-automated-cli)
   - [6.2 End-to-End User Journey Test Matrix](#62-end-to-end-user-journey-test-matrix)
   - [6.3 Production Deployment Checklist](#63-production-deployment-checklist)

---

# 1. CURRENT PROJECT STATUS

### 1.1 What is Already Completed
The Picky codebase possesses a sophisticated architectural foundation:
* **Backend Layered Architecture**: Clear separation of concerns in `picky-server/src`:
  * Route -> Joi Validation Middleware -> Controller -> Service -> Repository -> Mongoose Model.
* **Security Middleware Suite**:
  * `helmet` headers configured.
  * `cors` origin filtering configured.
  * `express-mongo-sanitize` for query injection prevention.
  * `xss-clean` for request payload sanitation.
  * Correlation ID tracing via `src/middleware/correlationId.middleware.js`.
  * Tiered rate limiting in `src/middleware/rateLimit.middleware.js`: general API (`100/15m`), Auth (`20/15m`), and OTP (`5/10m`).
* **Complete Database Schema Definitions (`picky-server/src/models`)**:
  * `User`: Phone auth, roles (`customer`, `admin`), addresses, order counts.
  * `Product`: Title, slug, description, category ref, pricing, variants (color, size, SKU, stock), images, tags, status.
  * `Category`: Name, slug, parentCategory (hierarchical subcategories), characteristics schema, image, active flag.
  * `Order`: Razorpay order/payment IDs, items snapshot, shipping address, pricing breakdown, order status, courier tracking info.
  * `Cart`: User/guest cart, item array, server-applied coupon reference, pricing snapshot.
  * `Wishlist`: User ID ref, product ID refs.
  * `Coupon` & `CouponUsage`: Code, type (`percentage`, `flat`), rules (min purchase, max discount), validity window, per-user limits, usage counters.
  * `Discount`: Automated threshold discounts (e.g., cart total tier discounts).
  * `Inventory`: Low stock thresholds, reserved quantities, audit logs.
* **Complex Business Logic Implementations**:
  * `order.service.js`: Complete atomic MongoDB session transaction for order creation, inventory stock deduction, coupon usage increment, cart clearing, and error rollback.
  * `cart.service.js`: Server-side price calculation enforcing coupon rules and tax/shipping logic.
  * `auth.service.js`: Dual authentication mechanism — phone OTP for shoppers and email/password for store administrators.
* **Frontend Design & Page Layouts (`picky_client/src/pages`)**:
  * High-aesthetic client pages: `Home`, `Categories`, `CategorySubcategories`, `CategoryProducts`, `ProductList`, `ProductDetail`, `Cart`, `Checkout`, `Orders`, `OrderDetail`, `Wishlist`, `Account`, `Search`, `BestSellers`, `NewArrivals`.
  * Comprehensive Admin Dashboard suite: `AdminDashboard`, `AdminOrders`, `AdminOrderDetail`, `AdminProducts`, `AdminCategories`, `AdminSubCategories`, `AdminInventory`, `AdminCoupons`, `AdminCustomers`, `AdminSettings`, `AdminCustomization`.

---

### 1.2 What is Partially Completed
* **Redis Integration (`picky-server/src/config/redis.js`)**:
  * Real Redis connection logic is written, but defaults to an in-memory Map fallback when connecting to `localhost:6379`.
  * *Impact*: Server restarts wipe all stored OTP sessions, rate-limit buckets, and refresh token validation entries.
* **Razorpay Gateway (`picky-server/src/services/razorpay.service.js`)**:
  * Backend contains mock fallback for dummy keys (`rzp_test_xxxxxxxxxxxx`), but no real test API keys are configured.
  * Frontend lacks the dynamic or static `<script src="https://checkout.razorpay.com/v1/checkout.js">` script tag in `index.html`.
* **Third-Party Services (WATI, Cloudinary, AWS S3)**:
  * `s3.service.js` & `cloudinary.service.js` return Unsplash fallbacks when credentials are placeholders.
  * `notification.service.js` logs to console instead of sending actual WhatsApp notifications.
* **Frontend API Integration**:
  * All 8 client services exist in `picky_client/src/services/`, but `auth.service.js`, `product.service.js`, `category.service.js`, `order.service.js`, and `cart.service.js` contain `try/catch` fallbacks to local mock data.
  * As a result, backend API errors fail silently and load fake data instead of alerting the user or developer.

---

### 1.3 What is Still Missing
1. **Admin Seed Record in Database**: No admin user exists in MongoDB Atlas. Calling `/api/v1/auth/admin/login` fails with 401.
2. **Catalog Seed Records in Database**: Categories and Products collections are completely empty. Real API requests return `[]`.
3. **Backend Endpoints**:
   * `GET /api/v1/customers` & `GET /api/v1/customers/:id` (required by `AdminCustomers.jsx`).
   * `GET /api/v1/settings` & `PATCH /api/v1/settings` (required by `AdminSettings.jsx` and `AdminCustomization.jsx`).
   * `GET /api/v1/inventory` & `PATCH /api/v1/inventory/:productId` (required by `AdminInventory.jsx`).
4. **Guest-to-User Cart Merge Trigger**: Frontend doesn't dispatch `POST /api/v1/cart/merge` immediately following successful OTP login.
5. **Razorpay Webhook Secret Configuration**: `RAZORPAY_WEBHOOK_SECRET` is missing from `picky-server/.env`.

---

### 1.4 Active Mock / Static Data Dependency Inventory

| Mock File Location | Consumed By | Current Function | Production Replacement Action |
|---|---|---|---|
| `picky_client/src/data/data.js` | `product.service.js`, `category.service.js`, `cart.service.js` | Supplies fallback product list, reviews, and fake `validateCoupon()` | Populate MongoDB via `seedProducts.js`, delete fallback code in services |
| `picky_client/src/data/categoryMockData.js` | `category.service.js` | Supplies navigation categories and subcategories | Populate MongoDB via `seedCategories.js`, delete fallback code |
| `picky_client/src/data/ordersMockData.js` | `order.service.js` | Supplies fake order history and tracking info | Populate orders via real checkout flow, delete fallback code |
| `picky_client/src/data/adminMockData.js` | `couponStore.js` | Supplies `MOCK_COUPONS` and `MOCK_DISCOUNTS` to store | Hook `AdminCoupons.jsx` directly to `admin.service.js` -> `/api/v1/coupons` |
| `picky_client/src/data/inventoryMockData.js` | `mockStockStore.js` | Holds local stock quantities in localStorage | Connect `AdminInventory.jsx` to `/api/v1/inventory` |
| `picky_client/src/data/customizationMockData.js` | `customizationStore.js` | Holds store banners, logos, and color palettes | Implement `/api/v1/settings` and load settings from MongoDB |
| `AdminProtectedRoute.jsx` (inline) | Admin Login Form | `handleDemoBypass()` creates fake JWT token on error | Remove bypass function; require real authenticated admin token |

---

# 2. ALL REQUIRED CORRECTIONS

### 2.1 Critical Security Corrections
1. **Rotate Compromised JWT Secrets**:
   * *File*: `picky-server/.env` (lines 11-12).
   * *Issue*: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are literal placeholder strings (`your-super-secret-access-key-minimum-32-chars`). Anyone can forge valid admin tokens.
   * *Correction*: Generate two distinct 256-bit cryptographic keys using `crypto.randomBytes(32).toString('hex')` and insert into `.env`.
2. **Correct CORS Allowed Origins**:
   * *File*: `picky-server/.env` (line 32).
   * *Issue*: `ALLOWED_ORIGINS=http://localhost:3000`. Vite defaults to port `5173`. Any API calls from port 5173 will be blocked by CORS policy.
   * *Correction*: Change to `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173`.
3. **Eradicate Admin Demo Bypass & Credential Leaks**:
   * *File*: `picky_client/src/components/layout/AdminProtectedRoute/AdminProtectedRoute.jsx`.
   * *Issue*: 
     * Form state initializes with `admin@picky.com` and `Admin@Picky2026!`.
     * `catch (err)` block invokes `handleDemoBypass()` which injects `demo-admin-jwt-token`. If backend is down, attacker gets full UI access.
   * *Correction*: Remove initial credentials from `useState`. Erase `handleDemoBypass()`. Render real error notification on failure.
4. **Mandate Webhook Signature Verification**:
   * *File*: `picky-server/src/services/razorpay.service.js` & `picky-server/.env`.
   * *Issue*: `verifyWebhookSignature` returns `true` if `RAZORPAY_WEBHOOK_SECRET` is unset.
   * *Correction*: Add `RAZORPAY_WEBHOOK_SECRET` to `env.js` validation schema and fail verification if signature doesn't match.

---

### 2.2 Backend & API Corrections
1. **MongoDB Connection Optimization**:
   * *File*: `picky-server/src/config/db.js`.
   * *Issue*: Redundant `dbName: 'picky'` in Mongoose connection options when already declared in URI path. `serverSelectionTimeoutMS: 5000` causes Atlas cold-start drops.
   * *Correction*: Remove `dbName` from connection options. Increase `serverSelectionTimeoutMS` to `30000`.
2. **Missing Customer Management Endpoint**:
   * *File*: Create `picky-server/src/modules/customer/` or attach to `user.routes.js`.
   * *Action*: Expose `GET /api/v1/customers` (with search, pagination, order metrics) protected by `authenticate, authorize('admin')`.
3. **Missing Store Settings Endpoint**:
   * *File*: Create `picky-server/src/modules/settings/`.
   * *Action*: Create `settings.model.js`, `settings.routes.js`, `settings.controller.js`. Expose `GET /api/v1/settings` (public) and `PATCH /api/v1/settings` (admin only).
4. **Missing Inventory Admin Endpoint**:
   * *File*: Expose routes in `picky-server/src/modules/product/product.routes.js` or dedicated `inventory.routes.js`:
     * `GET /api/v1/inventory`: List products with SKU, title, size, variant stock, lowStockThreshold.
     * `PATCH /api/v1/inventory/:productId`: Update stock directly per variant SKU.

---

### 2.3 Database & Model Corrections
1. **Subcategory Indexing & Population**:
   * *File*: `picky-server/src/models/category.model.js`.
   * *Action*: Ensure `parentCategory` is properly indexed (`categorySchema.index({ parentCategory: 1, isActive: 1 })`). Ensure query helper populates parent hierarchy.
2. **Order Model Status Consistency**:
   * *File*: `picky-server/src/models/order.model.js`.
   * *Action*: Ensure status enum matches UI expectations: `['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']`. Add courier tracking fields: `courierName`, `trackingNumber`, `trackingUrl`, `shippedAt`.
3. **Cart Session Indexing**:
   * *File*: `picky-server/src/models/cart.model.js`.
   * *Action*: Ensure TTL index on `updatedAt` for guest carts (e.g. expire after 30 days) to prevent MongoDB bloat.

---

### 2.4 Frontend & UI/UX Corrections
1. **Remove Silent Mock Fallbacks in Client Services**:
   * *Files*:
     * `picky_client/src/services/product.service.js`
     * `picky_client/src/services/category.service.js`
     * `picky_client/src/services/order.service.js`
     * `picky_client/src/services/cart.service.js`
   * *Correction*: Remove `catch` blocks that silently return `mockProducts`, `categoryMockData`, etc. Throw genuine API errors so UI can render error boundaries, empty states, or retry buttons.
2. **Embed Razorpay Checkout Script**:
   * *File*: `picky_client/index.html`.
   * *Action*: Add `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>` before closing `</body>` tag.
3. **Address Stock Indicator Synchronicity**:
   * *File*: `picky_client/src/pages/ProductDetail/ProductDetail.jsx`.
   * *Action*: Remove dependency on `mockStockStore.js`. Display real stock directly from `product.variants[selectedColor][selectedSize].stock`.

---

### 2.5 Routing & Protected Route Corrections
1. **Admin Route Protection Verification**:
   * *File*: `picky_client/src/components/layout/AdminProtectedRoute/AdminProtectedRoute.jsx`.
   * *Action*: Validate token expiration. Check `user.role === 'admin'`. If expired or invalid, trigger logout and redirect to `/pickyadmin-softnova2026`.
2. **Customer Protected Routes**:
   * *Files*: Ensure `/account`, `/orders`, `/orders/:id`, `/checkout` redirect unauthenticated users to `/login?redirect=...`.

---

### 2.6 State Management & Store Corrections
1. **Retire `couponStore.js` Mock Array**:
   * *File*: `picky_client/src/store/couponStore.js`.
   * *Action*: Refactor store to invoke `admin.service.js` methods (`getCoupons()`, `createCoupon()`, `deleteCoupon()`) rather than mutating local state initialized from `MOCK_COUPONS`.
2. **Deprecate `mockStockStore.js`**:
   * *File*: `picky_client/src/store/mockStockStore.js`.
   * *Action*: Remove this store completely. Stock is source-of-truth in MongoDB and queried through product and inventory endpoints.
3. **Enhance `cartStore.js` Sync Strategy**:
   * *File*: `picky_client/src/store/cartStore.js`.
   * *Action*: On initial load, read local items. When user logs in, call `POST /api/v1/cart/merge`, fetch server cart, and update Zustand state.

---

### 2.7 Environment & Configuration Corrections
1. **Validate and Clean `.env` files**:
   * Both `picky-server/.env` and `picky_client/.env` must contain accurate hostnames, ports, and configuration keys.

---

# 3. IMPLEMENTATION PLAN (PHASE-BY-PHASE)

```mermaid
graph TD
    P0[Phase 0: Security & Config Fixes] --> P1[Phase 1: DB Initialization & Seeding]
    P1 --> P2[Phase 2: Missing Backend Endpoints]
    P2 --> P3[Phase 3: Frontend Service Decoupling]
    P3 --> P4[Phase 4: Admin Panel Real-Data Wiring]
    P4 --> P5[Phase 5: Razorpay Checkout & Order Flow]
    P5 --> P6[Phase 6: Infrastructure & Production Prep]
```

### Phase 0: Immediate Security & Configuration Unblocking
* **Objective**: Remove critical security vulnerabilities, fix CORS, and stop fake admin logins.
* **Step 0.1**: Generate 2 random 64-char hex strings in Node:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Set them in `picky-server/.env` as `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
* **Step 0.2**: Update `ALLOWED_ORIGINS` in `picky-server/.env`:
  ```env
  ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
  ```
* **Step 0.3**: Edit `picky-server/src/config/db.js`:
  Remove `dbName: 'picky'` from `options`. Set `serverSelectionTimeoutMS: 30000`.
* **Step 0.4**: Edit `picky_client/src/components/layout/AdminProtectedRoute/AdminProtectedRoute.jsx`:
  Delete `handleDemoBypass()`. Clear default email and password from `useState('')`. On login error, show error alert.

---

### Phase 1: Database Initialization & Seeding
* **Objective**: Populate MongoDB Atlas with foundational records so all real API queries return data.
* **Step 1.1**: Create `picky-server/scripts/createAdmin.js`:
  * Connect to MongoDB using `MONGODB_URI`.
  * Hash password `Admin@Picky2026!` using `bcrypt.hash(password, 12)`.
  * Upsert User document with `email: 'admin@picky.com'`, `role: 'admin'`, `name: 'Store Administrator'`, `isEmailVerified: true`.
* **Step 1.2**: Create `picky-server/scripts/seedCategories.js`:
  * Insert primary parent categories (e.g., Men, Women, Accessories, Shoes).
  * Insert child subcategories referencing parents (e.g., Shirts, T-Shirts, Dresses, Sneakers).
  * Create characteristics schema per category (e.g. Size: S, M, L, XL; Fabric; Color).
* **Step 1.3**: Create `picky-server/scripts/seedProducts.js`:
  * Map real categories to products.
  * Insert 12-20 realistic products with high-resolution fashion imagery, variants (colors, sizes, SKU, inventory quantity), base pricing, and tags (`featured`, `bestseller`, `new_arrival`).
* **Step 1.4**: Run scripts via Node and verify count of documents in Atlas.

---

### Phase 2: Missing Backend Endpoints Implementation
* **Objective**: Complete API coverage required by the Admin panel.
* **Step 2.1 — Customers API**:
  * Create `picky-server/src/modules/customer/customer.controller.js` & `customer.routes.js`.
  * `GET /api/v1/customers`: Returns paginated users with `role: 'customer'`, order counts, and total spend.
  * Mount in `src/app.js` at `/api/v1/customers`.
* **Step 2.2 — Store Settings API**:
  * Create `src/models/settings.model.js` (storeName, contactEmail, contactPhone, socialLinks, banners, announcementBar).
  * Create `src/modules/settings/` (controller, routes, service).
  * `GET /api/v1/settings`: Public endpoint for UI theme and branding.
  * `PATCH /api/v1/settings`: Admin endpoint for updating branding and banners.
* **Step 2.3 — Inventory Management API**:
  * Expose `GET /api/v1/inventory` to list all product variants with their stock numbers.
  * Expose `PATCH /api/v1/inventory/:productId` to update variant stock.

---

### Phase 3: Frontend Service Decoupling & Real API Wiring
* **Objective**: Eliminate mock data fallbacks in client services and verify live data rendering.
* **Step 3.1**: Edit `picky_client/src/services/category.service.js`:
  * Remove `categoryMockData` import.
  * Return `response.data.data` directly. Let errors propagate to React components.
* **Step 3.2**: Edit `picky_client/src/services/product.service.js`:
  * Remove `data.js` imports (`mockProducts`, etc.).
  * Ensure query parameter serialization for categories, subcategories, price range, and sort order.
* **Step 3.3**: Edit `picky_client/src/services/cart.service.js`:
  * Remove `validateCoupon` fallback from `data.js`.
  * Rely entirely on `POST /api/v1/cart/coupon` and `DELETE /api/v1/cart/coupon`.
* **Step 3.4**: Edit `picky_client/src/services/order.service.js`:
  * Remove `ordersMockData.js`. Connect directly to `GET /api/v1/orders/my-orders` and `GET /api/v1/orders/:id`.

---

### Phase 4: Admin Panel Complete Real-Data Integration
* **Objective**: Ensure the entire Admin suite operates on MongoDB Atlas data.
* **Step 4.1 — Admin Coupons**:
  * Refactor `picky_client/src/pages/admin/AdminCoupons/AdminCoupons.jsx`.
  * Replace `useCouponStore` with React Query or `useEffect` calling `adminService.getCoupons()`, `adminService.createCoupon()`, and `adminService.deleteCoupon()`.
* **Step 4.2 — Admin Inventory**:
  * Refactor `picky_client/src/pages/admin/AdminInventory/AdminInventory.jsx`.
  * Delete `useMockStockStore`.
  * Fetch live stock via `adminService.getInventory()` and update stock via `adminService.updateStock()`.
* **Step 4.3 — Admin Customers**:
  * Connect `picky_client/src/pages/admin/AdminCustomers/AdminCustomers.jsx` to `adminService.getCustomers()`.
* **Step 4.4 — Admin Customization & Settings**:
  * Connect `AdminSettings.jsx` and `AdminCustomization.jsx` to `/api/v1/settings`.

---

### Phase 5: Payment Gateway & Order Lifecycle Verification
* **Objective**: Complete end-to-end checkout and payment execution.
* **Step 5.1**: Add Razorpay Checkout script to `picky_client/index.html`:
  ```html
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  ```
* **Step 5.2**: Update `picky-server/.env` with valid Razorpay Test Keys:
  ```env
  RAZORPAY_KEY_ID=rzp_test_...
  RAZORPAY_KEY_SECRET=...
  RAZORPAY_WEBHOOK_SECRET=...
  ```
* **Step 5.3**: Verify checkout sequence in `picky_client/src/pages/Checkout/Checkout.jsx`:
  * Call `POST /api/v1/orders/create-razorpay-order`.
  * Open Razorpay modal with `order_id` and key.
  * On handler success, call `POST /api/v1/orders/verify-payment`.
  * On 200 OK, clear client cart and navigate to `/order-success/:orderId`.
* **Step 5.4**: Admin Fulfillment Lifecycle:
  * In `AdminOrders.jsx`, update order status to `shipped`.
  * Add manual courier tracking (Courier Name: BlueDart / Delhivery / DTDC, Tracking Number, URL).
  * Verify customer sees tracking details immediately on `/orders/:id`.

---

### Phase 6: Production Infrastructure & Real Services
* **Objective**: Prepare system for production traffic and zero-downtime reliability.
* **Step 6.1 — Redis Cloud Setup**:
  * Provision an Upstash Redis or managed Redis instance.
  * Supply `rediss://default:...@...upstash.io:6379` in `picky-server/.env`.
  * Verify real distributed token storage and rate-limiting across server restarts.
* **Step 6.2 — Cloudinary / S3 Image Storage**:
  * Configure Cloudinary API credentials in `picky-server/.env`.
  * Test admin product image uploads via `multer` + Cloudinary stream.
* **Step 6.3 — WhatsApp Notifications (WATI)**:
  * Add active WATI endpoint and token for customer SMS/WhatsApp order confirmations.
* **Step 6.4 — Production Build & Performance**:
  * Test `npm run build` in `picky_client`. Resolve any unresolved imports or CSS warnings.

---

# 4. DATA FLOW & INTEGRATION ARCHITECTURE

```
+---------------------------------------------------------------------------------------+
|                                PICKY ARCHITECTURAL FLOW                               |
+---------------------------------------------------------------------------------------+
|  [CLIENT] React 18 + Vite -> Zustand Stores -> Axios HTTP Client (`services/api.js`)  |
|                                         |                                             |
|                                         v (HTTP / REST)                               |
|  [SERVER] Express -> Helmet/CORS -> CorrelationId -> RateLimiter -> Auth Middleware   |
|                                         |                                             |
|                                         v                                             |
|  [ROUTER] `*.routes.js` -> Joi Validation Schema (`*.schema.js`)                      |
|                                         |                                             |
|                                         v                                             |
|  [CONTROLLER] `*.controller.js` -> Extract req.body, req.user, req.query              |
|                                         |                                             |
|                                         v                                             |
|  [SERVICE] `*.service.js` -> Pure Business Logic, Multi-Model Transactions, Cryptography|
|                                         |                                             |
|                                         v                                             |
|  [REPOSITORY] `*.repository.js` -> Mongoose Queries (`findOne`, `updateOne`, `populate`)|
|                                         |                                             |
|                                         v                                             |
|  [DATABASE] MongoDB Atlas Replica Set (ACID Transactions) & Redis Key-Value Store     |
+---------------------------------------------------------------------------------------+
```

### 4.1 Customer Authentication Flow (Phone OTP)
1. **Frontend**: Customer enters 10-digit phone number on `/login`. `authStore.sendOtp(phone)` dispatches `POST /api/v1/auth/send-otp`.
2. **Backend Gateway**: `authLimiter` (`5/10m`) validates request frequency.
3. **Controller & Service**: `auth.service.js` creates a 6-digit cryptographic OTP.
4. **Cache**: OTP stored in Redis as `otp:{phone}` with a 300s TTL.
5. **Notification**: WhatsApp message dispatched via WATI (or console logged in development).
6. **Verification**: User inputs OTP on `/login`. Client calls `POST /api/v1/auth/verify-otp`.
7. **Resolution**: `auth.service.js` validates against Redis. If user exists, retrieves user; if not, creates new `customer` document.
8. **Tokens**: Issues signed JWT `accessToken` (15m) and `refreshToken` (7d). Stores refresh token hash in Redis (`refresh:{userId}`).
9. **Client Storage**: `authStore` saves `accessToken` in memory/localStorage and sets default Axios `Authorization: Bearer <token>` header. Triggers cart merge.

---

### 4.2 Admin Authentication Flow (Email + Password)
1. **Frontend**: Administrator visits `/pickyadmin-softnova2026`. Enters email and password. Form dispatches `POST /api/v1/auth/admin/login`.
2. **Backend**: `auth.controller.js` delegates to `auth.service.js:adminLogin`.
3. **Lookup & Security**: Queries MongoDB `User` model by email. Verifies `user.role === 'admin'`.
4. **Password Verification**: Executes `bcrypt.compare(password, user.password)`. If mismatched or role != admin, throws 401.
5. **Tokens**: Issues Admin JWT with payload `{ userId, role: 'admin' }`.
6. **Client Storage**: `AdminProtectedRoute` verifies token authenticity and grants access to `/admin/*` views.

---

### 4.3 Product Catalog, Hierarchy & Filtering Flow
1. **Frontend**: User browses `/category/women/dresses?sort=price_asc&size=M`.
2. **Service Request**: `product.service.js` calls `GET /api/v1/products?category=women&subcategory=dresses&sort=price_asc&size=M`.
3. **Controller & Repo**: `product.repository.js` executes Mongoose aggregation pipeline:
   * Resolves category slug to ObjectId.
   * Matches `isActive: true`, `isDeleted: false`.
   * Filters on variants array matching requested size and in-stock conditions.
   * Applies sort and pagination (`skip`, `limit`).
4. **Response**: Returns standardized JSON envelope `{ success: true, data: { products, pagination } }`.

---

### 4.4 Cart Synchronization Flow (Guest -> Logged In)
1. **Guest Browsing**: Unauthenticated user adds items to cart. Saved locally in `localStorage: 'picky_cart'`.
2. **Post-Login Trigger**: Immediately upon receiving token in `authStore.verifyOtp`, dispatches:
   ```javascript
   cartService.mergeCart(localCartItems);
   ```
3. **Backend (`POST /api/v1/cart/merge`)**:
   * Finds or creates `Cart` document for `req.user.userId`.
   * Iterates through incoming guest items. If item/variant exists, increments quantity; if new, pushes to `items` array.
   * Re-evaluates pricing server-side via `calculateCartPricing`.
   * Saves and returns updated MongoDB cart document.
4. **Frontend**: Updates `cartStore` with consolidated server cart. Clears guest localStorage cart.

---

### 4.5 Server-Side Coupon & Discount Calculation Flow
1. **Client Action**: Customer enters promo code `PICKY20` at checkout. Dispatches `POST /api/v1/cart/coupon` with `{ code: 'PICKY20' }`.
2. **Backend Validation (`cart.service.js`)**:
   * Retrieves active `Coupon` document where `code == 'PICKY20'`.
   * Checks `validFrom <= now <= validUntil`.
   * Verifies `usageCount < totalUsageLimit`.
   * Checks `CouponUsage` collection to verify `userUsageCount < perUserLimit`.
   * Checks `cart.subtotal >= coupon.minOrderAmount`.
3. **Discount Computation**:
   * If `percentage`: `discount = subtotal * (discountValue / 100)`. Caps at `coupon.maxDiscountAmount` if defined.
   * If `flat`: `discount = discountValue`.
4. **Cart Update**: Attaches `coupon: coupon._id` and records `couponDiscount: discount` on Cart document. Returns updated breakdown.

---

### 4.6 Order Checkout & Razorpay Atomic Transaction Flow
1. **Order Creation Request**:
   * Client calls `POST /api/v1/orders/create-razorpay-order` with `{ shippingAddress }`.
2. **Backend Razorpay Order**:
   * Retrieves user's DB cart. Verifies all items have sufficient stock in `Inventory`.
   * Calls Razorpay API: `razorpay.orders.create({ amount: finalTotal * 100, currency: 'INR', receipt: ... })`.
   * Returns `razorpayOrderId`, `amount`, and `currency` to client.
3. **Payment Execution (Client)**:
   * Client opens Razorpay Checkout modal. User completes UPI / Card payment.
   * Razorpay callback returns `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }`.
4. **Verification & Atomic MongoDB Transaction (`POST /api/v1/orders/verify-payment`)**:
   * Computes HMAC SHA256 signature using `RAZORPAY_KEY_SECRET`. Compares against incoming signature.
   * Starts Mongoose Transaction (`session.startTransaction()`):
     * Deducts item quantities from `Inventory` / `Product` variant stock.
     * Creates permanent `Order` document with status `confirmed`.
     * Records entry in `CouponUsage` collection.
     * Increments user `orderCount`.
     * Clears user's `Cart`.
     * Commits transaction (`session.commitTransaction()`).
5. **Post-Commit**: Triggers WhatsApp order confirmation via `notification.service.js`.

---

### 4.7 Admin Order Tracking & Courier Assignment Flow
1. **Admin Order Detail**: Admin views order on `/admin/orders/:id`.
2. **Courier Assignment**: Admin selects courier (e.g., Delhivery, BlueDart, DTDC), inputs tracking number and tracking URL, and clicks "Update Tracking".
3. **API Request**: Client dispatches `PATCH /api/v1/orders/:id/tracking` with:
   ```json
   {
     "courierName": "Delhivery",
     "trackingNumber": "DEL129384812",
     "trackingUrl": "https://www.delhivery.com/track/package/DEL129384812",
     "status": "shipped"
   }
   ```
4. **Backend Processing**:
   * Updates `Order` document: sets `status = 'shipped'`, populates `courier` object, sets `shippedAt = new Date()`.
   * Appends entry to `order.statusTimeline`.
   * Dispatches WhatsApp notification to customer with direct tracking link.

---

### 4.8 Inventory Stock Management & Audit Flow
1. **Stock Query**: Admin views `/admin/inventory`. Client requests `GET /api/v1/inventory`.
2. **Aggregation**: Backend returns all products joined with their current variant inventory records and low-stock warnings (`stock <= lowStockThreshold`).
3. **Stock Adjustment**: Admin updates stock quantity for SKU `PK-WOM-DRS-01-M` to `25`. Dispatches `PATCH /api/v1/inventory/:productId`.
4. **Update & Log**:
   * Updates variant stock in `Product` model.
   * Updates `Inventory` model and writes an audit log: `{ adminId, sku, previousStock: 10, newStock: 25, reason: 'Restock' }`.

---

# 5. EXACT FILE-BY-FILE AUDIT & CHECKLIST

### 5.1 Backend (`picky-server`) File Matrix

| Relative File Path | Current Status | Required Action | Priority |
|---|---|---|---|
| `src/server.js` | ✅ Working | Maintain startup sequence. Keep graceful shutdown. | Low |
| `src/app.js` | ⚠️ Partial | Mount missing route modules (`/customers`, `/settings`). | High |
| `src/config/db.js` | ⚠️ Bug | Remove duplicate `dbName: 'picky'`. Set `serverSelectionTimeoutMS: 30000`. | High |
| `src/config/env.js` | ⚠️ Incomplete | Add validation for `RAZORPAY_WEBHOOK_SECRET` and `ALLOWED_ORIGINS`. | High |
| `src/config/redis.js` | ⚠️ Partial | Ensure production switches cleanly to Upstash Redis via `rediss://`. | Medium |
| `src/config/seed.js` | ⚠️ Incomplete | Replace placeholder seeds with dedicated category and product seed scripts. | High |
| `src/middleware/auth.middleware.js` | ✅ Working | Validates JWT and attaches `req.user`. Retain. | None |
| `src/middleware/role.middleware.js` | ✅ Working | Enforces `authorize('admin')`. Retain. | None |
| `src/middleware/rateLimit.middleware.js`| ✅ Working | Keep tiered limits (`apiLimiter`, `authLimiter`, `otpLimiter`). | None |
| `src/middleware/validate.middleware.js` | ✅ Working | Standard Joi validator. Retain. | None |
| `src/middleware/correlationId.middleware.js`| ✅ Working | UUID correlation tracing. Retain. | None |
| `src/models/user.model.js` | ✅ Working | Complete schema for customer and admin users. | None |
| `src/models/product.model.js` | ✅ Working | Complete schema with variants and pricing. | None |
| `src/models/category.model.js` | ⚠️ Partial | Verify `parentCategory` index and subcategory population helpers. | Medium |
| `src/models/order.model.js` | ⚠️ Partial | Add explicit courier tracking fields (`courierName`, `trackingNumber`, etc.). | High |
| `src/models/cart.model.js` | ✅ Working | Schema with item references and coupon discount snapshots. | None |
| `src/models/wishlist.model.js` | ✅ Working | Simple user-product relation. Retain. | None |
| `src/models/coupon.model.js` | ✅ Working | Rich rules schema (per-user limit, min purchase, max discount). | None |
| `src/models/couponUsage.model.js` | ✅ Working | Usage tracking per user and order. Retain. | None |
| `src/models/discount.model.js` | ✅ Working | Tiered cart discount schema. Retain. | None |
| `src/models/inventory.model.js` | ✅ Working | Inventory management and audit tracking schema. Retain. | None |
| `src/models/settings.model.js` | ❌ Missing | **Create file**. Schema for store branding, banners, and announcement text. | High |
| `src/modules/auth/auth.controller.js` | ✅ Working | OTP send/verify + Admin login. | None |
| `src/modules/auth/auth.service.js` | ✅ Working | Crypto OTP + JWT issue + bcrypt compare. | None |
| `src/modules/auth/auth.routes.js` | ✅ Working | Routes for `/send-otp`, `/verify-otp`, `/admin/login`, `/refresh`. | None |
| `src/modules/auth/auth.repository.js` | ✅ Working | User data access methods. Retain. | None |
| `src/modules/auth/auth.schema.js` | ✅ Working | Joi schemas for auth payloads. Retain. | None |
| `src/modules/category/*` | ✅ Working | Full CRUD, slug lookups, characteristics update. | None |
| `src/modules/product/*` | ✅ Working | Full CRUD, search, filter, pagination, soft-delete. | None |
| `src/modules/cart/*` | ✅ Working | Full CRUD, merge guest cart, apply/remove coupon. | None |
| `src/modules/wishlist/*` | ✅ Working | Add, remove, list wishlist items. | None |
| `src/modules/order/order.service.js` | ⚠️ Partial | Verify atomic transaction works with Atlas replica set. | High |
| `src/modules/order/order.routes.js` | ⚠️ Partial | Add `PATCH /orders/:id/tracking` route for admin. | High |
| `src/modules/coupon/*` | ✅ Working | Complete backend CRUD and validation. | None |
| `src/modules/discount/*` | ✅ Working | Automatic discount rule engine. | None |
| `src/modules/report/*` | ✅ Working | Sales summaries, top products, order trends. | None |
| `src/modules/customer/*` | ❌ Missing | **Create module**. Customer listing and profile endpoint for Admin. | High |
| `src/modules/settings/*` | ❌ Missing | **Create module**. Public and admin store settings endpoints. | High |
| `src/services/razorpay.service.js` | ⚠️ Partial | Ensure webhook signature verification enforces secret in production. | High |
| `src/services/notification.service.js`| ⚠️ Partial | Connect to real WATI API when live credentials supplied. | Medium |
| `src/services/cloudinary.service.js` | ⚠️ Partial | Connect to live Cloudinary upload stream. | Medium |
| `src/services/s3.service.js` | ⚠️ Partial | Connect to live AWS S3 bucket when configured. | Medium |
| `scripts/createAdmin.js` | ❌ Missing | **Create script**. Upserts initial admin credentials into Atlas. | Critical |
| `scripts/seedCategories.js` | ❌ Missing | **Create script**. Seeds parent and child categories into Atlas. | High |
| `scripts/seedProducts.js` | ❌ Missing | **Create script**. Seeds catalog with rich variant & image data. | High |

---

### 5.2 Frontend (`picky_client`) File Matrix

| Relative File Path | Current Status | Required Action | Priority |
|---|---|---|---|
| `index.html` | ⚠️ Partial | Add Razorpay Checkout script tag `<script src="..."></script>`. | Critical |
| `src/services/api.js` | ✅ Working | Base Axios instance with auth interceptor. Retain. | None |
| `src/services/auth.service.js` | ⚠️ Partial | Remove mock login fallback in catch block. | High |
| `src/services/product.service.js` | ⚠️ Partial | Remove `data.js` mock product fallback. | High |
| `src/services/category.service.js` | ⚠️ Partial | Remove `categoryMockData.js` fallback. | High |
| `src/services/cart.service.js` | ⚠️ Partial | Remove local coupon validation fallback. | High |
| `src/services/order.service.js` | ⚠️ Partial | Remove `ordersMockData.js` fallback. | High |
| `src/services/admin.service.js` | ⚠️ Partial | Add methods: `getCustomers()`, `getSettings()`, `updateSettings()`, `getInventory()`, `updateStock()`. | High |
| `src/services/wishlist.service.js`| ✅ Working | Connects to `/api/v1/wishlist`. Retain. | None |
| `src/store/authStore.js` | ⚠️ Partial | Add automatic `cartService.mergeCart()` trigger on login. | High |
| `src/store/cartStore.js` | ⚠️ Partial | Ensure local state syncs with server cart. | High |
| `src/store/couponStore.js` | 🔴 Deprecated | **Refactor**. Stop seeding from `MOCK_COUPONS`. Wire to `adminService`. | High |
| `src/store/mockStockStore.js` | 🔴 Deprecated | **Delete/Retire**. Read stock directly from product models. | High |
| `src/store/customizationStore.js` | ⚠️ Partial | Connect to `/api/v1/settings` instead of local mock data. | Medium |
| `src/components/layout/AdminProtectedRoute/*` | 🔴 Security Risk | **Delete demo bypass**. Remove hardcoded credentials. | Critical |
| `src/pages/Home/Home.jsx` | ⚠️ Partial | Render real featured products and categories from backend. | Medium |
| `src/pages/Categories/Categories.jsx` | ⚠️ Partial | Render live categories from DB. | Medium |
| `src/pages/CategorySubcategories/*`| ⚠️ Partial | Render live subcategories from parent slug query. | Medium |
| `src/pages/ProductList/ProductList.jsx`| ⚠️ Partial | Render live paginated products with category/price filters. | Medium |
| `src/pages/ProductDetail/ProductDetail.jsx`| ⚠️ Partial | Render real product variants, real stock count, and images. | Medium |
| `src/pages/Cart/Cart.jsx` | ⚠️ Partial | Validate coupons against backend endpoint `/cart/coupon`. | High |
| `src/pages/Checkout/Checkout.jsx` | ⚠️ Partial | Wire real Razorpay modal and verify-payment endpoint. | Critical |
| `src/pages/Orders/Orders.jsx` | ⚠️ Partial | Render customer's real past orders from DB. | High |
| `src/pages/OrderDetail/OrderDetail.jsx`| ⚠️ Partial | Display real status timeline and courier tracking number. | High |
| `src/pages/Wishlist/Wishlist.jsx` | ✅ Working | Live wishlist management. | None |
| `src/pages/Login/Login.jsx` | ✅ Working | Clean phone OTP flow. | None |
| `src/pages/admin/AdminDashboard/*` | ⚠️ Partial | Wire to `/api/v1/reports/sales-summary`. | Medium |
| `src/pages/admin/AdminOrders/*` | ⚠️ Partial | Connect status update and tracking form to live API. | High |
| `src/pages/admin/AdminOrderDetail/*`| ⚠️ Partial | Render real order breakdown and address. | High |
| `src/pages/admin/AdminProducts/*` | ⚠️ Partial | Full product CRUD wired to `/api/v1/products`. | High |
| `src/pages/admin/AdminCategories/*`| ⚠️ Partial | Category CRUD wired to `/api/v1/categories`. | High |
| `src/pages/admin/AdminSubCategories/*`| ⚠️ Partial | Subcategory CRUD wired to backend. | High |
| `src/pages/admin/AdminInventory/*` | ⚠️ Partial | Replace `mockStockStore` with live inventory API. | High |
| `src/pages/admin/AdminCoupons/*` | ⚠️ Partial | Wire coupon CRUD to `/api/v1/coupons`. | High |
| `src/pages/admin/AdminCustomers/*` | ⚠️ Partial | Wire customer table to `/api/v1/customers`. | High |
| `src/pages/admin/AdminSettings/*` | ⚠️ Partial | Wire settings form to `/api/v1/settings`. | Medium |
| `src/pages/admin/AdminCustomization/*`| ⚠️ Partial | Wire branding and banners to `/api/v1/settings`. | Medium |

---

# 6. TESTING & VERIFICATION PLAN

### 6.1 Backend API Verification Script (Automated CLI)
Create `picky-server/scripts/verify_api.js` to execute automated end-to-end API checks using native `fetch`:
1. **Health Check**: `GET /api/v1/products` -> Expect `200 OK` with JSON array.
2. **CORS Validation**: Request with `Origin: http://localhost:5173` -> Expect `Access-Control-Allow-Origin: http://localhost:5173`.
3. **Admin Authentication**: `POST /api/v1/auth/admin/login` with `admin@picky.com` -> Expect `200 OK` and valid JWT.
4. **Protected Route Validation**: `GET /api/v1/coupons` with Admin JWT -> Expect `200 OK`; without token -> Expect `401 Unauthorized`.
5. **Customer OTP Cycle**: `POST /api/v1/auth/send-otp` with test number -> Verify Redis key exists.
6. **Cart & Pricing Engine**: Create cart, add items, apply test coupon -> Verify subtotal, discount, and grand total calculations.

---

### 6.2 End-to-End User Journey Test Matrix

| Test ID | User Role | Action Sequence | Expected Result | Pass/Fail Criteria |
|---|---|---|---|---|
| **E2E-01** | Guest | Browse Home -> Click Category -> Filter by Subcategory | Live products load from DB; URL reflects slug | No mock fallback triggered |
| **E2E-02** | Guest | Add 2 items to Cart -> View `/cart` | Items stored in localStorage; price totals correct | Quantity adjustments update subtotal |
| **E2E-03** | Guest -> Customer | Navigate to `/login` -> Enter phone -> Enter OTP | Auth success; JWT stored; Guest cart merged into DB cart | Local cart items now appear in DB Cart |
| **E2E-04** | Customer | Apply Coupon `PICKY10` in Cart | Validates against DB rules; discount deducted | Max cap and min order rules enforced |
| **E2E-05** | Customer | Proceed to Checkout -> Enter Address -> Pay via Razorpay | Razorpay modal opens; on success, Order created | Inventory deducted; Cart emptied; Redirect to success page |
| **E2E-06** | Admin | Login at `/pickyadmin-softnova2026` | Real JWT issued; Dashboard loads | No demo bypass used |
| **E2E-07** | Admin | Open Order -> Set Status to `Shipped` -> Input Tracking # | Order status updated; Customer order detail shows tracking | Tracking link is clickable and accurate |
| **E2E-08** | Admin | Create new Product with variants -> Save | Product appears in DB and on public `/products` list | Image and variants properly linked |
| **E2E-09** | Admin | Adjust variant inventory in `/admin/inventory` | Stock count updates in DB; Low stock badge updates | Out-of-stock items block checkout |

---

### 6.3 Production Deployment Checklist
* [ ] Both JWT secrets set to unique 64-char crypto strings.
* [ ] MongoDB Atlas IP access list configured for production server IPs.
* [ ] Upstash or managed Redis URL configured with `rediss://`.
* [ ] Razorpay production keys (`rzp_live_...`) and webhook secret configured.
* [ ] WATI live production endpoint and access token set.
* [ ] Cloudinary production cloud name, API key, and secret set.
* [ ] `ALLOWED_ORIGINS` set to the exact production domain (e.g. `https://picky.com`).
* [ ] Frontend production build verified (`npm run build` exits 0 with no bundle errors).
* [ ] Process manager configured (PM2 / Docker) with restart-on-failure policy.
* [ ] SSL / TLS active on backend API domain.
