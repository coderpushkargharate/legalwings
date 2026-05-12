'use client';

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { Plus, CreditCard as Edit, Trash2, Search, X, ChevronLeft, ChevronRight, Loader2, Phone, Mail, MapPin, User, Filter } from 'lucide-react';

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

export default function ClientsPage() {
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
  const [showFilters, setShowFilters] = useState(false);
  
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
      
      await fetchClients(false);
      
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

  // Client type badge color helper
  const getClientTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'OWNER': 'bg-emerald-100 text-emerald-700',
      'TENANT': 'bg-blue-100 text-blue-700',
      'AGENT': 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  return (
    <AppShell>
      <Header title="Client Management" />
      <div className="p-4 sm:p-6">
        {/* Refresh Indicator */}
        {isRefreshing && !initialLoading && (
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600 border border-slate-200">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating...
            </div>
          </div>
        )}

        {/* Error Message */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="font-medium hover:underline p-1">✕</button>
          </div>
        )}

        {/* Search & Filters - Desktop */}
        <div 
          className="hidden sm:block bg-white rounded-xl border border-slate-200 p-4 mb-4"
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
                aria-label="Clear filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search & Filters - Mobile */}
        <div className="sm:hidden mb-4 space-y-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent text-sm text-slate-700 outline-none w-full"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700"
            >
              <Filter className="w-4 h-4" />
              Filters {clientType && `(${clientType})`}
            </button>
            <button 
              onClick={() => fetchClients(false)} 
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors flex-shrink-0"
              disabled={isPending || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
            </button>
          </div>
          
          {showFilters && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Client Type</label>
                <select
                  value={clientType}
                  onChange={(e) => handleClientTypeChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Types</option>
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                  <option value="AGENT">Agent</option>
                </select>
              </div>
              {(searchText || clientType) && (
                <button 
                  onClick={handleClearFilters} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" /> Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add Client Button */}
        <div className="mb-4">
          <button 
            onClick={openAdd} 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> 
                        <span>Loading clients...</span>
                      </div>
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      {searchText || clientType ? 'No clients match your filters' : 'No clients found'}
                    </td>
                  </tr>
                ) : (
                  clients.map((c, i) => (
                    <tr 
                      key={`client-${c.id}`}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        deletingId === c.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-500">{i + 1 + page * 20}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 font-medium truncate">{c.firstName} {c.lastName}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.phoneNo}</td>
                      <td className="px-4 py-3 text-slate-700 truncate">{c.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block ${getClientTypeBadge(c.clientType)}`}>
                          {c.clientType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 truncate">
                        {c.cityName || c.areaName ? `${c.cityName || ''}${c.cityName && c.areaName ? ', ' : ''}${c.areaName || ''}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => openEdit(c)} 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            disabled={isPending}
                            aria-label="Edit client"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id)} 
                            disabled={deletingId === c.id || isPending}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete client"
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
          
          {/* Desktop Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePageChange(Math.max(0, page - 1))} 
                  disabled={page === 0 || isPending} 
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} 
                  disabled={page >= totalPages - 1 || isPending} 
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden space-y-3">
          {initialLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> 
                <span>Loading clients...</span>
              </div>
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
              {searchText || clientType ? 'No clients match your filters' : 'No clients found'}
            </div>
          ) : (
            clients.map((c, i) => (
              <div 
                key={`client-mobile-${c.id}`}
                className={`bg-white rounded-xl border border-slate-200 p-4 space-y-3 ${
                  deletingId === c.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 truncate">{c.firstName} {c.lastName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getClientTypeBadge(c.clientType)}`}>
                        {c.clientType}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{c.phoneNo}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {(c.cityName || c.areaName) && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{c.cityName || ''}{c.cityName && c.areaName ? ', ' : ''}{c.areaName || ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-slate-400">#{i + 1 + page * 20}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEdit(c)} 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        disabled={isPending}
                        aria-label="Edit client"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id)} 
                        disabled={deletingId === c.id || isPending}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Delete client"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3">
              <p className="text-xs text-slate-500 font-medium">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePageChange(Math.max(0, page - 1))} 
                  disabled={page === 0 || isPending} 
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg bg-white border border-slate-200"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} 
                  disabled={page >= totalPages - 1 || isPending} 
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg bg-white border border-slate-200"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal - Add/Edit Client */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800">
                  {editClient ? 'Edit Client' : 'Add Client'}
                </h3>
                <button 
                  onClick={() => { setShowModal(false); setEditClient(null); setFormError(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors -mr-2"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6">
                {formError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {formError}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                      <input 
                        value={form.firstName} 
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                      <input 
                        value={form.lastName} 
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                      <input 
                        value={form.phoneNo} 
                        onChange={(e) => setForm({ ...form, phoneNo: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                        maxLength={10}
                        placeholder="10 digits"
                        inputMode="numeric"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        value={form.email} 
                        onChange={(e) => setForm({ ...form, email: e.target.value })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Type *</label>
                    <select 
                      value={form.clientType} 
                      onChange={(e) => setForm({ ...form, clientType: e.target.value })} 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="TENANT">Tenant</option>
                      <option value="AGENT">Agent</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                      <input 
                        value={form.cityName} 
                        onChange={(e) => setForm({ ...form, cityName: e.target.value })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
                      <input 
                        value={form.areaName} 
                        onChange={(e) => setForm({ ...form, areaName: e.target.value })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar Number</label>
                      <input 
                        value={form.aadharNumber} 
                        onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                        maxLength={12}
                        placeholder="12 digits"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                      <input 
                        value={form.panNumber} 
                        onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                        maxLength={10}
                        placeholder="ABCDE1234F"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => { setShowModal(false); setEditClient(null); setFormError(null); }} 
                    className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition-colors font-medium"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={isPending || !form.firstName.trim() || !form.lastName.trim() || !form.phoneNo}
                    className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
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