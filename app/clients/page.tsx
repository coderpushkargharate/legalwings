'use client';

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { Plus, CreditCard as Edit, Trash2, Search, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phoneNo: string;
  email: string;
  clientType: string;
  cityName?: string;
  areaName?: string;
  birthDate?: string;
  aadharNumber?: string;
  panNumber?: string;
  createdAt?: string;
}

// ✅ Removed ClientsPageProps interface - pages can't accept custom props in App Router

export default function ClientsPage() { // ✅ Removed props from function signature
  const { apiFetch } = useApi();
  const [clients, setClients] = useState<Client[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [clientType, setClientType] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ 
    firstName: '', lastName: '', phoneNo: '', email: '', 
    clientType: 'OWNER', cityName: '', areaName: '', 
    aadharNumber: '', panNumber: '' 
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const searchTimerRef = useRef<NodeJS.Timeout>();

  const fetchClients = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const params = new URLSearchParams({ 
        page: page.toString(), 
        pageSize: '20' 
      });
      if (searchText) params.set('searchText', searchText);
      if (clientType) params.set('clientType', clientType);

      const res = await apiFetch(`/api/clients?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch clients');
      }
      
      const data = await res.json();
      
      startTransition(() => {
        const newClients = data.clientPage?.content || [];
        setClients(newClients);
        setTotalPages(data.clientPage?.totalPages || 1);
      });
    } catch (error: any) {
      console.error('Fetch error:', error);
      setFormError(error.message || 'Failed to load clients');
      if (isInitial) setClients([]);
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [apiFetch, page, searchText, clientType]);

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      fetchClients(true);
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    
    searchTimerRef.current = setTimeout(() => {
      setPage(0);
      fetchClients(false);
    }, 300);
    
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchText]);

  const handleClientTypeChange = (value: string) => {
    setClientType(value);
    setPage(0);
    fetchClients(false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchClients(false);
  };

  const handleSave = async () => {
    setFormError(null);
    
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNo) {
      setFormError('First name, last name, and phone number are required');
      return;
    }

    try {
      const payload = { 
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNo: form.phoneNo,
        email: form.email?.trim() || '',
        clientType: form.clientType,
        cityName: form.cityName?.trim() || '',
        areaName: form.areaName?.trim() || '',
        aadharNumber: form.aadharNumber?.trim() || '',
        panNumber: form.panNumber?.trim() || '',
      };

      let response;
      if (editClient) {
        response = await apiFetch('/api/clients', {
          method: 'PUT',
          body: JSON.stringify({ id: editClient.id, ...payload }),
        });
      } else {
        response = await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 409 && errorData.existingClient) {
          setFormError(`Client with phone ${form.phoneNo} already exists`);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to save client');
      }
      
      const savedClient = await response.json();
      
      // ✅ Removed onClientCreated/onClientUpdated callbacks
      // Data refresh below ensures UI stays consistent
      
      await fetchClients(false); // ✅ Already refreshing, so callbacks were redundant
      
      setShowModal(false);
      setEditClient(null);
      setForm({ 
        firstName: '', lastName: '', phoneNo: '', email: '', 
        clientType: 'OWNER', cityName: '', areaName: '', 
        aadharNumber: '', panNumber: '' 
      });
      
    } catch (error: any) {
      console.error('Save error:', error);
      setFormError(error.message || 'Failed to save client.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    setDeletingId(id);
    
    startTransition(() => {
      setClients(prev => prev.filter(c => c.id !== id));
    });
    
    try {
      const response = await apiFetch(`/api/clients?id=${id}`, { method: 'DELETE' });
      
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      
      await fetchClients(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      setFormError(error.message || 'Failed to delete client. Reverting...');
      await fetchClients(false);
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setForm({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      phoneNo: client.phoneNo || '',
      email: client.email || '',
      clientType: client.clientType || 'OWNER',
      cityName: client.cityName || '',
      areaName: client.areaName || '',
      aadharNumber: client.aadharNumber || '',
      panNumber: client.panNumber || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const openAdd = () => {
    setEditClient(null);
    setForm({ 
      firstName: '', lastName: '', phoneNo: '', email: '', 
      clientType: 'OWNER', cityName: '', areaName: '', 
      aadharNumber: '', panNumber: '' 
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
  };

  const handleClearFilters = () => {
    setSearchText('');
    setClientType('');
    setPage(0);
    fetchClients(false);
  };

  const refreshClients = useCallback(() => {
    fetchClients(false);
  }, [fetchClients]);

  return (
    <AppShell>
      <Header title="Client Management" />
      <div className="p-6">
        {isRefreshing && !initialLoading && (
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600 border border-slate-200">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating...
            </div>
          </div>
        )}

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="font-medium hover:underline">✕</button>
          </div>
        )}

        <div 
          className="bg-white rounded-xl border border-slate-200 p-4 mb-4 will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none w-full"
              />
            </div>
            <select
              value={clientType}
              onChange={(e) => handleClientTypeChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              <option value="OWNER">Owner</option>
              <option value="TENANT">Tenant</option>
              <option value="AGENT">Agent</option>
            </select>
            <button 
              onClick={() => fetchClients(false)} 
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex-shrink-0"
              disabled={isPending || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
            </button>
            {(searchText || clientType) && (
              <button 
                onClick={handleClearFilters} 
                className="p-2 text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <button 
            onClick={openAdd} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>

        <div 
          className="bg-white rounded-xl border border-slate-200 overflow-hidden will-change-transform"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">First Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Last Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">City</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> 
                        <span>Loading clients...</span>
                      </div>
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      {searchText || clientType ? 'No clients match your filters' : 'No clients found'}
                    </td>
                  </tr>
                ) : (
                  clients.map((c, i) => (
                    <tr 
                      key={`client-${c.id}`}
                      className={`hover:bg-slate-50/50 transition-colors will-change-transform ${
                        deletingId === c.id ? 'opacity-50' : ''
                      }`}
                      style={{ transform: 'translateZ(0)' }}
                    >
                      <td className="px-4 py-3 text-slate-500 truncate">{i + 1 + page * 20}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.firstName}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.lastName}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.phoneNo}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.email}</td>
                      <td className="px-4 py-3 truncate">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 inline-block">
                          {c.clientType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.cityName || '-'}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.areaName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => openEdit(c)} 
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            disabled={isPending}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id)} 
                            disabled={deletingId === c.id || isPending}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePageChange(Math.max(0, page - 1))} 
                  disabled={page === 0 || isPending} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} 
                  disabled={page >= totalPages - 1 || isPending} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {showModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {editClient ? 'Edit Client' : 'Add Client'}
                  </h3>
                  <button 
                    onClick={() => { setShowModal(false); setEditClient(null); setFormError(null); }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {formError && (
                  <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {formError}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                      <input 
                        value={form.firstName} 
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                      <input 
                        value={form.lastName} 
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                      <input 
                        value={form.phoneNo} 
                        onChange={(e) => setForm({ ...form, phoneNo: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                        maxLength={10}
                        placeholder="10 digits"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        value={form.email} 
                        onChange={(e) => setForm({ ...form, email: e.target.value })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Type *</label>
                    <select 
                      value={form.clientType} 
                      onChange={(e) => setForm({ ...form, clientType: e.target.value })} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="TENANT">Tenant</option>
                      <option value="AGENT">Agent</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                      <input 
                        value={form.cityName} 
                        onChange={(e) => setForm({ ...form, cityName: e.target.value })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
                      <input 
                        value={form.areaName} 
                        onChange={(e) => setForm({ ...form, areaName: e.target.value })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar Number</label>
                      <input 
                        value={form.aadharNumber} 
                        onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                        maxLength={12}
                        placeholder="12 digits"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                      <input 
                        value={form.panNumber} 
                        onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                        maxLength={10}
                        placeholder="ABCDE1234F"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => { setShowModal(false); setEditClient(null); setFormError(null); }} 
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={isPending || !form.firstName.trim() || !form.lastName.trim() || !form.phoneNo}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      'Save Client'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}