'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable, { type Column, type Lead } from '@/components/leads-table';

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
    render: (lead: Lead) => {
      const amount = lead.amount;
      if (amount == null || amount === '') return '-';
      const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(numericValue) ? '-' : `₹${numericValue.toLocaleString('en-IN')}`;
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
      lead.createdDate ? new Date(lead.createdDate).toLocaleDateString('en-IN') : '-' 
  },
  // ✅ Accounting-specific columns
  { 
    key: 'tokenNumber', 
    label: 'Token No.', 
    width: '120px', 
    render: (lead: Lead) => lead.agreement?.tokenNo || '-' 
  },
  { 
    key: 'totalAmount', 
    label: 'Total Amount', 
    width: '110px', 
    render: (lead: Lead) => {
      const amount = lead.payment?.totalAmount;
      if (amount == null) return '₹ -';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '₹ -' : new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
      }).format(num);
    }
  },
  { 
    key: 'paidAmount', 
    label: 'Paid Amount', 
    width: '110px', 
    render: (lead: Lead) => {
      const amount = lead.payment?.paidAmount;
      if (amount == null) return '₹ -';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '₹ -' : new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
      }).format(num);
    }
  },
  { 
    key: 'pendingAmount', 
    label: 'Pending', 
    width: '110px', 
    render: (lead: Lead) => {
      const amount = lead.payment?.pendingAmount || lead.payment?.outstandingAmount;
      if (amount == null) return '₹ -';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '₹ -' : new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
      }).format(num);
    }
  },
  { 
    key: 'commissionAmount', 
    label: 'Commission', 
    width: '110px', 
    render: (lead: Lead) => {
      const amount = lead.payment?.commissionAmount;
      if (amount == null) return '₹ -';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '₹ -' : new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
      }).format(num);
    }
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
          showAddButton={false}
        />
      </div>
    </AppShell>
  );
}