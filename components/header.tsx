// src/components/header.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useApi } from '@/components/api-client';
import { Bell, Search, LogOut, Loader2, X, FileText } from 'lucide-react';
import InstallAppButton from '@/components/install-app-button';

interface SearchLead {
  id: string;
  client?: { firstName?: string; lastName?: string; phoneNo?: string };
  agreement?: {
    tokenNo?: string;
    owner?: { firstName?: string; lastName?: string };
    tenant?: { firstName?: string; lastName?: string };
  };
  leadStatus?: string;
  transitLevel?: string;
}

const teamLabel = (t?: string) => (t ? t.replace('_TEAM', '').replace('_', ' ') : '');

// Global lead search shown in the header — matches by name, phone, token, mobile,
// or owner/tenant details (whatever the API's searchText supports) and lets the
// user jump straight to a lead.
function HeaderSearch() {
  const { apiFetch } = useApi();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search against /api/leads (respects the caller's team access rules).
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/leads?searchText=${encodeURIComponent(q)}&pageSize=8`);
        if (res.ok) {
          const data = await res.json();
          setResults(data?.leadPage?.content || []);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Header search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, apiFetch]);

  // Broadcast the query so the leads table below can float matching rows to the top.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('global-lead-search', { detail: query }));
  }, [query]);

  // Close the results panel on an outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const goToLead = (id: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/leads/new?mode=view&id=${id}`);
  };

  return (
    <div ref={boxRef} className="hidden md:block relative">
      <div className="flex items-center h-10 bg-white border border-slate-200 rounded-[10px] px-3 focus-within:border-teal-600 focus-within:ring-[3px] focus-within:ring-teal-600/10 transition-all">
        <Search className="w-4 h-4 text-slate-400 mr-2" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, phone, token..."
          className="bg-transparent text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none w-56"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-1" />
        ) : query ? (
          <button onClick={() => { setQuery(''); setResults([]); }} className="text-slate-400 hover:text-slate-600 ml-1">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {open && query.trim() && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400">No matching leads.</div>
          ) : (
            results.map((lead) => {
              const name = `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || 'Unnamed lead';
              const ownerName = `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim();
              const tenantName = `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim();
              const meta = [
                lead.client?.phoneNo,
                ownerName && `Owner: ${ownerName}`,
                tenantName && `Tenant: ${tenantName}`,
                lead.agreement?.tokenNo && `Token ${lead.agreement.tokenNo}`,
                teamLabel(lead.transitLevel),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={lead.id}
                  onClick={() => goToLead(lead.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate">{meta || 'No details'}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ title }: { title?: string }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-[58px] bg-white border-b border-slate-200 flex items-center justify-between px-5 lg:px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-slate-800">{title || 'LegalWings CRM'}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Global lead search */}
        <HeaderSearch />

        {/* Install as an app (PWA) — visible on every panel */}
        <InstallAppButton />

        {/* Notifications */}
        <button className="relative w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-2 relative group md:pl-1 md:pr-3 md:py-1 md:rounded-full md:border md:border-slate-200 md:bg-white">
          <button className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-[11px] font-bold text-white hover:ring-2 hover:ring-teal-300 transition-all">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </button>
          <div className="hidden md:block">
            <p className="text-[12.5px] font-semibold text-slate-800 leading-tight">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10.5px] text-slate-500 leading-tight capitalize">{user?.roles?.[0] || 'Admin'}</p>
          </div>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <button
              onClick={logout}
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
