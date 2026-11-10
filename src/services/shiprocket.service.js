const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Check if real Shiprocket credentials are configured
 */
function isRealShiprocketConfigured() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  return Boolean(
    email &&
    password &&
    !email.includes('placeholder') &&
    !email.includes('your_') &&
    !password.includes('your_')
  );
}

/**
 * Obtain Shiprocket API JWT Bearer token (cached for 9 days)
 */
async function getAuthToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!isRealShiprocketConfigured()) {
    return null;
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password,
    });

    if (res.data?.token) {
      cachedToken = res.data.token;
      // Shiprocket tokens last ~10 days. Cache for 9 days.
      tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
      logger.info('✅ [Shiprocket] Authenticated successfully with live API');
      return cachedToken;
    }
  } catch (err) {
    logger.error(`❌ [Shiprocket] Authentication failed: ${err.response?.data?.message || err.message}`);
    throw new Error(err.response?.data?.message || 'Shiprocket authentication failed');
  }

  return null;
}

/**
 * Check delivery serviceability for a delivery pincode
 */
async function checkServiceability({ deliveryPincode, weight = 0.5, cod = 0 }) {
  const isReal = isRealShiprocketConfigured();

  if (!isReal) {
    // ── Dev Sandbox Simulated Serviceability ──
    const isTN = /^(60|61|62|63|64)\d{4}$/.test(String(deliveryPincode));
    return {
      success: true,
      mode: 'sandbox',
      deliveryPincode,
      isServiceable: true,
      estimatedDeliveryDays: isTN ? '2-3 Business Days' : '4-5 Business Days',
      courierCompanies: [
        { id: 1, name: 'Delhivery Surface', rate: isTN ? 45 : 70, etd: isTN ? '2 Days' : '4 Days' },
        { id: 2, name: 'BlueDart Express', rate: isTN ? 60 : 90, etd: isTN ? '1-2 Days' : '3 Days' },
        { id: 3, name: 'DTDC Surface', rate: isTN ? 42 : 68, etd: isTN ? '3 Days' : '5 Days' },
        { id: 4, name: 'Shadowfax', rate: isTN ? 40 : 65, etd: isTN ? '2 Days' : '4 Days' },
      ],
    };
  }

  try {
    const token = await getAuthToken();
    const pickupPostcode = process.env.SHIPROCKET_PICKUP_PINCODE || '614804';

    const res = await axios.get(`${BASE_URL}/courier/serviceability/`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        pickup_postcode: pickupPostcode,
        delivery_postcode: deliveryPincode,
        weight,
        cod: cod ? 1 : 0,
      },
    });

    const data = res.data?.data;
    const availableCouriers = data?.available_courier_companies || [];

    return {
      success: true,
      mode: 'live',
      deliveryPincode,
      isServiceable: availableCouriers.length > 0,
      courierCompanies: availableCouriers.map((c) => ({
        id: c.courier_company_id,
        name: c.courier_name,
        rate: c.rate,
        etd: c.etd,
        cod: c.cod === 1,
      })),
    };
  } catch (err) {
    logger.warn(`[Shiprocket] Serviceability check error: ${err.message}`);
    return {
      success: false,
      isServiceable: true, // fallback to open
      courierCompanies: [],
    };
  }
}

/**
 * 1-Click Create Order, Assign AWB, and Schedule Pickup
 */
async function createShipment(order, packageDetails = {}) {
  const isReal = isRealShiprocketConfigured();

  const weight = Number(packageDetails.weight) || 0.5; // in kg
  const length = Number(packageDetails.length) || 15; // in cm
  const breadth = Number(packageDetails.breadth) || 12; // in cm
  const height = Number(packageDetails.height) || 5; // in cm

  const addr = order.shippingAddress || {};
  const isCOD = order.paymentMethod === 'cod';

  if (!isReal) {
    // ── Dev Sandbox Simulated Shipment ──
    const randomAwb = `SR-DLHV-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const randomShipmentId = `SHP-${Date.now().toString().slice(-6)}`;
    const randomOrderId = `SRO-${Date.now().toString().slice(-6)}`;
    const isTN = /^(60|61|62|63|64)\d{4}$/.test(String(addr.pincode));
    const courierName = packageDetails.courierName || (isTN ? 'Delhivery Surface' : 'BlueDart Express');

    logger.info(`📦 [Shiprocket Sandbox] Simulated shipment created for #${order.orderNumber}: AWB ${randomAwb}`);

    return {
      success: true,
      mode: 'sandbox',
      shiprocketOrderId: randomOrderId,
      shiprocketShipmentId: randomShipmentId,
      awbCode: randomAwb,
      courierName,
      courierUrl: `https://shiprocket.co/tracking/${randomAwb}`,
      shippingLabelUrl: `https://apiv2.shiprocket.in/sample-label/${randomShipmentId}.pdf`,
      pickupScheduledDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      shippingStatus: 'AWB Assigned (Pickup Scheduled)',
    };
  }

  // ── Live Shiprocket API Flow ──
  const token = await getAuthToken();
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  // 1. Format order items for Shiprocket payload
  const orderItems = (order.items || []).map((item) => ({
    name: item.name || 'Picky Lifestyle Product',
    sku: item.sku || `SKU-${item.product || 'GEN'}`,
    units: item.quantity || 1,
    selling_price: item.price || 0,
    discount: 0,
    tax: 0,
  }));

  const orderPayload = {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now()).toISOString().split('T')[0],
    pickup_location: pickupLocation,
    billing_customer_name: addr.fullName || 'Customer',
    billing_last_name: '',
    billing_address: addr.street || '',
    billing_address_2: addr.landmark || '',
    billing_city: addr.city || 'Chennai',
    billing_pincode: addr.pincode || '600001',
    billing_state: addr.state || 'Tamil Nadu',
    billing_country: 'India',
    billing_email: order.user?.email || 'orders@picky.co.in',
    billing_phone: addr.phone || '9876543210',
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: isCOD ? 'COD' : 'Prepaid',
    sub_total: order.subtotal || order.total,
    length,
    breadth,
    height,
    weight,
  };

  try {
    // Step A: Create Adhoc Order in Shiprocket
    const createRes = await axios.post(`${BASE_URL}/orders/create/adhoc`, orderPayload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const srData = createRes.data;
    const shipmentId = srData.shipment_id;
    const srOrderId = srData.order_id;

    if (!shipmentId) {
      throw new Error(srData.message || 'Failed to generate Shiprocket shipment ID');
    }

    // Step B: Generate AWB
    let awbCode = null;
    let courierName = 'Shiprocket Courier';

    try {
      const awbRes = await axios.post(
        `${BASE_URL}/courier/assign/awb`,
        { shipment_id: shipmentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      awbCode = awbRes.data?.response?.data?.awb_code;
      courierName = awbRes.data?.response?.data?.courier_name || courierName;
    } catch (awbErr) {
      logger.warn(`[Shiprocket] Auto AWB assignment pending: ${awbErr.message}`);
    }

    // Step C: Request Courier Pickup
    let pickupDate = null;
    try {
      const pickupRes = await axios.post(
        `${BASE_URL}/courier/generate/pickup`,
        { shipment_id: [shipmentId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      pickupDate = pickupRes.data?.response?.pickup_scheduled_date || null;
    } catch (pickupErr) {
      logger.warn(`[Shiprocket] Auto pickup request notice: ${pickupErr.message}`);
    }

    // Step D: Get Shipping Label URL
    let labelUrl = null;
    try {
      const labelRes = await axios.post(
        `${BASE_URL}/courier/generate/label`,
        { shipment_id: [shipmentId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      labelUrl = labelRes.data?.label_url || null;
    } catch (_) {}

    return {
      success: true,
      mode: 'live',
      shiprocketOrderId: String(srOrderId),
      shiprocketShipmentId: String(shipmentId),
      awbCode: awbCode || `SR-PENDING-${shipmentId}`,
      courierName,
      courierUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
      shippingLabelUrl: labelUrl,
      pickupScheduledDate: pickupDate,
      shippingStatus: awbCode ? 'AWB Assigned' : 'Order Created',
    };
  } catch (apiErr) {
    const msg = apiErr.response?.data?.message || apiErr.message;
    logger.error(`❌ [Shiprocket] Shipment creation error: ${msg}`);
    throw new Error(msg);
  }
}

/**
 * Live Tracking for an AWB Code
 */
async function trackShipment(awbCode) {
  const isReal = isRealShiprocketConfigured();

  if (!isReal || !awbCode || awbCode.startsWith('SR-DLHV') || awbCode.startsWith('SR-PENDING')) {
    // ── Dev Sandbox Simulated Tracking Milestones ──
    return {
      success: true,
      mode: 'sandbox',
      awb: awbCode || 'SR-DLHV-98421054',
      courier: 'Delhivery Surface',
      currentStatus: 'In Transit',
      trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
      activities: [
        { activity: 'Out for Delivery to Customer Doorstep', location: 'Destination Hub', date: new Date().toISOString() },
        { activity: 'Shipment arrived at Regional Distribution Center', location: 'Chennai Hub', date: new Date(Date.now() - 14 * 3600 * 1000).toISOString() },
        { activity: 'Package picked up from Picky Store Warehouse', location: 'Thanjavur, TN', date: new Date(Date.now() - 28 * 3600 * 1000).toISOString() },
        { activity: 'Manifest & AWB Generated by Shiprocket', location: 'System', date: new Date(Date.now() - 36 * 3600 * 1000).toISOString() },
      ],
    };
  }

  try {
    const token = await getAuthToken();
    const res = await axios.get(`${BASE_URL}/courier/track/awb/${awbCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const trackingData = res.data?.tracking_data;
    const shipmentTrack = trackingData?.shipment_track || [];
    const activities = trackingData?.shipment_track_activities || [];

    return {
      success: true,
      mode: 'live',
      awb: awbCode,
      courier: shipmentTrack[0]?.courier_name || 'Courier Partner',
      currentStatus: shipmentTrack[0]?.current_status || 'In Transit',
      trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
      activities: activities.map((a) => ({
        activity: a.activity,
        location: a.location,
        date: a.date,
      })),
    };
  } catch (err) {
    logger.warn(`[Shiprocket] Track AWB error: ${err.message}`);
    return {
      success: false,
      awb: awbCode,
      currentStatus: 'Dispatched',
      activities: [],
    };
  }
}

/**
 * Generate Shipping Label PDF URL
 */
async function getShippingLabel(shipmentId) {
  if (!isRealShiprocketConfigured()) {
    return {
      success: true,
      mode: 'sandbox',
      labelUrl: `https://apiv2.shiprocket.in/sample-label/${shipmentId || 'demo'}.pdf`,
    };
  }

  try {
    const token = await getAuthToken();
    const res = await axios.post(
      `${BASE_URL}/courier/generate/label`,
      { shipment_id: [shipmentId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return {
      success: true,
      labelUrl: res.data?.label_url,
    };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

module.exports = {
  isRealShiprocketConfigured,
  getAuthToken,
  checkServiceability,
  createShipment,
  trackShipment,
  getShippingLabel,
};

