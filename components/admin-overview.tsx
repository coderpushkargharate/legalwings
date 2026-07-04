'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/components/api-client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, IndianRupee, Clock, TrendingUp, CalendarDays, Users, Loader2, X,
} from 'lucide-react';

interface NameCount { name: string; count: number; }
interface ReportData {
  totalLeads: number;
  perTeam: NameCount[];
  createdByPerson: NameCount[];
  forwardedByPerson: NameCount[];
  perDay: NameCount[];
  perMonth: NameCount[];
  payments: { totalReceived: number; totalPending: number; totalCommission: number; totalAgreement: number };
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// "YYYY-MM" -> "Jul 2026"
const monthLabel = (key: string): string => {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d.getTime())) return key;
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

// First / last calendar day of a "YYYY-MM" month, as YYYY-MM-DD.
const monthRange = (key: string): { from: string; to: string } => {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` };
};

const BAR_COLOR = '#00A651';
const BAR_ACTIVE = '#f59e0b';

export default function AdminOverview() {
  const { apiFetch } = useApi();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month drill-down state
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<ReportData | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await apiFetch('/api/reports');
        if (!res.ok) throw new Error('Failed to load overview');
        const json = await res.json();
        if (active) setData(json);
      } catch (e: any) {
        if (active) setError(e.message || 'Failed to load overview');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [apiFetch]);

  const openMonth = useCallback(async (key: string) => {
    setSelectedMonth(key);
    setMonthData(null);
    setMonthLoading(true);
    try {
      const { from, to } = monthRange(key);
      const res = await apiFetch(`/api/reports?from=${from}&to=${to}`);
      if (res.ok) setMonthData(await res.json());
    } catch (e) {
      console.error('Failed to load month detail:', e);
    } finally {
      setMonthLoading(false);
    }
  }, [apiFetch]);

  // Months chronological (API returns newest-first), plus display labels.
  const monthChart = useMemo(() => {
    if (!data) return [];
    return [...data.perMonth]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ key: r.name, label: monthLabel(r.name), count: r.count }));
  }, [data]);

  // Top employees by leads created.
  const employeeChart = useMemo(() => {
    if (!data) return [];
    return data.createdByPerson.slice(0, 12).map((r) => ({ name: r.name, count: r.count }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-3 bg-white rounded-xl border border-slate-200 mb-8">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading overview...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-8">{error}</div>
    );
  }
  if (!data) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-semibold text-slate-800">All Over View</h3>
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Admin only</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label="Total Leads" value={data.totalLeads.toLocaleString('en-IN')} color="text-teal-600" bg="bg-teal-50" />
        <SummaryCard icon={IndianRupee} label="Revenue (Received)" value={inr(data.payments.totalReceived)} color="text-emerald-600" bg="bg-emerald-50" />
        <SummaryCard icon={Clock} label="Pending" value={inr(data.payments.totalPending)} color="text-amber-600" bg="bg-amber-50" />
        <SummaryCard icon={IndianRupee} label="Commission" value={inr(data.payments.totalCommission)} color="text-blue-600" bg="bg-blue-50" />
      </div>

      {/* Leads per month — clickable */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-teal-600" />
          <h4 className="font-semibold text-slate-800">Leads per Month</h4>
          <span className="ml-auto text-xs text-slate-400">Click a bar to see that month&apos;s details</span>
        </div>
        {monthChart.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No lead data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,166,81,0.06)' }} formatter={(v: any) => [v, 'Leads']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer"
                onClick={(d: any) => d && d.key && openMonth(d.key)}>
                {monthChart.map((entry) => (
                  <Cell key={entry.key} fill={entry.key === selectedMonth ? BAR_ACTIVE : BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Month drill-down detail */}
      {selectedMonth && (
        <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-slate-800">{monthLabel(selectedMonth)} — Details</h4>
            <button onClick={() => { setSelectedMonth(null); setMonthData(null); }}
              className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Close month detail">
              <X className="w-5 h-5" />
            </button>
          </div>

          {monthLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading {monthLabel(selectedMonth)}...</div>
          ) : monthData ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <SummaryCard icon={TrendingUp} label="Leads this month" value={monthData.totalLeads.toLocaleString('en-IN')} color="text-teal-600" bg="bg-teal-50" />
                <SummaryCard icon={IndianRupee} label="Revenue" value={inr(monthData.payments.totalReceived)} color="text-emerald-600" bg="bg-emerald-50" />
                <SummaryCard icon={Clock} label="Pending" value={inr(monthData.payments.totalPending)} color="text-amber-600" bg="bg-amber-50" />
                <SummaryCard icon={IndianRupee} label="Commission" value={inr(monthData.payments.totalCommission)} color="text-blue-600" bg="bg-blue-50" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h5 className="text-sm font-semibold text-slate-700">Leads added per employee</h5>
              </div>
              <PersonBars rows={monthData.createdByPerson} empty="No leads were added this month." />
            </>
          ) : (
            <div className="text-sm text-slate-400 py-6">Could not load this month&apos;s details.</div>
          )}
        </div>
      )}

      {/* Leads created per employee — all time */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-teal-600" />
          <h4 className="font-semibold text-slate-800">Leads Created per Employee</h4>
          <span className="ml-auto text-xs text-slate-400">All time</span>
        </div>
        {employeeChart.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No employee activity yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, employeeChart.length * 38)}>
            <BarChart data={employeeChart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,166,81,0.06)' }} formatter={(v: any) => [v, 'Leads']} />
              <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// Horizontal mini bars for "who added how many" lists.
function PersonBars({ rows, empty }: { rows: NameCount[]; empty: string }) {
  if (!rows || rows.length === 0) {
    return <div className="py-6 text-center text-sm text-slate-400">{empty}</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="w-40 truncate text-sm text-slate-700">{r.name}</span>
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#00A651] rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-sm font-semibold text-slate-800">{r.count}</span>
        </div>
      ))}
    </div>
  );
}
