'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column } from '@/components/leads-table';

const columns: Column[] = [
  {
    key: 'tokenNo',
    label: 'Token No.',
    width: '130px',
    render: (lead) => lead.agreement?.tokenNo || '-',
  },
  {
    key: 'totalReceived',
    label: 'Amount Received',
    width: '130px',
    render: (lead) => lead.payment?.totalReceivedAmount ? `₹${lead.payment.totalReceivedAmount}` : '-',
  },
  {
    key: 'outstanding',
    label: 'Outstanding',
    width: '120px',
    render: (lead) => lead.payment?.outstandingAmount ? `₹${lead.payment.outstandingAmount}` : '-',
  },
  {
    key: 'totalAmount',
    label: 'Total Amount',
    width: '120px',
    render: (lead) => lead.payment?.totalAmount ? `₹${lead.payment.totalAmount}` : '-',
  },
  {
    key: 'grnNumber',
    label: 'GRN No.',
    width: '100px',
    render: (lead) => lead.payment?.grnNumber || '-',
  },
  {
    key: 'grnAmount',
    label: 'GRN Amount',
    width: '100px',
    render: (lead) => lead.payment?.grnNumber ? `₹${lead.payment.grnNumber}` : '-',
  },
  {
    key: 'dhcNumber',
    label: 'DHC No.',
    width: '100px',
    render: (lead) => lead.payment?.dhcNumber || '-',
  },
  {
    key: 'dhcAmount',
    label: 'DHC Amount',
    width: '100px',
    render: (lead) => lead.payment?.dhcAmount ? `₹${lead.payment.dhcAmount}` : '-',
  },
  {
    key: 'commissionName',
    label: 'Commission Name',
    width: '130px',
    render: (lead) => lead.payment?.commissionDate || '-',
  },
  {
    key: 'commissionAmount',
    label: 'Commission Amt',
    width: '120px',
    render: (lead) => lead.payment?.commissionAmount ? `₹${lead.payment.commissionAmount}` : '-',
  },
  {
    key: 'commissionDate',
    label: 'Commission Date',
    width: '120px',
    render: (lead) => lead.payment?.commissionDate ? new Date(lead.payment.commissionDate).toLocaleDateString() : '-',
  },
];

export default function AccountTeamPage() {
  return (
    <AppShell>
      <Header title="Account Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="ACCOUNT_TEAM"
          title="Account Team"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}
