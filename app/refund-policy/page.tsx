import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { BUSINESS } from '@/lib/business-info';

export const metadata: Metadata = { title: `Refund & Cancellation Policy — ${BUSINESS.brandName}` };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>
        This policy applies to all services purchased from {BUSINESS.legalName} (&quot;{BUSINESS.brandName}&quot;).
      </p>

      <section>
        <h2>1. Cancellation</h2>
        <ul>
          <li>
            You may cancel your order by contacting us at {BUSINESS.email} or {BUSINESS.phone} before the agreement
            is submitted for registration or the doorstep visit is completed.
          </li>
          <li>Once the agreement has been submitted to the registration authority, the order cannot be cancelled.</li>
        </ul>
      </section>

      <section>
        <h2>2. Refunds</h2>
        <ul>
          <li>Cancelled before any work has started: full refund of the amount paid.</li>
          <li>
            Cancelled after drafting has started but before registration: refund of the amount paid minus the
            service charges for work already done.
          </li>
          <li>
            Government stamp duty and registration fees already paid to the authority are non-refundable, except
            where the authority itself refunds them.
          </li>
          <li>If a payment is debited twice or debited for a failed order, the extra amount is refunded in full.</li>
          <li>If we are unable to deliver the service due to a reason on our side, you receive a full refund.</li>
        </ul>
      </section>

      <section>
        <h2>3. Refund timeline</h2>
        <p>
          Approved refunds are processed within 5–7 working days and credited to the original payment method
          (UPI, card, net banking or wallet). Your bank may take additional time to reflect the credit.
        </p>
      </section>

      <section>
        <h2>4. How to request a refund</h2>
        <p>
          Email {BUSINESS.email} with your name, registered mobile number and payment transaction ID. We will
          respond within 2 working days.
        </p>
      </section>
    </LegalPage>
  );
}
