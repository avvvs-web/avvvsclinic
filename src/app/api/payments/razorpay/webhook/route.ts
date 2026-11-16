import { confirmPaid } from '@/lib/appointments';
import { hasDatabase } from '@/lib/db';
import { razorpay, razorpayConfigured, razorpayWebhookReady, webhookGenuine } from '@/lib/payments-razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * Razorpay's webhook: https://clinic.avvvs.com/api/payments/razorpay/webhook
 * Events to switch on in the Razorpay dashboard: payment.captured and order.paid.
 *
 * This confirms a paid consultation even when the patient's browser never came back from the
 * payment window (closed tab, lost connection, a UPI approval that arrived late). Each call is
 * checked against RAZORPAY_WEBHOOK_SECRET, and confirming is safe to repeat: Razorpay sends the
 * same event more than once, and only the first changes anything.
 *
 * Answers 200 to anything genuine, including events it has no use for, so Razorpay does not keep
 * retrying them; 401 to a bad signature; 500 only when confirming failed and a retry would help.
 */
export async function POST(req: Request) {
  if (!razorpayConfigured() || !razorpayWebhookReady() || !hasDatabase()) return new Response('Not configured', { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!webhookGenuine(raw, signature)) return new Response('Bad signature', { status: 401 });
  try {
    const paid = await razorpay.verifyWebhook(raw, signature);
    if (!paid) return Response.json({ ok: true, ignored: true });
    return Response.json({ ok: true, result: await confirmPaid(paid) });
  } catch (e) {
    console.error('[razorpay] could not confirm a paid consultation', e);
    return new Response('Try again', { status: 500 });
  }
}
