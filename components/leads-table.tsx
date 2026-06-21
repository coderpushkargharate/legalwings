'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import {
  Eye, Trash2, Plus, Search, ChevronLeft, ChevronRight, Calendar, Download, Send, X, Filter,
  User, Loader2, Phone, Mail, MapPin, FileText, CreditCard, CalendarDays, Clock, Building,
  Users, IndianRupee, BadgeCheck, AlertCircle, CalendarClock, FileDown, Edit, Save,
  ChevronDown, ChevronUp, Receipt, Banknote, FileCheck, UserCheck, Users2, MapPinned,
  PhoneCall, MailOpen, Hash, CalendarRange, Timer, Tag, Link2, DollarSign, Percent,
  ClipboardList, Notebook, CircleDot, ArrowRightLeft, CircleHelp, CheckCircle2, XCircle,
  ArrowUpDown, ArrowDownUp
} from 'lucide-react';
import Link from 'next/link';
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
  primary: '#00A651',
  primaryHover: '#008f44',
  primaryLight: '#f0fdf4',
  primaryRing: 'rgba(0, 166, 81, 0.2)',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  background: '#ffffff',
};

// ==================== UTILITY FUNCTIONS ====================
// DD/MM/YY (2-digit year) — consistent across all team tables.
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// DD/MM/YY HH:MM for fields that carry a time (appointments, forwarding history).
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Typeable date field in DD/MM/YY. Displays an ISO value as DD/MM/YY, lets the
// user type digits (auto-inserting slashes), and emits an ISO yyyy-mm-dd string
// once a full date is entered so the rest of the app keeps storing ISO dates.
const isoToDDMMYY = (iso?: string): string => {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const DateInput: React.FC<{ value?: string; onChange: (iso: string) => void; className?: string }> = ({ value, onChange, className }) => {
  const [text, setText] = useState<string>(isoToDDMMYY(value));
  useEffect(() => { setText(isoToDDMMYY(value)); }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (digits.length === 6) {
      const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yy = digits.slice(4, 6);
      onChange(`20${yy}-${mm}-${dd}`);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YY"
      value={text}
      onChange={(e) => handle(e.target.value)}
      maxLength={8}
      className={className}
    />
  );
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
}
const EditLeadModal: React.FC<EditLeadModalProps> = ({ isOpen, lead, onClose, onSave }) => {
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
        cityId: lead.cityId,
        areaId: lead.areaId,
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

      const updateData = {
        ...formData,
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

  const inputClass = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A651] focus:border-transparent transition-all";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1";
  const sectionClass = "bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6";
  const sectionHeaderClass = "text-base font-semibold text-slate-800 mb-4 flex items-center gap-2";

  const totalAmount = parseFloat(formData.payment?.totalAmount?.toString() || '0');
  const commissionAmount = parseFloat(formData.payment?.commissionAmount?.toString() || '0');
  const outstandingAmount = totalAmount + commissionAmount;

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
                activeTab === tab ? 'bg-white text-[#00A651] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'lead' ? 'Lead Details' : tab === 'client' ? 'Client & Agreement' : 'Payment Details'}
            </button>
          ))}
        </div>

        {activeTab === 'lead' && (
          <div className={sectionClass}>
            <h4 className={sectionHeaderClass}><FileText className="w-5 h-5 text-[#00A651]" /> Lead Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelClass}>Lead Date</label><input type="date" value={formData.leadDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('general', 'leadDate', e.target.value)} className={inputClass} /></div>
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
              <div><label className={labelClass}>Tentative Agreement Date</label><input type="date" value={formData.tentativeAgreementDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('general', 'tentativeAgreementDate', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Appointment Time</label><input type="datetime-local" value={formData.appointmentTime?.slice(0, 16) || ''} onChange={(e) => handleInputChange('general', 'appointmentTime', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Visit Address</label><input type="text" value={formData.visitAddress || ''} onChange={(e) => handleInputChange('general', 'visitAddress', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Description</label><input type="text" value={formData.description || ''} onChange={(e) => handleInputChange('general', 'description', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Reference Name</label><input type="text" value={formData.referenceName || ''} onChange={(e) => handleInputChange('general', 'referenceName', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Reference Number</label><input type="text" value={formData.referenceNumber || ''} onChange={(e) => handleInputChange('general', 'referenceNumber', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Amount</label><input type="text" value={formData.amount || ''} onChange={(e) => handleInputChange('general', 'amount', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>City</label><input type="text" value={formData.client?.cityName || formData.city?.name || ''} className={inputClass} readOnly disabled /></div>
              <div><label className={labelClass}>Area</label><input type="text" value={formData.client?.areaName || formData.area?.name || ''} className={inputClass} readOnly disabled /></div>
              <div><label className={labelClass}>Last FollowUp Date</label><input type="date" value={formData.lastFollowUpDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('general', 'lastFollowUpDate', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Next FollowUp Date</label><input type="date" value={formData.nextFollowUpDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('general', 'nextFollowUpDate', e.target.value)} className={inputClass} /></div>
            </div>
          </div>
        )}

        {activeTab === 'client' && (
          <div className="space-y-6">
            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><User className="w-5 h-5 text-[#00A651]" /> Owner Details</h4>
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
              <h4 className={sectionHeaderClass}><Users className="w-5 h-5 text-[#00A651]" /> Tenant Details</h4>
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
              <h4 className={sectionHeaderClass}><BadgeCheck className="w-5 h-5 text-[#00A651]" /> Police Verification</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>Name</label><input type="text" value={formData.agreement?.pvName || ''} onChange={(e) => handleInputChange('agreement', 'pvName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Age</label><input type="number" value={formData.agreement?.pvAge || ''} onChange={(e) => handleInputChange('agreement', 'pvAge', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Mobile</label><input type="tel" value={formData.agreement?.pvMobile || ''} onChange={(e) => handleInputChange('agreement', 'pvMobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Relation</label><input type="text" value={formData.agreement?.pvRelation || ''} onChange={(e) => handleInputChange('agreement', 'pvRelation', e.target.value)} className={inputClass} /></div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><MapPinned className="w-5 h-5 text-[#00A651]" /> Site Visit Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>SV Name</label><input type="text" value={formData.agreement?.svName || ''} onChange={(e) => handleInputChange('agreement', 'svName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>SV No.</label><input type="text" inputMode="numeric" value={formData.agreement?.svNo || ''} onChange={(e) => handleInputChange('agreement', 'svNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>SV Location</label><input type="text" value={formData.agreement?.svLocation || ''} onChange={(e) => handleInputChange('agreement', 'svLocation', e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Assign Status</label>
                  <select value={formData.agreement?.assignStatus || ''} onChange={(e) => handleInputChange('agreement', 'assignStatus', e.target.value)} className={inputClass}>
                    <option value="">Select Assign Status</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><FileCheck className="w-5 h-5 text-[#00A651]" /> Agreement Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Token Number</label>
                  <input type="text" value={formData.agreement?.tokenNo || ''} onChange={(e) => handleInputChange('agreement', 'tokenNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 14))} maxLength={14} className={inputClass} />
                </div>
                <div><label className={labelClass}>Agreement Start Date</label><input type="date" value={formData.agreement?.agreementStartDate?.split('T')[0] || formData.agreement?.startDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('agreement', 'agreementStartDate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Agreement End Date</label><input type="date" value={formData.agreement?.agreementEndDate?.split('T')[0] || formData.agreement?.endDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('agreement', 'agreementEndDate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Mobile No</label><input type="tel" value={formData.agreement?.mobileNo || ''} onChange={(e) => handleInputChange('agreement', 'mobileNo', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} maxLength={10} className={inputClass} /></div>
                <div><label className={labelClass}>Execute Date</label><input type="date" value={formData.agreement?.executeDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('agreement', 'executeDate', e.target.value)} className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Address Line 1</label><input type="text" value={formData.agreement?.addressLine1 || ''} onChange={(e) => handleInputChange('agreement', 'addressLine1', e.target.value)} className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Address Line 2</label><input type="text" value={formData.agreement?.addressLine2 || ''} onChange={(e) => handleInputChange('agreement', 'addressLine2', e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Agreement Status</label>
                  <select value={formData.agreement?.status || ''} onChange={(e) => handleInputChange('agreement', 'status', e.target.value)} className={inputClass}>
                    <option value="">Select Status</option>
                    {['Owner Pending', 'Tenant Pending', 'Witness Pending', 'Challan and DHC', 'Extra Visit', '1 Tenant Pending', 'NRI Owner Pending', 'Deposit Details Pending', 'Furniture Details Pending', 'Miscellaneous points Pending', 'Agent/owner/Tenant Confirmation Pending', 'Draft Updation Pending', 'POA Pending Sending', 'Reshadule', 'Biomatric Problem', 'Sarver Problem', 'Sending Govt.', 'Photo Pending', 'Other Problme'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Back Office Status</label>
                  <select value={formData.agreement?.backOfficeStatus || ''} onChange={(e) => handleInputChange('agreement', 'backOfficeStatus', e.target.value)} className={inputClass}>
                    <option value="">Select Status</option>
                    {['Govt. Approval pending', 'Govt. Quiery', 'Govt. Copy send clint', 'Govt. Other issue', 'Challan Pending', 'DHC Pending', 'ReShadule visit', 'Payment Pending', 'POA Pending', 'PVR Pending', 'Cummision Sending', 'Document Pending', 'Draft Confirmation Pending', 'Other State Bio. Pending', 'NRI Bio Pending', 'Photo Pending', 'Other Problme'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Agreement File (PDF)</label>
                  {(formData.agreement?.fileData || formData.agreement?.agreementFile) && (
                    <div className="flex items-center gap-3 mb-1">
                      <a
                        href={formData.agreement.fileData || formData.agreement.agreementFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#00A651] hover:underline"
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
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><CreditCard className="w-5 h-5 text-[#00A651]" /> Payment Summary</h4>
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
                  <label className={labelClass}>Commission Amount</label>
                  <input type="text" placeholder="e.g., 500" value={formData.payment?.commissionAmount || ''} onChange={(e) => handleInputChange('payment', 'commissionAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Outstanding Amount</label>
                  <input type="text" value={`₹ ${outstandingAmount.toFixed(2)}`} readOnly className={`${inputClass} bg-slate-50 text-red-600 font-semibold cursor-not-allowed`} />
                  <p className="text-xs text-slate-500 mt-1">Calculated: Total + Commission</p>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><UserCheck className="w-5 h-5 text-[#00A651]" /> Owner Payments</h4>
              {ownerPayments.map((p, i) => (
                <div key={`owner-${i}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-white rounded-lg border border-slate-200">
                  <div><label className={labelClass}>Payment Date</label><input type="date" value={p.paymentDate} onChange={(e) => updateOwnerPayment(i, 'paymentDate', e.target.value)} className={inputClass} /></div>
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
              <button type="button" onClick={addOwnerPayment} className="flex items-center gap-1 text-sm text-[#00A651] hover:text-[#008f44] font-medium border border-dashed border-[#00A651] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all">
                <Plus className="w-4 h-4" /> Add Owner Payment
              </button>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><Users2 className="w-5 h-5 text-[#00A651]" /> Tenant Payments</h4>
              {tenantPayments.map((p, i) => (
                <div key={`tenant-${i}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-white rounded-lg border border-slate-200">
                  <div><label className={labelClass}>Payment Date</label><input type="date" value={p.paymentDate} onChange={(e) => updateTenantPayment(i, 'paymentDate', e.target.value)} className={inputClass} /></div>
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
              <button type="button" onClick={addTenantPayment} className="flex items-center gap-1 text-sm text-[#00A651] hover:text-[#008f44] font-medium border border-dashed border-[#00A651] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all">
                <Plus className="w-4 h-4" /> Add Tenant Payment
              </button>
            </div>

            <div className={sectionClass}>
              <h4 className={sectionHeaderClass}><Banknote className="w-5 h-5 text-[#00A651]" /> Back Work Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>GRN Number</label><input type="text" inputMode="numeric" value={formData.payment?.grnNumber || ''} onChange={(e) => handleInputChange('payment', 'grnNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 18))} maxLength={18} className={inputClass} /></div>
                <div><label className={labelClass}>GRN Amount</label><input type="text" value={formData.payment?.grnAmount || ''} onChange={(e) => handleInputChange('payment', 'grnAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div><label className={labelClass}>Govt GRN Date</label><input type="date" value={formData.payment?.govtGrnDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('payment', 'govtGrnDate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Number</label><input type="text" inputMode="numeric" value={formData.payment?.dhcNumber || ''} onChange={(e) => handleInputChange('payment', 'dhcNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 13))} maxLength={13} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Amount</label><input type="text" value={formData.payment?.dhcAmount || ''} onChange={(e) => handleInputChange('payment', 'dhcAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div><label className={labelClass}>DHC Date</label><input type="date" value={formData.payment?.dhcDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('payment', 'dhcDate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Date</label><input type="date" value={formData.payment?.commissionDate?.split('T')[0] || ''} onChange={(e) => handleInputChange('payment', 'commissionDate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Name</label><input type="text" value={formData.payment?.commissionName || ''} onChange={(e) => handleInputChange('payment', 'commissionName', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Commission Amount</label><input type="text" value={formData.payment?.commissionAmount || ''} onChange={(e) => handleInputChange('payment', 'commissionAmount', e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} /></div>
                <div className="md:col-span-3"><label className={labelClass}>Description</label><textarea value={formData.payment?.description || ''} onChange={(e) => handleInputChange('payment', 'description', e.target.value)} rows={3} className={`${inputClass} resize-none`} /></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#00A651] text-white rounded-lg font-medium hover:bg-[#008f44] transition-colors disabled:opacity-50 flex items-center gap-2">
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
}
const ViewLeadModal: React.FC<ViewLeadModalProps> = ({ isOpen, leadId, onClose, onEdit, onLeadUpdated, isAdmin = false }) => {
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
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-[#00A651] animate-spin" /><p className="ml-2">Loading lead details...</p></div>
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
                  <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-[#00A651] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>
              {onEdit && (
                <button onClick={() => { setIsEditing(true); setActiveTab('lead'); }} className="flex items-center gap-2 px-4 py-2 bg-[#00A651] text-white rounded-lg text-sm font-medium hover:bg-[#008f44] transition-colors">
                  <Edit className="w-4 h-4" /> Edit Lead
                </button>
              )}
            </div>

            {activeTab === 'lead' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-[#00A651]" /> Lead Details</h4>
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
                    <InfoItem label="Appointment Time" value={formatDateTime(lead.appointmentTime)} icon={Clock} />
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
                    <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-[#00A651]" /> Forwarding History</h4>
                    <div className="space-y-3">
                      {lead.forwardedHistory.map((history, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-medium text-slate-700 text-sm"><span className="text-slate-500">{history.fromTeam}</span><ChevronRight className="w-3 h-3 inline mx-1 text-slate-400" /><span className="text-[#00A651]">{history.toTeam}</span></span>
                            <span className="text-slate-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(history.forwardedAt)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2"><User className="w-3 h-3 inline mr-1" /> Forwarded by: <span className="font-medium">{history.forwardedBy}</span></p>
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
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-[#00A651]" /> Owner Details</h4>
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
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-[#00A651]" /> Tenant Details</h4>
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
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-[#00A651]" /> Police Verification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <InfoItem label="Name" value={lead.agreement?.pvName || '-'} />
                    <InfoItem label="Age" value={lead.agreement?.pvAge || '-'} />
                    <InfoItem label="Mobile" value={lead.agreement?.pvMobile || '-'} icon={Phone} />
                    <InfoItem label="Relation" value={lead.agreement?.pvRelation || '-'} />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><MapPinned className="w-5 h-5 text-[#00A651]" /> Site Visit Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <InfoItem label="SV Name" value={lead.agreement?.svName || '-'} />
                    <InfoItem label="SV No." value={lead.agreement?.svNo || '-'} icon={Hash} />
                    <InfoItem label="SV Location" value={lead.agreement?.svLocation || '-'} icon={MapPin} />
                    <InfoItem label="Assign Status" value={lead.agreement?.assignStatus || '-'} badge />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileCheck className="w-5 h-5 text-[#00A651]" /> Agreement Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="Token Number" value={lead.agreement?.tokenNo || '-'} />
                    <InfoItem label="Agreement Status" value={lead.agreement?.status || '-'} badge />
                    <InfoItem label="Back Office Status" value={lead.agreement?.backOfficeStatus || '-'} badge />
                    <InfoItem label="Start Date" value={formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate)} icon={CalendarDays} />
                    <InfoItem label="End Date" value={formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate)} icon={CalendarDays} />
                    <InfoItem label="Execute Date" value={formatDate(lead.agreement?.executeDate)} icon={CalendarDays} />
                    <InfoItem label="Mobile No" value={lead.agreement?.mobileNo || '-'} icon={Phone} />
                    <InfoItem label="Address Line 1" value={lead.agreement?.addressLine1 || '-'} multiline />
                    <InfoItem label="Address Line 2" value={lead.agreement?.addressLine2 || '-'} multiline />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Agreement File
                      </label>
                      {(lead.agreement?.fileData || lead.agreement?.agreementFile) ? (
                        <div className="flex items-center gap-3">
                          <a href={lead.agreement.fileData || lead.agreement.agreementFile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#00A651] hover:underline">
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
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-[#00A651] to-[#008f44] rounded-xl p-5 text-white">
                  <h4 className="text-base font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Payment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard label="Total Amount" value={formatCurrency(lead.payment?.totalAmount)} />
                    <SummaryCard label="Commission" value={formatCurrency(lead.payment?.commissionAmount)} />
                    <SummaryCard label="Outstanding" value={formatCurrency((lead.payment?.outstandingAmount ?? (Number(lead.payment?.totalAmount) + Number(lead.payment?.commissionAmount))))} highlight />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#00A651]" /> Owner Payments</h4>
                  {lead.paymentDetails?.filter(p => p.clientType === 'OWNER')?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-200"><th className="text-left py-2 px-3">Date</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Mode</th><th className="text-left py-2 px-3">Payer</th><th className="text-left py-2 px-3">Transaction No.</th></tr></thead>
                        <tbody>
                          {lead.paymentDetails?.filter(p => p.clientType === 'OWNER').map((p, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                              <td className="py-2 px-3 font-medium text-[#00A651]">{formatCurrency(p.paymentAmount)}</td>
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
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users2 className="w-5 h-5 text-[#00A651]" /> Tenant Payments</h4>
                  {lead.paymentDetails?.filter(p => p.clientType === 'TENANT')?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-200"><th className="text-left py-2 px-3">Date</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Mode</th><th className="text-left py-2 px-3">Payer</th><th className="text-left py-2 px-3">Transaction No.</th></tr></thead>
                        <tbody>
                          {lead.paymentDetails?.filter(p => p.clientType === 'TENANT').map((p, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                              <td className="py-2 px-3 font-medium text-[#00A651]">{formatCurrency(p.paymentAmount)}</td>
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
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Banknote className="w-5 h-5 text-[#00A651]" /> Back Work Account</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="GRN Number" value={lead.payment?.grnNumber || '-'} />
                    <InfoItem label="GRN Amount" value={formatCurrency(lead.payment?.grnAmount)} />
                    <InfoItem label="Govt GRN Date" value={formatDate(lead.payment?.govtGrnDate)} icon={CalendarDays} />
                    <InfoItem label="DHC Number" value={lead.payment?.dhcNumber || '-'} />
                    <InfoItem label="DHC Amount" value={formatCurrency(lead.payment?.dhcAmount)} />
                    <InfoItem label="DHC Date" value={formatDate(lead.payment?.dhcDate)} icon={CalendarDays} />
                    <InfoItem label="Commission Date" value={formatDate(lead.payment?.commissionDate)} icon={CalendarDays} />
                    <InfoItem label="Commission Name" value={lead.payment?.commissionName || '-'} />
                    <InfoItem label="Commission Amount" value={formatCurrency(lead.payment?.commissionAmount)} />
                    <InfoItem label="Description" value={lead.payment?.description || '-'} multiline />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </BaseModal>
      <EditLeadModal isOpen={isEditing} lead={lead} onClose={() => setIsEditing(false)} onSave={handleSaveEdit} />
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
interface TeamSelectionModalProps { isOpen: boolean; leadId: string; onSend: (leadId: string, team: string, assignedToUserId?: string | null, reason?: string) => void; onClose: () => void; }
const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({ isOpen, leadId, onSend, onClose }) => {
  const { apiFetch } = useApi();
  const [selectedTeam, setSelectedTeam] = useState<'CALLING' | 'EXECUTIVE' | 'BACKEND' | 'ACCOUNTING' | 'MARKETING'>('CALLING');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [assignToEmployee, setAssignToEmployee] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [forwardReason, setForwardReason] = useState('');
  const prevTeamRef = useRef<string>('');
  const reasonOptions = [
    { value: '', label: '-- Select Reason --' },
    { value: 'Completed', label: 'Completed' },
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
  const teams = [
    { key: 'CALLING', label: 'Calling Team', icon: '📞', color: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700' },
    { key: 'EXECUTIVE', label: 'Executive Team', icon: '👔', color: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700' },
    { key: 'BACKEND', label: 'Backend Team', icon: '⚙️', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700' },
    { key: 'ACCOUNTING', label: 'Accounts Team', icon: '💰', color: 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-700' },
    { key: 'MARKETING', label: 'Marketing Team', icon: '📢', color: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 text-cyan-700' },
  ];

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
interface LeadsTableProps { transitLevel: string; title: string; columns?: Column[]; showAddButton?: boolean; onSendToBackend?: (leadId: string) => void; filterFn?: (lead: Lead) => boolean; }
export default function LeadsTable({ transitLevel, title, columns: customColumns, showAddButton = true, filterFn }: LeadsTableProps) {
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
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
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
  // Backend team: All Work / Submitted / Completed buckets.
  const [backendView, setBackendView] = useState<'all' | 'submitted' | 'completed'>('all');
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  // Accounting / appointment list: sort by appointment date (ascending / descending).
  const [appointmentSort, setAppointmentSort] = useState<'none' | 'asc' | 'desc'>('none');

  const canExport = Array.isArray(user?.roles) && (user?.roles?.includes('ADMIN') || user?.roles?.includes('ACCOUNTING') || user?.roles?.includes('admin') || user?.roles?.includes('accounting'));
  const isAdmin = Array.isArray(user?.roles) && (user?.roles?.includes('ADMIN') || user?.roles?.includes('admin'));
  const isMarketingDashboard = transitLevel === 'MARKETING' || transitLevel === 'MARKETING_TEAM';
  const isExecutiveDashboard = transitLevel === 'EXECUTIVE' || transitLevel === 'EXECUTIVE_TEAM';
  const isCallingDashboard = transitLevel === 'CALLING' || transitLevel === 'CALLING_TEAM';
  const isBackendDashboard = transitLevel === 'BACKEND' || transitLevel === 'BACKEND_TEAM';
  const isAccountingDashboard = transitLevel === 'ACCOUNTING' || transitLevel === 'ALL';

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
        { key: 'commissionAmount', label: 'Commission Amount', width: '120px', render: (lead) => formatCurrency(lead.payment?.commissionAmount) },
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
        { key: 'viewAll', label: 'View All Old Information', width: '180px', render: (lead) => (<button onClick={(e) => { e.stopPropagation(); setViewModal({ isOpen: true, leadId: lead.id }); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#00A651] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"><Eye className="w-3.5 h-3.5" /> View Details</button>) },
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
  // only. In the Lead view, collapse those columns into a single "Next Forward"
  // action that pushes the lead into the Appointment view.
  if (isCallingDashboard && callingView === 'leads') {
    const svKeys = ['svName', 'svNo', 'svLocation'];
    const svIndex = columns.findIndex((c) => svKeys.includes(c.key));
    const withoutSv = columns.filter((c) => !svKeys.includes(c.key));
    if (svIndex >= 0) {
      const leadFollowUpCol: Column = {
        key: 'leadFollowUp',
        label: 'Lead Followup',
        width: '120px',
        render: (lead) => formatDate(lead.nextFollowUpDate),
      };
      const nextForwardCol: Column = {
        key: 'nextForward',
        label: 'Next Followup',
        width: '150px',
        render: (lead) => (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleAppointment(lead.id, true); }}
            disabled={forwardingId === lead.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#00A651] hover:bg-[#008f44] rounded-lg transition-colors disabled:opacity-50"
          >
            {forwardingId === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />} Next Followup
          </button>
        ),
      };
      const insertAt = Math.min(svIndex, withoutSv.length);
      withoutSv.splice(insertAt, 0, leadFollowUpCol, nextForwardCol);
    }
    columns = withoutSv;
  }

  const fetchLeads = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString(), transitLevel });
      if (isCallingDashboard) {
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (filterOn) params.set('filterOn', filterOn);
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
        if (searchText) params.set('searchText', searchText);
      }
      if (isExecutiveDashboard && executiveSearch) params.set('searchText', executiveSearch);
      if (isBackendDashboard) {
        if (ownerName) params.set('ownerName', ownerName);
        if (tenantName) params.set('tenantName', tenantName);
        if (tokenNumber) params.set('tokenNumber', tokenNumber);
        if (agreementStatus) params.set('agreementStatus', agreementStatus);
        if (backOfficeStatus) params.set('backOfficeStatus', backOfficeStatus);
        if (grnNo) params.set('grnNo', grnNo);
        if (dhcNo) params.set('dhcNo', dhcNo);
        if (commissionDate) params.set('commissionDate', commissionDate);
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
  }, [page, transitLevel, fromDate, toDate, filterOn, executiveSearch, appointmentFromDate, appointmentToDate, appointmentLocation, clientType, mobileFilter, assignedEmployeeFilter, selectedStatus, nextFollowUpFromDate, nextFollowUpToDate, lastFollowUpFromDate, lastFollowUpToDate, visitCount, selectedCity, selectedArea, areaText, tokenNumber, searchText, ownerName, tenantName, agreementStatus, backOfficeStatus, grnNo, dhcNo, commissionDate, commissionAmount, clientName, phone, amount, status, paymentDate, executeDate, startDate, endDate, ownerMobile, ownerDob, tenantMobile, tenantDob, authLoading, user, isCallingDashboard, isExecutiveDashboard, isBackendDashboard, isAccountingDashboard, isMarketingDashboard]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleApplyFilters = () => setPage(0);
  const handleClearFilters = () => {
    setFromDate(today);
    setToDate(today);
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

  // Calling team appointments: mark an appointment Complete / Pending / Cancelled.
  const handleAppointmentStatus = async (leadId: string, status: string) => {
    setForwardingId(leadId);
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id: leadId, appointmentStatus: status }),
      });
      if (!res.ok) throw new Error('Update failed');
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, appointmentStatus: status } : l)));
    } catch {
      alert('Failed to update appointment status. Please try again.');
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label><div className="relative"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label><div className="relative"><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /></div></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Filter On</label><select value={filterOn} onChange={(e) => setFilterOn(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option>Created Date</option><option>Updated Date</option><option>Appointment Date</option><option>Agreement Date</option></select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</label><select value={assignedEmployeeFilter} onChange={(e) => setAssignedEmployeeFilter(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All Employees</option>{availableEmployees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Appointment From</label><input type="date" value={appointmentFromDate} onChange={(e) => setAppointmentFromDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Appointment To</label><input type="date" value={appointmentToDate} onChange={(e) => setAppointmentToDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Location (Appointment)</label><input type="text" placeholder="e.g. Pune, Mumbai" value={appointmentLocation} onChange={(e) => setAppointmentLocation(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Client Type</label><select value={clientType} onChange={(e) => setClientType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option><option value="OWNER">Owner</option><option value="TENANT">Tenant</option><option value="AGENT">Agent</option></select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Lead Status</label><select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All Status</option>{dropdowns.leadStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Visit Count</label><input type="number" placeholder="e.g. 1, 2, 3" value={visitCount} onChange={(e) => setVisitCount(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number</label><input type="tel" placeholder="Search by mobile" value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
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
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Area (Text)</label><input type="text" placeholder="e.g. Sector 45" value={areaText} onChange={(e) => setAreaText(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end pt-2 border-t border-slate-100">
            <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search by name, phone, token..." value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setPage(0)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleApplyFilters} className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">Apply Filters</button>
              <button onClick={handleClearFilters} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">Clear</button>
              {canExport && (<button onClick={handleExportExcel} className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"><Download className="w-4 h-4" /> Export</button>)}
            </div>
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
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Owner Name</label><input type="text" placeholder="Search owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant Name</label><input type="text" placeholder="Search tenant" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token No.</label><input type="text" placeholder="Token number" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Agreement Status</label><select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{dropdowns.agreementStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Back Office Status</label><select value={backOfficeStatus} onChange={(e) => setBackOfficeStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{dropdowns.backOfficeStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}</select></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">GRN No.</label><input type="text" placeholder="GRN number" value={grnNo} onChange={(e) => setGrnNo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">DHC No.</label><input type="text" placeholder="DHC number" value={dhcNo} onChange={(e) => setDhcNo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Commission Date</label><input type="date" value={commissionDate} onChange={(e) => setCommissionDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Commission Amt</label><input type="number" placeholder="Amount" value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</label><select value={assignedEmployeeFilter} onChange={(e) => setAssignedEmployeeFilter(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"><option value="">All</option>{availableEmployees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}</select></div>
            <div className="col-span-1 md:col-span-2"></div>
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
  }
  // Backend team: All Work shows everything; Submitted / Completed are subsets.
  if (isBackendDashboard) {
    displayedLeads = displayedLeads.filter((l) => {
      if (backendView === 'submitted') return l.backendStatus === 'SUBMITTED';
      if (backendView === 'completed') return l.backendStatus === 'COMPLETED';
      return true;
    });
  }
  // Sort by appointment date (ascending / descending) when requested.
  if (appointmentSort !== 'none') {
    displayedLeads = [...displayedLeads].sort((a, b) => {
      const ta = a.appointmentTime ? new Date(a.appointmentTime).getTime() : 0;
      const tb = b.appointmentTime ? new Date(b.appointmentTime).getTime() : 0;
      return appointmentSort === 'asc' ? ta - tb : tb - ta;
    });
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
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {(['leads', 'appointments'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCallingView(view)}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                callingView === view ? 'bg-white text-[#00A651] shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                backendView === view ? 'bg-white text-[#00A651] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(isAccountingDashboard || (isCallingDashboard && callingView === 'appointments')) && (
        <div className="flex items-center gap-2 text-sm">
          <ArrowUpDown className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-slate-600">Sort by Appointment Date:</span>
          <select
            value={appointmentSort}
            onChange={(e) => setAppointmentSort(e.target.value as 'none' | 'asc' | 'desc')}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A651] focus:border-transparent transition-all cursor-pointer"
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
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider" style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                    {col.label}
                  </th>
                ))}
                {shouldShowExtraColumns && (
                  <>
                    <th className="text-left px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider w-36">Assigned To</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider w-28 sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columns.length + (shouldShowExtraColumns ? 2 : 0)} className="text-center py-12 text-slate-400"><div className="flex flex-col items-center gap-3"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div><span>Loading leads...</span></div></td></tr>
              ) : displayedLeads.length === 0 ? (
                <tr><td colSpan={columns.length + (shouldShowExtraColumns ? 2 : 0)} className="text-center py-12 text-slate-400">No records found matching your filters</td></tr>
              ) : (
                displayedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
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
                        <td className="px-4 py-3 align-middle whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewModal({ isOpen: true, leadId: lead.id })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Complete Lead Details">
                              <Eye className="w-4 h-4" />
                            </button>
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
                                  className="p-2 text-slate-400 hover:text-[#00A651] hover:bg-[#f0fdf4] rounded-lg transition-all disabled:opacity-40"
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
                              <>
                                <button
                                  onClick={() => handleAppointmentStatus(lead.id, 'COMPLETED')}
                                  disabled={forwardingId === lead.id}
                                  className={`p-2 rounded-lg transition-all disabled:opacity-40 ${lead.appointmentStatus === 'COMPLETED' ? 'text-white bg-emerald-500 hover:bg-emerald-600' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                  title="Mark Appointment Complete"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleAppointmentStatus(lead.id, 'PENDING')}
                                  disabled={forwardingId === lead.id}
                                  className={`p-2 rounded-lg transition-all disabled:opacity-40 ${lead.appointmentStatus === 'PENDING' ? 'text-white bg-amber-500 hover:bg-amber-600' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                  title="Mark Appointment Pending"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleAppointmentStatus(lead.id, 'CANCELLED')}
                                  disabled={forwardingId === lead.id}
                                  className={`p-2 rounded-lg transition-all disabled:opacity-40 ${lead.appointmentStatus === 'CANCELLED' ? 'text-white bg-red-500 hover:bg-red-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                  title="Mark Appointment Cancelled"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isBackendDashboard && (
                              lead.backendStatus === 'COMPLETED' ? (
                                <button
                                  onClick={() => handleBackendStatus(lead.id, 'SUBMITTED')}
                                  disabled={forwardingId === lead.id}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40"
                                  title="Reforward to Submitted"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                                </button>
                              ) : lead.backendStatus === 'SUBMITTED' ? (
                                <>
                                  <button
                                    onClick={() => handleBackendStatus(lead.id, 'COMPLETED')}
                                    disabled={forwardingId === lead.id}
                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-40"
                                    title="Forward to Completed"
                                  >
                                    {forwardingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleBackendStatus(lead.id, '')}
                                    disabled={forwardingId === lead.id}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40"
                                    title="Reforward to All Work"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleBackendStatus(lead.id, 'SUBMITTED')}
                                  disabled={forwardingId === lead.id}
                                  className="p-2 text-slate-400 hover:text-[#00A651] hover:bg-[#f0fdf4] rounded-lg transition-all disabled:opacity-40"
                                  title="Forward to Submitted"
                                >
                                  {forwardingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                              )
                            )}
                            <button onClick={() => setCancelModal({ isOpen: true, leadId: lead.id })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Cancel">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
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
      />
      <TeamSelectionModal isOpen={sendModal.isOpen} leadId={sendModal.leadId} onSend={handleSendToTeam} onClose={() => setSendModal({ isOpen: false, leadId: '' })} />
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
        />
      )}
    </div>
  );
}
export type { Lead, DropdownData, Column, Employee, PaymentDetail };
