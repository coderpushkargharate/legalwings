'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useAuth } from '@/components/auth-provider';
import { useApi } from '@/components/api-client';
import {
  Phone,
  UserCheck,
  Server,
  DollarSign,
  Megaphone,
  Users,
  FileText,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalLeads: number;
  totalClients: number;
  totalAgreements: number;
  newLeadsToday: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const [stats, setStats] = useState<DashboardStats>({ totalLeads: 0, totalClients: 0, totalAgreements: 0, newLeadsToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadsRes, clientsRes] = await Promise.all([
          apiFetch('/api/leads?pageSize=1'),
          apiFetch('/api/clients?pageSize=1'),
        ]);
        const leadsData = await leadsRes.json();
        const clientsData = await clientsRes.json();
        setStats({
          totalLeads: leadsData.leadPage?.totalElements || 0,
          totalClients: clientsData.clientPage?.totalElements || 0,
          totalAgreements: 0,
          newLeadsToday: 0,
        });
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const teams = [
    { name: 'Calling Team', path: '/calling-team', icon: Phone, desc: 'Manage incoming leads and calls', color: 'bg-blue-500' },
    { name: 'Executive Team', path: '/executive-team', icon: UserCheck, desc: 'Handle executive appointments', color: 'bg-emerald-500' },
    { name: 'Backend Team', path: '/backend-team', icon: Server, desc: 'Process agreements and documents', color: 'bg-amber-500' },
    { name: 'Account Team', path: '/account-team', icon: DollarSign, desc: 'Track payments and commissions', color: 'bg-rose-500' },
    { name: 'Marketing Team', path: '/marketing-team', icon: Megaphone, desc: 'Marketing campaigns and analytics', color: 'bg-cyan-500' },
  ];

  const statCards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Agreements', value: stats.totalAgreements, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'New Today', value: stats.newLeadsToday, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <AppShell>
      <Header title="Dashboard" />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Welcome back, {user?.firstName}</h2>
          <p className="text-sm text-slate-500 mt-1">Here is what is happening with your CRM today.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</span>
                <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-4">Teams</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Link
              key={team.path}
              href={team.path}
              className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-teal-200 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${team.color} rounded-xl flex items-center justify-center shadow-sm`}>
                  <team.icon className="w-6 h-6 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors" />
              </div>
              <h4 className="text-base font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">{team.name}</h4>
              <p className="text-sm text-slate-500 mt-1">{team.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
