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
    render: (lead: Lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'ownerName',
    label: 'Owner Name',
    width: '150px',
    render: (lead: Lead) => `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'tenantName',
    label: 'Tenant Name',
    width: '150px',
    render: (lead: Lead) => `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'tokenNo',
    label: 'Token No.',
    width: '120px',
    render: (lead: Lead) => lead.agreement?.tokenNo || '-',
  },
  {
    key: 'agreementStatus',
    label: 'Agreement Status',
    width: '140px',
    render: (lead: Lead) => {
      const s = lead.agreement?.status || '-';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'backOfficeStatus',
    label: 'Back Office Status',
    width: '150px',
    render: (lead: Lead) => {
      const s = lead.agreement?.backOfficeStatus || '-';
      const cls = getStatusClass(s);
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{s}</span>;
    },
  },
  {
    key: 'grnNumber',
    label: 'GRN No.',
    width: '100px',
    render: (lead: Lead) => lead.payment?.grnNumber || '-',
  },
  {
    key: 'dhcNumber',
    label: 'DHC No.',
    width: '100px',
    render: (lead: Lead) => lead.payment?.dhcNumber || '-',
  },
  {
    key: 'commissionDate',
    label: 'Commission Date',
    width: '120px',
    render: (lead: Lead) => lead.payment?.commissionDate ? new Date(lead.payment.commissionDate).toLocaleDateString('en-IN') : '-',
  },
  {
    key: 'commissionAmount',
    label: 'Commission Amt',
    width: '120px',
    render: (lead: Lead) => {
      const amount = lead.payment?.commissionAmount;
      if (amount == null) return '-';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '-' : `₹${num.toLocaleString('en-IN')}`;
    },
  },
];

function getStatusClass(status: string) {
  const s = status?.toUpperCase() || '';
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'COMPLETED', 'CONFIRMED', 'REGISTERED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW', 'DRAFTED', 'IN_PROGRESS'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function BackendTeamPage() {
  return (
    <AppShell>
      <Header title="Backend Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="BACKEND_TEAM"
          title="Backend Team"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}