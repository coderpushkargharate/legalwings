'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import LeadsTable, { type Column, type Lead } from '@/components/leads-table';

// ✅ Helper: Format date consistently (DD/MM/YYYY)
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

// ✅ Helpers shared by the on-screen columns AND the Excel export so both match.
const toNum = (v?: number | string | null): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const formatINR = (v?: number | string | null): string => {
  const n = toNum(v);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
};

const leadName = (lead: Lead): string =>
  `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-';

const ownerName = (lead: Lead): string =>
  `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-';

const tenantName = (lead: Lead): string =>
  `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-';

// Execute date from the Client & Agreement form.
const executeDate = (lead: Lead): string =>
  formatDate(lead.agreement?.executeDate || lead.agreement?.startDate || lead.agreement?.agreementStartDate);

const totalAgreementFees = (lead: Lead): number =>
  toNum(lead.payment?.totalAmount) || toNum(lead.amount);

// Received = sum of all recorded payments, falling back to payment summary fields.
const receivedAmount = (lead: Lead): number => {
  const fromDetails = lead.paymentDetails?.reduce((sum, p) => sum + toNum(p.paymentAmount), 0) || 0;
  if (fromDetails > 0) return fromDetails;
  return toNum(lead.payment?.totalReceivedAmount) || toNum(lead.payment?.paidAmount);
};

const outstandingAmount = (lead: Lead): number => {
  if (lead.payment?.outstandingAmount != null) return toNum(lead.payment.outstandingAmount);
  if (lead.payment?.pendingAmount != null) return toNum(lead.payment.pendingAmount);
  return totalAgreementFees(lead) - receivedAmount(lead);
};

const commissionAmount = (lead: Lead): number => toNum(lead.payment?.commissionAmount);
const commissionDate = (lead: Lead): string => formatDate(lead.payment?.commissionDate);
const assignedTo = (lead: Lead): string => lead.assignedToUserName || '-';

// ✅ Accounts-team columns — the 12 requested points, in order.
const columns: Column[] = [
  { key: 'leadName', label: 'Lead Name', width: '150px', render: leadName },
  { key: 'leadPhone', label: 'Lead Phone No', width: '130px', render: (lead) => lead.client?.phoneNo || '-' },
  { key: 'ownerName', label: 'Owner Name', width: '150px', render: ownerName },
  { key: 'tenantName', label: 'Tenant Name', width: '150px', render: tenantName },
  { key: 'executeDate', label: 'Execute Date', width: '120px', render: executeDate },
  { key: 'status', label: 'Status', width: '130px', render: (lead) => lead.leadStatus || '-' },
  { key: 'totalFees', label: 'Total Agreement Fees', width: '150px', render: (lead) => formatINR(totalAgreementFees(lead)) },
  { key: 'received', label: 'Received Amount', width: '140px', render: (lead) => formatINR(receivedAmount(lead)) },
  { key: 'outstanding', label: 'Outstanding Amount', width: '150px', render: (lead) => formatINR(outstandingAmount(lead)) },
  { key: 'commissionAmount', label: 'Commission Amount', width: '150px', render: (lead) => formatINR(commissionAmount(lead)) },
  { key: 'commissionDate', label: 'Commission Date', width: '130px', render: commissionDate },
  { key: 'assignedTo', label: 'Assigned To', width: '140px', render: assignedTo },
];

// ✅ Excel export — same 12 columns as the on-screen table.
const exportRows = (leads: Lead[]): Record<string, any>[] =>
  leads.map((lead) => ({
    'Lead Name': leadName(lead),
    'Lead Phone No': lead.client?.phoneNo || '-',
    'Owner Name': ownerName(lead),
    'Tenant Name': tenantName(lead),
    'Execute Date': executeDate(lead),
    'Status': lead.leadStatus || '-',
    'Total Agreement Fees': totalAgreementFees(lead),
    'Received Amount': receivedAmount(lead),
    'Outstanding Amount': outstandingAmount(lead),
    'Commission Amount': commissionAmount(lead),
    'Commission Date': commissionDate(lead),
    'Assigned To': assignedTo(lead),
  }));

// ✅ Only show leads that have actually received a payment.
const hasPayment = (lead: Lead): boolean => {
  const received = receivedAmount(lead);
  const totalReceived = Number(lead.payment?.totalReceivedAmount) || 0;
  return received > 0 || totalReceived > 0;
};

export default function AccountTeamPage() {
  return (
    <AppShell>
      <Header title="Accounts Overview" />
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          📊 <strong>Global View:</strong> This dashboard aggregates leads from all teams for financial &amp; operational tracking. Only leads with a received payment are shown.
        </div>
        <LeadsTable
          transitLevel="ALL"
          title="All Leads Overview"
          columns={columns}
          showAddButton={false}
          filterFn={hasPayment}
          exportRows={exportRows}
          exportSheetName="Accounts Report"
          exportFileName="Accounts_Report"
        />
      </div>
    </AppShell>
  );
}
