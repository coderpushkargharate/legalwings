import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { BUSINESS } from '@/lib/business-info';

export const metadata: Metadata = { title: `Contact Us — ${BUSINESS.brandName}` };

export default function ContactUsPage() {
  return (
    <LegalPage title="Contact Us">
      <p>We are happy to help with orders, payments, refunds or any other questions.</p>

      <section>
        <h2>{BUSINESS.legalName}</h2>
        <ul>
          <li><strong>Address:</strong> {BUSINESS.address}</li>
          <li>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${BUSINESS.email}`} className="text-teal-700 underline">{BUSINESS.email}</a>
          </li>
          <li>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className="text-teal-700 underline">{BUSINESS.phone}</a>
          </li>
          <li><strong>Support hours:</strong> {BUSINESS.supportHours}</li>
        </ul>
      </section>

      <p>We aim to reply to all queries within 1 working day.</p>
    </LegalPage>
  );
}
