'use client';
import React, { useState, useEffect, useCallback, useTransition } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { Plus, Trash2, Search, X, Loader2, Mail, User, Calendar, Building2, Filter } from 'lucide-react';

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
  const [showFilters, setShowFilters] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('');
  
  const [isPending, startTransition] = useTransition();

  // Stable fetch function
  const fetchEmployees = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    
    try {
      const res = await apiFetch('/api/employees');
      const data = await res.json();
      startTransition(() => {
        setEmployees(prev => {
          const newData = data.employees || [];
          if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
          return newData;
        });
      });
    } catch (error) {
      console.error('Fetch error:', error);
      if (isInitial) setEmployees([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [apiFetch]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    if (mounted) fetchEmployees(true);
    return () => { mounted = false; };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Client-side filtering handled by filtered() memo
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    if (!form.firstName.trim() || !form.email.trim() || !form.password.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      
      const result = await res.json();
      const newEmployee = result.employee || result;
      
      startTransition(() => {
        setEmployees(prev => {
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
    
    setDeletingId(id);
    startTransition(() => {
      setEmployees(prev => prev.filter(e => e.id !== id));
    });
    
    try {
      await apiFetch(`/api/employees?id=${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete. Reverting...');
      fetchEmployees(false);
    } finally {
      setDeletingId(null);
    }
  };

  // Team badge color helper
  const getTeamBadge = (team: string) => {
    const colors: Record<string, string> = {
      'Calling': 'bg-blue-50 text-blue-700 border-blue-200',
      'Executive': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Backend': 'bg-purple-50 text-purple-700 border-purple-200',
      'Accounts': 'bg-amber-50 text-amber-700 border-amber-200',
      'Marketing': 'bg-pink-50 text-pink-700 border-pink-200',
    };
    return colors[team] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Memoized filter function
  const filtered = useCallback(() => {
    let result = employees;
    
    // Search filter
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(e => 
        `${e.firstName} ${e.lastName} ${e.email} ${e.team}`.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Team filter
    if (teamFilter) {
      result = result.filter(e => e.team === teamFilter);
    }
    
    return result;
  }, [employees, search, teamFilter])();

  const handleClearFilters = () => {
    setSearch('');
    setTeamFilter('');
  };

  const teams = ['Calling', 'Executive', 'Backend', 'Accounts', 'Marketing'];

  return (
    <AppShell>
      <Header title="Employee Management" />
      <div className="p-4 sm:p-6">
        
        {/* Desktop Search & Filters */}
        <div className="hidden sm:block bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search employees..." 
                className="bg-transparent text-sm outline-none w-full" 
              />
              {search && (
                <button onClick={() => setSearch('')} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            
            {(search || teamFilter) && (
              <button 
                onClick={handleClearFilters} 
                className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            )}
            
            <button 
              onClick={() => setShowModal(true)} 
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        </div>

        {/* Mobile Search & Filters */}
        <div className="sm:hidden space-y-3 mb-4">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search employees..." 
              className="bg-transparent text-sm outline-none w-full" 
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-1 text-slate-400">
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
              Filters {teamFilter && `(${teamFilter})`}
            </button>
            <button 
              onClick={() => setShowModal(true)} 
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors flex-shrink-0 shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {showFilters && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Team</label>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              {(search || teamFilter) && (
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

        {/* Desktop Table View */}
        <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/4">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/4">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Team</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-1/6">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> 
                      <span>Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    {search || teamFilter ? 'No employees match your filters' : 'No employees found'}
                  </td>
                </tr>
              ) : (
                filtered.map(emp => (
                  <tr 
                    key={`emp-${emp.id}`}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      deletingId === emp.id ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">{emp.firstName} {emp.lastName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate">{emp.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-block ${getTeamBadge(emp.team)}`}>
                        {emp.team}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(emp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleDelete(emp.id)} 
                        disabled={deletingId === emp.id || isPending}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Delete employee"
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

        {/* Mobile Card View */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> 
                <span>Loading employees...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
              {search || teamFilter ? 'No employees match your filters' : 'No employees found'}
            </div>
          ) : (
            filtered.map(emp => (
              <div 
                key={`emp-mobile-${emp.id}`}
                className={`bg-white rounded-xl border border-slate-200 p-4 space-y-3 ${
                  deletingId === emp.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 truncate">{emp.firstName} {emp.lastName}</h3>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getTeamBadge(emp.team)}`}>
                        {emp.team}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(emp.id)} 
                    disabled={deletingId === emp.id || isPending}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Delete employee"
                  >
                    {deletingId === emp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Joined {new Date(emp.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal - Add Employee */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800">Add New Employee</h3>
                <button 
                  onClick={() => { setShowModal(false); setForm({ firstName: '', lastName: '', email: '', password: '', team: 'Calling' }); }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors -mr-2"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                    <input 
                      value={form.firstName} 
                      onChange={e => setForm({...form, firstName: e.target.value})} 
                      placeholder="John" 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <input 
                      value={form.lastName} 
                      onChange={e => setForm({...form, lastName: e.target.value})} 
                      placeholder="Doe" 
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                      placeholder="john@company.com" 
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                  <input 
                    type="password" 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    placeholder="••••••••" 
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={form.team} 
                      onChange={e => setForm({...form, team: e.target.value})} 
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white appearance-none"
                    >
                      {teams.map(team => (
                        <option key={team} value={team}>{team} Team</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm p-4 sm:p-6 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => { setShowModal(false); setForm({ firstName: '', lastName: '', email: '', password: '', team: 'Calling' }); }} 
                  className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate} 
                  disabled={isPending || !form.firstName.trim() || !form.email.trim() || !form.password.trim()}
                  className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create Employee'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}