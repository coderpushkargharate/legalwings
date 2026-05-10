// app/account-team/page.tsx
'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
// ✅ Import both Column AND Lead types from the source component
import LeadsTable, { type Column, type Lead } from '@/components/leads-table';

// ✅ Remove local Lead type definition - use imported one for consistency

const columns: Column[] = [
  { 
    key: 'createdBy', 
    label: 'Created By', 
    width: '130px', 
    render: (lead: Lead) => lead.createdByUserName || 'System' 
  },
  { 
    key: 'team', 
    label: 'Role/Team', 
    width: '110px', 
    render: (lead: Lead) => {
      const status = lead.leadStatus || 'NEW';
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {status}
        </span>
      );
    }
  },
  { 
    key: 'name', 
    label: 'Client Name', 
    width: '160px', 
    render: (lead: Lead) => 
      `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' 
  },
  { 
    key: 'phoneNo', 
    label: 'Phone', 
    width: '120px', 
    render: (lead: Lead) => lead.client?.phoneNo || '-' 
  },
  { 
    key: 'amount', 
    label: 'Amount', 
    width: '100px', 
    // ✅ Handle amount which may be string | undefined | null
    render: (lead: Lead) => {
      const amount = lead.amount;
      if (amount == null || amount === '') return '-';
      // Convert string to number if needed, then format
      const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(numericValue) ? '-' : `₹${numericValue}`;
    }
  },
  { 
    key: 'leadStatus', 
    label: 'Status', 
    width: '140px', 
    render: (lead: Lead) => lead.leadStatus || '-' 
  },
  { 
    key: 'createdDate', 
    label: 'Date', 
    width: '100px', 
    render: (lead: Lead) => 
      lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : '-' 
  },
];

export default function AccountTeamPage() {
  return (
    <AppShell>
      <Header title="Accounts Overview" />
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          📊 <strong>Global View:</strong> This dashboard aggregates leads from all teams for financial & operational tracking.
        </div>
        <LeadsTable
          transitLevel="ALL"
          title="All Leads Overview"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}