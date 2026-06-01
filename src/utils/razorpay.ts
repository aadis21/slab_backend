import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

export const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

export const createRazorpayOrder = async (
  amountInPaise: number,
  currency = 'INR',
  receipt?: string
) => {
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency,
    receipt: receipt || `order_${Date.now()}`,
  });
  return order;
};

export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};
