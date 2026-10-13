'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

// Templates are an admin tool; everyone else gets a short notice instead of the page.
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = Array.isArray(user?.roles) && user!.roles.some((r) => String(r).toLowerCase() === 'admin');
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
        <ShieldAlert className="w-8 h-8 text-slate-300" />
        <p className="text-sm">Only admins can manage templates.</p>
      </div>
    );
  }
  return <>{children}</>;
}
