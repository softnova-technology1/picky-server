const axios = require('axios');
const logger = require('../utils/logger');

const WATI_ENDPOINT = (process.env.WATI_BASE_URL || process.env.WATI_API_ENDPOINT || '').trim().replace(/\/$/, '');
const WATI_TOKEN = (process.env.WATI_API_KEY || process.env.WATI_ACCESS_TOKEN || '').trim();

const isRealWati =
  Boolean(WATI_ENDPOINT &&
  WATI_TOKEN &&
  !WATI_TOKEN.includes('mock') &&
  !WATI_TOKEN.includes('your_'));

/**
 * Clean phone number to international digits only (e.g. +91 98765 43210 → 919876543210)
 */
const formatPhoneNumber = (phone) => {
  let cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
};

/**
 * Universal WATI Dispatcher (Supports both WATI V3 and legacy V1 API)
 */
const sendTemplateMessage = async (phone, templateName, customParams = [], textFallback = '') => {
  const formattedPhone = formatPhoneNumber(phone);

  if (isRealWati) {
    const isV3 = WATI_ENDPOINT.includes('/api/ext/v3');

    if (isV3) {
      // ── WATI API V3 (Current Standard) ──────────────────────────────────
      try {
        const endpoint = `${WATI_ENDPOINT}/messageTemplates/send`;
        const res = await axios.post(
          endpoint,
          {
            template_name: templateName,
            broadcast_name: `picky_${templateName}_${Date.now()}`,
            recipients: [
              {
                target: formattedPhone,
                parameters: customParams,
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

        if (res.data?.success !== false) {
          logger.info(`✅ [WATI V3] Template "${templateName}" sent to ${formattedPhone} (Status: ${res.status})`);
          return res.data;
        } else {
          logger.warn(`⚠️ [WATI V3] Template "${templateName}" returned warning: ${JSON.stringify(res.data)}`);
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        logger.warn(`⚠️ [WATI V3] Template "${templateName}" error for ${formattedPhone}: ${errorMsg}`);
      }

      // If template fails or is pending, try sending direct conversation text message (if active 24h conversation exists)
      if (textFallback) {
        try {
          const textEndpoint = `${WATI_ENDPOINT}/conversations/messages/text`;
          const res = await axios.post(
            textEndpoint,
            {
              target: formattedPhone,
              text: textFallback,
            },
            {
              headers: {
                Authorization: `Bearer ${WATI_TOKEN}`,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );
          logger.info(`✅ [WATI V3] Conversation text message sent to ${formattedPhone}`);
          return res.data;
        } catch (textErr) {
          // Normal if 24h window is inactive
        }
      }
    } else {
      // ── Legacy WATI API V1 ──────────────────────────────────────────────
      try {
        const endpoint = `${WATI_ENDPOINT}/api/v1/sendTemplateMessage`;
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
        logger.info(`✅ [WATI V1] Template "${templateName}" sent to ${formattedPhone} (Status: ${res.status})`);
        return res.data;
      } catch (err) {
        logger.warn(`⚠️ [WATI V1] Template "${templateName}" error for ${formattedPhone}: ${err.response?.data?.message || err.message}`);
      }
    }
  }

  // ── Console Display (For Local Development, Testing & Pending Approvals) ──
  const paramsStr = customParams.map((p) => `${p.name}: ${p.value}`).join(', ');
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│ 📲 [WHATSAPP OTP / NOTIFICATION]                        │`);
  console.log(`│    To:       ${formattedPhone.padEnd(42)} │`);
  console.log(`│    Template: ${templateName.padEnd(42)} │`);
  console.log(`│    Payload:  ${paramsStr.substring(0, 42).padEnd(42)} │`);
  if (textFallback) {
    console.log(`│    Message:  ${textFallback.substring(0, 42).padEnd(42)} │`);
  }
  console.log('└────────────────────────────────────────────────────────┘\n');
};

const NotificationService = {
  /**
   * OTP login via WhatsApp
   * Template name: picky_otp
   * Params: {{1}} = otp
   */
  sendOTP: (phone, otp) =>
    sendTemplateMessage(
      phone,
      'picky_otp',
      [{ name: '1', value: otp }],
      `Your Picky verification code is: ${otp}. Do not share this code with anyone. Valid for 5 minutes.`
    ),

  /**
   * Order confirmed notification
   * Template name: picky_order_confirmed
   * Params: {{1}} = name, {{2}} = orderNumber, {{3}} = amount
   */
  sendOrderConfirmed: (phone, name, orderNumber, amount) =>
    sendTemplateMessage(
      phone,
      'picky_order_confirmed',
      [
        { name: '1', value: name || 'Customer' },
        { name: '2', value: orderNumber },
        { name: '3', value: `Rs.${amount}` },
      ],
      `Hi ${name || 'Customer'}, your Picky order #${orderNumber} for Rs.${amount} is confirmed!`
    ),

  /**
   * Order shipped notification
   * Template name: picky_order_shipped
   * Params: {{1}} = orderNumber, {{2}} = courier, {{3}} = trackingId (AWB)
   */
  sendOrderShipped: (phone, orderNumber, courier, trackingId) =>
    sendTemplateMessage(
      phone,
      'picky_order_shipped',
      [
        { name: '1', value: orderNumber },
        { name: '2', value: courier || 'Express Delivery' },
        { name: '3', value: trackingId || 'N/A' },
      ],
      `Your Picky order #${orderNumber} has been shipped via ${courier || 'Express'} (AWB: ${trackingId || 'N/A'}).`
    ),

  /**
   * Order delivered notification
   * Template name: picky_order_delivered
   * Params: {{1}} = orderNumber
   */
  sendOrderDelivered: (phone, orderNumber) =>
    sendTemplateMessage(
      phone,
      'picky_order_delivered',
      [{ name: '1', value: orderNumber }],
      `Your Picky order #${orderNumber} has been delivered successfully. Thank you for shopping with us!`
    ),

  /**
   * Order cancelled notification
   * Template name: picky_order_cancelled
   * Params: {{1}} = orderNumber, {{2}} = note
   */
  sendOrderCancelled: (phone, orderNumber, note) =>
    sendTemplateMessage(
      phone,
      'picky_order_cancelled',
      [
        { name: '1', value: orderNumber },
        { name: '2', value: note || 'No reason provided.' },
      ],
      `Your Picky order #${orderNumber} has been cancelled. Note: ${note || 'N/A'}`
    ),
};

module.exports = NotificationService;
