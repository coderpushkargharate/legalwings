'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';
import AdminUserHistory from '@/components/admin-user-history';
import { formatDate, formatAppointment } from '@/lib/date-utils';

const columns: Column[] = [
  {
    key: 'leadDate',
    label: 'Lead Date',
    width: '110px',
    render: (lead: Lead) => {
      const leadDate = (lead as Lead & { leadDate?: string }).leadDate || lead.createdDate;
      return formatDate(leadDate);
    },
  },
  {
    key: 'name',
    label: 'Name',
    width: '160px',
    render: (lead: Lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'phoneNo',
    label: 'Phone',
    width: '130px',
    render: (lead: Lead) => lead.client?.phoneNo || '-',
  },
  {
    key: 'leadSource',
    label: 'Lead Source',
    width: '120px',
    render: (lead: Lead) => lead.leadSource || '-',
  },
  {
    key: 'appointment',
    label: 'Appointment',
    width: '150px',
    render: (lead: Lead) => formatAppointment(lead.appointmentTime),
  },
  {
    key: 'visitAddress',
    label: 'Visit Location',
    width: '150px',
    render: (lead: Lead) => lead.visitAddress || lead.client?.areaName || lead.area?.name || '-',
  },
  {
    key: 'clientType',
    label: 'Client Type',
    width: '110px',
    render: (lead: Lead) => lead.client?.clientType || '-',
  },
  {
    key: 'status',
    label: 'Status',
    width: '130px',
    render: (lead: Lead) => {
      const s = lead.leadStatus || 'NEW_LEAD';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'agreementStatus',
    label: 'Agreement Status',
    width: '150px',
    render: (lead: Lead) => {
      const s = lead.agreement?.status || '-';
      if (s === '-') return <span className="text-slate-400">-</span>;
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: '140px',
    render: (lead: Lead) => lead.createdByUserName || '-',
  },
  {
    key: 'assignedTo',
    label: 'Assigned To',
    width: '140px',
    render: (lead: Lead) => lead.assignedToUserName || 'Team Only',
  },
];

function getStatusClass(status: string) {
  const s = status?.toUpperCase() || '';
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'COMPLETED', 'ACTIVE'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW', 'NEW_LEAD', 'FOLLOW_UP', 'INTERESTED'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function ShopTeamPage() {
  return (
    <AppShell>
      <Header title="Shop Employee" />
      <div className="p-6">
        {/* Lead-only history search — same as the dashboard's user history,
            but restricted to searching leads (no employee search). */}
        <AdminUserHistory leadOnly />
        <LeadsTable
          transitLevel="SHOP_TEAM"
          title="Shop Employee"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}
