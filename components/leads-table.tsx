'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import {
  Eye,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  Send,
  X,
  Filter,
  User,
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  CalendarDays,
  Clock,
  Building,
  Users,
  IndianRupee,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// ==================== INTERFACES ====================
interface Lead {
  id: string;
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
    owner?: { firstName?: string; lastName?: string; phoneNo?: string; dateOfBirth?: string; email?: string; aadharNumber?: string; panNumber?: string };
    tenant?: { firstName?: string; lastName?: string; phoneNo?: string; dateOfBirth?: string; email?: string; aadharNumber?: string; panNumber?: string };
    executeDate?: string;
    startDate?: string;
    endDate?: string;
    addressLine1?: string;
    addressLine2?: string;
    agreementStartDate?: string;
    agreementEndDate?: string;
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
    ownerPayments?: Array<{ date?: string; amount?: number; mode?: string; partyName?: string; transactionNo?: string; paymentDate?: string; paymentAmount?: string; modeOfPayment?: string; payerName?: string }>;
    tenantPayments?: Array<{ date?: string; amount?: number; mode?: string; partyName?: string; transactionNo?: string; paymentDate?: string; paymentAmount?: string; modeOfPayment?: string; payerName?: string }>;
  };
  leadStatus?: string;
  status?: string;
  visitAddress?: string;
  appointmentTime?: string;
  lastFollowUpDate?: string;
  nextFollowUpDate?: string;
  createdDate?: string;
  createdByUserName?: string;
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
  city?: { id?: string; name?: string };
  area?: { id?: string; name?: string };
  paymentDetails?: Array<{
    clientType: 'OWNER' | 'TENANT';
    paymentDate?: string;
    paymentAmount?: string;
    modeOfPayment?: string;
    payerName?: string;
  }>;
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
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (amount?: number | string): string => {
  if (!amount) return '₹ -';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num || 0);
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

// ==================== BASE MODAL - FIXED FOR SMOOTH OPENING ====================
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

  // Sync internal visibility state with prop
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Trigger animation after mount
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        ref={modalRef}
        className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} overflow-hidden transition-all duration-200 ease-out flex flex-col max-h-[95vh] ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// ==================== VIEW LEAD MODAL ====================
interface ViewLeadModalProps {
  isOpen: boolean;
  leadId: string;
  onClose: () => void;
}

const ViewLeadModal: React.FC<ViewLeadModalProps> = ({ isOpen, leadId, onClose }) => {
  const { apiFetch } = useApi();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lead' | 'agreement' | 'payment'>('lead');
  const prevLeadIdRef = useRef<string>('');

  // Only fetch when leadId actually changes AND modal is open
  useEffect(() => {
    if (!isOpen || !leadId || prevLeadIdRef.current === leadId) return;
    
    prevLeadIdRef.current = leadId;
    
    const fetchLead = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/leads?id=${leadId}`);
        if (!res.ok) throw new Error('Failed to fetch lead');
        const data = await res.json();
        setLead(data);
      } catch (err) {
        console.error('Fetch lead error:', err);
        setError('Failed to load lead details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLead();
  }, [isOpen, leadId, apiFetch]);

  // Reset state ONLY when modal fully closes (not during animation)
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setLead(null);
        setLoading(true);
        setError(null);
        setActiveTab('lead');
        prevLeadIdRef.current = '';
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Lead Details" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#00A651] animate-spin" />
            <p className="text-slate-600">Loading lead details...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              Close
            </button>
          </div>
        </div>
      ) : !lead ? (
        <div className="text-center py-12 text-slate-500">No lead data available</div>
      ) : (
        <>
          {/* Tabs Navigation */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 sticky top-0 bg-white z-10">
            {[
              { key: 'lead', label: 'Lead Details', icon: FileText },
              { key: 'agreement', label: 'Agreement', icon: BadgeCheck },
              { key: 'payment', label: 'Payment', icon: CreditCard },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key 
                    ? 'bg-white text-[#00A651] shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lead Details Tab */}
          {activeTab === 'lead' && (
            <div className="space-y-6">
              {/* Client Info Card */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#00A651]" />
                  Client Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Name" value={`${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-'} />
                  <InfoItem label="Client Type" value={lead.client?.clientType || '-'} />
                  <InfoItem label="Phone" value={lead.client?.phoneNo || '-'} icon={Phone} />
                  <InfoItem label="Email" value={lead.client?.email || '-'} icon={Mail} />
                  <InfoItem label="City" value={lead.client?.cityName || lead.city?.name || '-'} icon={MapPin} />
                  <InfoItem label="Area" value={lead.client?.areaName || lead.area?.name || '-'} icon={Building} />
                </div>
              </div>

              {/* Lead Details Card */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00A651]" />
                  Lead Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Lead Status" value={lead.leadStatus || '-'} badge />
                  <InfoItem label="Lead Source" value={lead.leadSource || '-'} />
                  <InfoItem label="Visit Address" value={lead.visitAddress || '-'} icon={MapPin} />
                  <InfoItem label="Reference Name" value={lead.referenceName || '-'} />
                  <InfoItem label="Reference Number" value={lead.referenceNumber || '-'} />
                  <InfoItem label="Amount" value={lead.amount ? formatCurrency(lead.amount) : '-'} icon={IndianRupee} />
                  <InfoItem label="Tentative Agreement Date" value={formatDate(lead.tentativeAgreementDate)} icon={CalendarDays} />
                  <InfoItem label="Appointment Time" value={lead.appointmentTime ? new Date(lead.appointmentTime).toLocaleString('en-IN') : '-'} icon={Clock} />
                  <InfoItem label="Description" value={lead.description || '-'} multiline />
                  <InfoItem label="Last FollowUp" value={formatDate(lead.lastFollowUpDate)} icon={CalendarDays} />
                  <InfoItem label="Next FollowUp" value={formatDate(lead.nextFollowUpDate)} icon={CalendarDays} />
                  <InfoItem label="Created By" value={lead.createdByUserName || '-'} />
                  <InfoItem label="Created Date" value={formatDate(lead.createdDate)} icon={CalendarDays} />
                  <InfoItem label="Assigned To" value={lead.assignedToUserName || 'Team Only'} icon={User} />
                </div>
              </div>
            </div>
          )}

          {/* Agreement Tab */}
          {activeTab === 'agreement' && (
            <div className="space-y-6">
              {/* Owner Details */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#00A651]" />
                  Owner Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Name" value={`${lead.agreement?.owner?.firstName || ''} ${lead.agreement?.owner?.lastName || ''}`.trim() || '-'} />
                  <InfoItem label="Phone" value={lead.agreement?.owner?.phoneNo || '-'} icon={Phone} />
                  <InfoItem label="Email" value={lead.agreement?.owner?.email || '-'} icon={Mail} />
                  <InfoItem label="Aadhar" value={lead.agreement?.owner?.aadharNumber || '-'} />
                  <InfoItem label="PAN" value={lead.agreement?.owner?.panNumber || '-'} />
                </div>
              </div>

              {/* Tenant Details */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#00A651]" />
                  Tenant Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Name" value={`${lead.agreement?.tenant?.firstName || ''} ${lead.agreement?.tenant?.lastName || ''}`.trim() || '-'} />
                  <InfoItem label="Phone" value={lead.agreement?.tenant?.phoneNo || '-'} icon={Phone} />
                  <InfoItem label="Email" value={lead.agreement?.tenant?.email || '-'} icon={Mail} />
                  <InfoItem label="Aadhar" value={lead.agreement?.tenant?.aadharNumber || '-'} />
                  <InfoItem label="PAN" value={lead.agreement?.tenant?.panNumber || '-'} />
                </div>
              </div>

              {/* Agreement Details */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-[#00A651]" />
                  Agreement Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Token Number" value={lead.agreement?.tokenNo || '-'} />
                  <InfoItem label="Agreement Status" value={lead.agreement?.status || '-'} badge />
                  <InfoItem label="Back Office Status" value={lead.agreement?.backOfficeStatus || '-'} badge />
                  <InfoItem label="Start Date" value={formatDate(lead.agreement?.agreementStartDate || lead.agreement?.startDate)} icon={CalendarDays} />
                  <InfoItem label="End Date" value={formatDate(lead.agreement?.agreementEndDate || lead.agreement?.endDate)} icon={CalendarDays} />
                  <InfoItem label="Address Line 1" value={lead.agreement?.addressLine1 || '-'} multiline />
                  <InfoItem label="Address Line 2" value={lead.agreement?.addressLine2 || '-'} multiline />
                </div>
              </div>
            </div>
          )}

          {/* Payment Tab */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              {/* Payment Summary */}
              <div className="bg-gradient-to-r from-[#00A651] to-[#008f44] rounded-xl p-5 text-white">
                <h4 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SummaryCard label="Total Amount" value={formatCurrency(lead.payment?.totalAmount)} />
                  <SummaryCard label="Commission" value={formatCurrency(lead.payment?.commissionAmount)} />
                  <SummaryCard label="Outstanding" value={formatCurrency(lead.payment?.outstandingAmount)} highlight />
                </div>
              </div>

              {/* Owner Payments */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4">Owner Payments</h4>
                {lead.paymentDetails?.filter(p => p.clientType === 'OWNER')?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Date</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Amount</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Mode</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Payer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lead.paymentDetails?.filter(p => p.clientType === 'OWNER').map((p, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                            <td className="py-2 px-3 font-medium text-[#00A651]">{formatCurrency(p.paymentAmount)}</td>
                            <td className="py-2 px-3">{p.modeOfPayment || '-'}</td>
                            <td className="py-2 px-3">{p.payerName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No owner payments recorded</p>
                )}
              </div>

              {/* Tenant Payments */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-base font-semibold text-slate-800 mb-4">Tenant Payments</h4>
                {lead.paymentDetails?.filter(p => p.clientType === 'TENANT')?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Date</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Amount</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Mode</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Payer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lead.paymentDetails?.filter(p => p.clientType === 'TENANT').map((p, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                            <td className="py-2 px-3 font-medium text-[#00A651]">{formatCurrency(p.paymentAmount)}</td>
                            <td className="py-2 px-3">{p.modeOfPayment || '-'}</td>
                            <td className="py-2 px-3">{p.payerName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No tenant payments recorded</p>
                )}
              </div>

              {/* Back Work Account */}
              {(lead.payment?.grnNumber || lead.payment?.dhcNumber || lead.payment?.commissionName) && (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-4">Back Work Account</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="GRN Number" value={lead.payment.grnNumber || '-'} />
                    <InfoItem label="GRN Amount" value={formatCurrency(lead.payment.grnAmount)} />
                    <InfoItem label="GRN Date" value={formatDate(lead.payment.govtGrnDate || lead.payment.grnDate)} icon={CalendarDays} />
                    <InfoItem label="DHC Number" value={lead.payment.dhcNumber || '-'} />
                    <InfoItem label="DHC Amount" value={formatCurrency(lead.payment.dhcAmount)} />
                    <InfoItem label="DHC Date" value={formatDate(lead.payment.dhcDate)} icon={CalendarDays} />
                    <InfoItem label="Commission Name" value={lead.payment.commissionName || '-'} />
                    <InfoItem label="Commission Amount" value={formatCurrency(lead.payment.commissionAmount)} />
                    <InfoItem label="Commission Date" value={formatDate(lead.payment.commissionDate)} icon={CalendarDays} />
                  </div>
                </div>
              )}

              {/* Description */}
              {lead.payment?.description && (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-base font-semibold text-slate-800 mb-2">Notes</h4>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{lead.payment.description}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </BaseModal>
  );
};

// ==================== HELPER COMPONENTS ====================
interface InfoItemProps {
  label: string;
  value: string;
  icon?: React.ElementType;
  badge?: boolean;
  multiline?: boolean;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, icon: Icon, badge, multiline }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </label>
    {badge ? (
      <div>{getStatusBadge(value)}</div>
    ) : (
      <p className={`text-sm text-slate-700 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{value || '-'}</p>
    )}
  </div>
);

interface SummaryCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, highlight }) => (
  <div className={`p-4 rounded-lg ${highlight ? 'bg-white/20' : 'bg-white/10'}`}>
    <p className="text-sm opacity-90">{label}</p>
    <p className={`text-xl font-bold ${highlight ? 'text-amber-200' : 'text-white'}`}>{value}</p>
  </div>
);

// ==================== CONFIRMATION MODAL ====================
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger' | 'success';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen, title, message, confirmText = 'Yes', cancelText = 'No', onConfirm, onCancel, variant = 'default'
}) => {
  const btnClass = variant === 'danger' 
    ? 'bg-red-500 hover:bg-red-600' 
    : variant === 'success' 
    ? 'bg-emerald-500 hover:bg-emerald-600' 
    : 'bg-amber-500 hover:bg-amber-600';

  return (
    <BaseModal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${btnClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

// ==================== TEAM SELECTION MODAL ====================
interface TeamSelectionModalProps {
  isOpen: boolean;
  leadId: string;
  onSend: (leadId: string, team: string, assignedToUserId?: string | null) => void;
  onClose: () => void;
}

const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({ isOpen, leadId, onSend, onClose }) => {
  const { apiFetch } = useApi();
  const [selectedTeam, setSelectedTeam] = useState<'CALLING' | 'EXECUTIVE' | 'BACKEND' | 'ACCOUNTING' | 'MARKETING'>('CALLING');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [assignToEmployee, setAssignToEmployee] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const prevTeamRef = useRef<string>('');

  const teams = [
    { key: 'CALLING', label: 'Calling Team', icon: '📞', color: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700' },
    { key: 'EXECUTIVE', label: 'Executive Team', icon: '👔', color: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700' },
    { key: 'BACKEND', label: 'Backend Team', icon: '⚙️', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700' },
    { key: 'ACCOUNTING', label: 'Accounts Team', icon: '💰', color: 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-700' },
    { key: 'MARKETING', label: 'Marketing Team', icon: '📢', color: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 text-cyan-700' },
  ];

  useEffect(() => {
    if (!isOpen) return;
    
    // Only fetch if team actually changed
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
      } finally {
        setLoadingEmployees(false);
      }
    };
    
    fetchEmployees();
  }, [selectedTeam, isOpen, apiFetch]);

  // Reset team ref when modal closes
  useEffect(() => {
    if (!isOpen) {
      prevTeamRef.current = '';
    }
  }, [isOpen]);

  const handleSend = () => {
    const employeeId = assignToEmployee ? selectedEmployee : null;
    onSend(leadId, selectedTeam, employeeId);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Forward Lead</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        
        <p className="text-sm font-medium text-slate-700 mb-3">Select Team:</p>
        <div className="grid gap-2 mb-4">
          {teams.map((t) => (
            <button
              key={t.key}
              onClick={() => { setSelectedTeam(t.key as any); setAssignToEmployee(false); setSelectedEmployee(null); }}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                selectedTeam === t.key ? t.color + ' border-opacity-100 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="font-medium">{t.label}</span>
              {selectedTeam === t.key && <div className="ml-auto w-2 h-2 rounded-full bg-current" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3 p-3 bg-slate-50 rounded-lg">
          <input 
            type="checkbox" 
            id="assignEmployee" 
            checked={assignToEmployee} 
            onChange={(e) => { setAssignToEmployee(e.target.checked); setSelectedEmployee(null); }}
            className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
          />
          <label htmlFor="assignEmployee" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4" /> Assign to specific employee
          </label>
        </div>

        {assignToEmployee && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-2">Select Employee:</label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading employees...
              </div>
            ) : employees.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No employees found in {selectedTeam} team</p>
            ) : (
              <select 
                value={selectedEmployee || ''} 
                onChange={(e) => setSelectedEmployee(e.target.value || null)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">Cancel</button>
          <button
            onClick={handleSend}
            disabled={assignToEmployee && !selectedEmployee}
            className="px-5 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> 
            {assignToEmployee && selectedEmployee ? 'Assign to Employee' : assignToEmployee ? 'Select Employee' : `Forward to ${selectedTeam} Team`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

// ==================== MAIN COMPONENT ====================
interface LeadsTableProps {
  transitLevel: string;
  title: string;
  columns: Column[];
  showAddButton?: boolean;
  onSendToBackend?: (leadId: string) => void;
}

export default function LeadsTable({
  transitLevel,
  title,
  columns,
  showAddButton = true,
}: LeadsTableProps) {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    cities: [], areas: [], leadStatuses: [], agreementStatuses: [],
    backOfficeStatuses: [], executives: [], clientTypes: [],
  });

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [filterOn, setFilterOn] = useState('Created Date');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [clientType, setClientType] = useState('');
  const [areaText, setAreaText] = useState('');
  const [tokenNumber, setTokenNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [assignedEmployeeFilter, setAssignedEmployeeFilter] = useState('');

  // ✅ MODAL STATES
  const [viewModal, setViewModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [sendModal, setSendModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; leadId: string }>({ isOpen: false, leadId: '' });
  const [cancelReason, setCancelReason] = useState('');

  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch('/api/employees');
        const data = await res.json();
        setAvailableEmployees(data.employees || []);
      } catch (error) {
        console.error('Failed to fetch employees for filter:', error);
      }
    })();
  }, [user, apiFetch]);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const res = await apiFetch('/api/dropdowns', { method: 'POST' });
        const data = await res.json();
        setDropdowns({
          cities: data?.cities || [], areas: data?.areas || [],
          leadStatuses: data?.leadStatuses || [], agreementStatuses: data?.agreementStatuses || [],
          backOfficeStatuses: data?.backOfficeStatuses || [], executives: data?.executives || [],
          clientTypes: data?.clientTypes || [],
        });
      } catch {
        console.error('Failed to fetch dropdowns');
      }
    })();
  }, [authLoading, user]);

  const fetchLeads = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(), pageSize: pageSize.toString(), transitLevel,
      });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (filterOn) params.set('filterOn', filterOn);
      if (selectedCity) params.set('cityId', selectedCity);
      if (selectedArea) params.set('areaId', selectedArea);
      if (clientType) params.set('clientType', clientType);
      if (areaText) params.set('areaText', areaText);
      if (tokenNumber) params.set('tokenNumber', tokenNumber);
      if (selectedStatus) params.set('status', selectedStatus);
      if (searchText) params.set('searchText', searchText);
      if (assignedEmployeeFilter) params.set('assignedToUserId', assignedEmployeeFilter);

      const res = await apiFetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data?.leadPage?.content || []);
      setTotalPages(data?.leadPage?.totalPages || 1);
    } catch {
      setLeads([]); setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, transitLevel, fromDate, toDate, filterOn, selectedCity, selectedArea, clientType, areaText, tokenNumber, selectedStatus, searchText, assignedEmployeeFilter, authLoading, user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleApplyFilters = () => setPage(0);
  const handleClearFilters = () => {
    setFromDate(today); setToDate(today); setFilterOn('Created Date');
    setSelectedCity(''); setSelectedArea(''); setClientType('');
    setAreaText(''); setTokenNumber(''); setSelectedStatus('');
    setSearchText(''); setAssignedEmployeeFilter('');
    setPage(0);
  };

  const handleSendToTeam = async (leadId: string, team: string, assignedToUserId?: string | null) => {
    try {
      await apiFetch(`/api/leads/${leadId}/assign-team`, { 
        method: 'POST', 
        body: JSON.stringify({ team, assignedToUserId }) 
      });
      alert(assignedToUserId 
        ? 'Lead successfully assigned to employee.' 
        : `Lead successfully forwarded to ${team} team.`);
      fetchLeads();
    } catch {
      alert('Failed to forward lead. Please try again.');
    } finally {
      setSendModal({ isOpen: false, leadId: '' });
    }
  };

  const handleCancelLead = async () => {
    if (!cancelReason.trim()) { alert('Please provide a cancellation reason.'); return; }
    try {
      await apiFetch('/api/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: cancelModal.leadId, leadStatus: 'CANCELLED', cancellationReason: cancelReason }),
      });
      alert('Lead cancelled successfully.');
      fetchLeads();
    } catch {
      alert('Failed to cancel lead.');
    } finally {
      setCancelModal({ isOpen: false, leadId: '' });
      setCancelReason('');
    }
  };

  const handleExportExcel = () => {
    if (leads.length === 0) return alert('No data to export.');
    const exportData = leads.map((lead) => ({
      'Token Number': lead.agreement?.tokenNo || '-',
      'Name': `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-',
      'Phone Number': lead.client?.phoneNo || '-',
      'Client Type': lead.client?.clientType || '-',
      'Visit Address': lead.visitAddress || '-',
      'Area': lead.client?.areaName || '-',
      'City': lead.client?.cityName || '-',
      'Lead Status': lead.leadStatus || '-',
      'Agreement Status': lead.agreement?.status || '-',
      'Assigned To': lead.assignedToUserName || '-',
      'Created Date': lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : '-',
      'Created By': lead.createdByUserName || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `Leads_${transitLevel}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 font-sans text-slate-700">
      {/* Filters Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold">
          <Filter className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label>
            <div className="relative">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label>
            <div className="relative">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Filter On</label>
            <select value={filterOn} onChange={(e) => setFilterOn(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
              <option>Created Date</option>
              <option>Updated Date</option>
              <option>Appointment Date</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</label>
            <select value={assignedEmployeeFilter} onChange={(e) => setAssignedEmployeeFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
              <option value="">All Employees</option>
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
          {[
            { label: 'City', value: selectedCity, set: setSelectedCity, options: dropdowns.cities },
            { label: 'Area', value: selectedArea, set: setSelectedArea, options: dropdowns.areas },
          ].map((f) => (
            <div key={f.label} className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">{f.label}</label>
              <select value={f.value} onChange={(e) => f.set(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
                <option value="">Select {f.label}</option>
                {f.options.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
              </select>
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Client Type</label>
            <select value={clientType} onChange={(e) => setClientType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
              <option value="">All</option>
              <option value="OWNER">Owner</option>
              <option value="TENANT">Tenant</option>
              <option value="AGENT">Agent</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Area (Text)</label>
            <input type="text" placeholder="e.g. Sector 45" value={areaText} onChange={(e) => setAreaText(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Token Number</label>
            <input type="text" placeholder="14 digits" value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Lead Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
              <option value="">All Status</option>
              {dropdowns.leadStatuses.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search by name, phone, token..." value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(0)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleApplyFilters}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">
              Apply Filters
            </button>
            <button onClick={handleClearFilters}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all">
              Clear
            </button>
            <button onClick={handleExportExcel}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Header & Add Button */}
      {showAddButton && (
        <div className="flex justify-end">
          <Link href={`/leads/new?transitLevel=${transitLevel}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add New Lead
          </Link>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider" style={col.width ? { width: col.width } : undefined}>
                    {col.label}
                  </th>
                ))}
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider w-32">Assigned To</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columns.length + 2} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-3"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div><span>Loading leads...</span></div>
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="text-center py-12 text-slate-400">No records found matching your filters</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3 text-slate-700 whitespace-nowrap align-middle">
                        {col.render ? col.render(lead) : '-'}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap align-middle">
                      {lead.assignedToUserName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                          <User className="w-3 h-3" /> {lead.assignedToUserName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Team Only</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center gap-1">
                        {/* ✅ VIEW BUTTON - Opens Modal with ALL data */}
                        <button 
                          onClick={() => setViewModal({ isOpen: true, leadId: lead.id })} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                          title="View Complete Lead Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* ✅ EDIT BUTTON REMOVED */}
                        <button onClick={() => setSendModal({ isOpen: true, leadId: lead.id })} 
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                          title="Forward to Team/Employee">
                          <Send className="w-4 h-4" />
                        </button>
                        <button onClick={() => setCancelModal({ isOpen: true, leadId: lead.id })} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                          title="Cancel">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">Showing page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ MODALS - All using fixed BaseModal */}
      
      {/* View Lead Modal - Shows ALL data */}
      <ViewLeadModal 
        isOpen={viewModal.isOpen} 
        leadId={viewModal.leadId} 
        onClose={() => setViewModal({ isOpen: false, leadId: '' })} 
      />
      
      {/* Team Selection Modal */}
      <TeamSelectionModal 
        isOpen={sendModal.isOpen} 
        leadId={sendModal.leadId} 
        onSend={handleSendToTeam} 
        onClose={() => setSendModal({ isOpen: false, leadId: '' })} 
      />
      
      {/* Cancel Confirmation Modal */}
      <BaseModal isOpen={cancelModal.isOpen} onClose={() => setCancelModal({ isOpen: false, leadId: '' })}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Cancel Lead</h3>
          <p className="text-sm text-slate-600 mb-4">Please provide a reason for cancelling this lead:</p>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 resize-none"
            placeholder="Enter cancellation reason..." />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCancelModal({ isOpen: false, leadId: '' })} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-all">Cancel</button>
            <button onClick={handleCancelLead} className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all">Confirm Cancellation</button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

export type { Lead, DropdownData, Column, Employee };