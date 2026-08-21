'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';
import { formatDate, formatAppointment } from '@/lib/date-utils';

const columns: Column[] = [
  {
    key: 'leadDate',
    label: 'Lead Date',
    width: '100px',
    render: (lead: Lead) => {
      const leadDate = (lead as Lead & { leadDate?: string }).leadDate || lead.createdDate;
      return formatDate(leadDate);
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
    key: 'appointment',
    label: 'Appointment',
    width: '140px',
    render: (lead: Lead) => formatAppointment(lead.appointmentTime),
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
    // Show only the visit count number (dash when there is none).
    render: (lead: Lead) => (lead.visitCount ? String(lead.visitCount) : '-'),
  },
  {
    key: 'agreementStatus',
    label: 'Agreement Status',
    width: '150px',
    render: (lead: Lead) => {
      const s = lead.agreement?.status || '-';
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusClass(s)}`}>{s}</span>;
    },
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: '130px',
    render: (lead: Lead) => lead.createdByUserName || '-',
  },
  // Note: the "Assigned To" column is rendered automatically by LeadsTable, so it
  // is intentionally not repeated here.
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