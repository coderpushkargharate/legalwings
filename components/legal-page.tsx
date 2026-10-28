// Shared shell for the public policy pages — no login, no CRM sidebar.
import Link from 'next/link';
import { BUSINESS } from '@/lib/business-info';

export const POLICY_LINKS = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-and-conditions', label: 'Terms & Conditions' },
  { href: '/refund-policy', label: 'Refund & Cancellation' },
  { href: '/shipping-policy', label: 'Service Delivery' },
  { href: '/contact-us', label: 'Contact Us' },
];

export function PolicyLinks({ className = '' }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 ${className}`}>
      {POLICY_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-teal-700 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/icon-192.png" alt={`${BUSINESS.brandName} logo`} className="w-9 h-9 rounded-lg" />
          <span className="text-lg font-bold text-slate-800">{BUSINESS.brandName}</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <article className="bg-white rounded-xl border border-slate-200 p-6 sm:p-10 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{title}</h1>
          <p className="text-xs text-slate-400 mt-2 mb-8">Last updated: {BUSINESS.lastUpdated}</p>
          <div className="space-y-6 text-sm leading-relaxed text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <PolicyLinks />
        <p className="text-xs text-slate-400 text-center mt-3">
          © {new Date().getFullYear()} {BUSINESS.legalName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
