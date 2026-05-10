'use client';
import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, User } from 'lucide-react';
import { useApi } from '@/components/api-client';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
  fullName: string;
  roles: string[];
}

interface TeamSelectionModalProps {
  isOpen: boolean;
  leadId: string;
  onSend: (leadId: string, team: string, employeeId?: string, employeeName?: string) => void;
  onClose: () => void;
}

export default function TeamSelectionModal({ isOpen, leadId, onSend, onClose }: TeamSelectionModalProps) {
  const { apiFetch } = useApi();
  const [selectedTeam, setSelectedTeam] = useState<'Calling' | 'Executive' | 'Backend' | 'Accounts' | 'Marketing'>('Calling');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch employees when team changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await apiFetch(`/api/employees?team=${selectedTeam}`);
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || []);
        } else {
          setEmployees([]);
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    
    fetchEmployees();
    setSelectedEmployee(''); // Reset employee selection on team change
  }, [selectedTeam, isOpen, apiFetch]);

  const teams = [
    { 
      key: 'Calling', 
      label: 'Calling Team', 
      icon: '📞', 
      transitLevel: 'CALLING_TEAM',
      color: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700',
      desc: 'Initial lead qualification & follow-ups'
    },
    { 
      key: 'Executive', 
      label: 'Executive Team', 
      icon: '👔', 
      transitLevel: 'EXECUTIVE_TEAM',
      color: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-700',
      desc: 'Site visits & appointment scheduling'
    },
    { 
      key: 'Backend', 
      label: 'Backend Team', 
      icon: '⚙️', 
      transitLevel: 'BACKEND_TEAM',
      color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700',
      desc: 'Agreement processing & documentation'
    },
    { 
      key: 'Accounts', 
      label: 'Account Team', 
      icon: '💰', 
      transitLevel: 'ACCOUNTS_TEAM',
      color: 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-700',
      desc: 'Payment tracking & commission management'
    },
    { 
      key: 'Marketing', 
      label: 'Marketing Team', 
      icon: '📢', 
      transitLevel: 'MARKETING_TEAM',
      color: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400 text-cyan-700',
      desc: 'Campaign management & lead sourcing'
    },
  ];

  const handleSend = async () => {
    if (!leadId) return;
    
    setSending(true);
    try {
      const employee = employees.find(e => e.id === selectedEmployee);
      
      await onSend(
        leadId, 
        teams.find(t => t.key === selectedTeam)?.transitLevel || selectedTeam,
        selectedEmployee || undefined,
        employee?.fullName || undefined
      );
      
      onClose();
    } catch (error) {
      console.error('Failed to send lead:', error);
      alert('Failed to forward lead. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Forward Lead</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            disabled={sending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Select Team */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">1</span>
              Select Team:
            </p>
            <div className="grid gap-2">
              {teams.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedTeam(t.key as any)}
                  disabled={sending}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedTeam === t.key 
                      ? t.color + ' border-opacity-100 shadow-sm ring-2 ring-offset-1 ring-amber-500' 
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl mt-0.5">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800">{t.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
                  </div>
                  {selectedTeam === t.key && (
                    <div className="w-2.5 h-2.5 rounded-full bg-current mt-2 flex-shrink-0 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Optional - Select Specific Employee */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">2</span>
              Assign to Specific Employee (Optional):
            </p>
            
            {loadingEmployees ? (
              <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-lg text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading team members...
              </div>
            ) : employees.length === 0 ? (
              <div className="py-3 px-4 bg-slate-50 rounded-lg text-sm text-slate-500 flex items-center gap-2">
                <User className="w-4 h-4" />
                No employees found in {selectedTeam} Team. Lead will go to team queue.
              </div>
            ) : (
              <>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  disabled={sending}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition-all cursor-pointer"
                >
                  <option value="">→ Send to entire {selectedTeam} Team Queue</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.email})
                    </option>
                  ))}
                </select>
                {selectedEmployee && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    ✓ Lead will be assigned to: <strong>{employees.find(e => e.id === selectedEmployee)?.fullName}</strong>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Summary:</strong> Lead #{leadId.slice(-6)} → {teams.find(t => t.key === selectedTeam)?.label}
              {selectedEmployee && ` → ${employees.find(e => e.id === selectedEmployee)?.fullName}`}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 justify-end p-5 border-t border-slate-200 bg-slate-50">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedTeam}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Forward Lead
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}