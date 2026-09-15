const axios = require('axios');
const logger = require('../utils/logger');

const WATI_ENDPOINT = process.env.WATI_API_ENDPOINT || '';
const WATI_TOKEN = process.env.WATI_ACCESS_TOKEN || '';

const isRealWati =
  WATI_ENDPOINT &&
  WATI_TOKEN &&
  !WATI_TOKEN.includes('mock') &&
  !WATI_TOKEN.includes('your_');

/**
 * Clean phone number to digits only (e.g. +91 98765 43210 → 919876543210)
 */
const formatPhoneNumber = (phone) => {
  let cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
};

/**
 * audit fix #4 — Changed from sendSessionMessage to sendTemplateMessage.
 *
 * REASON: sendSessionMessage only works within a 24-hour customer-initiated
 * window. Order confirmations, shipping updates, and delivery notifications
 * are business-initiated messages → they fall OUTSIDE that window → WATI
 * returns 403 in production. Template messages work at any time.
 *
 * Templates must be pre-approved in the WATI dashboard:
 *  - picky_otp
 *  - picky_order_confirmed
 *  - picky_order_shipped
 *  - picky_order_delivered
 *  - picky_order_cancelled
 */
const sendTemplateMessage = async (phone, templateName, customParams = []) => {
  const formattedPhone = formatPhoneNumber(phone);

  if (isRealWati) {
    try {
      const endpoint = `${WATI_ENDPOINT.replace(/\/$/, '')}/api/v1/sendTemplateMessage`;
      const res = await axios.post(
        endpoint,
        {
          template_name: templateName,
          broadcast_name: `picky_${templateName}_${Date.now()}`,
          receivers: [
            {
              whatsappNumber: formattedPhone,
              customParams,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${WATI_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      logger.info(`✅ WATI Template "${templateName}" sent to ${formattedPhone} (Status: ${res.status})`);
      return res.data;
    } catch (err) {
      logger.error(
        `❌ WATI Template "${templateName}" error for ${formattedPhone}: ${err.response?.data?.message || err.message}`
      );
    }
  }

  // Console Mock for Local Development & Testing
  const paramsStr = customParams.map((p) => `${p.name}: ${p.value}`).join(', ');
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│ 📲 [WATI TEMPLATE] Template: ${templateName.padEnd(24)} │`);
  console.log(`│    To: ${formattedPhone.padEnd(48)} │`);
  console.log(`│    Params: ${paramsStr.substring(0, 44).padEnd(44)} │`);
  console.log('└────────────────────────────────────────────────────────┘\n');
};

const NotificationService = {
  /**
   * OTP login via WhatsApp Template Message
   * Template name: picky_otp
   * Params: {{1}} = otp
   */
  sendOTP: (phone, otp) =>
    sendTemplateMessage(phone, 'picky_otp', [
      { name: '1', value: otp },
    ]),

  /**
   * Order confirmed notification
   * Template name: picky_order_confirmed
   * Params: {{1}} = name, {{2}} = orderNumber, {{3}} = amount
   */
  sendOrderConfirmed: (phone, name, orderNumber, amount) =>
    sendTemplateMessage(phone, 'picky_order_confirmed', [
      { name: '1', value: name || 'Customer' },
      { name: '2', value: orderNumber },
      { name: '3', value: `Rs.${amount}` },
    ]),

  /**
   * Order shipped notification
   * Template name: picky_order_shipped
   * Params: {{1}} = orderNumber, {{2}} = courier, {{3}} = trackingId (AWB)
   */
  sendOrderShipped: (phone, orderNumber, courier, trackingId) =>
    sendTemplateMessage(phone, 'picky_order_shipped', [
      { name: '1', value: orderNumber },
      { name: '2', value: courier || 'Express Delivery' },
      { name: '3', value: trackingId || 'N/A' },
    ]),

  /**
   * Order delivered notification
   * Template name: picky_order_delivered
   * Params: {{1}} = orderNumber
   */
  sendOrderDelivered: (phone, orderNumber) =>
    sendTemplateMessage(phone, 'picky_order_delivered', [
      { name: '1', value: orderNumber },
    ]),

  /**
   * Order cancelled notification (audit fix #4 — was missing entirely)
   * Template name: picky_order_cancelled
   * Params: {{1}} = orderNumber, {{2}} = note
   */
  sendOrderCancelled: (phone, orderNumber, note) =>
    sendTemplateMessage(phone, 'picky_order_cancelled', [
      { name: '1', value: orderNumber },
      { name: '2', value: note || 'No reason provided.' },
    ]),
};

module.exports = NotificationService;
