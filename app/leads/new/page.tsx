'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import { ArrowLeft, Save, ChevronRight, Plus, X } from 'lucide-react';

interface DropdownData {
  cities: { id: string; name: string }[];
  areas: { id: string; name: string; cityName?: string }[];
  leadStatuses: { key: string; value: string }[];
  agreementStatuses: { key: string; value: string }[];
  backOfficeStatuses: { key: string; value: string }[];
}

function LeadFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const mode = searchParams.get('mode') || 'new';
  const leadId = searchParams.get('id');
  const transitLevel = searchParams.get('transitLevel') || 'CALLING_TEAM';

  const [activeTab, setActiveTab] = useState('lead');
  const [dropdowns, setDropdowns] = useState<DropdownData>({ cities: [], areas: [], leadStatuses: [], agreementStatuses: [], backOfficeStatuses: [] });
  const [saving, setSaving] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState(leadId || '');

  const [lead, setLead] = useState({
    firstName: '', lastName: '', email: '', contactNumber: '', clientType: 'OWNER',
    leadSource: '', leadStatus: 'NEW_LEAD', description: '', visitAddress: '',
    appointmentTime: '', referenceName: '', referenceNumber: '', amount: '',
    lastFollowUpDate: '', nextFollowUpDate: '', tentativeAgreementDate: '',
    cityId: '', areaId: '',
  });

  const [agreement, setAgreement] = useState({
    tokenNumber: '', agreementStartDate: '', agreementEndDate: '',
    addressLine1: '', addressLine2: '', agreementStatus: '', backOfficeStatus: '',
    ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerContact: '',
    ownerAadhar: '', ownerPan: '',
    tenantFirstName: '', tenantLastName: '', tenantEmail: '', tenantContact: '',
    tenantAadhar: '', tenantPan: '',
  });

  const [payment, setPayment] = useState({
    totalAmount: '', commissionAmount: '', commissionName: '', commissionDate: '',
    grnNumber: '', grnAmount: '', govtGrnDate: '', dhcNumber: '', dhcAmount: '',
    dhcDate: '', description: '',
  });

  const [ownerPayments, setOwnerPayments] = useState([{ paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }]);
  const [tenantPayments, setTenantPayments] = useState([{ paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dropdowns', { method: 'POST' });
      const data = await res.json();
      setDropdowns(data);
    } catch { /* empty */ }
  }, [apiFetch]);

  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await apiFetch(`/api/leads?id=${leadId}`);
      const data = await res.json();
      setCurrentLeadId(data.id);
      setLead({
        firstName: data.client?.firstName || '', lastName: data.client?.lastName || '',
        email: data.client?.email || '', contactNumber: data.client?.phoneNo || '',
        clientType: data.client?.clientType || 'OWNER', leadSource: data.leadSource || '',
        leadStatus: data.leadStatus || 'NEW_LEAD', description: data.description || '',
        visitAddress: data.visitAddress || '', appointmentTime: data.appointmentTime || '',
        referenceName: data.referenceName || '', referenceNumber: data.referenceNumber || '',
        amount: data.amount || '', lastFollowUpDate: data.lastFollowUpDate || '',
        nextFollowUpDate: data.nextFollowUpDate || '', tentativeAgreementDate: data.tentativeAgreementDate || '',
        cityId: data.city?.id || '', areaId: data.area?.id || '',
      });
      if (data.agreement) {
        setAgreement({
          tokenNumber: data.agreement.tokenNo || '', agreementStartDate: data.agreement.agreementStartDate || '',
          agreementEndDate: data.agreement.agreementEndDate || '', addressLine1: data.agreement.addressLine1 || '',
          addressLine2: data.agreement.addressLine2 || '', agreementStatus: data.agreement.status || '',
          backOfficeStatus: data.agreement.backOfficeStatus || '',
          ownerFirstName: data.agreement.owner?.firstName || '', ownerLastName: data.agreement.owner?.lastName || '',
          ownerEmail: data.agreement.owner?.email || '', ownerContact: data.agreement.owner?.phoneNo || '',
          ownerAadhar: data.agreement.owner?.aadharNumber || '', ownerPan: data.agreement.owner?.panNumber || '',
          tenantFirstName: data.agreement.tenant?.firstName || '', tenantLastName: data.agreement.tenant?.lastName || '',
          tenantEmail: data.agreement.tenant?.email || '', tenantContact: data.agreement.tenant?.phoneNo || '',
          tenantAadhar: data.agreement.tenant?.aadharNumber || '', tenantPan: data.agreement.tenant?.panNumber || '',
        });
      }
      if (data.payment) {
        setPayment({
          totalAmount: data.payment.totalAmount || '', commissionAmount: data.payment.commissionAmount || '',
          commissionName: data.payment.commissionName || '', commissionDate: data.payment.commissionDate || '',
          grnNumber: data.payment.grnNumber || '', grnAmount: data.payment.grnAmount || '',
          govtGrnDate: data.payment.govtGrnDate || '', dhcNumber: data.payment.dhcNumber || '',
          dhcAmount: data.payment.dhcAmount || '', dhcDate: data.payment.dhcDate || '',
          description: data.payment.description || '',
        });
      }
    } catch { /* empty */ }
  }, [apiFetch, leadId]);

  useEffect(() => { fetchDropdowns(); fetchLead(); }, [fetchDropdowns, fetchLead]);

  const isView = mode === 'view';

  const saveLead = async () => {
    setSaving(true);
    try {
      const payload = {
        ...lead,
        transitLevel,
        client: { firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phoneNo: lead.contactNumber, clientType: lead.clientType },
        city: lead.cityId ? { id: lead.cityId } : null,
        area: lead.areaId ? { id: lead.areaId } : null,
      };

      if (currentLeadId) {
        await apiFetch('/api/leads', { method: 'PUT', body: JSON.stringify({ id: currentLeadId, ...payload }) });
      } else {
        const res = await apiFetch('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        setCurrentLeadId(data.id);
      }
      setActiveTab('client');
    } catch {
      alert('Failed to save lead.');
    } finally {
      setSaving(false);
    }
  };

  const saveAgreement = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/agreements', {
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
          owner: { firstName: agreement.ownerFirstName, lastName: agreement.ownerLastName, email: agreement.ownerEmail, phoneNo: agreement.ownerContact, aadharNumber: agreement.ownerAadhar, panNumber: agreement.ownerPan, clientType: 'OWNER' },
          tenant: { firstName: agreement.tenantFirstName, lastName: agreement.tenantLastName, email: agreement.tenantEmail, phoneNo: agreement.tenantContact, aadharNumber: agreement.tenantAadhar, panNumber: agreement.tenantPan, clientType: 'TENANT' },
        }),
      });
      setActiveTab('payment');
    } catch {
      alert('Failed to save agreement.');
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/payments', {
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
            ...ownerPayments.filter(p => p.paymentAmount).map(p => ({ ...p, clientType: 'OWNER' })),
            ...tenantPayments.filter(p => p.paymentAmount).map(p => ({ ...p, clientType: 'TENANT' })),
          ],
        }),
      });
      alert('Payment saved successfully!');
    } catch {
      alert('Failed to save payment.');
    } finally {
      setSaving(false);
    }
  };

  const Input = ({ label, value, onChange, type = 'text', readOnly = false, maxLength }: { label: string; value: string; onChange: (v: string) => void; type?: string; readOnly?: boolean; maxLength?: number }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly || isView}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );

  const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { key: string; value: string }[] | string[] }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isView}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <option value="">Select {label}</option>
        {options.map((opt) => {
          const key = typeof opt === 'string' ? opt : opt.key;
          const label = typeof opt === 'string' ? opt : opt.value;
          return <option key={key} value={key}>{label}</option>;
        })}
      </select>
    </div>
  );

  const tabs = [
    { key: 'lead', label: 'Lead Details' },
    { key: 'client', label: 'Client & Agreement' },
    { key: 'payment', label: 'Payment Details' },
  ];

  return (
    <AppShell>
      <Header title={mode === 'view' ? 'View Lead' : mode === 'edit' ? 'Edit Lead' : 'Add New Lead'} />
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back button */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lead Tab */}
        {activeTab === 'lead' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Lead Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="First Name" value={lead.firstName} onChange={(v) => setLead({ ...lead, firstName: v })} />
              <Input label="Last Name" value={lead.lastName} onChange={(v) => setLead({ ...lead, lastName: v })} />
              <Select label="Client Type" value={lead.clientType} onChange={(v) => setLead({ ...lead, clientType: v })} options={['OWNER', 'TENANT', 'AGENT']} />
              <Input label="Contact Number" value={lead.contactNumber} onChange={(v) => setLead({ ...lead, contactNumber: v.replace(/[^0-9]/g, '').slice(0, 10) })} maxLength={10} />
              <Input label="Email" value={lead.email} onChange={(v) => setLead({ ...lead, email: v })} type="email" />
              <Select label="Lead Source" value={lead.leadSource} onChange={(v) => setLead({ ...lead, leadSource: v })} options={['ONLINE', 'CALL', 'EXCEL', 'REFERENCE', 'SHOP']} />
              <Select label="Lead Status" value={lead.leadStatus} onChange={(v) => setLead({ ...lead, leadStatus: v })} options={dropdowns.leadStatuses} />
              <Input label="Amount" value={lead.amount} onChange={(v) => setLead({ ...lead, amount: v })} />
              <Input label="Visit Address" value={lead.visitAddress} onChange={(v) => setLead({ ...lead, visitAddress: v })} />
              <Input label="Reference Name" value={lead.referenceName} onChange={(v) => setLead({ ...lead, referenceName: v })} />
              <Input label="Reference Number" value={lead.referenceNumber} onChange={(v) => setLead({ ...lead, referenceNumber: v })} />
              <Input label="Description" value={lead.description} onChange={(v) => setLead({ ...lead, description: v })} />
              <Input label="Tentative Agreement Date" value={lead.tentativeAgreementDate} onChange={(v) => setLead({ ...lead, tentativeAgreementDate: v })} type="date" />
              <Input label="Appointment Time" value={lead.appointmentTime} onChange={(v) => setLead({ ...lead, appointmentTime: v })} type="datetime-local" />
              <Input label="Last Follow Up" value={lead.lastFollowUpDate} onChange={(v) => setLead({ ...lead, lastFollowUpDate: v })} type="date" />
              <Input label="Next Follow Up" value={lead.nextFollowUpDate} onChange={(v) => setLead({ ...lead, nextFollowUpDate: v })} type="date" />
              <Select label="City" value={lead.cityId} onChange={(v) => setLead({ ...lead, cityId: v })} options={dropdowns.cities.map(c => ({ key: c.id, value: c.name }))} />
              <Select label="Area" value={lead.areaId} onChange={(v) => setLead({ ...lead, areaId: v })} options={dropdowns.areas.map(a => ({ key: a.id, value: a.name }))} />
            </div>
            {!isView && (
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={saveLead} disabled={saving} className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Lead'}
                </button>
                <button onClick={() => setActiveTab('client')} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Client & Agreement Tab */}
        {activeTab === 'client' && (
          <div className="space-y-6">
            {/* Owner */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-4">Owner Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="First Name" value={agreement.ownerFirstName} onChange={(v) => setAgreement({ ...agreement, ownerFirstName: v })} />
                <Input label="Last Name" value={agreement.ownerLastName} onChange={(v) => setAgreement({ ...agreement, ownerLastName: v })} />
                <Input label="Email" value={agreement.ownerEmail} onChange={(v) => setAgreement({ ...agreement, ownerEmail: v })} type="email" />
                <Input label="Contact" value={agreement.ownerContact} onChange={(v) => setAgreement({ ...agreement, ownerContact: v.replace(/[^0-9]/g, '').slice(0, 10) })} maxLength={10} />
                <Input label="Aadhar Number" value={agreement.ownerAadhar} onChange={(v) => setAgreement({ ...agreement, ownerAadhar: v.replace(/[^0-9]/g, '').slice(0, 12) })} maxLength={12} />
                <Input label="PAN Number" value={agreement.ownerPan} onChange={(v) => setAgreement({ ...agreement, ownerPan: v.toUpperCase() })} maxLength={10} />
              </div>
            </div>

            {/* Tenant */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-4">Tenant Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="First Name" value={agreement.tenantFirstName} onChange={(v) => setAgreement({ ...agreement, tenantFirstName: v })} />
                <Input label="Last Name" value={agreement.tenantLastName} onChange={(v) => setAgreement({ ...agreement, tenantLastName: v })} />
                <Input label="Email" value={agreement.tenantEmail} onChange={(v) => setAgreement({ ...agreement, tenantEmail: v })} type="email" />
                <Input label="Contact" value={agreement.tenantContact} onChange={(v) => setAgreement({ ...agreement, tenantContact: v.replace(/[^0-9]/g, '').slice(0, 10) })} maxLength={10} />
                <Input label="Aadhar Number" value={agreement.tenantAadhar} onChange={(v) => setAgreement({ ...agreement, tenantAadhar: v.replace(/[^0-9]/g, '').slice(0, 12) })} maxLength={12} />
                <Input label="PAN Number" value={agreement.tenantPan} onChange={(v) => setAgreement({ ...agreement, tenantPan: v.toUpperCase() })} maxLength={10} />
              </div>
            </div>

            {/* Agreement */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-4">Agreement Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Token Number" value={agreement.tokenNumber} onChange={(v) => setAgreement({ ...agreement, tokenNumber: v.replace(/[^0-9]/g, '').slice(0, 14) })} maxLength={14} />
                <Input label="Start Date" value={agreement.agreementStartDate} onChange={(v) => setAgreement({ ...agreement, agreementStartDate: v })} type="date" />
                <Input label="End Date" value={agreement.agreementEndDate} onChange={(v) => setAgreement({ ...agreement, agreementEndDate: v })} type="date" />
                <Input label="Address Line 1" value={agreement.addressLine1} onChange={(v) => setAgreement({ ...agreement, addressLine1: v })} />
                <Input label="Address Line 2" value={agreement.addressLine2} onChange={(v) => setAgreement({ ...agreement, addressLine2: v })} />
                <Select label="Agreement Status" value={agreement.agreementStatus} onChange={(v) => setAgreement({ ...agreement, agreementStatus: v })} options={dropdowns.agreementStatuses} />
                <Select label="Back Office Status" value={agreement.backOfficeStatus} onChange={(v) => setAgreement({ ...agreement, backOfficeStatus: v })} options={dropdowns.backOfficeStatuses} />
              </div>
            </div>

            {!isView && (
              <div className="flex justify-end gap-3">
                <button onClick={saveAgreement} disabled={saving} className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Agreement'}
                </button>
                <button onClick={() => setActiveTab('payment')} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-4">Payment Details {agreement.tokenNumber ? `(${agreement.tokenNumber})` : ''}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Total Agreement Amount" value={payment.totalAmount} onChange={(v) => setPayment({ ...payment, totalAmount: v })} />
                <Input label="Commission Amount" value={payment.commissionAmount} onChange={(v) => setPayment({ ...payment, commissionAmount: v })} />
                <Input label="Commission Name" value={payment.commissionName} onChange={(v) => setPayment({ ...payment, commissionName: v })} />
                <Input label="Commission Date" value={payment.commissionDate} onChange={(v) => setPayment({ ...payment, commissionDate: v })} type="date" />
                <Input label="GRN Number" value={payment.grnNumber} onChange={(v) => setPayment({ ...payment, grnNumber: v })} />
                <Input label="GRN Amount" value={payment.grnAmount} onChange={(v) => setPayment({ ...payment, grnAmount: v })} />
                <Input label="Govt GRN Date" value={payment.govtGrnDate} onChange={(v) => setPayment({ ...payment, govtGrnDate: v })} type="date" />
                <Input label="DHC Number" value={payment.dhcNumber} onChange={(v) => setPayment({ ...payment, dhcNumber: v })} />
                <Input label="DHC Amount" value={payment.dhcAmount} onChange={(v) => setPayment({ ...payment, dhcAmount: v })} />
                <Input label="DHC Date" value={payment.dhcDate} onChange={(v) => setPayment({ ...payment, dhcDate: v })} type="date" />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={payment.description}
                  onChange={(e) => setPayment({ ...payment, description: e.target.value })}
                  disabled={isView}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Owner Payments */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">Owner Payments</h3>
                {!isView && (
                  <button onClick={() => setOwnerPayments([...ownerPayments, { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }])} className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
              </div>
              {ownerPayments.map((p, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3 items-end">
                  <Input label="Date" value={p.paymentDate} onChange={(v) => { const n = [...ownerPayments]; n[i].paymentDate = v; setOwnerPayments(n); }} type="date" />
                  <Input label="Amount" value={p.paymentAmount} onChange={(v) => { const n = [...ownerPayments]; n[i].paymentAmount = v; setOwnerPayments(n); }} />
                  <Select label="Mode" value={p.modeOfPayment} onChange={(v) => { const n = [...ownerPayments]; n[i].modeOfPayment = v; setOwnerPayments(n); }} options={['CASH', 'ONLINE', 'CHEQUE']} />
                  <Input label="Payer Name" value={p.payerName} onChange={(v) => { const n = [...ownerPayments]; n[i].payerName = v; setOwnerPayments(n); }} />
                  {!isView && ownerPayments.length > 1 && (
                    <button onClick={() => setOwnerPayments(ownerPayments.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600 self-end mb-1"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>

            {/* Tenant Payments */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">Tenant Payments</h3>
                {!isView && (
                  <button onClick={() => setTenantPayments([...tenantPayments, { paymentDate: '', paymentAmount: '', modeOfPayment: '', payerName: '' }])} className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
              </div>
              {tenantPayments.map((p, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3 items-end">
                  <Input label="Date" value={p.paymentDate} onChange={(v) => { const n = [...tenantPayments]; n[i].paymentDate = v; setTenantPayments(n); }} type="date" />
                  <Input label="Amount" value={p.paymentAmount} onChange={(v) => { const n = [...tenantPayments]; n[i].paymentAmount = v; setTenantPayments(n); }} />
                  <Select label="Mode" value={p.modeOfPayment} onChange={(v) => { const n = [...tenantPayments]; n[i].modeOfPayment = v; setTenantPayments(n); }} options={['CASH', 'ONLINE', 'CHEQUE']} />
                  <Input label="Payer Name" value={p.payerName} onChange={(v) => { const n = [...tenantPayments]; n[i].payerName = v; setTenantPayments(n); }} />
                  {!isView && tenantPayments.length > 1 && (
                    <button onClick={() => setTenantPayments(tenantPayments.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600 self-end mb-1"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>

            {!isView && (
              <div className="flex justify-end gap-3">
                <button onClick={savePayment} disabled={saving} className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function LeadFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <LeadFormContent />
    </Suspense>
  );
}
