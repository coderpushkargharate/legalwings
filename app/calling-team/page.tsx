'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';

const columns: Column[] = [
  {
    key: 'leadDate',
    label: 'Lead Date',
    width: '100px',
    render: (lead: Lead) => {
      const leadDate = (lead as Lead & { leadDate?: string }).leadDate || lead.createdDate;
      return leadDate ? new Date(leadDate).toLocaleDateString('en-IN') : '-';
    },
  },
  {
    key: 'name',
    label: 'Name',
    width: '150px',
    render: (lead: Lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'phoneNo',
    label: 'Phone',
    width: '120px',
    render: (lead: Lead) => lead.client?.phoneNo || '-',
  },
  {
    key: 'svName',
    label: 'SV Name',
    width: '120px',
    render: (lead: Lead) => lead.agreement?.svName || '-',
  },
  {
    key: 'svNo',
    label: 'SV No.',
    width: '110px',
    render: (lead: Lead) => lead.agreement?.svNo || '-',
  },
  {
    key: 'svLocation',
    label: 'SV Location',
    width: '140px',
    render: (lead: Lead) => lead.agreement?.svLocation || '-',
  },
  {
    key: 'leadStatus',
    label: 'Status',
    width: '130px',
    render: (lead: Lead) => {
      const s = lead.leadStatus || '-';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'appointment',
    label: 'Appointment',
    width: '140px',
    render: (lead: Lead) => lead.appointmentTime ? new Date(lead.appointmentTime).toLocaleString('en-IN') : '-',
  },
  {
    key: 'visitAddress',
    label: 'Visit Location',
    width: '140px',
    render: (lead: Lead) => lead.visitAddress || lead.client?.areaName || lead.area?.name || '-',
  },
  {
    key: 'clientType',
    label: 'Client Type',
    width: '100px',
    render: (lead: Lead) => lead.client?.clientType || '-',
  },
  {
    key: 'visitCount',
    label: 'Visit Count',
    width: '120px',
    render: (lead: Lead) => {
      const assign = lead.agreement?.assignStatus;
      const cls = assign === 'Completed'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
      return (
        <div className="flex flex-col gap-1">
          <span>{lead.visitCount || 0}</span>
          {assign && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${cls}`}>{assign}</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'apptStatus',
    label: 'Appt. Status',
    width: '150px',
    render: (lead: Lead) => {
      const { label, cls } = getApptStatus(lead);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
    },
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: '130px',
    render: (lead: Lead) => lead.createdByUserName || '-',
  },
  {
    key: 'assignedTo',
    label: 'Assigned To',
    width: '130px',
    render: (lead: Lead) => lead.assignedToUserName || 'Team Only',
  },
];

function getStatusClass(status: string) {
  const s = status?.toUpperCase() || '';
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'DRAFT_CONFIRM', 'COMPLETED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW', 'NEW_LEAD', 'INTERESTED'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

// Derive the appointment status badge automatically:
// 1) Manual appointment action (Complete / Pending / Cancel) wins if set,
// 2) else Payment Pending when an amount is still due,
// 3) else Assigned when the lead is assigned to someone,
// 4) else fall back to the lead's own status.
function getApptStatus(lead: Lead): { label: string; cls: string } {
  const appt = (lead.appointmentStatus || '').toUpperCase();
  if (appt === 'COMPLETED') return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (appt === 'CANCELLED') return { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (appt === 'PENDING') return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

  const pending = Number(lead.payment?.pendingAmount ?? lead.payment?.outstandingAmount) || 0;
  if (pending > 0) return { label: 'Payment Pending', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };

  if (lead.assignedToUserName) return { label: 'Assigned', cls: 'bg-blue-50 text-blue-700 border-blue-200' };

  const s = lead.leadStatus || 'NEW';
  return { label: s, cls: getStatusClass(s) };
}

export default function CallingTeamPage() {
  return (
    <AppShell>
      <Header title="Calling Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="CALLING_TEAM"
          title="Calling Team"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}