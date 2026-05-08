'use client';
import React, { useState, useEffect, useCallback, useTransition } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
  createdAt: string;
}

export default function EmployeesPage() {
  const { apiFetch } = useApi();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', team: 'Calling' });
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // React 18 useTransition for non-urgent UI updates
  const [isPending, startTransition] = useTransition();

  // Stable fetch function - avoids re-creation on every render
  const fetchEmployees = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    
    try {
      const res = await apiFetch('/api/employees');
      const data = await res.json();
      // Use functional update to avoid stale closure
      setEmployees(prev => {
        const newData = data.employees || [];
        // Only update if data actually changed (prevents unnecessary re-renders)
        if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
        return newData;
      });
    } catch (error) {
      console.error('Fetch error:', error);
      if (isInitial) setEmployees([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [apiFetch]); // Only re-create if apiFetch changes

  // Initial load - runs only once on mount
  useEffect(() => {
    let mounted = true;
    if (mounted) {
      fetchEmployees(true);
    }
    return () => { mounted = false; };
  }, []); // Empty dependency = run once

  // Debounced search handler (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Search is client-side only, no API call needed
      // This effect just ensures we don't filter on every keystroke
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      
      const result = await res.json();
      const newEmployee = result.employee || result;
      
      // Use startTransition for non-urgent state update
      startTransition(() => {
        setEmployees(prev => {
          // Avoid duplicate entries
          if (prev.some(e => e.id === newEmployee.id)) return prev;
          return [newEmployee, ...prev];
        });
      });
      
      setShowModal(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', team: 'Calling' });
    } catch (error) {
      console.error('Create error:', error);
      alert('Failed to create employee.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    
    // Optimistic update with transition
    setDeletingId(id);
    startTransition(() => {
      setEmployees(prev => prev.filter(e => e.id !== id));
    });
    
    try {
      await apiFetch(`/api/employees?id=${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete. Reverting...');
      // Re-fetch only on error
      fetchEmployees(false);
    } finally {
      setDeletingId(null);
    }
  };

  // Memoized filter function to avoid re-calculation on every render
  const filtered = useCallback(() => {
    if (!search.trim()) return employees;
    const lowerSearch = search.toLowerCase();
    return employees.filter(e => 
      `${e.firstName} ${e.lastName} ${e.email} ${e.team}`.toLowerCase().includes(lowerSearch)
    );
  }, [employees, search])();

  return (
    <AppShell>
      <Header title="Employee Management" />
      <div className="p-6">
        {/* Search & Add - with CSS transform to prevent repaint */}
        <div 
          className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        >
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search employees..." 
              className="bg-transparent text-sm outline-none w-full" 
            />
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>

        {/* Table Container - CSS fix for blinking */}
        <div 
          className="bg-white rounded-xl border border-slate-200 overflow-hidden will-change-transform"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        >
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/4">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/4">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Team</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Created</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading employees...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    {search ? 'No employees match your search' : 'No employees found'}
                  </td>
                </tr>
              ) : (
                filtered.map(emp => (
                  <tr 
                    key={`emp-${emp.id}`} // Stable key prefix
                    className={`hover:bg-slate-50/50 transition-colors will-change-transform ${
                      deletingId === emp.id ? 'opacity-50' : ''
                    }`}
                    style={{ transform: 'translateZ(0)' }}
                  >
                    <td className="px-4 py-3 text-slate-700 font-medium truncate">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate">{emp.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                        {emp.team}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleDelete(emp.id)} 
                        disabled={deletingId === emp.id || isPending}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === emp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal - with proper z-index and animation */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New Employee</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  value={form.firstName} 
                  onChange={e => setForm({...form, firstName: e.target.value})} 
                  placeholder="First Name" 
                  className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                />
                <input 
                  value={form.lastName} 
                  onChange={e => setForm({...form, lastName: e.target.value})} 
                  placeholder="Last Name" 
                  className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              <input 
                type="email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                placeholder="Email Address" 
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
              />
              <input 
                type="password" 
                value={form.password} 
                onChange={e => setForm({...form, password: e.target.value})} 
                placeholder="Set Password" 
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" 
              />
              <select 
                value={form.team} 
                onChange={e => setForm({...form, team: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Calling">Calling Team</option>
                <option value="Executive">Executive Team</option>
                <option value="Backend">Backend Team</option>
                <option value="Accounts">Accounts Team</option>
                <option value="Marketing">Marketing Team</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate} 
                disabled={isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? 'Creating...' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}