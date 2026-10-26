const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertPaymentMatchesIntent,
  assertDirectOrderIsAllowed,
} = require('../src/modules/order/paymentValidation');
const Order = require('../src/models/order.model');

const makePayment = (overrides = {}) => ({
  intent: {
    razorpayOrderId: 'order_123',
    user: { toString: () => 'user_123' },
    pricing: { total: 125.5 },
  },
  razorpayOrderId: 'order_123',
  razorpayPaymentId: 'pay_123',
  gatewayOrder: {
    id: 'order_123',
    amount: 12550,
    currency: 'INR',
    notes: { userId: 'user_123' },
  },
  payment: {
    id: 'pay_123',
    order_id: 'order_123',
    amount: 12550,
    currency: 'INR',
    status: 'captured',
  },
  ...overrides,
});

test('accepts a captured payment matching the server checkout intent', () => {
  assert.doesNotThrow(() => assertPaymentMatchesIntent(makePayment()));
});

for (const [name, override] of [
  ['a different gateway order', { gatewayOrder: { ...makePayment().gatewayOrder, id: 'order_other' } }],
  ['a different payment order id', { payment: { ...makePayment().payment, order_id: 'order_other' } }],
  ['a different amount', { payment: { ...makePayment().payment, amount: 1 } }],
  ['a different currency', { gatewayOrder: { ...makePayment().gatewayOrder, currency: 'USD' } }],
  ['an uncaptured payment', { payment: { ...makePayment().payment, status: 'authorized' } }],
  ['an order created for another user', { gatewayOrder: { ...makePayment().gatewayOrder, notes: { userId: 'user_other' } } }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => assertPaymentMatchesIntent(makePayment(override)), /does not match this checkout/);
  });
}

test('rejects a direct production order marked paid with a client-supplied payment id', () => {
  assert.throws(() => assertDirectOrderIsAllowed({
    environment: 'production',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    razorpayPaymentId: 'fake_payment_id',
  }), /Payment details cannot be supplied/);
});

test('rejects direct production online orders even when client says pending', () => {
  assert.throws(() => assertDirectOrderIsAllowed({
    environment: 'production',
    paymentMethod: 'card',
    paymentStatus: 'pending',
  }), /verified Razorpay checkout flow/);
});

test('fails closed when NODE_ENV is missing', () => {
  assert.throws(() => assertDirectOrderIsAllowed({
    environment: undefined,
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    razorpayPaymentId: 'fake_payment_id',
  }), /Payment details cannot be supplied/);
});

test('allows a production COD order only without claimed payment details', () => {
  assert.doesNotThrow(() => assertDirectOrderIsAllowed({
    environment: 'production',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
  }));
});

test('rejects a paid claim even when NODE_ENV is development', () => {
  assert.throws(() => assertDirectOrderIsAllowed({
    environment: 'development',
    paymentMethod: 'card',
    paymentStatus: 'paid',
  }), /Payment details cannot be supplied/);
});

test('allows the development payment simulator to create a pending order', () => {
  assert.doesNotThrow(() => assertDirectOrderIsAllowed({
    environment: 'development',
    paymentMethod: 'card',
    paymentStatus: 'pending',
  }));
});

test('new Order documents default to pending payment status', () => {
  const order = new Order({
    orderNumber: 'PKY-TEST-12345678',
    user: '507f1f77bcf86cd799439011',
    items: [{ name: 'Test item', price: 10, quantity: 1 }],
    shippingAddress: { street: '1 Main Rd', city: 'Chennai', state: 'TN', pincode: '600001' },
    subtotal: 10,
    total: 10,
  });
  assert.equal(order.paymentStatus, 'pending');
});
