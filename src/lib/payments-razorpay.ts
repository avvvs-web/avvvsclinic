import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Paid, PaymentProvider } from './payments';
import { CLINIC } from './site';

/*
 * Razorpay, through its Orders API and hosted checkout (checkout.js). Nothing here touches card
 * or UPI details: the browser talks to Razorpay, and this server only creates the order, checks
 * signatures, reads back what was paid, and refunds.
 *
 *   RAZORPAY_KEY_ID          the public key id (rzp_live_… or rzp_test_…), also sent to the browser
 *   RAZORPAY_KEY_SECRET      its secret: server only
 *   RAZORPAY_WEBHOOK_SECRET  the secret typed when the webhook was created in the Razorpay dashboard
 *
 * A signature alone is never trusted for the amount: after it checks out, the payment is fetched
 * from Razorpay and must belong to the order, be in rupees, and be authorised or captured.
 */

const env = (k: string) => process.env[k]?.trim() || '';
const API = () => env('RAZORPAY_API_BASE') || 'https://api.razorpay.com';   // overridden only by the local test double

export const razorpayConfigured = () => !!env('RAZORPAY_KEY_ID') && !!env('RAZORPAY_KEY_SECRET');
export const razorpayWebhookReady = () => !!env('RAZORPAY_WEBHOOK_SECRET');
export const razorpayMode = () => (env('RAZORPAY_KEY_ID').startsWith('rzp_live_') ? 'live' : 'test');

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');
  const r = await fetch(`${API()}/v1${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Basic ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { code?: string; description?: string } };
  if (!r.ok) throw new Error(`Razorpay ${method} ${path}: ${r.status} ${j.error?.code ?? ''} ${j.error?.description ?? ''}`.trim());
  return j;
}

const hmac = (text: string, secret: string) => createHmac('sha256', secret).update(text).digest('hex');
function same(a: string, b: string) {
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether a webhook body really came from Razorpay (signed with the webhook's own secret). */
export function webhookGenuine(rawBody: string, signature: string | null) {
  const secret = env('RAZORPAY_WEBHOOK_SECRET');
  return !!secret && !!signature && same(hmac(rawBody, secret), signature);
}

interface RzpPayment { id: string; order_id: string | null; amount: number; currency: string; status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'; notes?: Record<string, string> | unknown[] }

/**
 * Reads the payment back from Razorpay. With `capture`, a payment that is only authorised is
 * captured (for accounts set to capture by hand); that is done only for a payment already known
 * to be for one of the clinic's own bookings, never from a webhook, because the same Razorpay
 * account also takes the pharmacy's payments.
 */
async function settled(paymentId: string, orderId: string, capture: boolean): Promise<Paid | null> {
  let p = await call<RzpPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
  if (p.order_id !== orderId || p.currency !== 'INR') return null;
  if (p.status === 'authorized' && capture) {
    try { p = await call<RzpPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: p.amount, currency: 'INR' }); }
    catch (e) {
      // someone else (auto-capture, or the webhook) may have captured it in the meantime
      p = await call<RzpPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
      if (p.status !== 'captured') throw e;
    }
  }
  return p.status === 'captured' ? { orderRef: orderId, paymentRef: p.id, amountPaise: p.amount } : null;
}

export const razorpay: PaymentProvider = {
  id: 'razorpay',
  required: true,

  async createOrder({ ref, amountPaise, name, email, phone, description }) {
    const o = await call<{ id: string; amount: number }>('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt: ref, notes: { booking: ref } });
    return {
      provider: 'razorpay', orderRef: o.id, amountPaise: o.amount,
      checkout: {
        key: env('RAZORPAY_KEY_ID'), order_id: o.id, amount: o.amount, currency: 'INR',
        name: CLINIC.name, description, prefill: { name, email, contact: phone }, notes: { booking: ref },
      },
    };
  },

  async verifyReturn(f) {
    const orderId = String(f.razorpay_order_id ?? ''), paymentId = String(f.razorpay_payment_id ?? ''), signature = String(f.razorpay_signature ?? '');
    if (!orderId || !paymentId || !signature) return null;
    if (!same(hmac(`${orderId}|${paymentId}`, env('RAZORPAY_KEY_SECRET')), signature)) return null;
    return settled(paymentId, orderId, true);
  },

  async verifyWebhook(rawBody, signature) {
    if (!webhookGenuine(rawBody, signature)) return null;
    let j: { event?: string; payload?: { payment?: { entity?: RzpPayment } } };
    try { j = JSON.parse(rawBody); } catch { return null; }
    const p = j.payload?.payment?.entity;
    // only the clinic's own orders carry a booking note; everything else on the account (the pharmacy's
    // payments) is left alone
    const booking = p?.notes && !Array.isArray(p.notes) ? (p.notes as Record<string, string>).booking : undefined;
    if (!p?.id || !p.order_id || !booking || !['payment.captured', 'order.paid'].includes(j.event ?? '')) return null;
    return settled(p.id, p.order_id, false);
  },

  async refund(paymentRef, amountPaise, ref) {
    const r = await call<{ id: string }>('POST', `/payments/${encodeURIComponent(paymentRef)}/refund`, { amount: amountPaise, speed: 'normal', notes: { booking: ref } });
    return r.id;
  },
};
