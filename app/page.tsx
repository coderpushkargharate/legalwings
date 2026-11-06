'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useAuth } from '@/components/auth-provider';
import { useApi } from '@/components/api-client';
import AdminUserHistory from '@/components/admin-user-history';
import AdminOverview from '@/components/admin-overview';
import AdminAllLeads from '@/components/admin-all-leads';
import AdminTeamReports from '@/components/team-reports';
import {
  Users,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ExternalLink,
  Link2,
} from 'lucide-react';

// 🔹 Quick links shown on every user's dashboard (admin + all employees)
const quickLinks = [
  { label: '1.9', url: 'https://efilingigr.maharashtra.gov.in/ereg/', color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 hover:border-teal-400' },
  { label: '2.0', url: 'https://leaveandlicense.igrmaharashtra.gov.in/', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-400' },
  { label: 'Thumb Unlock', url: 'https://myaadhaarbeta.uidai.gov.in/lock-unlock-biometrics/en', color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-400' },
  { label: 'Fees Calculator', url: 'https://legalwing.in/calculator/', color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400' },
];

interface DashboardStats {
  totalLeads: number;
  totalClients: number;
  totalAgreements: number;
  newLeadsToday: number;
}

// 🔹 Extend User type locally for team property
interface ExtendedUser {
  team?: string;
  roles?: string[];
  firstName: string;
  [key: string]: any;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const [stats, setStats] = useState<DashboardStats>({ 
    totalLeads: 0, 
    totalClients: 0, 
    totalAgreements: 0, 
    newLeadsToday: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        setLoading(true);

        const [leadsRes, clientsRes] = await Promise.all([
          apiFetch('/api/leads?pageSize=1'),
          apiFetch('/api/clients?pageSize=1'),
        ]);

        if (!leadsRes.ok || !clientsRes.ok) {
          console.error('API error', leadsRes.status, clientsRes.status);
          return;
        }

        const leadsData = await leadsRes.json();
        const clientsData = await clientsRes.json();

        setStats({
          totalLeads: leadsData.leadPage?.totalElements || 0,
          totalClients: clientsData.clientPage?.totalElements || 0,
          totalAgreements: 0,
          newLeadsToday: 0,
        });

      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Agreements', value: stats.totalAgreements, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'New Today', value: stats.newLeadsToday, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (!user) {
    return (
      <AppShell>
        <Header title="Dashboard" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </AppShell>
    );
  }

  // 🔹 Cast user for template access too
  const extendedUser = user as ExtendedUser;

  return (
    <AppShell>
      <Header title="Dashboard" />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Welcome back, {extendedUser?.firstName}</h2>
            <p className="text-sm text-slate-500 mt-1">Here is what is happening with your CRM today.</p>
            {/* 🔹 Show user's team/role for clarity */}
            {extendedUser.team && (
              <p className="text-xs text-slate-400 mt-1">
                Team: <span className="font-medium text-slate-600">{extendedUser.team}</span>
              </p>
            )}
          </div>
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

        {/* 🔹 Quick links — visible to everyone */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Quick Links</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${link.color}`}
              >
                <span>{link.label}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* 🔹 Admin-only: "All Data Overview" — manage every CRM lead (view/edit/delete, select-all, delete-all) */}
        {extendedUser.roles?.includes('admin') && <AdminAllLeads />}

        {/* 🔹 Admin-only: search any lead (or employee) and view its full history — shown above the overview */}
        {extendedUser.roles?.includes('admin') && <AdminUserHistory />}

        {/* 🔹 Admin-only: charts overview (leads per month, revenue, pending, per-employee) */}
        {extendedUser.roles?.includes('admin') && <AdminOverview />}

        {/* 🔹 Admin-only: team performance tables (calling, executive, back office, client type, agreements) — at the bottom */}
        {extendedUser.roles?.includes('admin') && <AdminTeamReports />}
      </div>
    </AppShell>
  );
}