'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';

const columns: Column[] = [
  {
    key: 'name',
    label: 'Name',
    width: '160px',
    render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'phoneNo',
    label: 'Phone',
    width: '110px',
    render: (lead) => lead.client?.phoneNo || '-',
  },
  {
    key: 'lastFollowUp',
    label: 'Last Follow Up',
    width: '120px',
    render: (lead) => lead.lastFollowUpDate ? new Date(lead.lastFollowUpDate).toLocaleDateString() : '-',
  },
  {
    key: 'nextFollowUp',
    label: 'Next Follow Up',
    width: '120px',
    render: (lead) => lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleDateString() : '-',
  },
  {
    key: 'appointmentTime',
    label: 'Appointment',
    width: '140px',
    render: (lead) => lead.appointmentTime ? new Date(lead.appointmentTime).toLocaleString() : '-',
  },
  {
    key: 'leadStatus',
    label: 'Lead Status',
    width: '130px',
    render: (lead) => {
      const s = lead.leadStatus || '-';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'clientType',
    label: 'Client Type',
    width: '100px',
    render: (lead) => lead.client?.clientType || '-',
  },
  {
    key: 'visitAddress',
    label: 'Visit Address',
    render: (lead) => lead.visitAddress || '-',
  },
  {
    key: 'createdDate',
    label: 'Created',
    width: '100px',
    render: (lead) => lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : '-',
  },
];

function getStatusClass(status: string) {
  const s = status.toUpperCase();
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'DRAFT_CONFIRM', 'COMPLETED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW', 'NEW_LEAD', 'INTERESTED'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
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
