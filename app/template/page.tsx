'use client';

// ============================================================================
// 🔹 PAGE: Templates (admin) — every saved business profile template, with
// create / edit / open public page / copy link / delete.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Loader2, Pencil, ExternalLink, Link2, Trash2, LayoutTemplate, BadgeCheck, MapPin } from 'lucide-react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import AdminOnly from '@/components/template/admin-only';
import { formatDate } from '@/lib/date-utils';

interface TemplateRow {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  businessName: string;
  category?: string;
  location?: string;
  photo?: string;
  verified?: boolean;
  servicesCount?: number;
  reviewsCount?: number;
  createdByUserName?: string;
  updatedAt?: string;
}

function TemplateList() {
  const { apiFetch } = useApi();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (searchText: string) => {
    setLoading(true);
    setError('');
    try {
      const qs = searchText.trim() ? `?searchText=${encodeURIComponent(searchText.trim())}` : '';
      const res = await apiFetch(`/api/template${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    const id = window.setTimeout(() => load(search), 300);
    return () => window.clearTimeout(id);
  }, [search, load]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(id);
  }, [message]);

  const pageUrl = (slug: string) => `${window.location.origin}/p/${slug}`;

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(pageUrl(slug));
      setMessage('Link copied');
    } catch {
      setError('Could not copy the link');
    }
  };

  const handleDelete = async (row: TemplateRow) => {
    if (!window.confirm(`Delete the template "${row.businessName}"? Its public page will stop working.`)) return;
    setDeletingId(row.id);
    try {
      const res = await apiFetch(`/api/template/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete template');
      setTemplates((prev) => prev.filter((x) => x.id !== row.id));
      setMessage('Template deleted');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business, category or location"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
        <div className="flex-1" />
        <Link href="/template/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Create Template
        </Link>
      </div>

      {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {message && <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 flex flex-col items-center gap-3 text-slate-500">
          <LayoutTemplate className="w-10 h-10 text-slate-300" />
          <p className="text-sm">{search ? 'No templates match your search.' : 'No templates yet.'}</p>
          {!search && (
            <Link href="/template/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Create your first template
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((row) => (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center text-lg font-bold text-slate-400">
                  {row.photo ? <img src={row.photo} alt={row.businessName} className="w-full h-full object-cover" /> : row.businessName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-slate-900 truncate">{row.businessName}</p>
                    {row.verified && <BadgeCheck className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  </div>
                  {row.category && <p className="text-xs text-slate-500 truncate">{row.category}</p>}
                  {row.location && <p className="text-xs text-slate-500 truncate flex items-center gap-1"><MapPin className="w-3 h-3" /> {row.location}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {row.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>{row.servicesCount ?? 0} services</span>
                <span>{row.reviewsCount ?? 0} reviews</span>
                <span className="ml-auto">Updated {formatDate(row.updatedAt)}</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">/p/{row.slug}{row.createdByUserName ? ` · by ${row.createdByUserName}` : ''}</p>
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                <Link href={`/template/${row.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700">
                  <Pencil className="w-3.5 h-3.5" /> Edit / Download
                </Link>
                {row.status === 'PUBLISHED' && (
                  <>
                    <a href={`/p/${row.slug}`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg" title="Open public page"><ExternalLink className="w-4 h-4" /></a>
                    <button type="button" onClick={() => copyLink(row.slug)} className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg" title="Copy link"><Link2 className="w-4 h-4" /></button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  disabled={deletingId === row.id}
                  className="ml-auto p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                  title="Delete"
                >
                  {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplatePage() {
  return (
    <AppShell>
      <Header title="Templates" />
      <AdminOnly>
        <TemplateList />
      </AdminOnly>
    </AppShell>
  );
}
