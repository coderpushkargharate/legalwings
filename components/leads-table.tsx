'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import {
  Eye,
  Pencil as Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

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
  };
  agreement?: {
    tokenNo?: string;
    status?: string;
    backOfficeStatus?: string;
    owner?: { firstName?: string; lastName?: string };
    tenant?: { firstName?: string; lastName?: string };
  };
  payment?: {
    grnNumber?: string;
    grnAmount?: number;
    dhcNumber?: string;
    dhcAmount?: number;
    commissionDate?: string;
    commissionAmount?: number;
    commissionName?: string;
    totalReceivedAmount?: number;
    outstandingAmount?: number;
    totalAmount?: number;
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
}

interface DropdownData {
  cities: { id: string; name: string }[];
  areas: { id: string; name: string; cityName?: string }[];
  leadStatuses: { key: string; value: string }[];
  agreementStatuses: { key: string; value: string }[];
  backOfficeStatuses: { key: string; value: string }[];
  executives: { id: string; name: string; userId: string }[];
}

interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (lead: Lead) => React.ReactNode;
}

interface LeadsTableProps {
  transitLevel: string;
  title: string;
  columns: Column[];
  showAddButton?: boolean;
  extraFilters?: React.ReactNode;
  onLeadAction?: (leadId: string, action: string) => void;
}

export default function LeadsTable({
  transitLevel,
  title,
  columns,
  showAddButton = true,
  extraFilters,
  onLeadAction,
}: LeadsTableProps) {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    cities: [],
    areas: [],
    leadStatuses: [],
    agreementStatuses: [],
    backOfficeStatuses: [],
    executives: [],
  });

  // Loading & pagination
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // 🔹 API-triggered filters (cause backend fetch)
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState(''); // triggers API
  const [clientType, setClientType] = useState('');
  const [leadStatus, setLeadStatus] = useState('');

  // 🔹 Local-only filters (client-side filtering, NO API call)
  const [tokenFilter, setTokenFilter] = useState('');
  const [areaTextFilter, setAreaTextFilter] = useState('');

  const pageSizeRef = useMemo(() => pageSize, []);

  // ✅ Fetch dropdowns (once on mount)
  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        const res = await apiFetch('/api/dropdowns', { method: 'POST' });
        const data = await res.json();
        setDropdowns({
          cities: data?.cities || [],
          areas: data?.areas || [],
          leadStatuses: data?.leadStatuses || [],
          agreementStatuses: data?.agreementStatuses || [],
          backOfficeStatuses: data?.backOfficeStatuses || [],
          executives: data?.executives || [],
        });
      } catch {
        setDropdowns({
          cities: [],
          areas: [],
          leadStatuses: [],
          agreementStatuses: [],
          backOfficeStatuses: [],
          executives: [],
        });
      }
    })();
  }, [authLoading, user]);

  // ✅ Fetch leads ONLY when API filters change (stable pattern)
  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSizeRef.toString(),
          transitLevel,
        });

        if (searchText) params.set('searchText', searchText);
        if (clientType) params.set('clientType', clientType);
        if (leadStatus) params.set('leadStatus', leadStatus);

        const res = await apiFetch(`/api/leads?${params.toString()}`);
        const data = await res.json();

        setLeads(data?.leadPage?.content || []);
        setTotalPages(data?.leadPage?.totalPages || 1);
      } catch {
        setLeads([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, transitLevel, searchText, clientType, leadStatus, authLoading, user]);

  // ✅ Local filtering (NO API call) - applied on fetched data
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const token = (lead?.agreement?.tokenNo || '').toLowerCase();
      const area = (lead?.client?.areaName || '').toLowerCase();

      const tokenMatch = !tokenFilter || token.includes(tokenFilter.toLowerCase());
      const areaMatch = !areaTextFilter || area.includes(areaTextFilter.toLowerCase());

      return tokenMatch && areaMatch;
    });
  }, [leads, tokenFilter, areaTextFilter]);

  // ✅ Handlers
  const handleSearchSubmit = () => {
    setSearchText(searchInput);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchText('');
    setClientType('');
    setLeadStatus('');
    setTokenFilter('');
    setAreaTextFilter('');
    setPage(0);
  };

  const handleCancel = async (id: string) => {
    const reason = prompt('Please enter the reason for cancellation:');
    if (!reason) return;

    try {
      await apiFetch('/api/leads', {
        method: 'PUT',
        body: JSON.stringify({
          id,
          leadStatus: 'CANCELLED',
          cancellationReason: reason,
        }),
      });
      // Re-fetch leads after cancel
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSizeRef.toString(),
        transitLevel,
      });
      if (searchText) params.set('searchText', searchText);
      if (clientType) params.set('clientType', clientType);
      if (leadStatus) params.set('leadStatus', leadStatus);

      const res = await apiFetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data?.leadPage?.content || []);
    } catch {
      alert('Failed to cancel lead.');
    }
  };

  const getStatusClass = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (['ASSIGNED', 'APPROVED', 'CLOSED', 'DRAFT_CONFIRM', 'COMPLETED'].includes(s))
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (['PENDING', 'POSTPONED', 'NEW', 'NEW_LEAD', 'INTERESTED'].includes(s))
      return 'bg-amber-50 text-amber-700 border-amber-200';
    if (['CANCELLED', 'REJECTED', 'NOT_INTERESTED', 'LOST'].includes(s))
      return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div>
      {/* 🔍 Filters Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              className="bg-transparent text-sm text-slate-700 outline-none w-full"
            />
          </div>

          {/* Client Type */}
          <select
            value={clientType}
            onChange={(e) => {
              setClientType(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Client Types</option>
            <option value="OWNER">Owner</option>
            <option value="TENANT">Tenant</option>
            <option value="AGENT">Agent</option>
          </select>

          {/* Lead Status */}
          <select
            value={leadStatus}
            onChange={(e) => {
              setLeadStatus(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Lead Statuses</option>
            {dropdowns.leadStatuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.value}
              </option>
            ))}
          </select>

          {/* Token Filter (Local) */}
          <input
            type="text"
            placeholder="Token No."
            value={tokenFilter}
            onChange={(e) => {
              setTokenFilter(e.target.value.replace(/[^0-9]/g, '').slice(0, 14));
              setPage(0);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none w-28 focus:ring-2 focus:ring-teal-500"
          />

          {/* Area Filter (Local) */}
          <input
            type="text"
            placeholder="Area"
            value={areaTextFilter}
            onChange={(e) => {
              setAreaTextFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none w-28 focus:ring-2 focus:ring-teal-500"
          />

          {/* Search Button (triggers API) */}
          <button
            onClick={handleSearchSubmit}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Search
          </button>

          {/* Clear Filters */}
          {(searchInput || clientType || leadStatus || tokenFilter || areaTextFilter) && (
            <button
              onClick={handleClearFilters}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear all filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {extraFilters}
        </div>
      </div>

      {/* ➕ Add Button */}
      {showAddButton && (
        <div className="mb-4">
          <Link
            href={`/leads/new?transitLevel=${transitLevel}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Lead
          </Link>
        </div>
      )}

      {/* 📊 Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-12 text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {col.render ? col.render(lead) : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/leads/${lead.id}?mode=view`}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/leads/${lead.id}?mode=edit`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleCancel(lead.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancel"
                        >
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

        {/* 📄 Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { Lead, DropdownData, Column };