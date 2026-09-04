const twilio = require('twilio');
const logger = require('../utils/logger');

const isRealTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  !process.env.TWILIO_ACCOUNT_SID.includes('mock') &&
  !process.env.TWILIO_ACCOUNT_SID.includes('xxxx');

let client = null;
if (isRealTwilio) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    logger.warn('Twilio initialization failed: ' + e.message);
  }
}

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

const send = async (to, body) => {
  if (client) {
    try {
      await client.messages.create({ from: FROM, to: `whatsapp:${to}`, body });
      logger.info(`WhatsApp sent to ${to}`);
      return;
    } catch (err) {
      logger.error(`WhatsApp send failed via Twilio: ${err.message}. Falling back to console output.`);
    }
  }

  // Console Mock for Local Development
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│ 📲 [DEV WHATSAPP MOCK] To: ${to.padEnd(28)} │`);
  console.log('├────────────────────────────────────────────────────────┤');
  body.split('\n').forEach((line) => {
    console.log(`│ ${line.padEnd(54)} │`);
  });
  console.log('└────────────────────────────────────────────────────────┘\n');
};

const NotificationService = {
  sendOTP: (phone, otp) =>
    send(phone, `Your Picky OTP is: ${otp}\nValid for 5 minutes. Do not share with anyone.`),

  sendOrderConfirmed: (phone, name, orderNumber, amount) =>
    send(phone, `Hi ${name}! Your Picky order #${orderNumber} is confirmed!\nTotal: Rs.${amount}\nWe'll notify you when it's shipped.`),

  sendOrderShipped: (phone, orderNumber, courier, trackingId) =>
    send(phone, `Order #${orderNumber} has been shipped!\nCourier: ${courier}\nAWB: ${trackingId}\nTrack using the AWB number with your courier.`),

  sendOrderDelivered: (phone, orderNumber) =>
    send(phone, `Your Picky order #${orderNumber} has been delivered!\nThank you for shopping with us! 🎉`),
};

module.exports = NotificationService;
