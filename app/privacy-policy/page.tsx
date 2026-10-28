import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { BUSINESS } from '@/lib/business-info';

export const metadata: Metadata = { title: `Privacy Policy — ${BUSINESS.brandName}` };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how {BUSINESS.legalName} (&quot;{BUSINESS.brandName}&quot;, &quot;we&quot;, &quot;us&quot;)
        collects, uses, shares and protects your personal information when you use our website{' '}
        {BUSINESS.website} and our rent agreement and related documentation services (the &quot;Services&quot;).
        By using the Services you agree to this policy.
      </p>

      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>Identity and contact details: name, mobile number, email address and postal address.</li>
          <li>
            Agreement details of the owner, tenant and witnesses: names, addresses, property details, rent and
            deposit amounts, and identity documents (such as Aadhaar or PAN) required by the registration authority.
          </li>
          <li>Biometric verification and photographs, only where required for registration of the agreement.</li>
          <li>
            Payment information: transaction ID, amount and status. Card, UPI and bank details are entered on and
            processed by our payment partner Cashfree Payments; we do not store your card number, CVV or UPI PIN.
          </li>
          <li>Technical data such as IP address, browser type and pages visited, used to keep the site secure.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>To draft, register and deliver your rent agreement or other documents you order.</li>
          <li>To schedule doorstep visits and contact you about your order.</li>
          <li>To process payments, issue receipts and handle refunds.</li>
          <li>To comply with legal requirements and respond to lawful requests from authorities.</li>
          <li>To prevent fraud and improve our Services.</li>
        </ul>
      </section>

      <section>
        <h2>3. Sharing of information</h2>
        <p>We do not sell or rent your personal information. We share it only with:</p>
        <ul>
          <li>Government registration authorities, as required to register your agreement.</li>
          <li>Our payment gateway partner (Cashfree Payments) to process your payment.</li>
          <li>Our staff and field executives who need it to deliver the Services.</li>
          <li>Law enforcement or regulators when required by law.</li>
        </ul>
      </section>

      <section>
        <h2>4. Data security</h2>
        <p>
          We use reasonable technical and organisational measures, including encrypted connections (HTTPS) and
          access controls, to protect your information. No method of transmission over the internet is fully
          secure, but we work to protect your data from unauthorised access, loss or misuse.
        </p>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <p>
          We keep your information for as long as needed to provide the Services and to meet legal, tax and
          accounting obligations, after which it is deleted or anonymised.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          You may ask to access, correct or delete your personal information, or withdraw consent, by writing to{' '}
          {BUSINESS.email}. Some information may need to be retained where the law requires it.
        </p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>
          Our website uses essential cookies and local storage to keep you signed in and to make the site work.
          We do not use them for third-party advertising.
        </p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>We may update this policy from time to time. The latest version will always be available on this page.</p>
      </section>

      <section>
        <h2>9. Contact / Grievance Officer</h2>
        <p>
          {BUSINESS.legalName}
          <br />
          {BUSINESS.address}
          <br />
          Email: {BUSINESS.email}
          <br />
          Phone: {BUSINESS.phone}
        </p>
      </section>
    </LegalPage>
  );
}
