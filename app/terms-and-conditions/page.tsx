import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { BUSINESS } from '@/lib/business-info';

export const metadata: Metadata = { title: `Terms & Conditions — ${BUSINESS.brandName}` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions govern your use of {BUSINESS.website} and the services offered by{' '}
        {BUSINESS.legalName} (&quot;{BUSINESS.brandName}&quot;). By placing an order or making a payment you agree to
        these terms.
      </p>

      <section>
        <h2>1. Services</h2>
        <p>
          {BUSINESS.brandName} provides drafting, registration and doorstep assistance for rent / leave and licence
          agreements and related legal documentation. We are a documentation service provider and not a law firm;
          our services do not constitute legal advice.
        </p>
      </section>

      <section>
        <h2>2. Your responsibilities</h2>
        <ul>
          <li>You must provide accurate and complete information and genuine documents.</li>
          <li>You are responsible for the correctness of the agreement details you confirm before registration.</li>
          <li>All parties (owner, tenant, witnesses) must be available for verification where required.</li>
        </ul>
      </section>

      <section>
        <h2>3. Pricing and payment</h2>
        <ul>
          <li>Prices are quoted in Indian Rupees (INR) and include our service charges as communicated to you.</li>
          <li>Government stamp duty and registration fees are charged at actuals as per applicable law.</li>
          <li>
            Online payments are processed securely by Cashfree Payments via UPI, debit/credit card, net banking and
            wallets. We do not store your card or bank credentials.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Cancellation and refunds</h2>
        <p>
          Cancellations and refunds are governed by our{' '}
          <a href="/refund-policy" className="text-teal-700 underline">Refund &amp; Cancellation Policy</a>.
        </p>
      </section>

      <section>
        <h2>5. Limitation of liability</h2>
        <p>
          We are not liable for delays or rejections caused by government portals, registration authorities,
          incorrect information supplied by you, or events beyond our reasonable control. Our total liability for
          any claim is limited to the amount paid by you for the specific service.
        </p>
      </section>

      <section>
        <h2>6. Intellectual property</h2>
        <p>All content on this website is owned by {BUSINESS.legalName} and may not be copied without permission.</p>
      </section>

      <section>
        <h2>7. Governing law</h2>
        <p>
          These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the
          courts at {BUSINESS.city}.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          For any questions, write to {BUSINESS.email} or call {BUSINESS.phone}.
        </p>
      </section>
    </LegalPage>
  );
}
