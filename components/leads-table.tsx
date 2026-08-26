'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import {
  Eye, Plus, Search, ChevronLeft, ChevronRight, Calendar, Download, Send, X, Filter,
  User, Loader2, Phone, Mail, MapPin, FileText, CreditCard, CalendarDays, Clock, Building,
  Users, IndianRupee, BadgeCheck, AlertCircle, CalendarClock, FileDown, Edit, Save,
  ChevronDown, ChevronUp, Receipt, Banknote, FileCheck, UserCheck, Users2, MapPinned,
  PhoneCall, MailOpen, Hash, CalendarRange, Timer, Tag, Link2, DollarSign, Percent,
  ClipboardList, Notebook, CircleDot, ArrowRightLeft, CircleHelp, CheckCircle2, XCircle,
  ArrowUpDown, ArrowDownUp, ArrowRight, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

// ==================== INTERFACES ====================
interface PaymentDetail {
  paymentDate: string;
  paymentAmount: string;
  modeOfPayment: string;
  payerName: string;
  transactionNumber?: string;
}
interface Lead {
  visitCount: number;
  id: string;
  clientId?: string;
  client?: {
    firstName?: string;
    lastName?: string;
    phoneNo?: string;
    email?: string;
    clientType?: string;
    address?: string;
    areaName?: string;
    cityName?: string;
  };
  agreement?: {
    tokenNo?: string;
    status?: string;
    backOfficeStatus?: string;
    owner?: {
      firstName?: string;
      lastName?: string;
      phoneNo?: string;
      dateOfBirth?: string;
      email?: string;
      aadharNumber?: string;
      panNumber?: string;
      birthDate?: string;
    };
    tenant?: {
      firstName?: string;
      lastName?: string;
      phoneNo?: string;
      dateOfBirth?: string;
      email?: string;
      aadharNumber?: string;
      panNumber?: string;
      birthDate?: string;
    };
    executeDate?: string;
    startDate?: string;
    endDate?: string;
    addressLine1?: string;
    addressLine2?: string;
    agreementStartDate?: string;
    agreementEndDate?: string;
    mobileNo?: string;
    pvName?: string;
    pvAge?: string;
    pvMobile?: string;
    pvRelation?: string;
    svName?: string;
    svNo?: string;
    svLocation?: string;
    assignStatus?: string;
    agreementFile?: string;
    agreementFileName?: string;
    fileData?: string;
    fileName?: string;
    pvrFileData?: string;
    pvrFileName?: string;
    otherFileData?: string;
    otherFileName?: string;
  };
  payment?: {
    grnNumber?: string;
    grnAmount?: number;
    grnDate?: string;
    dhcNumber?: string;
    dhcAmount?: number;
    dhcDate?: string;
    commissionDate?: string;
    commissionAmount?: number;
    commissionName?: string;
    totalReceivedAmount?: number;
    outstandingAmount?: number;
    totalAmount?: number;
    paidAmount?: number;
    pendingAmount?: number;
    totalExpensesAmount?: number;
    description?: string;
    govtGrnDate?: string;
    ourFees?: number;
    commission?: number;
  };
  leadStatus?: string;
  status?: string;
  visitAddress?: string;
  appointmentTime?: string;
  isAppointment?: boolean;
  appointmentStatus?: string;
  // Backend workflow bucket: undefined = All Work, 'SUBMITTED', 'COMPLETED'
  backendStatus?: string;
  lastFollowUpDate?: string;
  nextFollowUpDate?: string;
  createdDate?: string;
  createdByUserName?: string;
  createdByUserId?: string;
  createdAt?: string;
  updatedByUserName?: string;
  tentativeAgreementDate?: string;
  cancellationReason?: string;
  transitLevel?: string;
  leadSource?: string;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  assignedAt?: string;
  description?: string;
  referenceName?: string;
  referenceNumber?: string;
  amount?: string;
  city?: { id?: string; name: string };
  area?: { id?: string; name: string };
  cityId?: string;
  areaId?: string;
  leadDate?: string;
  paymentDetails?: Array<{
    clientType: 'OWNER' | 'TENANT';
    paymentDate?: string;
    paymentAmount?: string;
    modeOfPayment?: string;
    payerName?: string;
    transactionNumber?: string;
  }>;
  visibleToTeams?: string[];
  forwardedHistory?: Array<{
    fromTeam: string;
    toTeam: string;
    forwardedBy: string;
    forwardedByUserId?: string;
    forwardedAt: string;
    reason?: string;
  }>;
  forwardReason?: string;
  // Backend team: optional colour tag used to highlight a lead's row.
  rowColor?: string;
}
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
}
interface DropdownData {
  cities: { id: string; name: string }[];
  areas: { id: string; name: string; cityName?: string }[];
  leadStatuses: { key: string; value: string }[];
  agreementStatuses: { key: string; value: string }[];
  backOfficeStatuses: { key: string; value: string }[];
  executives: { id: string; name: string; userId: string }[];
  clientTypes: { key: string; value: string }[];
}
interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (lead: Lead) => React.ReactNode;
}

// ==================== THEME COLORS ====================
const THEME = {
  primary: '#00843d',
  primaryHover: '#00622d',
  primaryLight: '#f0fdf4',
  primaryRing: 'rgba(0, 166, 81, 0.2)',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  background: '#ffffff',
};

// ==================== UTILITY FUNCTIONS ====================
// DD/MM/YYYY — consistent across all team tables.
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
};

// Date only (DD/MM/YYYY) — time is intentionally never shown anywhere.
const formatDateTime = (dateString?: string): string => {
  return formatDate(dateString);
};

// Appointment: DD/MM/YYYY HH:mm (24-hour, no AM/PM). The time is read directly
// from the ISO string parts so a UTC/`Z` suffix can't shift it by the IST offset.
const formatAppointment = (dateString?: string): string => {
  if (!dateString) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(dateString.trim());
  if (m) {
    const [, yyyy, mm, dd, hStr, minStr] = m;
    const datePart = `${dd}/${mm}/${yyyy}`;
    return hStr === undefined ? datePart : `${datePart} ${hStr}:${minStr}`;
  }
  return formatDate(dateString);
};

// A native date input supports BOTH manual typing and the calendar picker, so the
// user can key in the date directly (no Enter needed) or pick it from the calendar.
const DateInput: React.FC<{ value?: string; onChange: (iso: string) => void; className?: string }> = ({ value, onChange, className }) => {
  const nativeValue = (() => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <input
      type="date"
      value={nativeValue}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
};

// Split a stored `YYYY-MM-DDTHH:mm` value into its date / hour / minute parts.
const parseDateTimeParts = (value?: string) => {
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [hStr = '', mStr = ''] = timePart.split(':');
  return {
    datePart: /^\d{4}-\d{2}-\d{2}/.test(datePart) ? datePart.slice(0, 10) : '',
    hour24: hStr === '' ? '' : hStr.padStart(2, '0'),
    minute: mStr === '' ? '' : mStr.padStart(2, '0'),
  };
};
// Rebuild a `YYYY-MM-DDTHH:mm` value from the date + 24-hour picker parts.
const buildDateTime = (datePart: string, hour24: string, minute: string) => {
  if (!datePart) return '';
  return `${datePart}T${(hour24 || '00').padStart(2, '0')}:${(minute || '00').padStart(2, '0')}`;
};

// Date + time picker (date input + hh / mm selects), matching the New Lead form's
// "Appointment Date & Time" field so editing keeps the exact time too.
const DateTimeInput: React.FC<{ value?: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className }) => {
  const { datePart, hour24, minute } = parseDateTimeParts(value);
  const selectClass = "px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d] focus:border-transparent transition-all cursor-pointer";
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={datePart}
        onChange={(e) => onChange(buildDateTime(e.target.value, hour24, minute))}
        className={`flex-1 ${className || ''}`}
      />
      <select aria-label="hour" value={hour24 || ''} onChange={(e) => onChange(buildDateTime(datePart, e.target.value, minute))} className={selectClass}>
        <option value="" disabled>hh</option>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-slate-400">:</span>
      <select aria-label="minute" value={minute || ''} onChange={(e) => onChange(buildDateTime(datePart, hour24, e.target.value))} className={selectClass}>
        <option value="" disabled>mm</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
};

// Add a number of days to an ISO date, returning YYYY-MM-DD (used by the Period field
// next to Agreement Start Date to auto-fill the End Date).
const addDaysISO = (iso?: string, days?: number | string): string => {
  if (!iso) return '';
  const base = new Date(/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(0, 10)}T00:00:00` : iso);
  if (isNaN(base.getTime())) return '';
  const n = typeof days === 'string' ? parseInt(days, 10) : days;
  if (n == null || isNaN(n)) return '';
  base.setDate(base.getDate() + n);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
};

// Whole-day difference between two ISO dates (to display the current period).
const diffDaysISO = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return '';
  const s = new Date(/^\d{4}-\d{2}-\d{2}/.test(startIso) ? `${startIso.slice(0, 10)}T00:00:00` : startIso);
  const e = new Date(/^\d{4}-\d{2}-\d{2}/.test(endIso) ? `${endIso.slice(0, 10)}T00:00:00` : endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const d = Math.round((e.getTime() - s.getTime()) / 86400000);
  return d >= 0 ? String(d) : '';
};

// Agreement period is ENTERED/SHOWN in months but STORED in days (≈30 days/month)
// so the end-date math and the saved value stay day-based. Convert at the input boundary.
const daysToMonthsStr = (days?: string | number): string => {
  const n = typeof days === 'string' ? parseInt(days, 10) : days;
  return n == null || isNaN(n) || n === 0 ? '' : String(Math.round(n / 30));
};
const monthsToDaysStr = (months: string): string => {
  const n = parseInt((months || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : String(n * 30);
};

const formatCurrency = (amount?: number | string): string => {
  if (!amount) return '₹ 0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹ 0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
};

const getStatusBadge = (status?: string): React.ReactNode => {
  if (!status) return <span className="text-slate-400">-</span>;
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    FOLLOW_UP: 'bg-purple-100 text-purple-700 border-purple-200',
    NEW_LEAD: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const color = colors[status.toUpperCase()] || 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${color}`}>{status}</span>;
};

// ==================== ROW COLOUR TAGS (Backend team) ====================
// Colour options used by the Backend team to highlight leads in the table.
// Backend team's row-colour tags. The `row` shades are kept a bit darker so a tagged
// lead stands out clearly against the plain white rows.
const ROW_COLORS: { key: string; label: string; swatch: string; row: string }[] = [
  { key: 'red', label: 'Red', swatch: 'bg-red-500', row: 'bg-red-200' },
  { key: 'dark-green', label: 'Dark Green', swatch: 'bg-green-700', row: 'bg-green-300' },
  { key: 'light-green', label: 'Light Green', swatch: 'bg-emerald-300', row: 'bg-emerald-200' },
  { key: 'orange', label: 'Orange', swatch: 'bg-orange-500', row: 'bg-orange-200' },
  { key: 'yellow', label: 'Yellow', swatch: 'bg-yellow-400', row: 'bg-yellow-200' },
  { key: 'purple', label: 'Purple', swatch: 'bg-purple-500', row: 'bg-purple-200' },
];
const rowColorRowClass = (color?: string) => (color ? ROW_COLORS.find((c) => c.key === color)?.row || '' : '');

// Does a lead match the global header search? Checks name, owner/tenant name,
// token number and phone numbers (case-insensitive substring).
const leadMatchesGlobalSearch = (lead: Lead, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const haystack = [
    `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`,
    `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`,
    `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`,
    lead.agreement?.tokenNo || '',
    lead.client?.phoneNo || '',
    lead.agreement?.owner?.phoneNo || '',
    lead.agreement?.tenant?.phoneNo || '',
    lead.agreement?.mobileNo || '',
  ].join(' ').toLowerCase();
  return haystack.includes(q);
};

// Hook: anchor a floating panel to a button and render it in a body-level portal,
// so it always sits ABOVE the table (never clipped by the table's scroll overflow).
function useAnchoredPanel() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right });
    }
    setOpen((o) => !o);
  };

  return { open, setOpen, pos, btnRef, panelRef, toggle };
}

// Small per-row palette to tag a lead with a highlight colour.
const RowColorPicker: React.FC<{ current?: string; onPick: (color: string) => void }> = ({ current, onPick }) => {
  const { open, setOpen, pos, btnRef, panelRef, toggle } = useAnchoredPanel();
  const currentSwatch = ROW_COLORS.find((c) => c.key === current)?.swatch;
  return (
    <>
      <button ref={btnRef} onClick={toggle} title="Tag row colour" className="p-2 rounded-lg hover:bg-slate-100 transition-all flex items-center">
        <span className={`w-4 h-4 rounded-full border border-slate-300 ${currentSwatch || 'bg-white'}`} />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 60 }} className="p-2 bg-white border border-slate-200 rounded-lg shadow-xl grid grid-cols-3 gap-1.5 w-max">
          {ROW_COLORS.map((c) => (
            <button key={c.key} onClick={() => { onPick(c.key); setOpen(false); }} title={c.label} className={`w-6 h-6 rounded-full border ${current === c.key ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-300'} ${c.swatch}`} />
          ))}
          <button onClick={() => { onPick(''); setOpen(false); }} title="Clear colour" className="w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-400"><X className="w-3 h-3" /></button>
        </div>,
        document.body,
      )}
    </>
  );
};

// Dropdown listing a lead's uploaded files with download links (Backend team).
// The leads LIST no longer ships the base64 file blobs (kept reloads fast), so the
// full lead — including the blobs — is fetched by id the first time the dropdown opens.
const FilesDropdown: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { apiFetch } = useApi();
  const { open, setOpen, pos, btnRef, panelRef, toggle } = useAnchoredPanel();
  const [fullLead, setFullLead] = useState<Lead | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (!open || fullLead || loadingFiles) return;
    // If the row already carries file data (e.g. just edited in this session), reuse it.
    const ag = lead.agreement;
    if (ag?.fileData || ag?.agreementFile || ag?.pvrFileData || ag?.otherFileData) {
      setFullLead(lead);
      return;
    }
    setLoadingFiles(true);
    apiFetch(`/api/leads?id=${lead.id}`)
      .then((r) => r.json())
      .then((d) => setFullLead(d))
      .catch(() => setFullLead(lead))
      .finally(() => setLoadingFiles(false));
  }, [open, fullLead, loadingFiles, lead, apiFetch]);

  const source = fullLead || lead;
  const files = [
    { data: source.agreement?.fileData || source.agreement?.agreementFile, name: source.agreement?.fileName || source.agreement?.agreementFileName || 'agreement', label: 'Agreement File' },
    { data: source.agreement?.pvrFileData, name: source.agreement?.pvrFileName || 'pvr-file', label: 'PVR File' },
    { data: source.agreement?.otherFileData, name: source.agreement?.otherFileName || 'other-file', label: 'Other File' },
  ].filter((f) => !!f.data);
  return (
    <>
      <button ref={btnRef} onClick={toggle} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all" title="Download uploaded files">
        <FileText className="w-3.5 h-3.5" /> Files <ChevronDown className="w-3 h-3" />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 60 }} className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-xl w-48">
          {loadingFiles ? (
            <div className="px-2 py-2 text-xs text-slate-400 text-center flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
          ) : files.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-400 text-center">No files uploaded</div>
          ) : files.map((f, i) => (
            <a key={i} href={f.data} download={f.name} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md transition-colors">
              <Download className="w-3.5 h-3.5 text-[#00843d]" /> <span className="truncate">{f.label}</span>
            </a>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

// ==================== BASE MODAL ====================
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, children, title, size = 'lg' }) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw] h-[95vh]',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} overflow-hidden transition-all duration-200 ease-out flex flex-col max-h-[95vh] ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Close modal">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

// ==================== EDIT LEAD MODAL ====================
interface EditLeadModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSave: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  dropdowns?: DropdownData;
  hideBackWorkAccount?: boolean;
}
const EditLeadModal: React.FC<EditLeadModalProps> = ({ isOpen, lead, onClose, onSave, dropdowns, hideBackWorkAccount = false }) => {
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lead' | 'client' | 'payment'>('lead');
  const [ownerPayments, setOwnerPayments] = useState<PaymentDetail[]>([
    { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '', transactionNumber: '' }
  ]);
  const [tenantPayments, setTenantPayments] = useState<PaymentDetail[]>([
    { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '', transactionNumber: '' }
  ]);

  useEffect(() => {
    if (lead) {
      setFormData({
        id: lead.id,
        clientId: lead.clientId,
        client: { ...lead.client },
        agreement: {
          ...lead.agreement,
          tokenNo: lead.agreement?.tokenNo || '',
          owner: { ...lead.agreement?.owner },
          tenant: { ...lead.agreement?.tenant }
        },
        payment: { ...lead.payment },
        leadStatus: lead.leadStatus,
        description: lead.description,
        nextFollowUpDate: lead.nextFollowUpDate,
        lastFollowUpDate: lead.lastFollowUpDate,
        assignedToUserId: lead.assignedToUserId,
        assignedToUserName: lead.assignedToUserName,
        cancellationReason: lead.cancellationReason,
        appointmentTime: lead.appointmentTime,
        tentativeAgreementDate: lead.tentativeAgreementDate,
        leadSource: lead.leadSource,
        visitAddress: lead.visitAddress,
        referenceName: lead.referenceName,
        referenceNumber: lead.referenceNumber,
        amount: lead.amount,
        visitCount: lead.visitCount,
        cityId: lead.cityId || lead.city?.id,
        areaId: lead.areaId || lead.area?.id,
        leadDate: lead.leadDate,
        visibleToTeams: lead.visibleToTeams,
        transitLevel: lead.transitLevel,
        createdByUserId: lead.createdByUserId,
        createdByUserName: lead.createdByUserName,
        createdAt: lead.createdAt,
        forwardedHistory: lead.forwardedHistory,
      });

      if (lead.paymentDetails?.length) {
        const ownerPmts = lead.paymentDetails
          .filter(p => p.clientType === 'OWNER')
          .map(p => ({
            paymentDate: p.paymentDate || '',
            paymentAmount: p.paymentAmount || '',
            modeOfPayment: p.modeOfPayment || '',
            payerName: p.payerName || '',
            transactionNumber: p.transactionNumber || '',
          }));
        const tenantPmts = lead.paymentDetails
          .filter(p => p.clientType === 'TENANT')
          .map(p => ({
            paymentDate: p.paymentDate || '',
            paymentAmount: p.paymentAmount || '',
            modeOfPayment: p.modeOfPayment || '',
            payerName: p.payerName || '',
            transactionNumber: p.transactionNumber || '',
          }));
        if (ownerPmts.length) setOwnerPayments(ownerPmts);
        if (tenantPmts.length) setTenantPayments(tenantPmts);
      }
    }
  }, [lead]);

  const handleInputChange = (section: 'client' | 'agreement' | 'payment' | 'general' | 'owner' | 'tenant', field: string, value: any) => {
    setFormData(prev => {
      if (section === 'general') return { ...prev, [field]: value };
      if (section === 'owner' || section === 'tenant') {
        return {
          ...prev,
          agreement: {
            ...prev.agreement,
            [section]: {
              ...(prev.agreement?.[section] as object),
              [field]: value
            }
          }
        };
      }
      return {
        ...prev,
        [section]: {
          ...(prev[section as keyof Partial<Lead>] as object),
          [field]: value
        }
      };
    });
  };

  // Agreement Start Date + Period(days) together drive the End Date.
  const handleAgreementStartChange = (iso: string) => {
    setFormData(prev => {
      const period = (prev.agreement as any)?.periodDays;
      const end = period ? addDaysISO(iso, period) : prev.agreement?.agreementEndDate;
      return { ...prev, agreement: { ...prev.agreement, agreementStartDate: iso, agreementEndDate: end } };
    });
  };
  const handlePeriodChange = (days: string) => {
    setFormData(prev => {
      const start = prev.agreement?.agreementStartDate || (prev.agreement as any)?.startDate;
      const end = start && days ? addDaysISO(start, days) : prev.agreement?.agreementEndDate;
      return { ...prev, agreement: { ...prev.agreement, periodDays: days, agreementEndDate: end } };
    });
  };

  const updateOwnerPayment = (index: number, field: keyof PaymentDetail, value: string) => {
    setOwnerPayments(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const updateTenantPayment = (index: number, field: keyof PaymentDetail, value: string) => {
    setTenantPayments(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const addOwnerPayment = () => {
    setOwnerPayments(prev => [...prev, { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '', transactionNumber: '' }]);
  };

  const addTenantPayment = () => {
    setTenantPayments(prev => [...prev, { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '', transactionNumber: '' }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead?.id) return;
    setLoading(true);
    setError(null);
    try {
      const paymentDetails = [
        ...ownerPayments.filter(p => p.paymentAmount).map(p => ({ ...p, clientType: 'OWNER' as const })),
        ...tenantPayments.filter(p => p.paymentAmount).map(p => ({ ...p, clientType: 'TENANT' as const })),
      ];

      // Resolve the selected City/Area ids to full { id, name } objects so tables
      // (which read lead.city?.name) keep showing the right label after save.
      const selectedCity = dropdowns?.cities.find(c => c.id === formData.cityId);
      const selectedArea = dropdowns?.areas.find(a => a.id === formData.areaId);

      const updateData = {
        ...formData,
        city: selectedCity ? { id: selectedCity.id, name: selectedCity.name } : formData.city,
        area: selectedArea ? { id: selectedArea.id, name: selectedArea.name } : formData.area,
        paymentDetails,
        visibleToTeams: lead.visibleToTeams,
        assignedToUserId: lead.assignedToUserId,
        assignedToUserName: lead.assignedToUserName,
        transitLevel: lead.transitLevel,
        createdByUserId: lead.createdByUserId,
        createdByUserName: lead.createdByUserName,
        createdAt: lead.createdAt,
        forwardedHistory: lead.forwardedHistory,
      };
      await onSave(lead.id, updateData);
      onClose();
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const inputClass = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d] focus:border-transparent transition-all";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1";
  const sectionClass = "bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6";
  const sectionHeaderClass = "text-base font-semibold text-slate-800 mb-4 flex items-center gap-2";

  const totalAmount = parseFloat(formData.payment?.totalAmount?.toString() || '0');
  const commissionAmount = parseFloat(formData.payment?.commissionAmount?.toString() || '0');
  const outstandingAmount = totalAmount + commissionAmount;
  // Received = sum of all owner + tenant payments; Balance = Outstanding − Received.
  const receivedAmount =
    [...ownerPayments, ...tenantPayments]
      .reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
  const balanceAmount = outstandingAmount - receivedAmount;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Edit Lead Details" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['lead', 'client', 'payment'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab ? 'bg-white text-[#00843d] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'lead' ? 'Lead Details' : tab === 'client' ? 'Client & Agreement' : 'Payment Details'}
            </button>
          ))}
        </div>

        {activeTab === 'lead' && (
          <div className={sectionClass}>
            <h4 className={sectionHeaderClass}><FileText className="w-5 h-5 text-[#00843d]" /> Lead Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelClass}>Lead Date</label><DateInput value={formData.leadDate} onChange={(iso) => handleInputChange('general', 'leadDate', iso)} className={inputClass} /></div>
              <div><label className={labelClass}>First Name</label><input type="text" value={formData.client?.firstName || ''} onChange={(e) => handleInputChange('client', 'firstName', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Last Name</label><input type="text" value={formData.client?.lastName || ''} onChange={(e) => handleInputChange('client', 'lastName', e.target.value)} className={inputClass} /></div>
              <div>
                <label className={labelClass}>Client Type</label>
                <select value={formData.client?.clientType || ''} onChange={(e) => handleInputChange('client', 'clientType', e.target.value)} className={inputClass}>
                  <option value="">Select Type</option>
                  <option value="OWNER">OWNER</option>
                  <option value="TENANT">TENANT</option>
                  <option value="AGENT">AGENT</option>
                </select>
              </div>
              <div><label className={labelClass}>Contact Number</label><input type="tel" value={formData.client?.phoneNo || ''} onChange={(e) => handleInputChange('client', 'phoneNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
              <div><label className={labelClass}>Email</label><input type="email" value={formData.client?.email || ''} onChange={(e) => handleInputChange('client', 'email', e.target.value)} className={inputClass} /></div>
              <div>
                <label className={labelClass}>Lead Source</label>
                <select value={formData.leadSource || ''} onChange={(e) => handleInputChange('general', 'leadSource', e.target.value)} className={inputClass}>
                  <option value="">Select Source</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="CALL">CALL</option>
                  <option value="EXCEL">EXCEL</option>
                  <option value="REFERENCE">REFERENCE</option>
                  <option value="SHOP">SHOP</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Lead Status</label>
                <select value={formData.leadStatus || ''} onChange={(e) => handleInputChange('general', 'leadStatus', e.target.value)} className={inputClass}>
                  <option value="">Select Status</option>
                  <option value="NEW_LEAD">NEW_LEAD</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="FOLLOW_UP">FOLLOW_UP</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div><label className={labelClass}>Tentative Agreement Date</label><DateInput value={formData.tentativeAgreementDate} onChange={(iso) => handleInputChange('general', 'tentativeAgreementDate', iso)} className={inputClass} /></div>
              <div className="md:col-span-2"><label className={labelClass}>Appointment Date &amp; Time</label><DateTimeInput value={formData.appointmentTime} onChange={(v) => handleInputChange('general', 'appointmentTime', v)} className={inputClass} /></div>
              <div><label className={labelClass}>Visit Address</label><input type="text" value={formData.visitAddress || ''} onChange={(e) => handleInputChange('general', 'visitAddress', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Description</label><input type="text" value={formData.description || ''} onChange={(e) => handleInputChange('general', 'description', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Reference Name</label><input type="text" value={formData.referenceName || ''} onChange={(e) => handleInputChange('general', 'referenceName', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Reference Number</label><input type="text" value={formData.referenceNumber || ''} onChange={(e) => handleInputChange('general', 'referenceNumber', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Amount</label><input type="text" value={formData.amount || ''} onChange={(e) => handleInputChange('general', 'amount', e.target.value)} className={inputClass} /></div>
              <div>
                <label className={labelClass}>City</label>
                <select value={formData.cityId || ''} onChange={(e) => handleInputChange('general', 'cityId', e.target.value)} className={inputClass}>
                  <option value="">Select City</option>
                  {(dropdowns?.cities || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Area</label>
                <select value={formData.areaId || ''} onChange={(e) => handleInputChange('general', 'areaId', e.target.value)} className={inputClass}>
                  <option value="">Select Area</option>
                  {(dropdowns?.areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Last FollowUp Date</label><DateInput value={formData.lastFollowUpDate} onChange={(iso) => handleInputChange('general', 'lastFollowUpDate', iso)} className={inputClass} /></div>
              <div><label className={labelClass}>Next FollowUp Date</label><DateInput value={formData.nextFollowUpDate} onChange={(iso) => handleInputChange('general', 'nextFollowUpDate', iso)} className={inputClass} /></div>
            </div>
          </div>
        )}

        {activeTab === 'client' && (
          <div className="space-y-6">
            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><User className="w-5 h-5 text-[#00843d]" /> Owner Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>First Name</label><input type="text" value={formData.agreement?.owner?.firstName || ''} onChange={(e) => handleInputChange('owner', 'firstName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Last Name</label><input type="text" value={formData.agreement?.owner?.lastName || ''} onChange={(e) => handleInputChange('owner', 'lastName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Email</label><input type="email" value={formData.agreement?.owner?.email || ''} onChange={(e) => handleInputChange('owner', 'email', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Contact</label><input type="tel" value={formData.agreement?.owner?.phoneNo || ''} onChange={(e) => handleInputChange('owner', 'phoneNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Aadhar Number</label><input type="text" value={formData.agreement?.owner?.aadharNumber || ''} onChange={(e) => handleInputChange('owner', 'aadharNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} maxLength={12} className={inputClass} /></div>
                <div><label className={labelClass}>PAN Number</label><input type="text" value={formData.agreement?.owner?.panNumber || ''} onChange={(e) => handleInputChange('owner', 'panNumber', e.target.value.toUpperCase())} maxLength={10} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Birth Date</label>
                  <DateInput value={formData.agreement?.owner?.birthDate || formData.agreement?.owner?.dateOfBirth} onChange={(iso) => handleInputChange('owner', 'birthDate', iso)} className={inputClass} />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><Users className="w-5 h-5 text-[#00843d]" /> Tenant Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>First Name</label><input type="text" value={formData.agreement?.tenant?.firstName || ''} onChange={(e) => handleInputChange('tenant', 'firstName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Last Name</label><input type="text" value={formData.agreement?.tenant?.lastName || ''} onChange={(e) => handleInputChange('tenant', 'lastName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Email</label><input type="email" value={formData.agreement?.tenant?.email || ''} onChange={(e) => handleInputChange('tenant', 'email', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Contact</label><input type="tel" value={formData.agreement?.tenant?.phoneNo || ''} onChange={(e) => handleInputChange('tenant', 'phoneNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Aadhar Number</label><input type="text" value={formData.agreement?.tenant?.aadharNumber || ''} onChange={(e) => handleInputChange('tenant', 'aadharNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} maxLength={12} className={inputClass} /></div>
                <div><label className={labelClass}>PAN Number</label><input type="text" value={formData.agreement?.tenant?.panNumber || ''} onChange={(e) => handleInputChange('tenant', 'panNumber', e.target.value.toUpperCase())} maxLength={10} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Birth Date</label>
                  <DateInput value={formData.agreement?.tenant?.birthDate || formData.agreement?.tenant?.dateOfBirth} onChange={(iso) => handleInputChange('tenant', 'birthDate', iso)} className={inputClass} />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><BadgeCheck className="w-5 h-5 text-[#00843d]" /> Police Verification</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>Name</label><input type="text" value={formData.agreement?.pvName || ''} onChange={(e) => handleInputChange('agreement', 'pvName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Age</label><input type="number" value={formData.agreement?.pvAge || ''} onChange={(e) => handleInputChange('agreement', 'pvAge', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Mobile</label><input type="tel" value={formData.agreement?.pvMobile || ''} onChange={(e) => handleInputChange('agreement', 'pvMobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Relation</label><input type="text" value={formData.agreement?.pvRelation || ''} onChange={(e) => handleInputChange('agreement', 'pvRelation', e.target.value)} className={inputClass} /></div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><MapPinned className="w-5 h-5 text-[#00843d]" /> Site Visit Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>SV Name</label><input type="text" value={formData.agreement?.svName || ''} onChange={(e) => handleInputChange('agreement', 'svName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>SV No.</label><input type="text" inputMode="numeric" value={formData.agreement?.svNo || ''} onChange={(e) => handleInputChange('agreement', 'svNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>SV Location</label><input type="text" value={formData.agreement?.svLocation || ''} onChange={(e) => handleInputChange('agreement', 'svLocation', e.target.value)} className={inputClass} /></div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><FileCheck className="w-5 h-5 text-[#00843d]" /> Agreement Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Token Number</label>
                  <input type="text" value={formData.agreement?.tokenNo || ''} onChange={(e) => handleInputChange('agreement', 'tokenNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 14))} maxLength={14} className={inputClass} />
                </div>
                <div><label className={labelClass}>Period (Month)</label><input type="number" min={0} placeholder="e.g. 11" value={daysToMonthsStr((formData.agreement as any)?.periodDays ?? diffDaysISO(formData.agreement?.agreementStartDate || formData.agreement?.startDate, formData.agreement?.agreementEndDate || formData.agreement?.endDate))} onChange={(e) => handlePeriodChange(monthsToDaysStr(e.target.value))} className={inputClass} /></div>
                <div><label className={labelClass}>Agreement Start Date</label><DateInput value={formData.agreement?.agreementStartDate || formData.agreement?.startDate} onChange={handleAgreementStartChange} className={inputClass} /></div>
                <div><label className={labelClass}>Agreement End Date</label><DateInput value={formData.agreement?.agreementEndDate || formData.agreement?.endDate} onChange={(iso) => handleInputChange('agreement', 'agreementEndDate', iso)} className={inputClass} /></div>
                <div><label className={labelClass}>Mobile No</label><input type="tel" value={formData.agreement?.mobileNo || ''} onChange={(e) => handleInputChange('agreement', 'mobileNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Execute Date</label><DateInput value={formData.agreement?.executeDate} onChange={(iso) => handleInputChange('agreement', 'executeDate', iso)} className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Address Line 1</label><input type="text" value={formData.agreement?.addressLine1 || ''} onChange={(e) => handleInputChange('agreement', 'addressLine1', e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Agreement Status</label>
                  <select value={formData.agreement?.status || ''} onChange={(e) => handleInputChange('agreement', 'status', e.target.value)} className={inputClass}>
                    <option value="">Select Status</option>
                    {['Owner Pending', 'Tenant Pending', 'Witness Pending', 'Payment + Witness Pending', 'All Pending', 'All VP Pending', 'Draft Ready', 'Challan and DHC', 'Extra Visit', '1 Tenant Pending', 'NRI Owner Pending', 'Deposit Details Pending', 'Furniture Details Pending', 'Miscellaneous points Pending', 'Agent/owner/Tenant Confirmation Pending', 'Draft Updation Pending', 'POA Pending Sending', 'Reshadule', 'Biomatric Problem', 'Sarver Problem', 'Sending Govt.', 'Photo Pending', 'Other Problme', 'Cancel'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {!hideBackWorkAccount && (
                <div>
                  <label className={labelClass}>Back Office Status</label>
                  <select value={formData.agreement?.backOfficeStatus || ''} onChange={(e) => handleInputChange('agreement', 'backOfficeStatus', e.target.value)} className={inputClass}>
                    <option value="">Select Status</option>
                    {['Govt. Approval pending', 'Govt. Quiery', 'Govt. Copy send clint', 'Govt. Other issue', 'Challan Pending', 'DHC Pending', 'ReShadule visit', 'Payment Pending', 'POA Pending', 'PVR Pending', 'Cummision Sending', 'Document Pending', 'Draft Confirmation Pending', 'Other State Bio. Pending', 'NRI Bio Pending', 'Photo Pending', 'Other Problme'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                )}
                <div className="md:col-span-3">
                  <label className={labelClass}>Agreement File (PDF)</label>
                  {(formData.agreement?.fileData || formData.agreement?.agreementFile) && (
                    <div className="flex items-center gap-3 mb-1">
                      <a
                        href={formData.agreement.fileData || formData.agreement.agreementFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#00843d] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> View current file
                      </a>
                      <a
                        href={formData.agreement.fileData || formData.agreement.agreementFile}
                        download={formData.agreement.fileName || formData.agreement.agreementFileName || 'agreement.pdf'}
                        className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        handleInputChange('agreement', 'fileName', file.name);
                        handleInputChange('agreement', 'fileData', typeof reader.result === 'string' ? reader.result : '');
                      };
                      reader.readAsDataURL(file);
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>PVR File</label>
                  {formData.agreement?.pvrFileData && (
                    <div className="flex items-center gap-3 mb-1">
                      <a href={formData.agreement.pvrFileData} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#00843d] hover:underline">
                        <FileText className="w-3.5 h-3.5" /> View current file
                      </a>
                      <a href={formData.agreement.pvrFileData} download={formData.agreement.pvrFileName || 'pvr-file'} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        handleInputChange('agreement', 'pvrFileName', file.name);
                        handleInputChange('agreement', 'pvrFileData', typeof reader.result === 'string' ? reader.result : '');
                      };
                      reader.readAsDataURL(file);
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Other File</label>
                  {formData.agreement?.otherFileData && (
                    <div className="flex items-center gap-3 mb-1">
                      <a href={formData.agreement.otherFileData} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#00843d] hover:underline">
                        <FileText className="w-3.5 h-3.5" /> View current file
                      </a>
                      <a href={formData.agreement.otherFileData} download={formData.agreement.otherFileName || 'other-file'} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        handleInputChange('agreement', 'otherFileName', file.name);
                        handleInputChange('agreement', 'otherFileData', typeof reader.result === 'string' ? reader.result : '');
                      };
                      reader.readAsDataURL(file);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><CreditCard className="w-5 h-5 text-[#00843d]" /> Payment Summary</h4>
              <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                <label className={labelClass}>Token Number</label>
                <input type="text" value={formData.agreement?.tokenNo || ''} onChange={(e) => handleInputChange('agreement', 'tokenNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 14))} maxLength={14} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Total Agreement Amount</label>
                  <input type="text" placeholder="e.g., 5000" value={formData.payment?.totalAmount || ''} onChange={(e) => handleInputChange('payment', 'totalAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>AC Amount</label>
                  <input type="text" placeholder="e.g., 500" value={formData.payment?.commissionAmount || ''} onChange={(e) => handleInputChange('payment', 'commissionAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Outstanding Amount</label>
                  <input type="text" value={`₹ ${outstandingAmount.toFixed(2)}`} readOnly className={`${inputClass} bg-slate-50 text-red-600 font-semibold cursor-not-allowed`} />
                  <p className="text-xs text-slate-500 mt-1">Calculated: Total + Commission</p>
                </div>
                <div>
                  <label className={labelClass}>Received Amount</label>
                  <input type="text" value={`₹ ${receivedAmount.toFixed(2)}`} readOnly className={`${inputClass} bg-slate-50 text-[#00843d] font-semibold cursor-not-allowed`} />
                  <p className="text-xs text-slate-500 mt-1">Owner + Tenant payments</p>
                </div>
                <div>
                  <label className={labelClass}>Balance Amount</label>
                  <input type="text" value={`₹ ${balanceAmount.toFixed(2)}`} readOnly className={`${inputClass} bg-slate-50 font-semibold cursor-not-allowed ${balanceAmount > 0 ? 'text-red-600' : 'text-[#00843d]'}`} />
                  <p className="text-xs text-slate-500 mt-1">Outstanding − Received</p>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><UserCheck className="w-5 h-5 text-[#00843d]" /> Owner Payments</h4>
              {ownerPayments.map((p, i) => (
                <div key={`owner-${i}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-white rounded-lg border border-slate-200">
                  <div><label className={labelClass}>Payment Date</label><DateInput value={p.paymentDate} onChange={(iso) => updateOwnerPayment(i, 'paymentDate', iso)} className={inputClass} /></div>
                  <div><label className={labelClass}>Amount</label><input type="text" placeholder="Amount" value={p.paymentAmount} onChange={(e) => updateOwnerPayment(i, 'paymentAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Mode</label>
                    <select value={p.modeOfPayment} onChange={(e) => updateOwnerPayment(i, 'modeOfPayment', e.target.value)} className={inputClass}>
                      <option value="">Select</option>
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div><label className={labelClass}>Payer Name</label><input type="text" placeholder="Payer Name" value={p.payerName} onChange={(e) => updateOwnerPayment(i, 'payerName', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Transaction Number</label><input type="text" placeholder="Transaction No." value={p.transactionNumber || ''} onChange={(e) => updateOwnerPayment(i, 'transactionNumber', e.target.value)} className={inputClass} /></div>
                </div>
              ))}
              <button type="button" onClick={addOwnerPayment} className="flex items-center gap-1 text-sm text-[#00843d] hover:text-[#00622d] font-medium border border-dashed border-[#00843d] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all">
                <Plus className="w-4 h-4" /> Add Owner Payment
              </button>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><Users2 className="w-5 h-5 text-[#00843d]" /> Tenant Payments</h4>
              {tenantPayments.map((p, i) => (
                <div key={`tenant-${i}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-white rounded-lg border border-slate-200">
                  <div><label className={labelClass}>Payment Date</label><DateInput value={p.paymentDate} onChange={(iso) => updateTenantPayment(i, 'paymentDate', iso)} className={inputClass} /></div>
                  <div><label className={labelClass}>Amount</label><input type="text" placeholder="Amount" value={p.paymentAmount} onChange={(e) => updateTenantPayment(i, 'paymentAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Mode</label>
                    <select value={p.modeOfPayment} onChange={(e) => updateTenantPayment(i, 'modeOfPayment', e.target.value)} className={inputClass}>
                      <option value="">Select</option>
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div><label className={labelClass}>Payer Name</label><input type="text" placeholder="Payer Name" value={p.payerName} onChange={(e) => updateTenantPayment(i, 'payerName', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Transaction Number</label><input type="text" placeholder="Transaction No." value={p.transactionNumber || ''} onChange={(e) => updateTenantPayment(i, 'transactionNumber', e.target.value)} className={inputClass} /></div>
                </div>
              ))}
              <button type="button" onClick={addTenantPayment} className="flex items-center gap-1 text-sm text-[#00843d] hover:text-[#00622d] font-medium border border-dashed border-[#00843d] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all">
                <Plus className="w-4 h-4" /> Add Tenant Payment
              </button>
            </div>

            {!hideBackWorkAccount && (
            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><Banknote className="w-5 h-5 text-[#00843d]" /> Back Work Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>GRN Number</label><input type="text" value={formData.payment?.grnNumber || ''} onChange={(e) => handleInputChange('payment', 'grnNumber', e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 18))} maxLength={18} className={inputClass} /></div>
                <div><label className={labelClass}>GRN Amount</label><input type="text" value={formData.payment?.grnAmount || ''} onChange={(e) => handleInputChange('payment', 'grnAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div><label className={labelClass}>Govt GRN Date</label><DateInput value={formData.payment?.govtGrnDate} onChange={(iso) => handleInputChange('payment', 'govtGrnDate', iso)} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Number</label><input type="text" value={formData.payment?.dhcNumber || ''} onChange={(e) => handleInputChange('payment', 'dhcNumber', e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 13))} maxLength={13} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Amount</label><input type="text" value={formData.payment?.dhcAmount || ''} onChange={(e) => handleInputChange('payment', 'dhcAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Date</label><DateInput value={formData.payment?.dhcDate} onChange={(iso) => handleInputChange('payment', 'dhcDate', iso)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Date</label><DateInput value={formData.payment?.commissionDate} onChange={(iso) => handleInputChange('payment', 'commissionDate', iso)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Name</label><input type="text" value={formData.payment?.commissionName || ''} onChange={(e) => handleInputChange('payment', 'commissionName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Amount</label><input type="text" value={formData.payment?.commissionAmount || ''} onChange={(e) => handleInputChange('payment', 'commissionAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div className="md:col-span-3"><label className={labelClass}>Description</label><textarea value={formData.payment?.description || ''} onChange={(e) => handleInputChange('payment', 'description', e.target.value)} rows={3} className={`${inputClass} resize-none`} /></div>
              </div>
            </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#00843d] text-white rounded-lg font-medium hover:bg-[#00622d] transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

// ==================== VIEW LEAD MODAL ====================
interface ViewLeadModalProps {
  isOpen: boolean;
  leadId: string;
  onClose: () => void;
  onEdit?: (lead: Lead) => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
  isAdmin?: boolean;
  dropdowns?: DropdownData;
  hideBackWorkAccount?: boolean;
}
const ViewLeadModal: React.FC<ViewLeadModalProps> = ({ isOpen, leadId, onClose, onEdit, onLeadUpdated, isAdmin = false, dropdowns, hideBackWorkAccount = false }) => {
  const { apiFetch } = useApi();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lead' | 'client' | 'payment'>('lead');
  const [isEditing, setIsEditing] = useState(false);
  const prevLeadIdRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen || !leadId || prevLeadIdRef.current === leadId) return;
    prevLeadIdRef.current = leadId;
    const fetchLead = async () => {
      setLoading(true); setError(null);
      try {
        const res = await apiFetch(`/api/leads?id=${leadId}`);
        if (!res.ok) throw new Error('Failed to fetch lead');
        const data = await res.json();
        setLead(data);
      } catch (err) {
        console.error('Fetch lead error:', err);
        setError('Failed to load lead details. Please try again.');
      } finally { setLoading(false); }
    };
    fetchLead();
  }, [isOpen, leadId, apiFetch]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setLead(null); setLoading(true); setError(null); setActiveTab('lead'); setIsEditing(false); prevLeadIdRef.current = '';
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ✅ FIX: After saving from ViewLeadModal, update local state AND notify parent
  const handleSaveEdit = async (updatedLeadId: string, updatedData: Partial<Lead>) => {
    const res = await apiFetch(`/api/leads`, { method: 'PUT', body: JSON.stringify({ id: updatedLeadId, ...updatedData }) });
    if (!res.ok) throw new Error('Save failed');
    const refreshed = await apiFetch(`/api/leads?id=${updatedLeadId}`);
    const data = await refreshed.json();
    setLead(data);
    // Notify parent to update its local leads array
    if (onLeadUpdated) onLeadUpdated(data);
  };

  if (!isOpen) return null;

  return (
    <>
      <BaseModal isOpen={isOpen} onClose={onClose} title="Lead Details" size="xl">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-[#00843d] animate-spin" /><p className="ml-2">Loading lead details...</p></div>
        ) : error ? (
          <div className="text-center py-12"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-red-600">{error}</p><button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 rounded-lg">Close</button></div>
        ) : !lead ? (
          <div className="text-center py-12 text-slate-500">No lead data available</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {[
                  { key: 'lead', label: 'Lead Details', icon: FileText },
                  { key: 'client', label: 'Client & Agreement', icon: BadgeCheck },
                  { key: 'payment', label: 'Payment Details', icon: CreditCard }
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-[#00843d] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>
              {onEdit && (
                <button onClick={() => { setIsEditing(true); setActiveTab('lead'); }} className="flex items-center gap-2 px-4 py-2 bg-[#00843d] text-white rounded-lg text-sm font-medium hover:bg-[#00622d] transition-colors">
                  <Edit className="w-4 h-4" /> Edit Lead
                </button>
              )}
            </div>

            {activeTab === 'lead' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-[#00843d]" /> Lead Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="Lead Date" value={formatDate(lead.leadDate)} icon={CalendarDays} />
                    <InfoItem label="First Name" value={lead.client?.firstName || '-'} />
                    <InfoItem label="Last Name" value={lead.client?.lastName || '-'} />
                    <InfoItem label="Client Type" value={lead.client?.clientType || '-'} />
                    <InfoItem label="Contact Number" value={lead.client?.phoneNo || '-'} icon={Phone} />
                    <InfoItem label="Email" value={lead.client?.email || '-'} icon={Mail} />
                    <InfoItem label="Lead Source" value={lead.leadSource || '-'} />
                    <InfoItem label="Lead Status" value={lead.leadStatus || '-'} badge />
                    <InfoItem label="Tentative Agreement Date" value={formatDate(lead.tentativeAgreementDate)} icon={CalendarDays} />
                    <InfoItem label="Appointment Time" value={formatAppointment(lead.appointmentTime)} icon={Clock} />
                    <InfoItem label="Visit Address" value={lead.visitAddress || '-'} icon={MapPin} />
                    <InfoItem label="Description" value={lead.description || '-'} multiline />
                    <InfoItem label="Reference Name" value={lead.referenceName || '-'} />
                    <InfoItem label="Reference Number" value={lead.referenceNumber || '-'} />
                    <InfoItem label="Amount" value={lead.amount ? formatCurrency(lead.amount) : '-'} icon={IndianRupee} />
                    <InfoItem label="City" value={lead.client?.cityName || lead.city?.name || '-'} icon={Building} />
                    <InfoItem label="Area" value={lead.client?.areaName || lead.area?.name || '-'} icon={MapPinned} />
                    <InfoItem label="Last FollowUp" value={formatDate(lead.lastFollowUpDate)} icon={CalendarDays} />
                    <InfoItem label="Next FollowUp" value={formatDate(lead.nextFollowUpDate)} icon={CalendarDays} />
                    <InfoItem label="Created By" value={lead.createdByUserName || '-'} />
                    <InfoItem label="Created Date" value={formatDate(lead.createdDate)} icon={CalendarDays} />
                    <InfoItem label="Assigned To" value={lead.assignedToUserName || 'Team Only'} icon={User} />
                    {lead.visibleToTeams && lead.visibleToTeams.length > 0 && <InfoItem label="Visible To Teams" value={lead.visibleToTeams.join(', ')} />}
                  </div>
                </div>
                {lead.forwardedHistory && lead.forwardedHistory.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-[#00843d]" /> Forwarding History</h4>
                    <div className="space-y-3">
                      {lead.forwardedHistory.map((history, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-medium text-slate-700 text-sm"><span className="text-slate-500">{history.fromTeam}</span><ChevronRight className="w-3 h-3 inline mx-1 text-slate-400" /><span className="text-[#00843d]">{history.toTeam}</span></span>
                            <span className="text-slate-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(history.forwardedAt)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span><User className="w-3 h-3 inline mr-1" /> Forwarded by: <span className="font-medium">{history.forwardedBy}</span></span>
                            <span><UserCheck className="w-3 h-3 inline mr-1" /> Assigned to: <span className="font-medium">{lead.assignedToUserName || 'Team Only'}</span></span>
                          </p>
                          {history.reason && <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"><AlertCircle className="w-3 h-3 inline mr-1" /><strong>Reason:</strong> {history.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lead.forwardReason && !lead.forwardedHistory?.length && <InfoItem label="Forward Reason" value={lead.forwardReason} multiline />}
              </div>
            )}

            {activeTab === 'client' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-[#00843d]" /> Owner Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="First Name" value={lead.agreement?.owner?.firstName || '-'} />
                    <InfoItem label="Last Name" value={lead.agreement?.owner?.lastName || '-'} />
                    <InfoItem label="Email" value={lead.agreement?.owner?.email || '-'} icon={Mail} />
                    <InfoItem label="Contact" value={lead.agreement?.owner?.phoneNo || '-'} icon={Phone} />
                    <InfoItem label="Aadhar Number" value={lead.agreement?.owner?.aadharNumber || '-'} icon={Hash} />
                    <InfoItem label="PAN Number" value={lead.agreement?.owner?.panNumber || '-'} icon={Hash} />
                    <InfoItem label="Birth Date" value={formatDate(lead.agreement?.owner?.birthDate || lead.agreement?.owner?.dateOfBirth)} icon={Calendar} />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-[#00843d]" /> Tenant Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="First Name" value={lead.agreement?.tenant?.firstName || '-'} />
                    <InfoItem label="Last Name" value={lead.agreement?.tenant?.lastName || '-'} />
                    <InfoItem label="Email" value={lead.agreement?.tenant?.email || '-'} icon={Mail} />
                    <InfoItem label="Contact" value={lead.agreement?.tenant?.phoneNo || '-'} icon={Phone} />
                    <InfoItem label="Aadhar Number" value={lead.agreement?.tenant?.aadharNumber || '-'} icon={Hash} />
                    <InfoItem label="PAN Number" value={lead.agreement?.tenant?.panNumber || '-'} icon={Hash} />
                    <InfoItem label="Birth Date" value={formatDate(lead.agreement?.tenant?.birthDate || lead.agreement?.tenant?.dateOfBirth)} icon={Calendar} />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-[#00843d]" /> Police Verification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <InfoItem label="Name" value={lead.agreement?.pvName || '-'} />
                    <InfoItem label="Age" value={lead.agreement?.pvAge || '-'} />
                    <InfoItem label="Mobile" value={lead.agreement?.pvMobile || '-'} icon={Phone} />
                    <InfoItem label="Relation" value={lead.agreement?.pvRelation || '-'} />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><MapPinned className="w-5 h-5 text-[#00843d]" /> Site Visit Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <InfoItem label="SV Name" value={lead.agreement?.svName || '-'} />
                    <InfoItem label="SV No." value={lead.agreement?.svNo || '-'} icon={Hash} />
                    <InfoItem label="SV Location" value={lead.agreement?.svLocation || '-'} icon={MapPin} />
                    <InfoItem label="Assign Status" value={lead.agreement?.assignStatus || '-'} badge />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileCheck className="w-5 h-5 text-[#00843d]" /> Agreement Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="Token Number" value={lead.agreement?.tokenNo || '-'} />
                    <InfoItem label="Agreement Status" value={lead.agreement?.status || '-'} badge />
                    <InfoItem label="Back Office Status" value={lead.agreement?.backOfficeStatus || '-'} badge />
                    <InfoItem label="Start Date" value={formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate)} icon={CalendarDays} />
                    <InfoItem label="End Date" value={formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate)} icon={CalendarDays} />
                    <InfoItem label="Execute Date" value={formatDate(lead.agreement?.executeDate)} icon={CalendarDays} />
                    <InfoItem label="Mobile No" value={lead.agreement?.mobileNo || '-'} icon={Phone} />
                    <InfoItem label="Address Line 1" value={lead.agreement?.addressLine1 || '-'} multiline />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Agreement File
                      </label>
                      {(lead.agreement?.fileData || lead.agreement?.agreementFile) ? (
                        <div className="flex items-center gap-3">
                          <a href={lead.agreement.fileData || lead.agreement.agreementFile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#00843d] hover:underline">
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a href={lead.agreement.fileData || lead.agreement.agreementFile} download={lead.agreement.fileName || lead.agreement.agreementFileName || 'agreement.pdf'} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700">-</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PVR File
                      </label>
                      {lead.agreement?.pvrFileData ? (
                        <div className="flex items-center gap-3">
                          <a href={lead.agreement.pvrFileData} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#00843d] hover:underline">
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a href={lead.agreement.pvrFileData} download={lead.agreement.pvrFileName || 'pvr-file'} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700">-</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Other File
                      </label>
                      {lead.agreement?.otherFileData ? (
                        <div className="flex items-center gap-3">
                          <a href={lead.agreement.otherFileData} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#00843d] hover:underline">
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a href={lead.agreement.otherFileData} download={lead.agreement.otherFileName || 'other-file'} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700">-</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-[#00843d] to-[#00622d] rounded-xl p-5 text-white">
                  <h4 className="text-base font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Payment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard label="Total Amount" value={formatCurrency(lead.payment?.totalAmount)} />
                    <SummaryCard label="Commission" value={formatCurrency(lead.payment?.commissionAmount)} />
                    <SummaryCard label="Outstanding" value={formatCurrency((lead.payment?.outstandingAmount ?? (Number(lead.payment?.totalAmount) + Number(lead.payment?.commissionAmount))))} highlight />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#00843d]" /> Owner Payments</h4>
                  {lead.paymentDetails?.filter(p => p.clientType === 'OWNER')?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-200"><th className="text-left py-2 px-3">Date</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Mode</th><th className="text-left py-2 px-3">Payer</th><th className="text-left py-2 px-3">Transaction No.</th></tr></thead>
                        <tbody>
                          {lead.paymentDetails?.filter(p => p.clientType === 'OWNER').map((p, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                              <td className="py-2 px-3 font-medium text-[#00843d]">{formatCurrency(p.paymentAmount)}</td>
                              <td className="py-2 px-3">{p.modeOfPayment || '-'}</td>
                              <td className="py-2 px-3">{p.payerName || '-'}</td>
                              <td className="py-2 px-3">{p.transactionNumber || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-slate-500 text-sm">No owner payments recorded</p>}
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users2 className="w-5 h-5 text-[#00843d]" /> Tenant Payments</h4>
                  {lead.paymentDetails?.filter(p => p.clientType === 'TENANT')?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-200"><th className="text-left py-2 px-3">Date</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Mode</th><th className="text-left py-2 px-3">Payer</th><th className="text-left py-2 px-3">Transaction No.</th></tr></thead>
                        <tbody>
                          {lead.paymentDetails?.filter(p => p.clientType === 'TENANT').map((p, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                              <td className="py-2 px-3 font-medium text-[#00843d]">{formatCurrency(p.paymentAmount)}</td>
                              <td className="py-2 px-3">{p.modeOfPayment || '-'}</td>
                              <td className="py-2 px-3">{p.payerName || '-'}</td>
                              <td className="py-2 px-3">{p.transactionNumber || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-slate-500 text-sm">No tenant payments recorded</p>}
                </div>
                {!hideBackWorkAccount && (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Banknote className="w-5 h-5 text-[#00843d]" /> Back Work Account</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="GRN Number" value={lead.payment?.grnNumber || '-'} />
                    <InfoItem label="GRN Amount" value={formatCurrency(lead.payment?.grnAmount)} />
                    <InfoItem label="Govt GRN Date" value={formatDate(lead.payment?.govtGrnDate)} icon={CalendarDays} />
                    <InfoItem label="DHC Number" value={lead.payment?.dhcNumber || '-'} />
                    <InfoItem label="DHC Amount" value={formatCurrency(lead.payment?.dhcAmount)} />
                    <InfoItem label="DHC Date" value={formatDate(lead.payment?.dhcDate)} icon={CalendarDays} />
                    <InfoItem label="Commission Date" value={formatDate(lead.payment?.commissionDate)} icon={CalendarDays} />
                    <InfoItem label="Commission Name" value={lead.payment?.commissionName || '-'} />
                    <InfoItem label="AC Amount" value={formatCurrency(lead.payment?.commissionAmount)} />
                    <InfoItem label="Description" value={lead.payment?.description || '-'} multiline />
                  </div>
                </div>
                )}
              </div>
            )}
          </>
        )}
      </BaseModal>
      <EditLeadModal isOpen={isEditing} lead={lead} onClose={() => setIsEditing(false)} onSave={handleSaveEdit} dropdowns={dropdowns} hideBackWorkAccount={hideBackWorkAccount} />
    </>
  );
};

// ==================== HELPER COMPONENTS ====================
interface InfoItemProps { label: string; value: string; icon?: React.ElementType; badge?: boolean; multiline?: boolean; }
const InfoItem: React.FC<InfoItemProps> = ({ label, value, icon: Icon, badge, multiline }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}{label}
    </label>
    {badge ? getStatusBadge(value) : <p className={`text-sm text-slate-700 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{value || '-'}</p>}
  </div>
);

interface SummaryCardProps { label: string; value: string; highlight?: boolean; }
const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, highlight }) => (
  <div className={`p-4 rounded-lg ${highlight ? 'bg-white/20' : 'bg-white/10'}`}>
    <p className="text-sm opacity-90">{label}</p>
    <p className={`text-xl font-bold ${highlight ? 'text-amber-200' : 'text-white'}`}>{value}</p>
  </div>
);

// ==================== CONFIRMATION MODAL ====================
interface ConfirmationModalProps { isOpen: boolean; title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void; onCancel: () => void; variant?: 'default' | 'danger' | 'success'; }
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, confirmText = 'Yes', cancelText = 'No', onConfirm, onCancel, variant = 'default' }) => {
  const btnClass = variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : variant === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600';
  return (
    <BaseModal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">{cancelText}</button>
          <button onClick={onConfirm} className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${btnClass}`}>{confirmText}</button>
        </div>
      </div>
    </BaseModal>
  );
};

// ==================== TEAM SELECTION MODAL ====================
interface TeamSelectionModalProps { isOpen: boolean; leadId: string; onSend: (leadId: string, team: string, assignedToUserId?: string | null, reason?: string) => void; onClose: () => void; restrictTeams?: boolean; excludeTeam?: string; }
export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({ isOpen, leadId, onSend, onClose, restrictTeams = false, excludeTeam }) => {
  const { apiFetch } = useApi();
  const [selectedTeam, setSelectedTeam] = useState<'CALLING' | 'EXECUTIVE' | 'BACKEND' | 'ACCOUNTING' | 'MARKETING' | 'SHOP'>('CALLING');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [assignToEmployee, setAssignToEmployee] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [forwardReason, setForwardReason] = useState('');
  const prevTeamRef = useRef<string>('');
  const reasonOptions = [
    { value: '', label: '-- Select Reason --' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Payment Pending', label: 'Payment Pending' },
    { value: 'Witness Pending', label: 'Witness Pending' },
    { value: 'Correction and Witness', label: 'Correction and Witness' },
    { value: 'Postpone', label: 'Postpone' },
    { value: 'Cancell', label: 'Cancell' },
    { value: '1st Visit', label: '1st Visit' },
    { value: '2nd Visit', label: '2nd Visit' },
    { value: '3rd Visit', label: '3rd Visit' },
    { value: 'Come In Shop', label: 'Come In Shop' },
    { value: 'NRI Call', label: 'NRI Call' },
    { value: 'Out Of Pune', label: 'Out Of Pune' },
  ];
  // Employees (non-admin dashboards) can only forward to Calling / Executive / Backend.
  const allTeams = [
    { key: 'CALLING', label: 'Calling Team', icon: '📞', color: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700' },
    { key: 'EXECUTIVE', label: 'Executive Team', icon: '👔', color: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700' },
    { key: 'BACKEND', label: 'Backend Team', icon: '⚙️', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700' },
    { key: 'ACCOUNTING', label: 'Accounts Team', icon: '💰', color: 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-700' },
    { key: 'MARKETING', label: 'Marketing Team', icon: '📢', color: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 text-cyan-700' },
    { key: 'SHOP', label: 'Shop Employee', icon: '🏪', color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 text-indigo-700' },
  ];
  // Employees can only forward to Calling / Executive / Backend, and never back to
  // their own team (e.g. a Calling-team employee sees only Executive & Backend).
  const teams = allTeams
    .filter(t => (restrictTeams ? ['CALLING', 'EXECUTIVE', 'BACKEND'].includes(t.key) : true))
    .filter(t => t.key !== excludeTeam);

  // If the currently-selected team isn't available (e.g. it's the excluded own
  // team), snap the selection to the first available team when the modal opens.
  useEffect(() => {
    if (isOpen && teams.length > 0 && !teams.some(t => t.key === selectedTeam)) {
      setSelectedTeam(teams[0].key as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (prevTeamRef.current === selectedTeam) return;
    prevTeamRef.current = selectedTeam;
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await apiFetch(`/api/employees?team=${selectedTeam}`);
        const data = await res.json();
        setEmployees(data.employees || []);
        setSelectedEmployee(null);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        setEmployees([]);
      } finally { setLoadingEmployees(false); }
    };
    fetchEmployees();
  }, [selectedTeam, isOpen, apiFetch]);

  useEffect(() => { if (!isOpen) prevTeamRef.current = ''; }, [isOpen]);

  const handleSend = () => {
    const employeeId = assignToEmployee ? selectedEmployee : null;
    onSend(leadId, selectedTeam, employeeId, forwardReason);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-slate-800">Forward Lead</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button></div>
        <p className="text-sm font-medium text-slate-700 mb-3">Select Team:</p>
        <div className="grid gap-2 mb-4">
          {teams.map((t) => (
            <button key={t.key} onClick={() => { setSelectedTeam(t.key as any); setAssignToEmployee(false); setSelectedEmployee(null); setForwardReason(''); }} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${selectedTeam === t.key ? t.color + ' border-opacity-100 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              <span className="text-xl">{t.icon}</span><span className="font-medium">{t.label}</span>{selectedTeam === t.key && <div className="ml-auto w-2 h-2 rounded-full bg-current" />}
            </button>
          ))}
        </div>
        <div className="mb-4"><label className="block text-sm font-medium text-slate-600 mb-2">Forward Reason *</label><select value={forwardReason} onChange={(e) => setForwardReason(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" required>{reasonOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
        <div className="flex items-center gap-2 mb-3 p-3 bg-slate-50 rounded-lg"><input type="checkbox" id="assignEmployee" checked={assignToEmployee} onChange={(e) => { setAssignToEmployee(e.target.checked); setSelectedEmployee(null); }} className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500" /><label htmlFor="assignEmployee" className="text-sm font-medium text-slate-700 flex items-center gap-2"><User className="w-4 h-4" /> Assign to specific employee</label></div>
        {assignToEmployee && (
          <div className="mb-4"><label className="block text-sm font-medium text-slate-600 mb-2">Select Employee:</label>{loadingEmployees ? (<div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading employees...</div>) : employees.length === 0 ? (<p className="text-sm text-slate-400 italic">No employees found in {selectedTeam} team</p>) : (<select value={selectedEmployee || ''} onChange={(e) => setSelectedEmployee(e.target.value || null)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"><option value="">-- Select Employee --</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.email})</option>)}</select>)}</div>
        )}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSend} disabled={(assignToEmployee && !selectedEmployee) || !forwardReason} className="px-5 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Send className="w-4 h-4" />{assignToEmployee && selectedEmployee ? 'Assign to Employee' : assignToEmployee ? 'Select Employee' : `Forward to ${selectedTeam} Team`}</button>
        </div>
      </div>
    </BaseModal>
  );
};

// ==================== MAIN LEADS TABLE COMPONENT ====================
interface LeadsTableProps { transitLevel: string; title: string; columns?: Column[]; showAddButton?: boolean; onSendToBackend?: (leadId: string) => void; filterFn?: (lead: Lead) => boolean; exportRows?: (leads: Lead[]) => Record<string, any>[]; exportSheetName?: string; exportFileName?: string; }
export default function LeadsTable({ transitLevel, title, columns: customColumns, showAddButton = true, filterFn, exportRows, exportSheetName, exportFileName }: LeadsTableProps) {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownData>({ cities: [], areas: [], leadStatuses: [], agreementStatuses: [], backOfficeStatuses: [], executives: [], clientTypes: [] });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  const today = new Date().toISOString().split('T')[0];

  // Filter states
  const [executiveSearch, setExecutiveSearch] = useState('');
  // Calling dashboard: keep only the common filters visible, tuck the rest behind a toggle.
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  // Default to empty so NO date filter is applied on load — the table shows all
  // data until the user picks a date range and clicks Apply. (Previously these
  // defaulted to `today`, which silently filtered every dashboard to today's rows.)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterOn, setFilterOn] = useState('Created Date');
  const [appointmentFromDate, setAppointmentFromDate] = useState('');
  const [appointmentToDate, setAppointmentToDate] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');
  const [clientType, setClientType] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [assignedEmployeeFilter, setAssignedEmployeeFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [nextFollowUpFromDate, setNextFollowUpFromDate] = useState('');
  const [nextFollowUpToDate, setNextFollowUpToDate] = useState('');
  const [lastFollowUpFromDate, setLastFollowUpFromDate] = useState('');
  const [lastFollowUpToDate, setLastFollowUpToDate] = useState('');
  const [visitCount, setVisitCount] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areaText, setAreaText] = useState('');
  const [tokenNumber, setTokenNumber] = useState('');
  const [searchText, setSearchText] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [tenantName, setTenantName] = useState('');
  // Backend team: single field that searches Owner OR Tenant name (merged filter).
  const [ownerTenantName, setOwnerTenantName] = useState('');
  const [agreementStatus, setAgreementStatus] = useState('');
  const [backOfficeStatus, setBackOfficeStatus] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [dhcNo, setDhcNo] = useState('');
  const [commissionDate, setCommissionDate] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [executeDate, setExecuteDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerDob, setOwnerDob] = useState('');
  const [tenantMobile, setTenantMobile] = useState('');
  const [tenantDob, setTenantDob] = useState('');

  const [viewModal, setViewModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [sendModal, setSendModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  // Calling team: switch between the "Leads" list and forwarded "Appointments".
  const [callingView, setCallingView] = useState<'leads' | 'appointments'>('leads');
  // Calling team: live count of leads created today and appointments booked for today,
  // shown as quick-summary buttons above the Lead / Appointment tabs.
  const [todayCounts, setTodayCounts] = useState<{ leads: number; appointments: number }>({ leads: 0, appointments: 0 });
  // Calling team: when on, the Appointments view shows only PENDING appointments.
  const [pendingApptOnly, setPendingApptOnly] = useState(false);
  // Calling team: count of PENDING appointments (leads tagged with the pending colour),
  // shown as a round badge on the "Pending Appointment" button.
  const [pendingApptCount, setPendingApptCount] = useState(0);
  // Backend team: All Work / Submitted / Completed buckets.
  const [backendView, setBackendView] = useState<'all' | 'submitted' | 'completed'>('all');
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  // Accounting / appointment list: sort by appointment date (ascending / descending).
  const [appointmentSort, setAppointmentSort] = useState<'none' | 'asc' | 'desc'>('none');
  // Query from the header's global search — matching rows float to the top of the table.
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    const handler = (e: Event) => setGlobalSearch((e as CustomEvent).detail || '');
    window.addEventListener('global-lead-search', handler);
    return () => window.removeEventListener('global-lead-search', handler);
  }, []);

  const canExport = Array.isArray(user?.roles) && (user?.roles?.includes('ADMIN') || user?.roles?.includes('ACCOUNTING') || user?.roles?.includes('admin') || user?.roles?.includes('accounting'));
  const isAdmin = Array.isArray(user?.roles) && (user?.roles?.includes('ADMIN') || user?.roles?.includes('admin'));
  const isMarketingDashboard = transitLevel === 'MARKETING' || transitLevel === 'MARKETING_TEAM';
  const isExecutiveDashboard = transitLevel === 'EXECUTIVE' || transitLevel === 'EXECUTIVE_TEAM';
  const isCallingDashboard = transitLevel === 'CALLING' || transitLevel === 'CALLING_TEAM';
  const isBackendDashboard = transitLevel === 'BACKEND' || transitLevel === 'BACKEND_TEAM';
  const isAccountingDashboard = transitLevel === 'ACCOUNTING' || transitLevel === 'ALL';
  const isShopDashboard = transitLevel === 'SHOP' || transitLevel === 'SHOP_TEAM';

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch('/api/employees');
        const data = await res.json();
        setAvailableEmployees(data.employees || []);
      } catch (error) { console.error('Failed to fetch employees for filter:', error); }
    })();
  }, [user, apiFetch]);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const res = await apiFetch('/api/dropdowns', { method: 'POST' });
        const data = await res.json();
        setDropdowns({ cities: data?.cities || [], areas: data?.areas || [], leadStatuses: data?.leadStatuses || [], agreementStatuses: data?.agreementStatuses || [], backOfficeStatuses: data?.backOfficeStatuses || [], executives: data?.executives || [], clientTypes: data?.clientTypes || [] });
      } catch { console.error('Failed to fetch dropdowns'); }
    })();
  }, [authLoading, user]);

  const getColumnsForDashboard = (): Column[] => {
    if (customColumns) return customColumns;
    if (isCallingDashboard) {
      return [
        { key: 'leadDate', label: 'Lead Date', width: '120px', render: (lead) => formatDate(lead.leadDate || lead.createdDate) },
        { key: 'name', label: 'Name', width: '180px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
        { key: 'clientType', label: 'Client Type', width: '100px', render: (lead) => lead.client?.clientType || '-' },
        { key: 'contactNo', label: 'Contact No', width: '130px', render: (lead) => lead.client?.phoneNo || '-' },
        { key: 'leadStatus', label: 'Lead Status', width: '120px', render: (lead) => getStatusBadge(lead.leadStatus) },
        { key: 'leadSource', label: 'Lead Source', width: '120px', render: (lead) => lead.leadSource || '-' },
        { key: 'area', label: 'Area', width: '140px', render: (lead) => lead.client?.areaName || lead.area?.name || '-' },
        { key: 'lastFollowUp', label: 'Last Follow Up', width: '120px', render: (lead) => formatDate(lead.lastFollowUpDate) },
        { key: 'nextFollowUp', label: 'Next Follow Up', width: '120px', render: (lead) => formatDate(lead.nextFollowUpDate) },
      ];
    }
    if (isExecutiveDashboard) {
      return [
        { key: 'leadDate', label: 'Lead Date', width: '120px', render: (lead) => formatDate(lead.leadDate || lead.createdDate) },
        { key: 'name', label: 'Name', width: '180px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
        { key: 'clientType', label: 'Client Type', width: '100px', render: (lead) => lead.client?.clientType || '-' },
        { key: 'contactNo', label: 'Contact No', width: '130px', render: (lead) => lead.client?.phoneNo || '-' },
        { key: 'leadStatus', label: 'Lead Status', width: '120px', render: (lead) => getStatusBadge(lead.leadStatus) },
        { key: 'leadSource', label: 'Lead Source', width: '120px', render: (lead) => lead.leadSource || '-' },
        { key: 'area', label: 'Area', width: '140px', render: (lead) => lead.client?.areaName || lead.area?.name || '-' },
        { key: 'lastFollowUp', label: 'Last Follow Up', width: '120px', render: (lead) => formatDate(lead.lastFollowUpDate) },
        { key: 'nextFollowUp', label: 'Next Follow Up', width: '120px', render: (lead) => formatDate(lead.nextFollowUpDate) },
      ];
    }
    if (isBackendDashboard) {
      return [
        { key: 'name', label: 'Name', width: '160px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
        { key: 'ownerName', label: 'Owner Name', width: '160px', render: (lead) => `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-' },
        { key: 'tenantName', label: 'Tenant Name', width: '160px', render: (lead) => `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-' },
        { key: 'tokenNumber', label: 'Token Number', width: '130px', render: (lead) => lead.agreement?.tokenNo || '-' },
        { key: 'agreementStatus', label: 'Agreement Status', width: '130px', render: (lead) => getStatusBadge(lead.agreement?.status) },
        { key: 'backOfficeStatus', label: 'Back Office Status', width: '140px', render: (lead) => getStatusBadge(lead.agreement?.backOfficeStatus) },
        { key: 'grnNo', label: 'GRN No', width: '120px', render: (lead) => lead.payment?.grnNumber || '-' },
        { key: 'dhcNo', label: 'DHC No', width: '120px', render: (lead) => lead.payment?.dhcNumber || '-' },
        { key: 'commissionDate', label: 'Commission Date', width: '120px', render: (lead) => formatDate(lead.payment?.commissionDate) },
      ];
    }
    if (isAccountingDashboard) {
      return [
        { key: 'tokenNumber', label: 'Token Number', width: '130px', render: (lead) => lead.agreement?.tokenNo || '-' },
        { key: 'clientName', label: 'Client Name', width: '180px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
        { key: 'phone', label: 'Phone', width: '130px', render: (lead) => lead.client?.phoneNo || '-' },
        { key: 'totalAmount', label: 'Total Amount', width: '120px', render: (lead) => formatCurrency(lead.payment?.totalAmount) },
        { key: 'paidAmount', label: 'Paid Amount', width: '120px', render: (lead) => formatCurrency(lead.payment?.paidAmount) },
        { key: 'pendingAmount', label: 'Pending Amount', width: '120px', render: (lead) => formatCurrency(lead.payment?.pendingAmount || lead.payment?.outstandingAmount) },
        { key: 'paymentDate', label: 'Date', width: '120px', render: (lead) => { const date = lead.paymentDetails?.[0]?.paymentDate; return formatDate(date); } },
        { key: 'status', label: 'Status', width: '120px', render: (lead) => getStatusBadge(lead.agreement?.status || lead.leadStatus) },
        { key: 'commissionAmount', label: 'Commission Amt', width: '120px', render: (lead) => formatCurrency(lead.payment?.commissionAmount) },
        { key: 'grnNo', label: 'GRN No.', width: '110px', render: (lead) => lead.payment?.grnNumber || '-' },
        { key: 'dhcNo', label: 'DHC No.', width: '110px', render: (lead) => lead.payment?.dhcNumber || '-' },
        { key: 'actions', label: 'Actions', width: '100px', render: (lead) => (
          <button onClick={(e) => { e.stopPropagation(); setEditLead(lead); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
        )},
      ];
    }
    if (isMarketingDashboard) {
      return [
        { key: 'tokenNumber', label: 'Token Number', width: '130px', render: (lead) => lead.agreement?.tokenNo || '-' },
        { key: 'executeDate', label: 'Execute Date', width: '120px', render: (lead) => formatDate(lead.agreement?.executeDate) },
        { key: 'ownerName', label: 'Owner Name', width: '150px', render: (lead) => `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-' },
        { key: 'ownerMobile', label: 'Mobile Number', width: '130px', render: (lead) => lead.agreement?.owner?.phoneNo || '-' },
        { key: 'ownerDob', label: 'Birth Date Owner', width: '120px', render: (lead) => formatDate(lead.agreement?.owner?.birthDate || lead.agreement?.owner?.dateOfBirth) },
        { key: 'startDate', label: 'Starting Date', width: '120px', render: (lead) => formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate) },
        { key: 'endDate', label: 'Ending Date', width: '120px', render: (lead) => formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate) },
        { key: 'tenantName', label: 'Tenant Name', width: '150px', render: (lead) => `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-' },
        { key: 'tenantMobile', label: 'Mobile Number', width: '130px', render: (lead) => lead.agreement?.tenant?.phoneNo || '-' },
        { key: 'tenantDob', label: 'Birth Date Tenant', width: '130px', render: (lead) => formatDate(lead.agreement?.tenant?.birthDate || lead.agreement?.tenant?.dateOfBirth) },
        { key: 'viewAll', label: 'View All Old Information', width: '180px', render: (lead) => (<button onClick={(e) => { e.stopPropagation(); setViewModal({ isOpen: true, leadId: lead.id }); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#00843d] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"><Eye className="w-3.5 h-3.5" /> View Details</button>) },
        { key: 'adminDownload', label: 'Download', width: '100px', render: (lead) => { return isAdmin ? (<button onClick={(e) => { e.stopPropagation(); handleExportSingleLead(lead); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"><FileDown className="w-3.5 h-3.5" /> Download</button>) : (<span className="text-xs text-slate-400 italic">Admin Only</span>); } },
      ];
    }
    return [
      { key: 'tokenNumber', label: 'Token No', width: '120px', render: (lead) => lead.agreement?.tokenNo || '-' },
      { key: 'name', label: 'Name', width: '180px', render: (lead) => `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-' },
      { key: 'clientType', label: 'Type', width: '90px', render: (lead) => lead.client?.clientType || '-' },
      { key: 'phone', label: 'Phone', width: '130px', render: (lead) => lead.client?.phoneNo || '-' },
      { key: 'status', label: 'Status', width: '120px', render: (lead) => getStatusBadge(lead.leadStatus) },
      { key: 'area', label: 'Area', width: '140px', render: (lead) => lead.client?.areaName || '-' },
      { key: 'createdDate', label: 'Created', width: '110px', render: (lead) => formatDate(lead.createdDate) },
      { key: 'assignedTo', label: 'Assigned To', width: '140px', render: (lead) => lead.assignedToUserName || 'Team Only' },
    ];
  };
  let columns = getColumnsForDashboard();

  // Calling team Lead view: SV Name / No / Location belong to the Appointment view
  // only. In the Lead view, collapse those columns into Last Followup / Next
  // Followup date columns.
  if (isCallingDashboard && callingView === 'leads') {
    const svKeys = ['svName', 'svNo', 'svLocation'];
    const svIndex = columns.findIndex((c) => svKeys.includes(c.key));
    const withoutSv = columns.filter((c) => !svKeys.includes(c.key));
    if (svIndex >= 0) {
      // Last Followup column shows the lead's most recent follow-up date.
      const lastFollowupCol: Column = {
        key: 'lastFollowup',
        label: 'Last Followup',
        width: '130px',
        render: (lead) => (
          <span className="text-sm text-slate-700">{formatDate(lead.lastFollowUpDate)}</span>
        ),
      };
      // Next Followup column shows the lead's Next FollowUp Date (entered on the
      // new-lead form) — date only.
      const nextForwardCol: Column = {
        key: 'nextForward',
        label: 'Next Followup',
        width: '130px',
        render: (lead) => (
          <span className="text-sm text-slate-700">{formatDate(lead.nextFollowUpDate)}</span>
        ),
      };
      const insertAt = Math.min(svIndex, withoutSv.length);
      withoutSv.splice(insertAt, 0, lastFollowupCol, nextForwardCol);
    }
    columns = withoutSv;
  }

  const fetchLeads = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      // When the "Pending Appointment" filter is on, pull ALL appointment leads in one
      // page (instead of 20/page) so every pending appointment is shown together.
      const showAllPending = isCallingDashboard && callingView === 'appointments' && pendingApptOnly;
      const effectivePageSize = showAllPending ? 1000 : pageSize;
      const params = new URLSearchParams({ page: showAllPending ? '0' : page.toString(), pageSize: effectivePageSize.toString(), transitLevel });
      if (isCallingDashboard) {
        if (callingView === 'appointments') {
          // Appointments tab: pull ALL appointment leads (server-filtered), not just
          // ones created today — otherwise an appointment booked on an earlier day
          // disappears once the date rolls over (default Created Date range = today).
          params.set('isAppointment', 'true');
        } else {
          // Leads tab: exclude leads that were forwarded to Appointments so the
          // server count/pagination matches the list the user actually sees.
          params.set('isAppointment', 'false');
          if (fromDate) params.set('fromDate', fromDate);
          if (toDate) params.set('toDate', toDate);
          if (filterOn) params.set('filterOn', filterOn);
        }
        if (appointmentFromDate) params.set('appointmentFromDate', appointmentFromDate);
        if (appointmentToDate) params.set('appointmentToDate', appointmentToDate);
        if (appointmentLocation) params.set('appointmentLocation', appointmentLocation);
        if (clientType) params.set('clientType', clientType);
        if (assignedEmployeeFilter) params.set('assignedToUserId', assignedEmployeeFilter);
        // Lead Status dropdown is populated from leadStatuses, so it must filter the
        // lead's own status field — not agreement.status (which the `status` param maps to).
        if (selectedStatus) params.set('leadStatus', selectedStatus);
        if (mobileFilter) params.set('mobile', mobileFilter);
        if (nextFollowUpFromDate) params.set('nextFollowUpFromDate', nextFollowUpFromDate);
        if (nextFollowUpToDate) params.set('nextFollowUpToDate', nextFollowUpToDate);
        if (lastFollowUpFromDate) params.set('lastFollowUpFromDate', lastFollowUpFromDate);
        if (lastFollowUpToDate) params.set('lastFollowUpToDate', lastFollowUpToDate);
        if (visitCount) params.set('visitCount', visitCount);
        if (selectedCity) params.set('cityId', selectedCity);
        if (selectedArea) params.set('areaId', selectedArea);
        if (areaText) params.set('areaText', areaText);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (clientName) params.set('clientName', clientName);
        if (searchText) params.set('searchText', searchText);
      }
      if (isShopDashboard) {
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (clientType) params.set('clientType', clientType);
        if (selectedStatus) params.set('leadStatus', selectedStatus);
        if (mobileFilter) params.set('mobile', mobileFilter);
        if (selectedCity) params.set('cityId', selectedCity);
        if (selectedArea) params.set('areaId', selectedArea);
        if (areaText) params.set('areaText', areaText);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (searchText) params.set('searchText', searchText);
      }
      if (isExecutiveDashboard && executiveSearch) params.set('searchText', executiveSearch);
      if (isBackendDashboard) {
        if (ownerTenantName) params.set('ownerTenantName', ownerTenantName);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (agreementStatus) params.set('agreementStatus', agreementStatus);
        if (backOfficeStatus) params.set('backOfficeStatus', backOfficeStatus);
        if (grnNo) params.set('grnNo', grnNo);
        if (dhcNo) params.set('dhcNo', dhcNo);
        if (commissionAmount) params.set('commissionAmount', commissionAmount);
        if (assignedEmployeeFilter) params.set('assignedToUserId', assignedEmployeeFilter);
      }
      if (isAccountingDashboard) {
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (clientName) params.set('clientName', clientName);
        if (phone) params.set('phone', phone);
        if (amount) params.set('amount', amount);
        if (status) params.set('status', status);
        if (paymentDate) params.set('paymentDate', paymentDate);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (ownerName) params.set('ownerName', ownerName);
        if (tenantName) params.set('tenantName', tenantName);
        if (mobileFilter) params.set('mobile', mobileFilter);
        if (searchText) params.set('searchText', searchText);
      }
      if (isMarketingDashboard) {
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (executeDate) params.set('executeDate', executeDate);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (ownerName) params.set('ownerName', ownerName);
        if (ownerMobile) params.set('ownerMobile', ownerMobile);
        if (ownerDob) params.set('ownerDob', ownerDob);
        if (tenantName) params.set('tenantName', tenantName);
        if (tenantMobile) params.set('tenantMobile', tenantMobile);
        if (tenantDob) params.set('tenantDob', tenantDob);
      }
      const res = await apiFetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data?.leadPage?.content || []);
      setTotalPages(data?.leadPage?.totalPages || 1);
    } catch (error) {
      console.error('Fetch leads error:', error);
      setLeads([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, transitLevel, fromDate, toDate, filterOn, executiveSearch, appointmentFromDate, appointmentToDate, appointmentLocation, clientType, mobileFilter, assignedEmployeeFilter, selectedStatus, nextFollowUpFromDate, nextFollowUpToDate, lastFollowUpFromDate, lastFollowUpToDate, visitCount, selectedCity, selectedArea, areaText, tokenNumber, searchText, ownerName, tenantName, ownerTenantName, agreementStatus, backOfficeStatus, grnNo, dhcNo, commissionDate, commissionAmount, clientName, phone, amount, status, paymentDate, executeDate, startDate, endDate, ownerMobile, ownerDob, tenantMobile, tenantDob, authLoading, user, callingView, pendingApptOnly, isCallingDashboard, isExecutiveDashboard, isBackendDashboard, isAccountingDashboard, isMarketingDashboard, isShopDashboard]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Calling team: fetch today's lead + appointment counts for the summary buttons.
  // Runs independently of the main table (which shows only one view at a time) so
  // both numbers stay accurate regardless of the active tab or filters. Re-runs
  // whenever the table reloads so the counts stay in sync after forwards/edits.
  useEffect(() => {
    if (!isCallingDashboard || authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const leadsParams = new URLSearchParams({ transitLevel, page: '0', pageSize: '1', fromDate: today, toDate: today, filterOn: 'Created Date', isAppointment: 'false' });
        const apptParams = new URLSearchParams({ transitLevel, page: '0', pageSize: '1', isAppointment: 'true', appointmentFromDate: today, appointmentToDate: today });
        // Pending Appointment = ALL appointment leads (every date), so no date filter.
        const allApptParams = new URLSearchParams({ transitLevel, page: '0', pageSize: '1', isAppointment: 'true' });
        const [leadsRes, apptRes, allApptRes] = await Promise.all([
          apiFetch(`/api/leads?${leadsParams.toString()}`),
          apiFetch(`/api/leads?${apptParams.toString()}`),
          apiFetch(`/api/leads?${allApptParams.toString()}`),
        ]);
        const [leadsData, apptData, allApptData] = await Promise.all([leadsRes.json(), apptRes.json(), allApptRes.json()]);
        if (cancelled) return;
        setTodayCounts({
          leads: leadsData?.leadPage?.totalElements || 0,
          appointments: apptData?.leadPage?.totalElements || 0,
        });
        // Total of all appointment leads (across every date) — shown on the button badge.
        setPendingApptCount(allApptData?.leadPage?.totalElements || 0);
      } catch (error) {
        if (!cancelled) console.error('Failed to fetch today counts:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [isCallingDashboard, authLoading, user, transitLevel, today, apiFetch, leads]);

  const handleApplyFilters = () => setPage(0);
  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setFilterOn('Created Date');
    setAppointmentFromDate('');
    setAppointmentToDate('');
    setAppointmentLocation('');
    setClientType('');
    setMobileFilter('');
    setAssignedEmployeeFilter('');
    setSelectedStatus('');
    setNextFollowUpFromDate('');
    setNextFollowUpToDate('');
    setLastFollowUpFromDate('');
    setLastFollowUpToDate('');
    setVisitCount('');
    setSelectedCity('');
    setSelectedArea('');
    setAreaText('');
    setTokenNumber('');
    setSearchText('');
    setExecutiveSearch('');
    setOwnerName('');
    setTenantName('');
    setOwnerTenantName('');
    setAgreementStatus('');
    setBackOfficeStatus('');
    setGrnNo('');
    setDhcNo('');
    setCommissionDate('');
    setCommissionAmount('');
    setClientName('');
    setPhone('');
    setAmount('');
    setStatus('');
    setPaymentDate('');
    setExecuteDate('');
    setStartDate('');
    setEndDate('');
    setOwnerMobile('');
    setOwnerDob('');
    setTenantMobile('');
    setTenantDob('');
    setPage(0);
  };

  const handleSendToTeam = async (leadId: string, team: string, assignedToUserId?: string | null, reason?: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}/assign-team`, { method: 'POST', body: JSON.stringify({ team, assignedToUserId, reason, keepVisibleToSource: true }) });
      alert(assignedToUserId ? 'Lead successfully assigned to employee.' : `Lead successfully forwarded to ${team} team.`);
      fetchLeads();
    } catch { alert('Failed to forward lead. Please try again.'); } finally { setSendModal({ isOpen: false, leadId: '' }); }
  };

  const handleCancelLead = async () => {
    if (!cancelReason.trim()) { alert('Please provide a cancellation reason.'); return; }
    try {
      await apiFetch('/api/leads', { method: 'PUT', body: JSON.stringify({ id: cancelModal.leadId, leadStatus: 'CANCELLED', cancellationReason: cancelReason }) });
      alert('Lead cancelled successfully.');
      fetchLeads();
    } catch { alert('Failed to cancel lead.'); } finally { setCancelModal({ isOpen: false, leadId: '' }); setCancelReason(''); }
  };

  // Calling team: forward a lead into the Appointments view (and back).
  const handleToggleAppointment = async (leadId: string, makeAppointment: boolean) => {
    setForwardingId(leadId);
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id: leadId, isAppointment: makeAppointment }),
      });
      if (!res.ok) throw new Error('Update failed');
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, isAppointment: makeAppointment } : l)));
      alert(makeAppointment ? 'Lead forwarded to Appointment.' : 'Moved back to Leads.');
    } catch {
      alert('Failed to update appointment. Please try again.');
    } finally {
      setForwardingId(null);
    }
  };

  // Backend team: forward / reforward a lead between All Work → Submitted → Completed.
  // `status` is '' (All Work), 'SUBMITTED' or 'COMPLETED'.
  const handleBackendStatus = async (leadId: string, status: string) => {
    setForwardingId(leadId);
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id: leadId, backendStatus: status }),
      });
      if (!res.ok) throw new Error('Update failed');
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, backendStatus: status } : l)));
    } catch {
      alert('Failed to update backend status. Please try again.');
    } finally {
      setForwardingId(null);
    }
  };

  // Backend team: tag a lead's row with a highlight colour ('' clears it).
  const handleRowColor = async (leadId: string, color: string) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, rowColor: color } : l)));
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id: leadId, rowColor: color }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch {
      alert('Failed to update row colour. Please try again.');
    }
  };

  // ✅ KEY FIX: Update lead in local state instead of refetching the entire list.
  // This prevents leads from disappearing when date filters are active and a lead's
  // date doesn't match the current filter range after saving.
  const handleSaveLeadEdit = async (leadId: string, updatedData: Partial<Lead>) => {
    const res = await apiFetch('/api/leads', { method: 'PUT', body: JSON.stringify({ id: leadId, ...updatedData }) });
    if (!res.ok) throw new Error('Save failed');
    // Fetch only the updated lead and patch it into local state
    const refreshed = await apiFetch(`/api/leads?id=${leadId}`);
    if (refreshed.ok) {
      const updatedLead = await refreshed.json();
      setLeads(prev => prev.map(l => l.id === leadId ? { ...updatedLead, id: leadId } : l));
    } else {
      // Fallback: patch with what we sent if re-fetch fails
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updatedData } : l));
    }
  };

  // ✅ Handler for when ViewLeadModal's internal edit saves successfully
  const handleLeadUpdatedFromView = (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  const handleExportExcel = () => {
    if (leads.length === 0) return alert('No data to export.');

    // Caller-supplied export (e.g. Accounts team's fixed 12-column report).
    if (exportRows) {
      const rows = exportRows(leads);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, exportSheetName || 'Report');
      XLSX.writeFile(wb, `${exportFileName || 'Report'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const exportData: any[] = [];
    exportData.push({ 'Token Number': '', 'Our Fees': '', 'Commission': '', 'Total Amount': '', 'Payment Date': '', 'Payment Amount': '', 'Mode': '', 'Party Name': '', 'Transaction No.': '', 'Total Received': '', 'GRN Date': '', 'GRN Number': '', 'GRN Amount': '', 'DHC Date': '', 'DHC Number': '', 'DHC Amount': '', 'Commission Date': '', 'Commission Name': '', 'Commission Amount': '' });
    leads.forEach((lead) => {
      const ownerPayments = lead.paymentDetails?.filter(p => p.clientType === 'OWNER') || [];
      if (ownerPayments.length > 0) {
        ownerPayments.forEach((p, idx) => { exportData.push({ 'Token Number': idx === 0 ? (lead.agreement?.tokenNo || '-') : '', 'Our Fees': idx === 0 ? formatCurrency(lead.payment?.ourFees) : '', 'Commission': idx === 0 ? formatCurrency(lead.payment?.commission) : '', 'Total Amount': idx === 0 ? formatCurrency(lead.payment?.totalAmount) : '', 'Payment Date': formatDate(p.paymentDate), 'Payment Amount': formatCurrency(p.paymentAmount), 'Mode': p.modeOfPayment || '-', 'Party Name': p.payerName || '-', 'Transaction No.': p.transactionNumber || '-', 'Total Received': idx === 0 ? formatCurrency(lead.payment?.totalReceivedAmount) : '', 'GRN Date': idx === 0 ? formatDate(lead.payment?.govtGrnDate) : '', 'GRN Number': idx === 0 ? (lead.payment?.grnNumber || '-') : '', 'GRN Amount': idx === 0 ? formatCurrency(lead.payment?.grnAmount) : '', 'DHC Date': idx === 0 ? formatDate(lead.payment?.dhcDate) : '', 'DHC Number': idx === 0 ? (lead.payment?.dhcNumber || '-') : '', 'DHC Amount': idx === 0 ? formatCurrency(lead.payment?.dhcAmount) : '', 'Commission Date': idx === 0 ? formatDate(lead.payment?.commissionDate) : '', 'Commission Name': idx === 0 ? (lead.payment?.commissionName || '-') : '', 'Commission Amount': idx === 0 ? formatCurrency(lead.payment?.commissionAmount) : '' }); });
      } else { exportData.push({ 'Token Number': lead.agreement?.tokenNo || '-', 'Our Fees': formatCurrency(lead.payment?.ourFees), 'Commission': formatCurrency(lead.payment?.commission), 'Total Amount': formatCurrency(lead.payment?.totalAmount), 'Payment Date': '-', 'Payment Amount': '-', 'Mode': '-', 'Party Name': '-', 'Transaction No.': '-', 'Total Received': formatCurrency(lead.payment?.totalReceivedAmount), 'GRN Date': formatDate(lead.payment?.govtGrnDate), 'GRN Number': lead.payment?.grnNumber || '-', 'GRN Amount': formatCurrency(lead.payment?.grnAmount), 'DHC Date': formatDate(lead.payment?.dhcDate), 'DHC Number': lead.payment?.dhcNumber || '-', 'DHC Amount': formatCurrency(lead.payment?.dhcAmount), 'Commission Date': formatDate(lead.payment?.commissionDate), 'Commission Name': lead.payment?.commissionName || '-', 'Commission Amount': formatCurrency(lead.payment?.commissionAmount) }); }
      const tenantPayments = lead.paymentDetails?.filter(p => p.clientType === 'TENANT') || [];
      if (tenantPayments.length > 0) { tenantPayments.forEach((p) => { exportData.push({ 'Token Number': '', 'Our Fees': '', 'Commission': '', 'Total Amount': '', 'Payment Date': formatDate(p.paymentDate), 'Payment Amount': formatCurrency(p.paymentAmount), 'Mode': p.modeOfPayment || '-', 'Party Name': p.payerName || '-', 'Transaction No.': p.transactionNumber || '-', 'Total Received': '', 'GRN Date': '', 'GRN Number': '', 'GRN Amount': '', 'DHC Date': '', 'DHC Number': '', 'DHC Amount': '', 'Commission Date': '', 'Commission Name': '', 'Commission Amount': '' }); }); }
      exportData.push({});
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accounting Report');
    XLSX.writeFile(wb, `Accounting_Report_${transitLevel}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportSingleLead = (lead: Lead) => {
    const exportData = { 'Token Number': lead.agreement?.tokenNo || '-', 'Owner Name': `${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-', 'Owner Phone': lead.agreement?.owner?.phoneNo || '-', 'Owner DOB': formatDate(lead.agreement?.owner?.birthDate || lead.agreement?.owner?.dateOfBirth), 'Owner Email': lead.agreement?.owner?.email || '-', 'Owner Aadhar': lead.agreement?.owner?.aadharNumber || '-', 'Owner PAN': lead.agreement?.owner?.panNumber || '-', 'Tenant Name': `${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-', 'Tenant Phone': lead.agreement?.tenant?.phoneNo || '-', 'Tenant DOB': formatDate(lead.agreement?.tenant?.birthDate || lead.agreement?.tenant?.dateOfBirth), 'Tenant Email': lead.agreement?.tenant?.email || '-', 'Execute Date': formatDate(lead.agreement?.executeDate), 'Agreement Start': formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate), 'Agreement End': formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate), 'Address Line 1': lead.agreement?.addressLine1 || '-', 'Address Line 2': lead.agreement?.addressLine2 || '-', 'Agreement Status': lead.agreement?.status || '-', 'Back Office Status': lead.agreement?.backOfficeStatus || '-', 'GRN Number': lead.payment?.grnNumber || '-', 'GRN Amount': formatCurrency(lead.payment?.grnAmount), 'DHC Number': lead.payment?.dhcNumber || '-', 'DHC Amount': formatCurrency(lead.payment?.dhcAmount), 'Commission Name': lead.payment?.commissionName || '-', 'Commission Amount': formatCurrency(lead.payment?.commissionAmount), 'Commission Date': formatDate(lead.payment?.commissionDate), 'Total Amount': formatCurrency(lead.payment?.totalAmount), 'Paid Amount': formatCurrency(lead.payment?.paidAmount), 'Pending Amount': formatCurrency(lead.payment?.pendingAmount || lead.payment?.outstandingAmount) };
    const ws = XLSX.utils.json_to_sheet([exportData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Details');
    XLSX.writeFile(wb, `Lead_${lead.agreement?.tokenNo || lead.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderFilters = () => {
    if (isExecutiveDashboard) {
      return (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by name, phone, token..." value={executiveSearch} onChange={(e) => setExecutiveSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={handleApplyFilters} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Search</button>
          <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
        </div>
      );
    }
    if (isCallingDashboard) {
      return (
        <>
          {/* Common filters — always visible so leads stay near the top. */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number</label><input type="tel" placeholder="Search by mobile" value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Name</label><input type="text" placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token No.</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</label><select value={assignedEmployeeFilter} onChange={(e) => setAssignedEmployeeFilter(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All Employees</option>{availableEmployees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label><div className="relative"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label><div className="relative"><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Appointment From</label><input type="date" value={appointmentFromDate} onChange={(e) => setAppointmentFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Appointment To</label><input type="date" value={appointmentToDate} onChange={(e) => setAppointmentToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>

          {/* Toggle for the less-used filters. */}
          <button type="button" onClick={() => setShowMoreFilters((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 mb-4">
            <Filter className="w-4 h-4" /> {showMoreFilters ? 'Hide' : 'More'} Filters
          </button>

          {showMoreFilters && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Filter On</label><select value={filterOn} onChange={(e) => setFilterOn(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option>Created Date</option><option>Updated Date</option><option>Appointment Date</option><option>Agreement Date</option></select></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Location (Appointment)</label><input type="text" placeholder="e.g. Pune, Mumbai" value={appointmentLocation} onChange={(e) => setAppointmentLocation(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Visit Count</label><input type="number" placeholder="e.g. 1, 2, 3" value={visitCount} onChange={(e) => setVisitCount(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Client Type</label><select value={clientType} onChange={(e) => setClientType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option><option value="OWNER">Owner</option><option value="TENANT">Tenant</option><option value="AGENT">Agent</option></select></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Lead Status</label><select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All Status</option>{dropdowns.leadStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Area (Text)</label><input type="text" placeholder="e.g. Sector 45" value={areaText} onChange={(e) => setAreaText(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Next FollowUp From</label><input type="date" value={nextFollowUpFromDate} onChange={(e) => setNextFollowUpFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Next FollowUp To</label><input type="date" value={nextFollowUpToDate} onChange={(e) => setNextFollowUpToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Last FollowUp From</label><input type="date" value={lastFollowUpFromDate} onChange={(e) => setLastFollowUpFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Last FollowUp To</label><input type="date" value={lastFollowUpToDate} onChange={(e) => setLastFollowUpToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">City</label><select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">Select City</option>{dropdowns.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Area</label><select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">Select Area</option>{dropdowns.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Search</label><input type="text" placeholder="Search by name, phone, token..." value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={handleApplyFilters} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
            <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
            {canExport && (<button onClick={handleExportExcel} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"><Download className="w-4 h-4" /> Export</button>)}
          </div>
        </>
      );
    }
    if (isAccountingDashboard) {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Client Name</label><input type="text" placeholder="Search client" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</label><input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</label><input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{dropdowns.agreementStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token No.</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Owner Name</label><input type="text" placeholder="Search owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant Name</label><input type="text" placeholder="Search tenant" value={tenantName} onChange={(e) => setTenantName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number</label><input type="tel" placeholder="Search by mobile" value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={handleApplyFilters} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
            <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
            {canExport && (<button onClick={handleExportExcel} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"><Download className="w-4 h-4" /> Export Excel</button>)}
          </div>
        </>
      );
    }
    if (isBackendDashboard) {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Owner / Tenant Name</label><input type="text" placeholder="Search owner or tenant" value={ownerTenantName} onChange={(e) => setOwnerTenantName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token No.</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Agreement Status</label><select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{dropdowns.agreementStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Back Office Status</label><select value={backOfficeStatus} onChange={(e) => setBackOfficeStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{dropdowns.backOfficeStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">GRN No.</label><input type="text" placeholder="GRN number" value={grnNo} onChange={(e) => setGrnNo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">DHC No.</label><input type="text" placeholder="DHC number" value={dhcNo} onChange={(e) => setDhcNo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</label><select value={assignedEmployeeFilter} onChange={(e) => setAssignedEmployeeFilter(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{availableEmployees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}</select></div>
            <div className="col-span-1 md:col-span-3"></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={handleApplyFilters} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
            <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
          </div>
        </>
      );
    }
    if (isMarketingDashboard) {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token Number</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Execute Date</label><input type="date" value={executeDate} onChange={(e) => setExecuteDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Starting Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Ending Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Owner Name</label><input type="text" placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number (Owner)</label><input type="tel" placeholder="Mobile number" value={ownerMobile} onChange={(e) => setOwnerMobile(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Birth Date Owner</label><input type="date" value={ownerDob} onChange={(e) => setOwnerDob(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant Name</label><input type="text" placeholder="Tenant name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number (Tenant)</label><input type="tel" placeholder="Mobile number" value={tenantMobile} onChange={(e) => setTenantMobile(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Birth Date Tenant</label><input type="date" value={tenantDob} onChange={(e) => setTenantDob(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={handleApplyFilters} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
            <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
          </div>
        </>
      );
    }
    if (isShopDashboard) {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Client Type</label><select value={clientType} onChange={(e) => setClientType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option><option value="OWNER">Owner</option><option value="TENANT">Tenant</option><option value="AGENT">Agent</option></select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Lead Status</label><select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All Status</option>{dropdowns.leadStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number</label><input type="tel" placeholder="Search by mobile" value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">City</label><select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">Select City</option>{dropdowns.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Area</label><select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">Select Area</option>{dropdowns.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token No.</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end pt-2 border-t border-slate-100">
            <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search by name, phone, token..." value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleApplyFilters} className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
              <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
              {canExport && (<button onClick={handleExportExcel} className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"><Download className="w-4 h-4" /> Export</button>)}
            </div>
          </div>
        </>
      );
    }
    return null;
  };

  const shouldShowExtraColumns = !isMarketingDashboard;

  // Apply optional client-side filter (e.g. account team: only paid leads) and,
  // for the calling team, split between the Leads list and the Appointments list.
  let displayedLeads = leads;
  if (filterFn) displayedLeads = displayedLeads.filter(filterFn);
  if (isCallingDashboard) {
    displayedLeads = displayedLeads.filter((l) =>
      callingView === 'appointments' ? !!l.isAppointment : !l.isAppointment,
    );
    // "Pending Appointment" button: show ALL appointment leads (every date), not
    // just today's — the appointments filter above already keeps only appointments.
  }
  // Backend team: each bucket normally shows only its own leads. But when a filter/search
  // is active, we drop the bucket restriction so a match surfaces regardless of which tab
  // it lives in — e.g. searching from All Work still finds a Completed lead.
  const backendSearchActive = isBackendDashboard && (
    !!ownerTenantName || !!tokenNumber || !!agreementStatus || !!backOfficeStatus ||
    !!grnNo || !!dhcNo || !!commissionAmount || !!assignedEmployeeFilter || !!globalSearch.trim()
  );
  if (isBackendDashboard && !backendSearchActive) {
    displayedLeads = displayedLeads.filter((l) => {
      if (backendView === 'submitted') return l.backendStatus === 'SUBMITTED';
      if (backendView === 'completed') return l.backendStatus === 'COMPLETED';
      // All Work: only leads that haven't been moved to Submitted/Completed yet.
      return l.backendStatus !== 'SUBMITTED' && l.backendStatus !== 'COMPLETED';
    });
  }
  // Sort by date (ascending / descending) when requested. The backend team sorts by
  // Execute Date; every other dashboard sorts by Appointment date.
  if (appointmentSort !== 'none') {
    const sortDate = (l: Lead) => {
      const v = isBackendDashboard ? l.agreement?.executeDate : l.appointmentTime;
      return v ? new Date(v).getTime() : 0;
    };
    displayedLeads = [...displayedLeads].sort((a, b) =>
      appointmentSort === 'asc' ? sortDate(a) - sortDate(b) : sortDate(b) - sortDate(a),
    );
  }
  // Header global search: float matching leads to the top (keeps the rest below).
  if (globalSearch.trim()) {
    const matched = displayedLeads.filter((l) => leadMatchesGlobalSearch(l, globalSearch));
    const rest = displayedLeads.filter((l) => !leadMatchesGlobalSearch(l, globalSearch));
    displayedLeads = [...matched, ...rest];
  }

  return (
    <div className="space-y-6 font-sans text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold"><Filter className="w-5 h-5 text-amber-500" /><h2 className="text-lg">Filters</h2></div>
        {renderFilters()}
      </div>

      {showAddButton && transitLevel !== 'MARKETING' && transitLevel !== 'MARKETING_TEAM' && (
        <div className="flex justify-end">
          <Link href={`/leads/new?transitLevel=${transitLevel}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm"><Plus className="w-4 h-4" /> Add New Lead</Link>
        </div>
      )}

      {isCallingDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { setCallingView('leads'); setPendingApptOnly(false); setFromDate(today); setToDate(today); setFilterOn('Created Date'); setAppointmentFromDate(''); setAppointmentToDate(''); setPage(0); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#f0fdf4] border border-[#00843d]/30 text-[#00843d] rounded-lg text-sm font-medium hover:bg-[#dcfce7] transition-all shadow-sm"
          >
            <CalendarDays className="w-4 h-4" /> Today Lead
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-[#00843d] text-white text-xs font-semibold">{todayCounts.leads}</span>
          </button>
          <button
            type="button"
            onClick={() => { setCallingView('appointments'); setPendingApptOnly(false); setAppointmentFromDate(today); setAppointmentToDate(today); setPage(0); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-all shadow-sm"
          >
            <CalendarClock className="w-4 h-4" /> Today Appointment
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold">{todayCounts.appointments}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingApptOnly((prev) => {
                const next = !prev;
                if (next) {
                  // Show ALL appointments across every date: switch to the appointments
                  // view and clear any date range that "Today Appointment" may have set.
                  setCallingView('appointments');
                  setAppointmentFromDate('');
                  setAppointmentToDate('');
                  setPage(0);
                }
                return next;
              });
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm border ${
              pendingApptOnly
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-4 h-4" /> Pending Appointment
            <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-xs font-semibold ${pendingApptOnly ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'}`}>{pendingApptCount}</span>
          </button>
        </div>
      )}

      {isCallingDashboard && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {(['leads', 'appointments'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => {
                setCallingView(view);
                setPage(0);
                if (view === 'leads') {
                  // "Lead" tab = ALL leads, every date. Clear any date range a quick
                  // button (e.g. "Today Lead") may have set so nothing is auto-filtered.
                  setPendingApptOnly(false);
                  setFromDate('');
                  setToDate('');
                } else {
                  // "Appointment" tab = ALL appointments, every date.
                  setAppointmentFromDate('');
                  setAppointmentToDate('');
                }
              }}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                callingView === view ? 'bg-white text-[#00843d] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {view === 'leads' ? 'Lead' : 'Appointment'}
            </button>
          ))}
        </div>
      )}

      {isBackendDashboard && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {([['all', 'All Work'], ['submitted', 'Submitted'], ['completed', 'Completed']] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => setBackendView(view)}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                backendView === view ? 'bg-white text-[#00843d] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(isAccountingDashboard || isBackendDashboard || (isCallingDashboard && callingView === 'appointments')) && (
        <div className="flex items-center gap-2 text-sm">
          <ArrowUpDown className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-slate-600">{isBackendDashboard ? 'Sort by Execute Date:' : 'Sort by Appointment Date:'}</span>
          <select
            value={appointmentSort}
            onChange={(e) => setAppointmentSort(e.target.value as 'none' | 'asc' | 'desc')}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d] focus:border-transparent transition-all cursor-pointer"
          >
            <option value="none">Default</option>
            <option value="asc">Ascending (Oldest first)</option>
            <option value="desc">Descending (Newest first)</option>
          </select>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490] border-b border-[#00622d]">
              <tr>
                <th className="text-left px-4 py-3.5 font-semibold text-white whitespace-nowrap text-xs uppercase tracking-wider w-16">No.</th>
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3.5 font-semibold text-white whitespace-nowrap text-xs uppercase tracking-wider" style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                    {col.label}
                  </th>
                ))}
                {shouldShowExtraColumns && (
                  <>
                    <th className="text-left px-4 py-3.5 font-semibold text-white whitespace-nowrap text-xs uppercase tracking-wider w-36">Assigned To</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-white whitespace-nowrap text-xs uppercase tracking-wider w-28 sticky right-0 bg-[#0d9488] z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={1 + columns.length + (shouldShowExtraColumns ? 2 : 0)} className="text-center py-12 text-slate-400"><div className="flex flex-col items-center gap-3"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div><span>Loading leads...</span></div></td></tr>
              ) : displayedLeads.length === 0 ? (
                <tr><td colSpan={1 + columns.length + (shouldShowExtraColumns ? 2 : 0)} className="text-center py-12 text-slate-400">No records found matching your filters</td></tr>
              ) : (
                displayedLeads.map((lead, index) => {
                  // Backend colour tag: fill the whole row (including the sticky
                  // Actions cell) so the colour covers the entire lead.
                  const rowColor = (isBackendDashboard || (isCallingDashboard && callingView === 'appointments')) ? rowColorRowClass(lead.rowColor) : '';
                  // Continuous serial number across server-side pages (1-based).
                  const serialNo = page * pageSize + index + 1;
                  return (
                  <tr key={lead.id} className={`transition-colors ${rowColor || 'hover:bg-slate-50/80'}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap align-middle font-medium">{serialNo}</td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap align-middle truncate max-w-xs" title={typeof col.render?.(lead) === 'string' ? col.render?.(lead) as string : ''}>
                        {col.render ? col.render(lead) : '-'}
                      </td>
                    ))}
                    {shouldShowExtraColumns && (
                      <>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap align-middle">
                          {lead.assignedToUserName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                              <User className="w-3 h-3" /> {lead.assignedToUserName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Team Only</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 align-middle whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] ${rowColor || 'bg-white'}`}>
                          <div className="flex items-center gap-1">
                            {/* Backend Submitted/Completed: swap the view button for a downloadable files dropdown. */}
                            {isBackendDashboard && (backendView === 'submitted' || backendView === 'completed') ? (
                              <FilesDropdown lead={lead} />
                            ) : (
                              <button onClick={() => setViewModal({ isOpen: true, leadId: lead.id })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Complete Lead Details">
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {isBackendDashboard && (
                              <RowColorPicker current={lead.rowColor} onPick={(color) => handleRowColor(lead.id, color)} />
                            )}
                            <button onClick={() => setEditLead(lead)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Edit Lead">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => setSendModal({ isOpen: true, leadId: lead.id })} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Forward to Team/Employee">
                              <Send className="w-4 h-4" />
                            </button>
                            {isCallingDashboard && (
                              callingView === 'leads' ? (
                                <button
                                  onClick={() => handleToggleAppointment(lead.id, true)}
                                  disabled={forwardingId === lead.id}
                                  className="p-2 text-slate-400 hover:text-[#00843d] hover:bg-[#f0fdf4] rounded-lg transition-all disabled:opacity-40"
                                  title="Forward to Appointment"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleAppointment(lead.id, false)}
                                  disabled={forwardingId === lead.id}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40"
                                  title="Move back to Leads"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                                </button>
                              )
                            )}
                            {isCallingDashboard && callingView === 'appointments' && (
                              // Colour tag for appointments (same as the Backend team) so a
                              // lead can be highlighted with a row colour.
                              <RowColorPicker current={lead.rowColor} onPick={(color) => handleRowColor(lead.id, color)} />
                            )}
                            {isBackendDashboard && (
                              lead.backendStatus === 'COMPLETED' ? (
                                // Completed → can only go back to Submitted
                                <button
                                  onClick={() => handleBackendStatus(lead.id, 'SUBMITTED')}
                                  disabled={forwardingId === lead.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all disabled:opacity-40"
                                  title="Move this lead back to Submitted"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />} Submitted
                                </button>
                              ) : lead.backendStatus === 'SUBMITTED' ? (
                                // Submitted → forward to Completed, or back to All Work
                                <>
                                  <button
                                    onClick={() => handleBackendStatus(lead.id, '')}
                                    disabled={forwardingId === lead.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all disabled:opacity-40"
                                    title="Move this lead back to All Work"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" /> All Work
                                  </button>
                                  <button
                                    onClick={() => handleBackendStatus(lead.id, 'COMPLETED')}
                                    disabled={forwardingId === lead.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all disabled:opacity-40"
                                    title="Forward this lead to Completed"
                                  >
                                    {forwardingId === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Completed <ArrowRight className="w-3.5 h-3.5" /></>}
                                  </button>
                                </>
                              ) : (
                                // All Work → forward to Submitted
                                <button
                                  onClick={() => handleBackendStatus(lead.id, 'SUBMITTED')}
                                  disabled={forwardingId === lead.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all disabled:opacity-40"
                                  title="Forward this lead to Submitted"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Submitted <ArrowRight className="w-3.5 h-3.5" /></>}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">Showing page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* View modal now receives onLeadUpdated to patch local state */}
      <ViewLeadModal
        isOpen={viewModal.isOpen}
        leadId={viewModal.leadId}
        onClose={() => setViewModal({ isOpen: false, leadId: '' })}
        onEdit={setEditLead}
        onLeadUpdated={handleLeadUpdatedFromView}
        isAdmin={isAdmin}
        dropdowns={dropdowns}
        hideBackWorkAccount={isExecutiveDashboard}
      />
      <TeamSelectionModal isOpen={sendModal.isOpen} leadId={sendModal.leadId} onSend={handleSendToTeam} onClose={() => setSendModal({ isOpen: false, leadId: '' })} restrictTeams={!isAdmin} excludeTeam={!isAdmin && transitLevel && transitLevel !== 'ALL' ? transitLevel.toUpperCase().replace('_TEAM', '') : undefined} />
      <BaseModal isOpen={cancelModal.isOpen} onClose={() => setCancelModal({ isOpen: false, leadId: '' })}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Cancel Lead</h3>
          <p className="text-sm text-slate-600 mb-4">Please provide a reason for cancelling this lead:</p>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 resize-none" placeholder="Enter cancellation reason..." />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCancelModal({ isOpen: false, leadId: '' })} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-all">Cancel</button>
            <button onClick={handleCancelLead} className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all">Confirm Cancellation</button>
          </div>
        </div>
      </BaseModal>

      {/* Direct edit from accounting dashboard rows */}
      {editLead && (
        <EditLeadModal
          isOpen={!!editLead}
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSave={handleSaveLeadEdit}
          dropdowns={dropdowns}
          hideBackWorkAccount={isExecutiveDashboard}
        />
      )}
    </div>
  );
}
export type { Lead, DropdownData, Column, Employee, PaymentDetail };
