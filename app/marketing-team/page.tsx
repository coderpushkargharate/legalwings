'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column, Lead } from '@/components/leads-table';
import { formatDate } from '@/lib/date-utils';
import LeadFileField from '@/components/lead-file-field';
import { slotFileName, slotHasFile } from '@/lib/lead-files';

const fullName = (p?: { firstName?: string; lastName?: string }) =>
  `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || '-';

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
    render: (lead) => formatDate(lead.agreement?.executeDate),
  },
  {
    key: 'startDate',
    label: 'Starting Date',
    width: '120px',
    render: (lead) => {
      const date = lead.agreement?.agreementStartDate || lead.agreement?.startDate;
      return formatDate(date);
    },
  },
  {
    key: 'endDate',
    label: 'Ending Date',
    width: '120px',
    render: (lead) => {
      const date = lead.agreement?.agreementEndDate || lead.agreement?.endDate;
      return formatDate(date);
    },
  },
  {
    key: 'ownerName',
    label: 'Owner Name',
    width: '150px',
    render: (lead) => fullName(lead.agreement?.owner),
  },
  {
    key: 'ownerMobile',
    label: 'Mobile Number',
    width: '130px',
    render: (lead) => lead.agreement?.owner?.phoneNo || '-',
  },
  {
    key: 'ownerEmail',
    label: 'Owner Email',
    width: '200px',
    render: (lead) => lead.agreement?.owner?.email || '-',
  },
  {
    key: 'ownerDob',
    label: 'Birth Date Owner',
    width: '120px',
    render: (lead) => formatDate(lead.agreement?.owner?.birthDate || lead.agreement?.owner?.dateOfBirth),
  },
  {
    key: 'tenantName',
    label: 'Tenant Name',
    width: '150px',
    render: (lead) => fullName(lead.agreement?.tenant),
  },
  {
    key: 'tenantMobile',
    label: 'Mobile Number',
    width: '130px',
    render: (lead) => lead.agreement?.tenant?.phoneNo || '-',
  },
  {
    key: 'tenantEmail',
    label: 'Tenant Email',
    width: '200px',
    render: (lead) => lead.agreement?.tenant?.email || '-',
  },
  {
    key: 'tenantDob',
    label: 'Birth Date Tenant',
    width: '130px',
    render: (lead) => formatDate(lead.agreement?.tenant?.birthDate || lead.agreement?.tenant?.dateOfBirth),
  },
  {
    key: 'agreementFile',
    label: 'Agreement File',
    width: '170px',
    // View / Download — the file is fetched on demand from /api/files.
    render: (lead) => slotHasFile(lead.agreement, 'agreement')
      ? <LeadFileField compact leadId={lead.id} slot="agreement" agreement={lead.agreement} />
      : '-',
  },
];

// Excel export — same columns as the table (the file itself is listed by name).
const exportRows = (leads: Lead[]): Record<string, any>[] =>
  leads.map((lead) => ({
    'Token Number': lead.agreement?.tokenNo || '-',
    'Execute Date': formatDate(lead.agreement?.executeDate),
    'Starting Date': formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate),
    'Ending Date': formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate),
    'Owner Name': fullName(lead.agreement?.owner),
    'Owner Mobile': lead.agreement?.owner?.phoneNo || '-',
    'Owner Email': lead.agreement?.owner?.email || '-',
    'Birth Date Owner': formatDate(lead.agreement?.owner?.birthDate || lead.agreement?.owner?.dateOfBirth),
    'Tenant Name': fullName(lead.agreement?.tenant),
    'Tenant Mobile': lead.agreement?.tenant?.phoneNo || '-',
    'Tenant Email': lead.agreement?.tenant?.email || '-',
    'Birth Date Tenant': formatDate(lead.agreement?.tenant?.birthDate || lead.agreement?.tenant?.dateOfBirth),
    'Agreement File': slotHasFile(lead.agreement, 'agreement') ? slotFileName(lead.agreement, 'agreement') : '-',
  }));

export default function MarketingTeamPage() {
  return (
    <AppShell>
      <Header title="Marketing Team" />
      <div className="p-6">
        <LeadsTable
          transitLevel="MARKETING_TEAM"
          title="Marketing Team"
          columns={columns}
          exportRows={exportRows}
          exportSheetName="Marketing"
          exportFileName="Marketing_Team"
        />
      </div>
    </AppShell>
  );
}