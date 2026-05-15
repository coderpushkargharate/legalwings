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
    key: 'lastFollowUp',
    label: 'Last Follow Up',
    width: '110px',
    render: (lead: Lead) => lead.lastFollowUpDate ? new Date(lead.lastFollowUpDate).toLocaleDateString('en-IN') : '-',
  },
  {
    key: 'nextFollowUp',
    label: 'Next Follow Up',
    width: '110px',
    render: (lead: Lead) => lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN') : '-',
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
    width: '90px',
    render: (lead: Lead) => lead.visitCount || 0,
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