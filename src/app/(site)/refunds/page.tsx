import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { CANCEL_CUTOFF_MIN } from '@/lib/consult';
import { CLINIC, alternatesFor, tel } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Fees, cancellations and refunds',
  description: `How fees are charged at ${CLINIC.name}, how to cancel or change an appointment, and when and how fees are refunded.`,
  alternates: alternatesFor('/refunds'),
};

const hours = CANCEL_CUTOFF_MIN / 60;

// A draft for legal review, and for the clinic to confirm the refund rules before online payment is
// switched on (lib/payments.ts). Payment gateways ask for this page when a merchant account is opened.
export default function Refunds() {
  const mail = <a href={`mailto:${CLINIC.email}`}>{CLINIC.email}</a>;
  const phone = <a href={tel(CLINIC.phones[0])}>{CLINIC.phones[0]}</a>;
  return (
    <LegalPage
      title="Fees, cancellations and refunds"
      updated="15 November 2026"
      intro={<p>This page explains how {CLINIC.name}, run by {CLINIC.legal} (AVVVS), Kozhikode, charges for consultations and therapies, how to cancel or change an appointment, and when you get your money back. It is a draft awaiting legal review.</p>}
      sections={[
        { id: 'fees', title: 'Fees', body: <>
          <p>The fee for an online consultation is shown next to the doctor’s name before you book, in Indian rupees, including any applicable taxes. Fees for consultations and therapies at the clinic are explained at the clinic before any treatment begins.</p>
          <p>A fee pays for the doctor’s time and advice. It does not depend on the outcome of the consultation, and it does not include medicines or therapies, which are charged separately.</p>
        </> },
        { id: 'paying', title: 'How you pay', body: <>
          <p>At present, online consultations are booked without paying on this website. If a fee applies, the clinic tells you how to pay it. Fees for visits to the clinic are paid at the clinic.</p>
          <p>When online payment is switched on, you will pay when you book, through a licensed payment gateway, by UPI, card, net banking or wallet. Your payment details go to the gateway, not to the clinic, and the clinic never sees or stores your card number or UPI PIN. An appointment awaiting payment is held for a few minutes and released if the payment does not complete. You receive a receipt by email.</p>
        </> },
        { id: 'cancel', title: 'Cancelling or changing an online consultation', body: <>
          <p>You can cancel or move an online consultation up to {hours} hours before it starts, using the link in your confirmation email. Closer to the time, please call {phone}.</p>
          <ul>
            <li><b>You cancel {hours} hours or more before the start:</b> the full fee is refunded.</li>
            <li><b>You cancel less than {hours} hours before, or do not join:</b> the fee is not normally refunded, because the doctor’s time was kept for you. If something serious stopped you, call the clinic and it will consider a refund or a new time.</li>
            <li><b>You move the appointment</b> to another available time with the same doctor: no charge, and the fee you paid carries over.</li>
          </ul>
        </> },
        { id: 'clinic', title: 'When the clinic cancels, or the call fails', body: <>
          <ul>
            <li><b>The clinic cancels or the doctor cannot attend:</b> you choose a new time or a full refund.</li>
            <li><b>The doctor decides your concern cannot be handled online</b> and asks you to visit in person before giving advice: you choose a full refund, or to put the fee towards a consultation at the clinic.</li>
            <li><b>The video call fails</b> because of a problem on the clinic’s side and cannot be completed: you choose a new time or a full refund.</li>
          </ul>
        </> },
        { id: 'visits', title: 'Visits and therapies at the clinic', body: <>
          <p>Requests to visit the clinic are free to make and to cancel; please call to cancel so the time can go to someone else. For therapy programmes paid in advance, any sessions not yet given are refunded if you stop the programme, unless the clinic told you otherwise in writing before you paid. Medicines that have been dispensed cannot be returned.</p>
        </> },
        { id: 'refunds', title: 'How refunds are paid', body: <>
          <p>Refunds go back to the account or card you paid from. The clinic starts the refund within 5 working days of agreeing it, and it normally reaches you within 5 to 10 working days after that, depending on your bank. Payments made at the clinic are refunded at the clinic or by bank transfer.</p>
          <p>To ask for a refund, write to {mail} or call {phone} with your booking reference (it is in your confirmation email).</p>
        </> },
        { id: 'complaints', title: 'Questions and complaints', body: <>
          <p>If you are unhappy with how a fee or refund was handled, contact the clinic at {mail}, {phone}, or in writing at {CLINIC.address.lines.join(', ')}. We acknowledge complaints within 48 hours and aim to resolve them within one month. Nothing on this page limits your rights under the Consumer Protection Act, 2019. See also our <Link href="/terms">Terms of use</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        </> },
      ]}
    />
  );
}
