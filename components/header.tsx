'use client';

import React from 'react';
import { useAuth } from '@/components/auth-provider';
import { Bell, Search } from 'lucide-react';

export default function Header({ title }: { title?: string }) {
  const { user } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{title || 'LegalWings CRM'}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1.5">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-slate-600 outline-none w-48"
          />
        </div>
        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-slate-700">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-slate-400">{user?.roles?.[0] || 'Admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
