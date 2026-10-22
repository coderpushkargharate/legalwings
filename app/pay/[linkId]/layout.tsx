import type { Metadata } from 'next';

// Link previews (WhatsApp etc.) show a payment page, not the CRM.
export const metadata: Metadata = {
  title: 'LegalWings — Secure Payment',
  description: 'Pay securely to LegalWings via UPI, card or net banking (powered by Cashfree).',
  manifest: null,
  appleWebApp: null,
  robots: { index: false, follow: false },
  openGraph: { title: 'LegalWings — Secure Payment', description: 'Pay securely via UPI, card or net banking.' },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
