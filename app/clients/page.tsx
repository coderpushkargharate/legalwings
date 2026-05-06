'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { Plus, CreditCard as Edit, Trash2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [clientType, setClientType] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phoneNo: '', email: '', clientType: 'OWNER', cityName: '', areaName: '', aadharNumber: '', panNumber: '' });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: '20' });
      if (searchText) params.set('searchText', searchText);
      if (clientType) params.set('clientType', clientType);

      const res = await apiFetch(`/api/clients?${params.toString()}`);
      const data = await res.json();
      setClients(data.clientPage?.content || []);
      setTotalPages(data.clientPage?.totalPages || 1);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, searchText, clientType]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleSave = async () => {
    try {
      if (editClient) {
        await apiFetch('/api/clients', {
          method: 'PUT',
          body: JSON.stringify({ id: editClient.id, ...form }),
        });
      } else {
        await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setShowModal(false);
      setEditClient(null);
      setForm({ firstName: '', lastName: '', phoneNo: '', email: '', clientType: 'OWNER', cityName: '', areaName: '', aadharNumber: '', panNumber: '' });
      fetchClients();
    } catch {
      alert('Failed to save client.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      await apiFetch(`/api/clients?id=${id}`, { method: 'DELETE' });
      fetchClients();
    } catch {
      alert('Failed to delete client.');
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
    setShowModal(true);
  };

  const openAdd = () => {
    setEditClient(null);
    setForm({ firstName: '', lastName: '', phoneNo: '', email: '', clientType: 'OWNER', cityName: '', areaName: '', aadharNumber: '', panNumber: '' });
    setShowModal(true);
  };

  return (
    <AppShell>
      <Header title="Client Management" />
      <div className="p-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                className="bg-transparent text-sm text-slate-700 outline-none w-full"
              />
            </div>
            <select
              value={clientType}
              onChange={(e) => { setClientType(e.target.value); setPage(0); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              <option value="OWNER">Owner</option>
              <option value="TENANT">Tenant</option>
              <option value="AGENT">Agent</option>
            </select>
            <button onClick={fetchClients} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">Submit</button>
            {(searchText || clientType) && (
              <button onClick={() => { setSearchText(''); setClientType(''); setPage(0); }} className="p-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>

        {/* Add button */}
        <div className="mb-4">
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">First Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Last Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading...</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">No clients found</td></tr>
                ) : (
                  clients.map((c, i) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500">{i + 1 + page * 20}</td>
                      <td className="px-4 py-3 text-slate-700">{c.firstName}</td>
                      <td className="px-4 py-3 text-slate-700">{c.lastName}</td>
                      <td className="px-4 py-3 text-slate-700">{c.phoneNo}</td>
                      <td className="px-4 py-3 text-slate-700">{c.email}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{c.clientType}</span></td>
                      <td className="px-4 py-3 text-slate-700">{c.cityName || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{c.areaName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">{editClient ? 'Edit Client' : 'Add Client'}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                      <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                      <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input value={form.phoneNo} onChange={(e) => setForm({ ...form, phoneNo: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" maxLength={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Type</label>
                    <select value={form.clientType} onChange={(e) => setForm({ ...form, clientType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500">
                      <option value="OWNER">Owner</option>
                      <option value="TENANT">Tenant</option>
                      <option value="AGENT">Agent</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                      <input value={form.cityName} onChange={(e) => setForm({ ...form, cityName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
                      <input value={form.areaName} onChange={(e) => setForm({ ...form, areaName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar Number</label>
                      <input value={form.aadharNumber} onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" maxLength={12} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                      <input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" maxLength={10} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => { setShowModal(false); setEditClient(null); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
