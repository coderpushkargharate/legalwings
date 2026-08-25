'use client';

// ============================================================================
// 🔹 Shared team table columns — mirrors what each team's table shows so a single
// lead can be previewed "as it is" in its current team (used by User History).
// ============================================================================

import React from 'react';
import type { Column, Lead } from '@/components/leads-table';
import { formatDate, formatAppointment } from '@/lib/date-utils';

function statusClass(status?: string) {
  const s = (status || '').toUpperCase();
  if (['ASSIGNED', 'APPROVED', 'CLOSED', 'DRAFT_CONFIRM', 'COMPLETED', 'CONFIRMED', 'REGISTERED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PENDING', 'POSTPONED', 'NEW', 'NEW_LEAD', 'INTERESTED', 'DRAFTED', 'IN_PROGRESS'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(s)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}
const badge = (s?: string) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusClass(s)}`}>{s || '-'}</span>;
const fullName = (f?: string, l?: string) => `${f || ''} ${l || ''}`.trim() || '-';

// Calling team — same as app/calling-team/page.tsx.
const callingColumns: Column[] = [
  { key: 'leadDate', label: 'Lead Date', width: '100px', render: (l: Lead) => formatDate((l as Lead & { leadDate?: string }).leadDate || l.createdDate) },
  { key: 'name', label: 'Name', width: '150px', render: (l: Lead) => fullName(l.client?.firstName, l.client?.lastName) },
  { key: 'phoneNo', label: 'Phone', width: '120px', render: (l: Lead) => l.client?.phoneNo || '-' },
  { key: 'svName', label: 'SV Name', width: '120px', render: (l: Lead) => l.agreement?.svName || '-' },
  { key: 'svNo', label: 'SV No.', width: '110px', render: (l: Lead) => l.agreement?.svNo || '-' },
  { key: 'svLocation', label: 'SV Location', width: '140px', render: (l: Lead) => l.agreement?.svLocation || '-' },
  { key: 'appointment', label: 'Appointment', width: '140px', render: (l: Lead) => formatAppointment(l.appointmentTime) },
  { key: 'visitAddress', label: 'Visit Location', width: '140px', render: (l: Lead) => l.visitAddress || l.client?.areaName || l.area?.name || '-' },
  { key: 'clientType', label: 'Client Type', width: '100px', render: (l: Lead) => l.client?.clientType || '-' },
  { key: 'visitCount', label: 'Visit Count', width: '120px', render: (l: Lead) => (l.visitCount ? String(l.visitCount) : '-') },
  { key: 'agreementStatus', label: 'Agreement Status', width: '150px', render: (l: Lead) => badge(l.agreement?.status) },
  { key: 'createdBy', label: 'Created By', width: '130px', render: (l: Lead) => l.createdByUserName || '-' },
];

// Executive team — same as app/executive-team/page.tsx.
const executiveColumns: Column[] = [
  { key: 'name', label: 'Name', width: '160px', render: (l: Lead) => fullName(l.client?.firstName, l.client?.lastName) },
  { key: 'phoneNo', label: 'Phone', width: '110px', render: (l: Lead) => l.client?.phoneNo || '-' },
  { key: 'svName', label: 'SV Name', width: '120px', render: (l: Lead) => l.agreement?.svName || '-' },
  { key: 'svNo', label: 'SV No.', width: '110px', render: (l: Lead) => l.agreement?.svNo || '-' },
  { key: 'svLocation', label: 'SV Location', width: '140px', render: (l: Lead) => l.agreement?.svLocation || '-' },
  { key: 'visitAddress', label: 'Visit Address', render: (l: Lead) => l.visitAddress || l.area?.name || '-' },
  { key: 'clientType', label: 'Client Type', width: '100px', render: (l: Lead) => l.client?.clientType || '-' },
  { key: 'appointmentTime', label: 'Appointment', width: '140px', render: (l: Lead) => formatAppointment(l.appointmentTime) },
  { key: 'leadStatus', label: 'Status', width: '120px', render: (l: Lead) => badge(l.leadStatus) },
  { key: 'createdBy', label: 'Created By', width: '110px', render: (l: Lead) => l.createdByUserName || '-' },
];

// Backend team — same as app/backend-team/page.tsx.
const backendColumns: Column[] = [
  { key: 'executeDate', label: 'Execute Date', width: '120px', render: (l: Lead) => formatDate(l.agreement?.executeDate) },
  { key: 'name', label: 'Name', width: '160px', render: (l: Lead) => fullName(l.client?.firstName, l.client?.lastName) },
  { key: 'ownerName', label: 'Owner Name', width: '150px', render: (l: Lead) => fullName(l.agreement?.owner?.firstName, l.agreement?.owner?.lastName) },
  { key: 'tenantName', label: 'Tenant Name', width: '150px', render: (l: Lead) => fullName(l.agreement?.tenant?.firstName, l.agreement?.tenant?.lastName) },
  { key: 'tokenNo', label: 'Token No.', width: '120px', render: (l: Lead) => l.agreement?.tokenNo || '-' },
  { key: 'agreementStatus', label: 'Agreement Status', width: '140px', render: (l: Lead) => badge(l.agreement?.status) },
  { key: 'backOfficeStatus', label: 'Back Office Status', width: '150px', render: (l: Lead) => badge(l.agreement?.backOfficeStatus) },
  { key: 'ownerNo', label: 'Owner No.', width: '130px', render: (l: Lead) => l.agreement?.owner?.phoneNo || '-' },
  { key: 'tenantNo', label: 'Tenant No.', width: '130px', render: (l: Lead) => l.agreement?.tenant?.phoneNo || '-' },
  { key: 'grnNumber', label: 'GRN No.', width: '100px', render: (l: Lead) => l.payment?.grnNumber || '-' },
  { key: 'dhcNumber', label: 'DHC No.', width: '100px', render: (l: Lead) => l.payment?.dhcNumber || '-' },
  { key: 'commissionDate', label: 'Commission Date', width: '120px', render: (l: Lead) => formatDate(l.payment?.commissionDate) },
];

// Fallback for teams without a bespoke layout (Accounting / Marketing / Shop, etc.).
const genericColumns: Column[] = [
  { key: 'leadDate', label: 'Lead Date', width: '110px', render: (l: Lead) => formatDate((l as Lead & { leadDate?: string }).leadDate || l.createdDate) },
  { key: 'name', label: 'Name', width: '160px', render: (l: Lead) => fullName(l.client?.firstName, l.client?.lastName) },
  { key: 'phoneNo', label: 'Phone', width: '120px', render: (l: Lead) => l.client?.phoneNo || '-' },
  { key: 'clientType', label: 'Client Type', width: '100px', render: (l: Lead) => l.client?.clientType || '-' },
  { key: 'tokenNo', label: 'Token No.', width: '120px', render: (l: Lead) => l.agreement?.tokenNo || '-' },
  { key: 'appointment', label: 'Appointment', width: '140px', render: (l: Lead) => formatAppointment(l.appointmentTime) },
  { key: 'agreementStatus', label: 'Agreement Status', width: '140px', render: (l: Lead) => badge(l.agreement?.status) },
  { key: 'leadStatus', label: 'Lead Status', width: '120px', render: (l: Lead) => badge(l.leadStatus) },
  { key: 'createdBy', label: 'Created By', width: '130px', render: (l: Lead) => l.createdByUserName || '-' },
];

export function getTeamColumns(transitLevel?: string): Column[] {
  switch ((transitLevel || '').toUpperCase()) {
    case 'CALLING_TEAM':
    case 'CALLING':
      return callingColumns;
    case 'EXECUTIVE_TEAM':
    case 'EXECUTIVE':
      return executiveColumns;
    case 'BACKEND_TEAM':
    case 'BACKEND':
      return backendColumns;
    default:
      return genericColumns;
  }
}
