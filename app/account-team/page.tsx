'use client';
import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable from '@/components/leads-table';
import type { Column } from '@/components/leads-table';

const columns: Column[] = [
  { key: 'createdBy', label: 'Created By', width: '130px', render: (lead) => lead.createdByUserName || 'System' },
  { key: 'team', label: 'Role/Team', width: '110px', render: (lead) => {
    const status = lead.leadStatus || 'NEW';
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
  }},
  { key: 'name', label: 'Client Name', width: '160px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
  { key: 'phoneNo', label: 'Phone', width: '120px', render: (lead) => lead.client?.phoneNo || '-' },
  { key: 'amount', label: 'Amount', width: '100px', render: (lead) => lead.amount ? `₹${lead.amount}` : '-' },
  { key: 'leadStatus', label: 'Status', width: '140px', render: (lead) => lead.leadStatus || '-' },
  { key: 'createdDate', label: 'Date', width: '100px', render: (lead) => lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : '-' },
];

export default function AccountTeamPage() {
  return (
    <AppShell>
      <Header title="Accounts Overview" />
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          📊 <strong>Global View:</strong> This dashboard aggregates leads from all teams for financial & operational tracking.
        </div>
        {/* 🔹 viewAll={true} bypasses employee restriction via API */}
        <LeadsTable
          transitLevel="ALL"
          viewAll={true}
          title="All Leads Overview"
          columns={columns}
        />
      </div>
    </AppShell>
  );
}