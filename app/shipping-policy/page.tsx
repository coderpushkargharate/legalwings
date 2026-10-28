import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { BUSINESS } from '@/lib/business-info';

export const metadata: Metadata = { title: `Service Delivery Policy — ${BUSINESS.brandName}` };

export default function ShippingPolicyPage() {
  return (
    <LegalPage title="Shipping & Service Delivery Policy">
      <p>
        {BUSINESS.brandName} provides services, not physical goods, so no products are shipped. This page explains
        how and when our services are delivered.
      </p>

      <section>
        <h2>1. Delivery method</h2>
        <ul>
          <li>Draft agreements are shared by email and/or WhatsApp on your registered contact details.</li>
          <li>Registered agreements are delivered as a digital copy (PDF) by email and/or WhatsApp.</li>
          <li>Where a doorstep visit is booked, our executive visits the address you provide at the scheduled time.</li>
        </ul>
      </section>

      <section>
        <h2>2. Delivery timeline</h2>
        <ul>
          <li>Draft agreement: usually within 24 hours of receiving complete details and payment.</li>
          <li>Doorstep visit: scheduled within 1–3 working days, as per your preferred slot.</li>
          <li>
            Registered agreement: usually within 1–3 working days after biometric verification, subject to the
            government portal.
          </li>
        </ul>
        <p>Delays caused by government portals or incomplete documents are outside our control; we will keep you informed.</p>
      </section>

      <section>
        <h2>3. Contact</h2>
        <p>If you have not received your service within the stated time, contact us at {BUSINESS.email} or {BUSINESS.phone}.</p>
      </section>
    </LegalPage>
  );
}
