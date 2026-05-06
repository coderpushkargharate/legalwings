'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column } from '@/components/leads-table';

const columns: Column[] = [
  {
    key: 'createdDate',
    label: 'Created Date',
    width: '120px',
    render: (lead) => lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : '-',
  },
  {
    key: 'name',
    label: 'Client Name',
    width: '160px',
    render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'tokenNo',
    label: 'Token No.',
    width: '120px',
    render: (lead) => lead.agreement?.tokenNo || '-',
  },
  {
    key: 'phoneNo',
    label: 'Phone',
    width: '110px',
    render: (lead) => lead.client?.phoneNo || '-',
  },
  {
    key: 'clientType',
    label: 'Client Type',
    width: '100px',
    render: (lead) => lead.client?.clientType || '-',
  },
  {
    key: 'visitAddress',
    label: 'Address',
    render: (lead) => lead.visitAddress || lead.client?.address || '-',
  },
];

export default function MarketingTeamPage() {
  return (
    <AppShell>
      <Header title="Marketing Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="MARKETING_TEAM"
          title="Marketing Team"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}
