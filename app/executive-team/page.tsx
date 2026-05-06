'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column } from '@/components/leads-table';

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
    key: 'visitAddress',
    label: 'Visit Address',
    render: (lead) => lead.visitAddress || '-',
  },
  {
    key: 'clientType',
    label: 'Client Type',
    width: '100px',
    render: (lead) => lead.client?.clientType || '-',
  },
  {
    key: 'appointmentTime',
    label: 'Appointment',
    width: '140px',
    render: (lead) => lead.appointmentTime ? new Date(lead.appointmentTime).toLocaleString() : '-',
  },
  {
    key: 'leadStatus',
    label: 'Status',
    width: '120px',
    render: (lead) => {
      const s = lead.leadStatus || '-';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: '110px',
    render: (lead) => lead.createdByUserName || '-',
  },
];

function getStatusClass(status: string) {
  const s = status.toUpperCase();
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'COMPLETED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function ExecutiveTeamPage() {
  return (
    <AppShell>
      <Header title="Executive Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="EXECUTIVE_TEAM"
          title="Executive Team"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}
