'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useApi } from '@/components/api-client';
import {
  Database, X, Loader2, Trash2, Pencil, Plus, Search, RefreshCw,
  AlertTriangle, Save, Download,
} from 'lucide-react';

// The table renders the core contact + status fields, but the Excel export pulls
// EVERY field the new-lead form captures (Lead + Agreement + Payment). The API's
// non-external GET returns the full lead document, so all of this is available.
interface Person {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNo?: string;
  clientType?: string;
  aadharNumber?: string;
  panNumber?: string;
  birthDate?: string;
}
interface PaymentDetail {
  clientType?: string;
  paymentDate?: string;
  paymentAmount?: number | string;
  modeOfPayment?: string;
  payerName?: string;
  transactionNumber?: string;
}
interface Lead {
  id: string;
  client?: Person;
  leadStatus?: string;
  leadSource?: string;
  description?: string;
  visitAddress?: string;
  appointmentTime?: string;
  referenceName?: string;
  referenceNumber?: string;
  amount?: string | number;
  leadDate?: string;
  lastFollowUpDate?: string;
  nextFollowUpDate?: string;
  tentativeAgreementDate?: string;
  city?: { value?: string; name?: string; id?: string } | string;
  area?: { value?: string; name?: string; id?: string } | string;
  agreement?: {
    tokenNo?: string;
    periodDays?: string | number;
    agreementStartDate?: string;
    agreementEndDate?: string;
    addressLine1?: string;
    addressLine2?: string;
    status?: string;
    backOfficeStatus?: string;
    mobileNo?: string;
    executeDate?: string;
    owner?: Person;
    tenant?: Person;
    pvName?: string;
    pvAge?: string | number;
    pvMobile?: string;
    pvRelation?: string;
    svName?: string;
    svNo?: string;
    svLocation?: string;
    assignStatus?: string;
  };
  payment?: {
    totalAmount?: number | string;
    commissionAmount?: number | string;
    commissionName?: string;
    commissionDate?: string;
    grnNumber?: string;
    grnAmount?: number | string;
    govtGrnDate?: string;
    dhcNumber?: string;
    dhcAmount?: number | string;
    dhcDate?: string;
    description?: string;
    outstandingAmount?: number | string;
    receivedAmount?: number | string;
    balanceAmount?: number | string;
  };
  paymentDetails?: PaymentDetail[];
  transitLevel?: string;
  createdByUserName?: string;
  updatedByUserName?: string;
  createdAt?: string;
  updatedAt?: string;
  createdDate?: string;
}

const cityLabel = (c: Lead['city']): string => {
  if (!c) return '-';
  if (typeof c === 'string') return c;
  return c.value || c.name || '-';
};

const fmtDate = (d?: string): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Date + time variant for fields like the appointment slot. Shows HH:mm in
// 24-hour form (no AM/PM). The time is read directly from the ISO string parts
// so a UTC/`Z` suffix can't shift it by the IST offset (which flips the clock).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDateTime = (d?: string): string => {
  if (!d) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(d.trim());
  if (m) {
    const [, yyyy, mm, dd, hStr, minStr] = m;
    const datePart = `${dd} ${MONTHS[parseInt(mm, 10) - 1]} ${yyyy}`;
    return hStr === undefined ? datePart : `${datePart} ${hStr}:${minStr}`;
  }
  return fmtDate(d);
};

// Agreement period is stored in days; the panel shows it in months (days ÷ 30,
// rounded to the nearest whole month — e.g. 330 → 11).
const daysToMonths = (days?: string | number): string | number => {
  if (days === '' || days == null) return '';
  const n = typeof days === 'string' ? parseFloat(days) : days;
  if (isNaN(n)) return '';
  return Math.round(n / 30);
};

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for EVERY field the new-lead form captures (Lead +
// Agreement + Owner/Tenant + PV/SV + Payment). Both the on-screen table and the
// Excel export render from this list, so the two never drift apart.
// `text: true` marks free-text columns that should not wrap to keep rows tidy.
// ─────────────────────────────────────────────────────────────────────────────
type Col = { header: string; value: (l: Lead) => string | number };

const COLUMNS: Col[] = [
  // Lead details
  { header: 'Lead Date', value: (l) => fmtDate(l.leadDate) },
  { header: 'First Name', value: (l) => l.client?.firstName || '' },
  { header: 'Last Name', value: (l) => l.client?.lastName || '' },
  { header: 'Client Type', value: (l) => l.client?.clientType || '' },
  { header: 'Contact Number', value: (l) => l.client?.phoneNo || '' },
  { header: 'Email', value: (l) => l.client?.email || '' },
  { header: 'Lead Source', value: (l) => l.leadSource || '' },
  { header: 'Lead Status', value: (l) => l.leadStatus || '' },
  { header: 'Tentative Agreement Date', value: (l) => fmtDate(l.tentativeAgreementDate) },
  { header: 'Appointment Date & Time', value: (l) => fmtDateTime(l.appointmentTime) },
  { header: 'Visit Address', value: (l) => l.visitAddress || '' },
  { header: 'Description', value: (l) => l.description || '' },
  { header: 'Reference Name', value: (l) => l.referenceName || '' },
  { header: 'Reference Number', value: (l) => l.referenceNumber || '' },
  { header: 'Amount', value: (l) => l.amount ?? '' },
  { header: 'City', value: (l) => cityLabel(l.city) },
  { header: 'Area', value: (l) => cityLabel(l.area) },
  { header: 'Last Follow Up', value: (l) => fmtDate(l.lastFollowUpDate) },
  { header: 'Next Follow Up', value: (l) => fmtDate(l.nextFollowUpDate) },
  // Agreement
  { header: 'Token Number', value: (l) => l.agreement?.tokenNo || '' },
  { header: 'Period (Month)', value: (l) => daysToMonths(l.agreement?.periodDays) },
  { header: 'Agreement Start', value: (l) => fmtDate(l.agreement?.agreementStartDate) },
  { header: 'Agreement End', value: (l) => fmtDate(l.agreement?.agreementEndDate) },
  { header: 'Agreement Address 1', value: (l) => l.agreement?.addressLine1 || '' },
  { header: 'Agreement Address 2', value: (l) => l.agreement?.addressLine2 || '' },
  { header: 'Agreement Status', value: (l) => l.agreement?.status || '' },
  { header: 'Back Office Status', value: (l) => l.agreement?.backOfficeStatus || '' },
  { header: 'Agreement Mobile', value: (l) => l.agreement?.mobileNo || '' },
  { header: 'Execute Date', value: (l) => fmtDate(l.agreement?.executeDate) },
  // Owner
  { header: 'Owner First Name', value: (l) => l.agreement?.owner?.firstName || '' },
  { header: 'Owner Last Name', value: (l) => l.agreement?.owner?.lastName || '' },
  { header: 'Owner Email', value: (l) => l.agreement?.owner?.email || '' },
  { header: 'Owner Contact', value: (l) => l.agreement?.owner?.phoneNo || '' },
  { header: 'Owner Aadhar', value: (l) => l.agreement?.owner?.aadharNumber || '' },
  { header: 'Owner PAN', value: (l) => l.agreement?.owner?.panNumber || '' },
  { header: 'Owner Birth Date', value: (l) => fmtDate(l.agreement?.owner?.birthDate) },
  // Tenant
  { header: 'Tenant First Name', value: (l) => l.agreement?.tenant?.firstName || '' },
  { header: 'Tenant Last Name', value: (l) => l.agreement?.tenant?.lastName || '' },
  { header: 'Tenant Email', value: (l) => l.agreement?.tenant?.email || '' },
  { header: 'Tenant Contact', value: (l) => l.agreement?.tenant?.phoneNo || '' },
  { header: 'Tenant Aadhar', value: (l) => l.agreement?.tenant?.aadharNumber || '' },
  { header: 'Tenant PAN', value: (l) => l.agreement?.tenant?.panNumber || '' },
  { header: 'Tenant Birth Date', value: (l) => fmtDate(l.agreement?.tenant?.birthDate) },
  // Police / Society verification
  { header: 'PV Name', value: (l) => l.agreement?.pvName || '' },
  { header: 'PV Age', value: (l) => l.agreement?.pvAge ?? '' },
  { header: 'PV Mobile', value: (l) => l.agreement?.pvMobile || '' },
  { header: 'PV Relation', value: (l) => l.agreement?.pvRelation || '' },
  { header: 'SV Name', value: (l) => l.agreement?.svName || '' },
  { header: 'SV No', value: (l) => l.agreement?.svNo || '' },
  { header: 'SV Location', value: (l) => l.agreement?.svLocation || '' },
  { header: 'Assign Status', value: (l) => l.agreement?.assignStatus || '' },
  // Payment
  { header: 'Total Amount', value: (l) => l.payment?.totalAmount ?? '' },
  { header: 'Commission Amount', value: (l) => l.payment?.commissionAmount ?? '' },
  { header: 'Commission Name', value: (l) => l.payment?.commissionName || '' },
  { header: 'Commission Date', value: (l) => fmtDate(l.payment?.commissionDate) },
  { header: 'GRN Number', value: (l) => l.payment?.grnNumber || '' },
  { header: 'GRN Amount', value: (l) => l.payment?.grnAmount ?? '' },
  { header: 'Govt GRN Date', value: (l) => fmtDate(l.payment?.govtGrnDate) },
  { header: 'DHC Number', value: (l) => l.payment?.dhcNumber || '' },
  { header: 'DHC Amount', value: (l) => l.payment?.dhcAmount ?? '' },
  { header: 'DHC Date', value: (l) => fmtDate(l.payment?.dhcDate) },
  { header: 'Payment Description', value: (l) => l.payment?.description || '' },
  { header: 'Outstanding Amount', value: (l) => l.payment?.outstandingAmount ?? '' },
  { header: 'Received Amount', value: (l) => l.payment?.receivedAmount ?? '' },
  { header: 'Balance Amount', value: (l) => l.payment?.balanceAmount ?? '' },
  // Meta
  { header: 'Created By', value: (l) => l.createdByUserName || '' },
  { header: 'Created Date', value: (l) => fmtDate(l.createdAt || l.createdDate) },
  { header: 'Updated By', value: (l) => l.updatedByUserName || '' },
  { header: 'Updated Date', value: (l) => fmtDate(l.updatedAt) },
];

// For table cells: show a dash for empty values (the export keeps them blank).
const cellText = (v: string | number): string | number =>
  v === '' || v === '-' || v == null ? '-' : v;

export default function AdminAllLeads() {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Lead | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'one' | 'selected' | 'all'; id?: string }>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Admins bypass team filtering; pull a large page so the panel shows everything.
      const res = await apiFetch('/api/leads?viewAll=true&pageSize=100000');
      if (!res.ok) throw new Error('Failed to load leads');
      const json = await res.json();
      const content: Lead[] = json.leadPage?.content || [];
      setLeads(content);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const name = `${l.client?.firstName || ''} ${l.client?.lastName || ''}`.toLowerCase();
      const phone = (l.client?.phoneNo || '').toLowerCase();
      const status = (l.leadStatus || '').toLowerCase();
      const src = (l.leadSource || '').toLowerCase();
      const by = (l.createdByUserName || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || status.includes(q) || src.includes(q) || by.includes(q);
    });
  }, [leads, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((l) => next.delete(l.id));
      } else {
        filtered.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Delete operations ----
  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true); setError(null);
    try {
      let res: Response;
      if (confirm.kind === 'all') {
        res = await apiFetch('/api/leads', { method: 'DELETE', body: JSON.stringify({ all: true }) });
      } else if (confirm.kind === 'selected') {
        res = await apiFetch('/api/leads', { method: 'DELETE', body: JSON.stringify({ ids: Array.from(selected) }) });
      } else {
        res = await apiFetch('/api/leads', { method: 'DELETE', body: JSON.stringify({ id: confirm.id }) });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Delete failed');
      }
      setConfirm(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  // ---- Edit (update) ----
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PUT',
        body: JSON.stringify({
          id: editing.id,
          client: editing.client || {},
          leadStatus: editing.leadStatus,
          leadSource: editing.leadSource,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Update failed');
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  // ---- Excel export ----
  // Exports whatever is currently in view (respects the search filter). If any
  // rows are selected, only those are exported so admins can hand-pick a subset.
  // Every field the NEW LEAD form captures is included — Lead details, Agreement
  // (owner / tenant / PV / SV), and Payment — so the sheet mirrors the full form.
  const exportExcel = () => {
    const source = selected.size > 0 ? filtered.filter((l) => selected.has(l.id)) : filtered;
    if (source.length === 0) return;
    const rows = source.map((l) =>
      Object.fromEntries(COLUMNS.map((c) => [c.header, c.value(l)])),
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `All_Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="mb-8">
      {/* Trigger button — lives in the admin dashboard overview */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#00843d] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#006b31] transition-colors"
      >
        <Database className="w-5 h-5" />
        All Data Overview
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Admin</span>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl my-2">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <Database className="w-5 h-5 text-[#00843d]" />
              <h3 className="text-lg font-semibold text-slate-800">All Data Overview — Leads</h3>
              <span className="text-xs text-slate-400">{leads.length} total</span>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone, status, source, created by… (scroll right for all fields)"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]/30"
                />
              </div>

              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>

              <button
                onClick={exportExcel}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00843d] px-3 py-2 text-sm font-medium text-white hover:bg-[#006b31] disabled:opacity-40 disabled:cursor-not-allowed"
                title={selected.size > 0 ? `Download ${selected.size} selected as Excel` : 'Download all visible as Excel'}
              >
                <Download className="w-4 h-4" />
                Download Excel{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>

              <Link
                href="/leads/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> New Lead
              </Link>

              <button
                onClick={() => setConfirm({ kind: 'selected' })}
                disabled={selected.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected ({selected.size})
              </button>

              <button
                onClick={() => setConfirm({ kind: 'all' })}
                disabled={leads.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-4 h-4" /> Delete All
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="px-5 py-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading all leads…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No leads found.</div>
              ) : (
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                      <tr className="text-left">
                        <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 w-10">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 accent-[#00843d]"
                            aria-label="Select all"
                          />
                        </th>
                        {COLUMNS.map((c) => (
                          <th key={c.header} className="px-3 py-2 font-medium whitespace-nowrap">{c.header}</th>
                        ))}
                        <th className="sticky right-0 z-20 bg-slate-50 px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((l) => {
                        const rowBg = selected.has(l.id) ? 'bg-teal-50' : 'bg-white group-hover:bg-slate-50';
                        return (
                        <tr key={l.id} className={`group ${selected.has(l.id) ? 'bg-teal-50/40' : 'hover:bg-slate-50'}`}>
                          <td className={`sticky left-0 z-10 px-3 py-2 ${rowBg}`}>
                            <input
                              type="checkbox"
                              checked={selected.has(l.id)}
                              onChange={() => toggleOne(l.id)}
                              className="h-4 w-4 accent-[#00843d]"
                              aria-label={`Select ${l.client?.firstName || 'lead'}`}
                            />
                          </td>
                          {COLUMNS.map((c) => (
                            <td key={c.header} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              {cellText(c.value(l))}
                            </td>
                          ))}
                          <td className={`sticky right-0 z-10 px-3 py-2 ${rowBg}`}>
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/leads/${l.id}`}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                title="Open full lead"
                              >
                                <Search className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => setEditing({ ...l, client: { ...l.client } })}
                                className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                                title="Quick edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirm({ kind: 'one', id: l.id })}
                                className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Quick edit modal */}
          {editing && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <Pencil className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-slate-800">Quick Edit Lead</h4>
                  <button onClick={() => setEditing(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 px-5 py-4">
                  <Field label="First Name">
                    <input
                      value={editing.client?.firstName || ''}
                      onChange={(e) => setEditing({ ...editing, client: { ...editing.client, firstName: e.target.value } })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Last Name">
                    <input
                      value={editing.client?.lastName || ''}
                      onChange={(e) => setEditing({ ...editing, client: { ...editing.client, lastName: e.target.value } })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={editing.client?.phoneNo || ''}
                      onChange={(e) => setEditing({ ...editing, client: { ...editing.client, phoneNo: e.target.value } })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Client Type">
                    <select
                      value={editing.client?.clientType || ''}
                      onChange={(e) => setEditing({ ...editing, client: { ...editing.client, clientType: e.target.value } })}
                      className={inputCls}
                    >
                      <option value="">-</option>
                      <option value="OWNER">OWNER</option>
                      <option value="TENANT">TENANT</option>
                      <option value="AGENT">AGENT</option>
                    </select>
                  </Field>
                  <Field label="Lead Status">
                    <input
                      value={editing.leadStatus || ''}
                      onChange={(e) => setEditing({ ...editing, leadStatus: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Lead Source">
                    <input
                      value={editing.leadSource || ''}
                      onChange={(e) => setEditing({ ...editing, leadSource: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00843d] px-4 py-2 text-sm font-medium text-white hover:bg-[#006b31] disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm delete modal */}
          {confirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h4 className="font-semibold text-slate-800">Confirm delete</h4>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  {confirm.kind === 'all'
                    ? `This will permanently delete ALL ${leads.length} leads from the CRM. This cannot be undone.`
                    : confirm.kind === 'selected'
                    ? `Delete ${selected.size} selected lead(s)? This cannot be undone.`
                    : 'Delete this lead? This cannot be undone.'}
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={doDelete}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
