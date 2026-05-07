'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import { ArrowLeft, Save, ChevronRight, Plus, X } from 'lucide-react';

// ============================================================================
// 🔹 THEME COLORS (Updated to match website theme)
// ============================================================================
const THEME = {
  primary: '#00A651',        // Main brand green
  primaryHover: '#008f44',   // Darker green for hover
  primaryLight: '#f0fdf4',   // Light green background
  primaryRing: 'rgba(0, 166, 81, 0.2)', // Focus ring with opacity
  textPrimary: '#1e293b',    // slate-800
  textSecondary: '#64748b',  // slate-500
  border: '#e2e8f0',         // slate-200
  background: '#ffffff',
  disabledBg: '#f8fafc',     // slate-50
};

// ============================================================================
// 🔹 TYPES
// ============================================================================
export interface DropdownData {
  cities: { id: string; name: string }[];
  areas: { id: string; name: string; cityName?: string }[];
  leadStatuses: { key: string; value: string }[];
  agreementStatuses: { key: string; value: string }[];
  backOfficeStatuses: { key: string; value: string }[];
}

interface PaymentDetail {
  paymentDate: string;
  paymentAmount: string;
  modeOfPayment: string;
  payerName: string;
}

interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  clientType: 'OWNER' | 'TENANT' | 'AGENT';
  leadSource: string;
  leadStatus: string;
  description: string;
  visitAddress: string;
  appointmentTime: string;
  referenceName: string;
  referenceNumber: string;
  amount: string;
  lastFollowUpDate: string;
  nextFollowUpDate: string;
  tentativeAgreementDate: string;
  cityId: string;
  areaId: string;
}

interface AgreementFormData {
  tokenNumber: string;
  agreementStartDate: string;
  agreementEndDate: string;
  addressLine1: string;
  addressLine2: string;
  agreementStatus: string;
  backOfficeStatus: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerContact: string;
  ownerAadhar: string;
  ownerPan: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  tenantContact: string;
  tenantAadhar: string;
  tenantPan: string;
  pvName?: string;
  pvAge?: string;
  pvMobile?: string;
  pvRelation?: string;
}

interface PaymentFormData {
  totalAmount: string;
  commissionAmount: string;
  commissionName: string;
  commissionDate: string;
  grnNumber: string;
  grnAmount: string;
  govtGrnDate: string;
  dhcNumber: string;
  dhcAmount: string;
  dhcDate: string;
  description: string;
}

// ============================================================================
// 🔹 REUSABLE COMPONENTS (MOVED OUTSIDE - CRITICAL FIX FOR FOCUS ISSUE)
// ============================================================================

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

const Input = memo(function Input({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  maxLength,
  placeholder,
  disabled = false,
  id,
}: InputProps) {
  const inputId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;
  
  return (
    <div>
      <label 
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700 mb-1"
      >
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
      />
    </div>
  );
});

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; value: string }[] | string[];
  disabled?: boolean;
  id?: string;
}

const Select = memo(function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  id,
}: SelectProps) {
  const selectId = id || `select-${label.replace(/\s+/g, '-').toLowerCase()}`;
  
  return (
    <div>
      <label 
        htmlFor={selectId}
        className="block text-sm font-medium text-slate-700 mb-1"
      >
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 disabled:text-slate-500 transition-all cursor-pointer"
      >
        <option value="">Select {label}</option>
        {options.map((opt) => {
          const key = typeof opt === 'string' ? opt : opt.key;
          const lbl = typeof opt === 'string' ? opt : opt.value;
          return (
            <option key={key} value={key}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
});

// ============================================================================
// 🔹 MAIN COMPONENT CONTENT
// ============================================================================

function LeadFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiFetch } = useApi();
  const { user, token, loading: authLoading } = useAuth();
  
  const mode = searchParams.get('mode') || 'new';
  const leadId = searchParams.get('id');
  const transitLevel = searchParams.get('transitLevel') || 'CALLING_TEAM';

  const [activeTab, setActiveTab] = useState('lead');
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    cities: [],
    areas: [],
    leadStatuses: [],
    agreementStatuses: [],
    backOfficeStatuses: [],
  });
  const [saving, setSaving] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState(leadId || '');
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 🔹 Lead State
  const [lead, setLead] = useState<LeadFormData>({
    firstName: '', lastName: '', email: '', contactNumber: '', clientType: 'OWNER',
    leadSource: '', leadStatus: 'NEW_LEAD', description: '', visitAddress: '',
    appointmentTime: '', referenceName: '', referenceNumber: '', amount: '',
    lastFollowUpDate: '', nextFollowUpDate: '', tentativeAgreementDate: '',
    cityId: '', areaId: '',
  });

  // 🔹 Agreement State
  const [agreement, setAgreement] = useState<AgreementFormData>({
    tokenNumber: '', agreementStartDate: '', agreementEndDate: '',
    addressLine1: '', addressLine2: '', agreementStatus: '', backOfficeStatus: '',
    ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerContact: '',
    ownerAadhar: '', ownerPan: '',
    tenantFirstName: '', tenantLastName: '', tenantEmail: '', tenantContact: '',
    tenantAadhar: '', tenantPan: '',
  });

  // 🔹 Payment State
  const [payment, setPayment] = useState<PaymentFormData>({
    totalAmount: '', commissionAmount: '', commissionName: '', commissionDate: '',
    grnNumber: '', grnAmount: '', govtGrnDate: '', dhcNumber: '', dhcAmount: '',
    dhcDate: '', description: '',
  });

  const [ownerPayments, setOwnerPayments] = useState<PaymentDetail[]>([
    { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }
  ]);
  const [tenantPayments, setTenantPayments] = useState<PaymentDetail[]>([
    { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }
  ]);

  const isView = mode === 'view';
  const isEditable = !isView;

  // ============================================================================
  // 🔹 FETCH DROPDOWNS (STABLE - NO UNNECESSARY RE-RENDERS)
  // ============================================================================
  useEffect(() => {
    if (authLoading || !token) return;
    
    let mounted = true;
    
    const fetchDropdowns = async () => {
      try {
        const res = await apiFetch('/api/dropdowns', { method: 'POST' });
        if (!mounted) return;
        
        if (res.ok) {
          const data = await res.json();
          setDropdowns({
            cities: data?.cities || [],
            areas: data?.areas || [],
            leadStatuses: data?.leadStatuses || [],
            agreementStatuses: data?.agreementStatuses || [],
            backOfficeStatuses: data?.backOfficeStatuses || [],
          });
        }
      } catch (err) {
        console.error('Dropdown fetch error:', err);
      }
    };
    
    fetchDropdowns();
    
    return () => {
      mounted = false;
    };
  }, [authLoading, token, apiFetch]);

  // ============================================================================
  // 🔹 FETCH LEAD DATA (STABLE - RUNS ONLY ONCE WHEN READY)
  // ============================================================================
  useEffect(() => {
    if (authLoading || !token || !leadId || formDataLoaded) return;
    
    let mounted = true;
    
    const fetchLeadData = async () => {
      try {
        setFormError(null);
        const res = await apiFetch(`/api/leads?id=${leadId}`);
        
        if (!mounted) return;
        
        if (!res.ok) {
          throw new Error('Failed to fetch lead data');
        }
        
        const data = await res.json();
        
        if (mounted) {
          setCurrentLeadId(data.id || leadId);
          
          // Populate Lead
          setLead({
            firstName: data.client?.firstName || '',
            lastName: data.client?.lastName || '',
            email: data.client?.email || '',
            contactNumber: data.client?.phoneNo || '',
            clientType: data.client?.clientType || 'OWNER',
            leadSource: data.leadSource || '',
            leadStatus: data.leadStatus || 'NEW_LEAD',
            description: data.description || '',
            visitAddress: data.visitAddress || '',
            appointmentTime: data.appointmentTime || '',
            referenceName: data.referenceName || '',
            referenceNumber: data.referenceNumber || '',
            amount: data.amount || '',
            lastFollowUpDate: data.lastFollowUpDate || '',
            nextFollowUpDate: data.nextFollowUpDate || '',
            tentativeAgreementDate: data.tentativeAgreementDate || '',
            cityId: data.city?.id || '',
            areaId: data.area?.id || '',
          });

          // Populate Agreement
          if (data.agreement) {
            setAgreement({
              tokenNumber: data.agreement.tokenNo || '',
              agreementStartDate: data.agreement.agreementStartDate || '',
              agreementEndDate: data.agreement.agreementEndDate || '',
              addressLine1: data.agreement.addressLine1 || '',
              addressLine2: data.agreement.addressLine2 || '',
              agreementStatus: data.agreement.status || '',
              backOfficeStatus: data.agreement.backOfficeStatus || '',
              ownerFirstName: data.agreement.owner?.firstName || '',
              ownerLastName: data.agreement.owner?.lastName || '',
              ownerEmail: data.agreement.owner?.email || '',
              ownerContact: data.agreement.owner?.phoneNo || '',
              ownerAadhar: data.agreement.owner?.aadharNumber || '',
              ownerPan: data.agreement.owner?.panNumber || '',
              tenantFirstName: data.agreement.tenant?.firstName || '',
              tenantLastName: data.agreement.tenant?.lastName || '',
              tenantEmail: data.agreement.tenant?.email || '',
              tenantContact: data.agreement.tenant?.phoneNo || '',
              tenantAadhar: data.agreement.tenant?.aadharNumber || '',
              tenantPan: data.agreement.tenant?.panNumber || '',
            });
          }

          // Populate Payment
          if (data.payment) {
            setPayment({
              totalAmount: data.payment.totalAmount?.toString() || '',
              commissionAmount: data.payment.commissionAmount?.toString() || '',
              commissionName: data.payment.commissionName || '',
              commissionDate: data.payment.commissionDate || '',
              grnNumber: data.payment.grnNumber || '',
              grnAmount: data.payment.grnAmount?.toString() || '',
              govtGrnDate: data.payment.govtGrnDate || '',
              dhcNumber: data.payment.dhcNumber || '',
              dhcAmount: data.payment.dhcAmount?.toString() || '',
              dhcDate: data.payment.dhcDate || '',
              description: data.payment.description || '',
            });
          }

          // Populate Payment Details
          if (data.paymentDetails?.length > 0) {
            const ownerPmts = data.paymentDetails
              .filter((p: any) => p.clientType === 'OWNER')
              .map((p: any) => ({
                paymentDate: p.paymentDate || '',
                paymentAmount: p.paymentAmount?.toString() || '',
                modeOfPayment: p.modeOfPayment || '',
                payerName: p.payerName || '',
              }));
            const tenantPmts = data.paymentDetails
              .filter((p: any) => p.clientType === 'TENANT')
              .map((p: any) => ({
                paymentDate: p.paymentDate || '',
                paymentAmount: p.paymentAmount?.toString() || '',
                modeOfPayment: p.modeOfPayment || '',
                payerName: p.payerName || '',
              }));
            
            if (ownerPmts.length > 0) setOwnerPayments(ownerPmts);
            if (tenantPmts.length > 0) setTenantPayments(tenantPmts);
          }
          
          setFormDataLoaded(true);
        }
      } catch (err) {
        console.error('Lead fetch error:', err);
        if (mounted) {
          setFormError('Failed to load lead data. Please try again.');
        }
      }
    };
    
    fetchLeadData();
    
    return () => {
      mounted = false;
    };
  }, [authLoading, token, leadId, formDataLoaded, apiFetch]);

  // ============================================================================
  // 🔹 STABLE STATE UPDATE HANDLERS (useCallback - prevents re-renders)
  // ============================================================================
  
  const updateLead = useCallback((field: keyof LeadFormData, value: string) => {
    setLead(prev => {
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const updateAgreement = useCallback((field: keyof AgreementFormData, value: string) => {
    setAgreement(prev => {
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const updatePayment = useCallback((field: keyof PaymentFormData, value: string) => {
    setPayment(prev => {
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const updateOwnerPayment = useCallback((index: number, field: keyof PaymentDetail, value: string) => {
    setOwnerPayments(prev => {
      if (prev[index]?.[field] === value) return prev;
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  }, []);

  const updateTenantPayment = useCallback((index: number, field: keyof PaymentDetail, value: string) => {
    setTenantPayments(prev => {
      if (prev[index]?.[field] === value) return prev;
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  }, []);

  // ============================================================================
  // 🔹 SAVE FUNCTIONS
  // ============================================================================

  const saveLead = useCallback(async () => {
    if (!token) {
      alert('Please wait, authentication is loading...');
      return;
    }
    
    setSaving(true);
    setFormError(null);
    
    try {
      const payload = {
        ...lead,
        transitLevel,
        client: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phoneNo: lead.contactNumber,
          clientType: lead.clientType,
        },
        city: lead.cityId ? { id: lead.cityId } : null,
        area: lead.areaId ? { id: lead.areaId } : null,
      };

      let response;
      if (currentLeadId) {
        response = await apiFetch('/api/leads', {
          method: 'PUT',
          body: JSON.stringify({ id: currentLeadId, ...payload }),
        });
      } else {
        response = await apiFetch('/api/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save lead');
      }

      const data = await response.json();
      if (!currentLeadId && data?.id) {
        setCurrentLeadId(data.id);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('id', data.id);
        window.history.replaceState({}, '', newUrl.toString());
      }
      
      setActiveTab('client');
    } catch (error: any) {
      console.error('Save lead error:', error);
      setFormError(error.message || 'Failed to save lead. Please try again.');
      alert('Failed to save lead.');
    } finally {
      setSaving(false);
    }
  }, [token, lead, currentLeadId, transitLevel, apiFetch]);

  const saveAgreement = useCallback(async () => {
    if (!token || !currentLeadId) {
      alert('Please save lead details first');
      return;
    }
    
    setSaving(true);
    setFormError(null);
    
    try {
      const response = await apiFetch('/api/agreements', {
        method: 'POST',
        body: JSON.stringify({
          leadId: currentLeadId,
          tokenNo: agreement.tokenNumber,
          agreementStartDate: agreement.agreementStartDate,
          agreementEndDate: agreement.agreementEndDate,
          status: agreement.agreementStatus,
          backOfficeStatus: agreement.backOfficeStatus,
          addressLine1: agreement.addressLine1,
          addressLine2: agreement.addressLine2,
          owner: {
            firstName: agreement.ownerFirstName,
            lastName: agreement.ownerLastName,
            email: agreement.ownerEmail,
            phoneNo: agreement.ownerContact,
            aadharNumber: agreement.ownerAadhar,
            panNumber: agreement.ownerPan,
            clientType: 'OWNER' as const,
          },
          tenant: {
            firstName: agreement.tenantFirstName,
            lastName: agreement.tenantLastName,
            email: agreement.tenantEmail,
            phoneNo: agreement.tenantContact,
            aadharNumber: agreement.tenantAadhar,
            panNumber: agreement.tenantPan,
            clientType: 'TENANT' as const,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save agreement');
      }
      
      setActiveTab('payment');
    } catch (error: any) {
      console.error('Save agreement error:', error);
      setFormError(error.message || 'Failed to save agreement. Please try again.');
      alert('Failed to save agreement.');
    } finally {
      setSaving(false);
    }
  }, [token, currentLeadId, agreement, apiFetch]);

  const savePayment = useCallback(async () => {
    if (!token || !currentLeadId) {
      alert('Please save lead and agreement details first');
      return;
    }
    
    setSaving(true);
    setFormError(null);
    
    try {
      const response = await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          leadId: currentLeadId,
          totalAmount: parseFloat(payment.totalAmount) || 0,
          commissionAmount: parseFloat(payment.commissionAmount) || 0,
          commissionName: payment.commissionName,
          commissionDate: payment.commissionDate,
          grnNumber: payment.grnNumber,
          grnAmount: parseFloat(payment.grnAmount) || 0,
          govtGrnDate: payment.govtGrnDate,
          dhcNumber: payment.dhcNumber,
          dhcAmount: parseFloat(payment.dhcAmount) || 0,
          dhcDate: payment.dhcDate,
          description: payment.description,
          paymentDetails: [
            ...ownerPayments
              .filter(p => p.paymentAmount && p.paymentAmount.trim() !== '' && parseFloat(p.paymentAmount) > 0)
              .map(p => ({ ...p, clientType: 'OWNER' as const })),
            ...tenantPayments
              .filter(p => p.paymentAmount && p.paymentAmount.trim() !== '' && parseFloat(p.paymentAmount) > 0)
              .map(p => ({ ...p, clientType: 'TENANT' as const })),
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save payment');
      }
      
      alert('Payment saved successfully!');
    } catch (error: any) {
      console.error('Save payment error:', error);
      setFormError(error.message || 'Failed to save payment. Please try again.');
      alert('Failed to save payment.');
    } finally {
      setSaving(false);
    }
  }, [token, currentLeadId, payment, ownerPayments, tenantPayments, apiFetch]);

  // ============================================================================
  // 🔹 TABS CONFIG
  // ============================================================================
  const tabs = useMemo(() => [
    { key: 'lead', label: 'Lead Details' },
    { key: 'client', label: 'Client & Agreement' },
    { key: 'payment', label: 'Payment Details' },
  ], []);

  // ============================================================================
  // 🔹 LOADING / ERROR STATES
  // ============================================================================
  if (authLoading) {
    return (
      <AppShell>
        <Header title="Loading..." />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A651]"></div>
        </div>
      </AppShell>
    );
  }

  if (!token && !authLoading) {
    return (
      <AppShell>
        <Header title="Authentication Required" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-slate-600">Please log in to continue.</p>
        </div>
      </AppShell>
    );
  }

  // ============================================================================
  // 🔹 MAIN RENDER
  // ============================================================================
  return (
    <AppShell>
      <Header
        title={
          mode === 'view'
            ? 'View Lead'
            : mode === 'edit'
            ? 'Edit Lead'
            : 'Add New Lead'
        }
      />
      <div className="p-6 max-w-5xl mx-auto">
        
        {/* 🔙 Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 rounded"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* ⚠️ Error Message */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {formError}
            <button 
              onClick={() => setFormError(null)}
              className="ml-2 font-medium hover:underline"
              type="button"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 📑 Tabs - Updated with theme colors */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 ${
                activeTab === tab.key
                  ? 'bg-white text-[#00A651] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 📋 LEAD TAB */}
{activeTab === 'lead' && (
  <div className="bg-white rounded-xl border border-slate-200 p-6">
    {/* Select Existing Client */}
    <div className="mb-6">
      <select
        disabled={!isEditable}
        className="w-full md:w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
        id="lead-selectExisting"
      >
        <option value="">Select Existing Client</option>
      </select>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          First Name
        </label>
        <input
          type="text"
          value={lead.firstName}
          onChange={(e) => updateLead('firstName', e.target.value)}
          disabled={!isEditable}
          placeholder="First Name"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-firstName"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Last Name
        </label>
        <input
          type="text"
          value={lead.lastName}
          onChange={(e) => updateLead('lastName', e.target.value)}
          disabled={!isEditable}
          placeholder="Last Name"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-lastName"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Client Type
        </label>
        <select
          value={lead.clientType}
          onChange={(e) => updateLead('clientType', e.target.value as any)}
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
          id="lead-clientType"
        >
          <option value="">Select Client Type</option>
          <option value="OWNER">OWNER</option>
          <option value="TENANT">TENANT</option>
          <option value="AGENT">AGENT</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Contact Number
        </label>
        <input
          type="text"
          value={lead.contactNumber}
          onChange={(e) =>
            updateLead('contactNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
          }
          maxLength={10}
          disabled={!isEditable}
          placeholder="Contact Number"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-contactNumber"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={lead.email}
          onChange={(e) => updateLead('email', e.target.value)}
          disabled={!isEditable}
          placeholder="Email"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Lead Source
        </label>
        <select
          value={lead.leadSource}
          onChange={(e) => updateLead('leadSource', e.target.value)}
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
          id="lead-leadSource"
        >
          <option value="">Select Lead Source</option>
          <option value="ONLINE">ONLINE</option>
          <option value="CALL">CALL</option>
          <option value="EXCEL">EXCEL</option>
          <option value="REFERENCE">REFERENCE</option>
          <option value="SHOP">SHOP</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Lead Status
        </label>
        <select
          value={lead.leadStatus}
          onChange={(e) => updateLead('leadStatus', e.target.value)}
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
          id="lead-leadStatus"
        >
          <option value="">Select Lead Status</option>
          {dropdowns.leadStatuses.map((status) => (
            <option key={status.key} value={status.key}>
              {status.value}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tentative Agreement Date
        </label>
        <div className="relative">
          <input
            type="date"
            value={lead.tentativeAgreementDate}
            onChange={(e) => updateLead('tentativeAgreementDate', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            id="lead-tentativeAgreementDate"
          />
          <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Appointment Time
        </label>
        <div className="relative">
          <input
            type="datetime-local"
            value={lead.appointmentTime}
            onChange={(e) => updateLead('appointmentTime', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            id="lead-appointmentTime"
          />
          <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Visit Address
        </label>
        <input
          type="text"
          value={lead.visitAddress}
          onChange={(e) => updateLead('visitAddress', e.target.value)}
          disabled={!isEditable}
          placeholder="Visit Address"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-visitAddress"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={lead.description}
          onChange={(e) => updateLead('description', e.target.value)}
          disabled={!isEditable}
          placeholder="Description"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-description"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Reference Name
        </label>
        <input
          type="text"
          value={lead.referenceName}
          onChange={(e) => updateLead('referenceName', e.target.value)}
          disabled={!isEditable}
          placeholder="Reference Name"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-referenceName"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Reference Number
        </label>
        <input
          type="text"
          value={lead.referenceNumber}
          onChange={(e) => updateLead('referenceNumber', e.target.value)}
          disabled={!isEditable}
          placeholder="Reference Number"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-referenceNumber"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Amount
        </label>
        <input
          type="text"
          value={lead.amount}
          onChange={(e) => updateLead('amount', e.target.value)}
          disabled={!isEditable}
          placeholder="Amount"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          id="lead-amount"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          City
        </label>
        <select
          value={lead.cityId}
          onChange={(e) => updateLead('cityId', e.target.value)}
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
          id="lead-cityId"
        >
          <option value="">Select City</option>
          {dropdowns.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Area
        </label>
        <select
          value={lead.areaId}
          onChange={(e) => updateLead('areaId', e.target.value)}
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
          id="lead-areaId"
        >
          <option value="">Select Area</option>
          {dropdowns.areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Last FollowUp Date
        </label>
        <div className="relative">
          <input
            type="date"
            value={lead.lastFollowUpDate}
            onChange={(e) => updateLead('lastFollowUpDate', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            id="lead-lastFollowUpDate"
          />
          <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Next FollowUp Date
        </label>
        <div className="relative">
          <input
            type="date"
            value={lead.nextFollowUpDate}
            onChange={(e) => updateLead('nextFollowUpDate', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            id="lead-nextFollowUpDate"
          />
          <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>

    {isEditable && (
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={saveLead}
          disabled={saving}
          className="px-6 py-2.5 bg-[#00A651] hover:bg-[#008f44] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          type="button"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setActiveTab('client')}
          className="px-6 py-2.5 bg-[#00A651] hover:bg-[#008f44] text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          type="button"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
)}

       {/* 👥 CLIENT & AGREEMENT TAB */}
{activeTab === 'client' && (
  <div className="space-y-6">
    {/* Owner Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Owner
      </h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Select Existing Client
        </label>
        <select
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
        >
          <option value="">Select Existing Client</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Owner Firstname"
          value={agreement.ownerFirstName}
          onChange={(v) => updateAgreement('ownerFirstName', v)}
          disabled={!isEditable}
          placeholder="Owner Firstname"
          id="agreement-ownerFirstName"
        />
        <Input
          label="Owner Lastname"
          value={agreement.ownerLastName}
          onChange={(v) => updateAgreement('ownerLastName', v)}
          disabled={!isEditable}
          placeholder="Owner Lastname"
          id="agreement-ownerLastName"
        />
        <Input
          label="Owner Email"
          value={agreement.ownerEmail}
          onChange={(v) => updateAgreement('ownerEmail', v)}
          type="email"
          disabled={!isEditable}
          placeholder="Owner Email"
          id="agreement-ownerEmail"
        />
        <Input
          label="Owner Contact"
          value={agreement.ownerContact}
          onChange={(v) =>
            updateAgreement(
              'ownerContact',
              v.replace(/[^0-9]/g, '').slice(0, 10)
            )
          }
          maxLength={10}
          disabled={!isEditable}
          placeholder="Owner Contact"
          id="agreement-ownerContact"
        />
        <Input
          label="Owner Aadhar Number"
          value={agreement.ownerAadhar}
          onChange={(v) =>
            updateAgreement(
              'ownerAadhar',
              v.replace(/[^0-9]/g, '').slice(0, 12)
            )
          }
          maxLength={12}
          disabled={!isEditable}
          placeholder="Owner Aadhar Number"
          id="agreement-ownerAadhar"
        />
        <Input
          label="Owner PAN Number"
          value={agreement.ownerPan}
          onChange={(v) => updateAgreement('ownerPan', v.toUpperCase())}
          maxLength={10}
          disabled={!isEditable}
          placeholder="Owner PAN Number"
          id="agreement-ownerPan"
        />
      </div>
    </div>

    {/* Tenant Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Tenant
      </h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Select Existing Client
        </label>
        <select
          disabled={!isEditable}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
        >
          <option value="">Select Existing Client</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Tenant Firstname"
          value={agreement.tenantFirstName}
          onChange={(v) => updateAgreement('tenantFirstName', v)}
          disabled={!isEditable}
          placeholder="Tenant Firstname"
          id="agreement-tenantFirstName"
        />
        <Input
          label="Tenant Lastname"
          value={agreement.tenantLastName}
          onChange={(v) => updateAgreement('tenantLastName', v)}
          disabled={!isEditable}
          placeholder="Tenant Lastname"
          id="agreement-tenantLastName"
        />
        <Input
          label="Tenant Email"
          value={agreement.tenantEmail}
          onChange={(v) => updateAgreement('tenantEmail', v)}
          type="email"
          disabled={!isEditable}
          placeholder="Tenant Email"
          id="agreement-tenantEmail"
        />
        <Input
          label="Tenant Contact"
          value={agreement.tenantContact}
          onChange={(v) =>
            updateAgreement(
              'tenantContact',
              v.replace(/[^0-9]/g, '').slice(0, 10)
            )
          }
          maxLength={10}
          disabled={!isEditable}
          placeholder="Tenant Contact"
          id="agreement-tenantContact"
        />
        <Input
          label="Tenant Aadhar Number"
          value={agreement.tenantAadhar}
          onChange={(v) =>
            updateAgreement(
              'tenantAadhar',
              v.replace(/[^0-9]/g, '').slice(0, 12)
            )
          }
          maxLength={12}
          disabled={!isEditable}
          placeholder="Tenant Aadhar Number"
          id="agreement-tenantAadhar"
        />
        <Input
          label="Tenant PAN Number"
          value={agreement.tenantPan}
          onChange={(v) => updateAgreement('tenantPan', v.toUpperCase())}
          maxLength={10}
          disabled={!isEditable}
          placeholder="Tenant PAN Number"
          id="agreement-tenantPan"
        />
      </div>
    </div>

    {/* Police Verification Details Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Police Verification Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          label="Name"
          value={agreement.pvName || ''}
          onChange={(v) => updateAgreement('pvName', v)}
          disabled={!isEditable}
          placeholder="Name"
          id="agreement-pvName"
        />
        <Input
          label="Age"
          value={agreement.pvAge || ''}
          onChange={(v) => updateAgreement('pvAge', v.replace(/[^0-9]/g, '').slice(0, 3))}
          maxLength={3}
          disabled={!isEditable}
          placeholder="Age"
          type="number"
          id="agreement-pvAge"
        />
        <Input
          label="Mobile No."
          value={agreement.pvMobile || ''}
          onChange={(v) => updateAgreement('pvMobile', v.replace(/[^0-9]/g, '').slice(0, 10))}
          maxLength={10}
          disabled={!isEditable}
          placeholder="Mobile No."
          id="agreement-pvMobile"
        />
        <Input
          label="Relation"
          value={agreement.pvRelation || ''}
          onChange={(v) => updateAgreement('pvRelation', v)}
          disabled={!isEditable}
          placeholder="Relation"
          id="agreement-pvRelation"
        />
      </div>
    </div>

    {/* Agreement Details Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Agreement Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Token Number"
          value={agreement.tokenNumber}
          onChange={(v) =>
            updateAgreement(
              'tokenNumber',
              v.replace(/[^0-9]/g, '').slice(0, 14)
            )
          }
          maxLength={14}
          disabled={!isEditable}
          placeholder="Token Number"
          id="agreement-tokenNumber"
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Agreement Start Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={agreement.agreementStartDate}
              onChange={(v) => updateAgreement('agreementStartDate', v)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
              id="agreement-agreementStartDate"
            />
            <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Agreement End Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={agreement.agreementEndDate}
              onChange={(v) => updateAgreement('agreementEndDate', v)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
              id="agreement-agreementEndDate"
            />
            <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <Input
          label="Address Line 1"
          value={agreement.addressLine1}
          onChange={(v) => updateAgreement('addressLine1', v)}
          disabled={!isEditable}
          placeholder="Address Line 1"
          id="agreement-addressLine1"
        />
        <Input
          label="Address Line 2"
          value={agreement.addressLine2}
          onChange={(v) => updateAgreement('addressLine2', v)}
          disabled={!isEditable}
          placeholder="Address Line 2"
          id="agreement-addressLine2"
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Agreement Status
          </label>
          <select
            value={agreement.agreementStatus}
            onChange={(v) => updateAgreement('agreementStatus', v)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
            id="agreement-agreementStatus"
          >
            <option value="">Select Agreement Status</option>
            <option value="Owner Pending">Owner Pending</option>
            <option value="Tenant Pending">Tenant Pending</option>
            <option value="Witness Pending">Witness Pending</option>
            <option value="Challan and DHC">Challan and DHC</option>
            <option value="Extra Visit">Extra Visit</option>
            <option value="1 Tenant Pending">1 Tenant Pending</option>
            <option value="NRI Owner Pending">NRI Owner Pending</option>
            <option value="Deposit Details Pending">Deposit Details Pending</option>
            <option value="Furniture Details Pending">Furniture Details Pending</option>
            <option value="Miscellaneous points Pending">Miscellaneous points Pending</option>
            <option value="Agent/owner/Tenant Confirmation Pending">Agent/owner/Tenant Confirmation Pending</option>
            <option value="Draft Updation Pending">Draft Updation Pending</option>
            <option value="POA Pending Sending">POA Pending Sending</option>
            <option value="Reshadule">Reshadule</option>
            <option value="Biomatric Problem">Biomatric Problem</option>
            <option value="Sarver Problem">Sarver Problem</option>
            <option value="Sending Govt.">Sending Govt.</option>
            <option value="Photo Pending">Photo Pending</option>
            <option value="Other Problme">Other Problme</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Back Office Status
          </label>
          <select
            value={agreement.backOfficeStatus}
            onChange={(v) => updateAgreement('backOfficeStatus', v)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
            id="agreement-backOfficeStatus"
          >
            <option value="">Select Back Office Status</option>
            <option value="Govt. Approval pending">Govt. Approval pending</option>
            <option value="Govt. Quiery">Govt. Quiery</option>
            <option value="Govt. Copy send clint">Govt. Copy send clint</option>
            <option value="Govt. Other issue">Govt. Other issue</option>
            <option value="Challan Pending">Challan Pending</option>
            <option value="DHC Pending">DHC Pending</option>
            <option value="ReShadule visit">ReShadule visit</option>
            <option value="Payment Pending">Payment Pending</option>
            <option value="POA Pending">POA Pending</option>
            <option value="PVR Pending">PVR Pending</option>
            <option value="Cummision Sending">Cummision Sending</option>
            <option value="Document Pending">Document Pending</option>
            <option value="Draft Confirmation Pending">Draft Confirmation Pending</option>
            <option value="Other State Bio. Pending">Other State Bio. Pending</option>
            <option value="NRI Bio Pending">NRI Bio Pending</option>
            <option value="Photo Pending">Photo Pending</option>
            <option value="Other Problme">Other Problme</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Agreement File
          </label>
          <input
            type="file"
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
            id="agreement-file"
          />
        </div>
      </div>
    </div>

    {isEditable && (
      <div className="flex justify-end gap-3">
        <button
          onClick={saveAgreement}
          disabled={saving}
          className="px-6 py-2.5 bg-[#00A651] hover:bg-[#008f44] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          type="button"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Agreement'}
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className="px-6 py-2.5 bg-[#00A651] hover:bg-[#008f44] text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          type="button"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
)}

       {/* 💰 PAYMENT TAB */}
{activeTab === 'payment' && (
  <div className="space-y-6">
    {/* Top Row - Agreement & Commission Amounts */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Total Agreement Amount
          </label>
          <input
            type="text"
            placeholder="e.g., 5000"
            value={payment.totalAmount}
            onChange={(e) => updatePayment('totalAmount', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commission Amount
          </label>
          <input
            type="text"
            placeholder="e.g., 500"
            value={payment.commissionAmount}
            onChange={(e) => updatePayment('commissionAmount', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Outstanding Amount
          </label>
          <input
            type="text"
            value="0.00"
            readOnly
            disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-red-600 font-medium"
          />
        </div>
      </div>
    </div>

    {/* Owner Payments Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Owner Payments
      </h3>
      {ownerPayments.map((p, i) => (
        <div key={`owner-${i}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={p.paymentDate}
                onChange={(e) => updateOwnerPayment(i, 'paymentDate', e.target.value)}
                disabled={!isEditable}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
              />
              <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount
            </label>
            <input
              type="text"
              placeholder="Amount"
              value={p.paymentAmount}
              onChange={(e) => updateOwnerPayment(i, 'paymentAmount', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mode
            </label>
            <select
              value={p.modeOfPayment}
              onChange={(e) => updateOwnerPayment(i, 'modeOfPayment', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
            >
              <option value="">Select Mode</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payer Name
            </label>
            <input
              type="text"
              placeholder="Payer Name"
              value={p.payerName}
              onChange={(e) => updateOwnerPayment(i, 'payerName', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
            />
          </div>
        </div>
      ))}
      {isEditable && (
        <button
          onClick={() =>
            setOwnerPayments([
              ...ownerPayments,
              { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' },
            ])
          }
          className="flex items-center gap-1 text-sm text-[#00A651] hover:text-[#008f44] font-medium border border-dashed border-[#00A651] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all"
          type="button"
        >
          <Plus className="w-4 h-4" /> Add Owner Payment
        </button>
      )}
    </div>

    {/* Tenant Payments Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Tenant Payments
      </h3>
      {tenantPayments.map((p, i) => (
        <div key={`tenant-${i}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={p.paymentDate}
                onChange={(e) => updateTenantPayment(i, 'paymentDate', e.target.value)}
                disabled={!isEditable}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
              />
              <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount
            </label>
            <input
              type="text"
              placeholder="Amount"
              value={p.paymentAmount}
              onChange={(e) => updateTenantPayment(i, 'paymentAmount', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mode
            </label>
            <select
              value={p.modeOfPayment}
              onChange={(e) => updateTenantPayment(i, 'modeOfPayment', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all cursor-pointer"
            >
              <option value="">Select Mode</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payer Name
            </label>
            <input
              type="text"
              placeholder="Payer Name"
              value={p.payerName}
              onChange={(e) => updateTenantPayment(i, 'payerName', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
            />
          </div>
        </div>
      ))}
      {isEditable && (
        <button
          onClick={() =>
            setTenantPayments([
              ...tenantPayments,
              { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' },
            ])
          }
          className="flex items-center gap-1 text-sm text-[#00A651] hover:text-[#008f44] font-medium border border-dashed border-[#00A651] rounded-lg px-3 py-2 hover:bg-[#f0fdf4] transition-all"
          type="button"
        >
          <Plus className="w-4 h-4" /> Add Tenant Payment
        </button>
      )}
    </div>

    {/* Total Amount Received */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Total Amount Received
        </label>
        <input
          type="text"
          value="0.00"
          readOnly
          disabled
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-[#00A651] font-medium"
        />
      </div>
    </div>

    {/* Description */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          value={payment.description}
          onChange={(e) => updatePayment('description', e.target.value)}
          disabled={!isEditable}
          placeholder="Add any payment related notes here..."
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all resize-none"
        />
      </div>
    </div>

    {/* Back Work Account Section */}
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        Back Work Account
      </h3>
      
      {/* Row 1: Govt GRN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Govt GRN Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={payment.govtGrnDate}
              onChange={(e) => updatePayment('govtGrnDate', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            />
            <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            GRN Number
          </label>
          <input
            type="text"
            placeholder="GRN Number"
            value={payment.grnNumber}
            onChange={(e) => updatePayment('grnNumber', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            GRN Amount
          </label>
          <input
            type="text"
            placeholder="GRN Amount"
            value={payment.grnAmount}
            onChange={(e) => updatePayment('grnAmount', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
      </div>

      {/* Row 2: DHC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            DHC Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={payment.dhcDate}
              onChange={(e) => updatePayment('dhcDate', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            />
            <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            DHC Number
          </label>
          <input
            type="text"
            placeholder="DHC Number"
            value={payment.dhcNumber}
            onChange={(e) => updatePayment('dhcNumber', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            DHC Amount
          </label>
          <input
            type="text"
            placeholder="DHC Amount"
            value={payment.dhcAmount}
            onChange={(e) => updatePayment('dhcAmount', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
      </div>

      {/* Row 3: Commission */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commission Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={payment.commissionDate}
              onChange={(e) => updatePayment('commissionDate', e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all pr-10"
            />
            <svg className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commission Name
          </label>
          <input
            type="text"
            placeholder="Commission Name"
            value={payment.commissionName}
            onChange={(e) => updatePayment('commissionName', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commission Amount
          </label>
          <input
            type="text"
            placeholder="Commission Amount"
            value={payment.commissionAmount}
            onChange={(e) => updatePayment('commissionAmount', e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30 disabled:bg-slate-50 transition-all"
          />
        </div>
      </div>
    </div>

    {/* Save Button */}
    {isEditable && (
      <div className="flex justify-end">
        <button
          onClick={savePayment}
          disabled={saving}
          className="px-6 py-2.5 bg-[#00A651] hover:bg-[#008f44] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          type="button"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    )}
  </div>
)}
      </div>
    </AppShell>
  );
}

// ============================================================================
// 🔹 PAGE EXPORT (with React.memo to prevent unnecessary re-renders)
// ============================================================================
export default memo(function LeadFormPage() {
  return <LeadFormContent />;
});

export type { DropdownData };
// hello