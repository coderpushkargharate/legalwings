'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable, { type Column, type Lead } from '@/components/leads-table';

// ✅ Helper: Format date consistently
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return '-';
  }
};

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
  // ✅ FIXED: Date column with leadDate added to fallback chain
  { 
    key: 'date', 
    label: 'Date', 
    width: '110px', 
    render: (lead: Lead) => {
      // Try multiple date sources in priority order (leadDate added!)
      const paymentDate = lead.paymentDetails?.[0]?.paymentDate;
      const commissionDate = lead.payment?.commissionDate;
      const agreementExecuteDate = lead.agreement?.executeDate;
      const agreementStartDate = lead.agreement?.agreementStartDate;
      const leadDate = lead.leadDate; // ✅ NEW: Added leadDate
      const createdDate = lead.createdDate;
      
      const displayDate = paymentDate || commissionDate || agreementExecuteDate || agreementStartDate || leadDate || createdDate;
      return formatDate(displayDate);
    }
  },
  // ✅ Accounting-specific columns
  { 
    key: 'tokenNumber', 
    label: 'Token No.', 
    width: '120px', 
    render: (lead: Lead) => lead.agreement?.tokenNo || '-' 
  },
  // ✅ Amount Received Column (sums all paymentDetails)
  { 
    key: 'amountReceived', 
    label: 'Amount Received', 
    width: '130px', 
    render: (lead: Lead) => {
      const received = lead.paymentDetails?.reduce((sum, p) => {
        const amount = typeof p.paymentAmount === 'string' 
          ? parseFloat(p.paymentAmount) 
          : p.paymentAmount || 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0) || 0;

      if (received === 0) return '₹ -';
      
      return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR', 
        maximumFractionDigits: 0 
      }).format(received);
    }
  },
  { 
    key: 'outstandingAmount', 
    label: 'Outstanding', 
    width: '110px',
    render: (lead: Lead) => {
      const total = Number(lead.payment?.totalAmount) || 0;
      const commission = Number(lead.payment?.commissionAmount) || 0;
      const outstanding = lead.payment?.outstandingAmount ?? (total + commission);
      if (isNaN(outstanding)) return '₹ -';
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0,
      }).format(outstanding);
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