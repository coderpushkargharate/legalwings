'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';

const columns: Column[] = [
  {
    key: 'tokenNumber',
    label: 'Token Number',
    width: '130px',
    render: (lead) => lead.agreement?.tokenNo || '-',
  },
  {
    key: 'executeDate',
    label: 'Execute Date',
    width: '120px',
    render: (lead) => lead.agreement?.executeDate ? new Date(lead.agreement.executeDate).toLocaleDateString() : '-',
  },
  {
    key: 'startDate',
    label: 'Starting Date',
    width: '120px',
    render: (lead) => {
      const date = lead.agreement?.agreementStartDate || lead.agreement?.startDate;
      return date ? new Date(date).toLocaleDateString() : '-';
    },
  },
  {
    key: 'endDate',
    label: 'Ending Date',
    width: '120px',
    render: (lead) => {
      const date = lead.agreement?.agreementEndDate || lead.agreement?.endDate;
      return date ? new Date(date).toLocaleDateString() : '-';
    },
  },
  {
    key: 'ownerName',
    label: 'Owner Name',
    width: '150px',
    render: (lead) => `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'ownerMobile',
    label: 'Mobile Number',
    width: '130px',
    render: (lead) => lead.agreement?.owner?.phoneNo || '-',
  },
  {
    key: 'ownerDob',
    label: 'Birth Date Owner',
    width: '120px',
    render: (lead) => lead.agreement?.owner?.dateOfBirth ? new Date(lead.agreement.owner.dateOfBirth).toLocaleDateString() : '-',
  },
  {
    key: 'tenantName',
    label: 'Tenant Name',
    width: '150px',
    render: (lead) => `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-',
  },
  {
    key: 'tenantMobile',
    label: 'Mobile Number',
    width: '130px',
    render: (lead) => lead.agreement?.tenant?.phoneNo || '-',
  },
  {
    key: 'tenantDob',
    label: 'Birth Date Tenant',
    width: '130px',
    render: (lead) => lead.agreement?.tenant?.dateOfBirth ? new Date(lead.agreement.tenant.dateOfBirth).toLocaleDateString() : '-',
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