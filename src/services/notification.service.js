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
 * Clean phone number to digits only (e.g. +91 98765 43210 -> 919876543210)
 */
const formatPhoneNumber = (phone) => {
  let cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
};

const sendWatiMessage = async (to, message) => {
  const formattedPhone = formatPhoneNumber(to);

  if (isRealWati) {
    try {
      const endpoint = `${WATI_ENDPOINT.replace(/\/$/, '')}/api/v1/sendSessionMessage/${formattedPhone}?messageText=${encodeURIComponent(message)}`;
      const res = await axios.post(
        endpoint,
        {},
        {
          headers: {
            Authorization: `Bearer ${WATI_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      logger.info(`✅ WATI WhatsApp message sent to ${formattedPhone} (Status: ${res.status})`);
      return res.data;
    } catch (err) {
      logger.error(`❌ WATI WhatsApp send error for ${formattedPhone}: ${err.response?.data?.message || err.message}`);
    }
  }

  // Console Mock for Local Development & Testing
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│ 📲 [WATI WHATSAPP DISPATCH] To: ${formattedPhone.padEnd(23)} │`);
  console.log('├────────────────────────────────────────────────────────┤');
  message.split('\n').forEach((line) => {
    console.log(`│ ${line.padEnd(54)} │`);
  });
  console.log('└────────────────────────────────────────────────────────┘\n');
};

const NotificationService = {
  sendOTP: (phone, otp) =>
    sendWatiMessage(phone, `Your Picky OTP is: ${otp}\nValid for 5 minutes. Do not share with anyone.`),

  sendOrderConfirmed: (phone, name, orderNumber, amount) =>
    sendWatiMessage(
      phone,
      `Hi ${name || 'Customer'}! Your Picky order #${orderNumber} is confirmed!\nTotal: Rs.${amount}\nPayment: 100% Paid (Razorpay)\nWe'll notify you when it's dispatched.`
    ),

  sendOrderShipped: (phone, orderNumber, courier, trackingId) =>
    sendWatiMessage(
      phone,
      `Order #${orderNumber} has been dispatched & shipped!\nCourier: ${courier || 'Express Delivery'}\nAWB: ${trackingId || 'N/A'}\nTrack live on your Picky account.`
    ),

  sendOrderDelivered: (phone, orderNumber) =>
    sendWatiMessage(
      phone,
      `Your Picky order #${orderNumber} has been delivered!\nThank you for shopping with us at Picky! 🎉`
    ),
};

module.exports = NotificationService;
