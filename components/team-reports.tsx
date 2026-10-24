'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/components/api-client';
import { CalendarDays, Loader2, PhoneCall, Briefcase, FileCheck2, Building2, ClipboardList } from 'lucide-react';

type Row = Record<string, string | number>;
export interface TeamReportData {
  calling: Row[];
  executive: Row[];
  backOffice: Row[];
  clientTypeByDay: Row[];
  agreementByDay: Row[];
}

// "2026-10-01" -> "01 Oct 2026"
const fmtDay = (v: string | number) => {
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

// The five team performance tables (calling, executive, back office, client type, agreements).
export function TeamReportTables({ team }: { team: TeamReportData }) {
  return (
    <>
      <ReportTable
        title="1. Calling Team Report" icon={PhoneCall} rows={team.calling}
        note="Every lead counts once — leads not created by a calling girl show under Unassigned / Admin."
        columns={[
          { key: 'name', label: 'Created By' },
          { key: 'leadCreated', label: 'Total Lead' },
          { key: 'appointment', label: 'Send to Appointment' },
          { key: 'sentToExecutive', label: 'Send to Executive' },
          { key: 'pendingAppointment', label: 'Pending in Appointment', tone: 'text-amber-600' },
          { key: 'interested', label: 'Interested' },
          { key: 'cancelled', label: 'Cancelled', tone: 'text-red-600' },
        ]}
      />
      <ReportTable
        title="2. Executive & Notary Shop Report" icon={Briefcase} rows={team.executive}
        note="Each appointment counts once, for whoever handled it last. Send to Backend / Calling are counted on the date the lead was sent."
        columns={[
          { key: 'name', label: 'Executive / Shop' },
          { key: 'appointment', label: 'Appointment' },
          { key: 'sentToBackend', label: 'Send to Backend', tone: 'text-emerald-600' },
          { key: 'sentToCalling', label: 'Send to Calling' },
          { key: 'firstVisit', label: 'Calling: 1st Visit' },
          { key: 'secondVisit', label: 'Calling: 2nd Visit' },
          { key: 'cancelPostpone', label: 'Calling: Cancel / Postpone', tone: 'text-red-600' },
          { key: 'otherReason', label: 'Calling: Other Reason' },
        ]}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ReportTable
          title="3. Back Office Report" icon={FileCheck2} rows={team.backOffice}
          columns={[
            { key: 'name', label: 'Back Office Employee' },
            { key: 'totalWork', label: 'Total Work' },
            { key: 'submitted', label: 'Submitted' },
            { key: 'completed', label: 'Completed', tone: 'text-emerald-600' },
            { key: 'pending', label: 'Pending', tone: 'text-amber-600' },
          ]}
        />
        <ReportTable
          title="4. Date-wise Client Type Report" icon={Building2} rows={team.clientTypeByDay}
          columns={[
            { key: 'date', label: 'Date', format: fmtDay },
            { key: 'owner', label: 'Owner' },
            { key: 'agent', label: 'Agent' },
            { key: 'tenant', label: 'Tenant' },
          ]}
        />
      </div>
      <ReportTable
        title="5. All Agreement Count (Day-wise)" icon={CalendarDays} rows={team.agreementByDay}
        columns={[
          { key: 'date', label: 'Date', format: fmtDay },
          { key: 'totalLeads', label: 'Total Lead' },
          { key: 'appointment', label: 'Appointment' },
          { key: 'totalWork', label: 'All Work' },
          { key: 'submitted', label: 'Submitted' },
          { key: 'completed', label: 'Completed', tone: 'text-emerald-600' },
          { key: 'pending', label: 'Pending', tone: 'text-amber-600' },
        ]}
      />
    </>
  );
}

// Admin dashboard section: fetches the team reports with its own date filter.
export default function AdminTeamReports() {
  const { apiFetch } = useApi();
  const [team, setTeam] = useState<TeamReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (f) params.set('from', f);
      if (t) params.set('to', t);
      const res = await apiFetch(`/api/reports/team?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load team reports');
      setTeam(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load team reports');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load('', ''); }, [load]);

  return (
    <div className="mb-8 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <ClipboardList className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-800">Team Performance Reports</h3>
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Admin only</span>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00843d]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00843d]" />
        </div>
        <button onClick={() => load(from, to)} className="px-5 py-2 bg-[#00843d] text-white rounded-lg text-sm font-medium hover:bg-[#00622d] transition-colors">Apply</button>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); load('', ''); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin" /> Loading team reports...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      ) : team ? (
        <TeamReportTables team={team} />
      ) : null}
    </div>
  );
}

interface ReportColumn { key: string; label: string; tone?: string; format?: (v: string | number) => string; }

// Multi-column report table with a totals row (the first column is the row label).
function ReportTable({ title, icon: Icon, columns, rows, note }: { title: string; icon: React.ElementType; columns: ReportColumn[]; rows: Row[]; note?: string }) {
  const [labelCol, ...numCols] = columns;
  const totals = numCols.map((c) => rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
        <Icon className="w-5 h-5 text-[#00843d]" />
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {note && <span className="text-xs text-slate-500">— {note}</span>}
        <span className="ml-auto text-xs text-slate-500">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} className={`px-4 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-slate-400">No data</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={`${r[labelCol.key]}-${idx}`} className="hover:bg-slate-50/80">
                <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{labelCol.format ? labelCol.format(r[labelCol.key]) : r[labelCol.key]}</td>
                {numCols.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 text-right font-semibold ${c.tone || 'text-slate-800'}`}>{r[c.key] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-slate-700">Total</td>
                {numCols.map((c, i) => (
                  <td key={c.key} className={`px-4 py-2.5 text-right font-bold ${c.tone || 'text-slate-900'}`}>{totals[i]}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
