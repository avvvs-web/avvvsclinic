import 'server-only';
import { razorpay, razorpayConfigured } from './payments-razorpay';

/*
 * Payment for online consultations.
 *
 * PAYMENT_PROVIDER=razorpay (with the Razorpay keys set) makes a patient pay when they book:
 * createAppointment() holds the slot as "pending_payment" for HOLD_MINUTES, the browser opens
 * Razorpay's checkout, and the appointment is confirmed by /api/consult/pay (the browser's
 * return) or /api/payments/razorpay/webhook (Razorpay's own call), whichever arrives first.
 * Without it, the "none" provider confirms a booking at once, with no payment step.
 *
 * Only doctors with a fee take payment; a doctor with no fee is always booked free.
 * The clinic never sees card or UPI details: only the amount, the status and Razorpay's references.
 */

export const HOLD_MINUTES = 10;

export interface PaymentOrder { provider: string; orderRef: string; amountPaise: number; /** what the browser needs to open the gateway's checkout */ checkout: Record<string, unknown> }
export interface Paid { orderRef: string; paymentRef: string; amountPaise: number }

export interface PaymentProvider {
  id: string;
  /** false: bookings confirm at once, with no payment step */
  required: boolean;
  createOrder(input: { ref: string; amountPaise: number; name: string; email: string; phone: string; description: string }): Promise<PaymentOrder>;
  /** The browser's return from checkout: checks the gateway's signature, then asks the gateway what was really paid. */
  verifyReturn(fields: Record<string, unknown>): Promise<Paid | null>;
  /** A webhook: checks it really came from the gateway. null means "not a payment, or not genuine". */
  verifyWebhook(rawBody: string, signature: string | null): Promise<Paid | null>;
  /** Sends the money back to where it came from; returns the gateway's refund reference. */
  refund(paymentRef: string, amountPaise: number, ref: string): Promise<string>;
}

const none: PaymentProvider = {
  id: 'none',
  required: false,
  async createOrder() { throw new Error('Online payment is not switched on.'); },
  async verifyReturn() { return null; },
  async verifyWebhook() { return null; },
  async refund() { throw new Error('Online payment is not switched on.'); },
};

export function paymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER?.trim() === 'razorpay' && razorpayConfigured()) return razorpay;
  return none;
}

/** The provider that took a past payment, for refunds: it must still work after payment is switched off again. */
export function providerById(id: string | null | undefined): PaymentProvider | null {
  return id === 'razorpay' && razorpayConfigured() ? razorpay : null;
}

/** Whether patients pay online when they book (for pages and wording). */
export const paymentOn = () => paymentProvider().required;
