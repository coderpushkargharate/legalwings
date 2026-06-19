import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'LegalWings CRM',
  description: 'LegalWings Rent Agreement CRM System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
