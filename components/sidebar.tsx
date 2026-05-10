'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import {
  LayoutDashboard,
  Phone,
  UserCheck,
  Server,
  DollarSign,
  Megaphone,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Scale,
  Users,
} from 'lucide-react';

// 🔹 Nav items configuration
const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, role: 'all' },
  { name: 'Calling Team', path: '/calling-team', icon: Phone, role: 'calling' },
  { name: 'Executive Team', path: '/executive-team', icon: UserCheck, role: 'executive' },
  { name: 'Backend Team', path: '/backend-team', icon: Server, role: 'backend' },
  { name: 'Account Team', path: '/account-team', icon: DollarSign, role: 'accounting' },
  { name: 'Marketing Team', path: '/marketing-team', icon: Megaphone, role: 'marketing' },
  { name: 'Employees', path: '/employees', icon: Users, role: 'admin' },
];

const dataManagement = {
  name: 'Data Management',
  icon: Database,
  role: 'admin',
  subRoutes: [
    { name: 'Clients', path: '/clients', icon: Database },
  ],
};

// 🔹 1. DEFINE PROPS INTERFACE FOR SIDEBAR CONTENT
interface SidebarContentProps {
  collapsed: boolean;
  pathname: string;
  user: any; // Replace 'any' with your actual User type if available
  logout: () => void;
  visibleNav: Array<{
    name: string;
    path: string;
    icon: React.ElementType;
    role: string;
  }>;
  showDataManagement: boolean;
  dataOpen: boolean;
  setDataOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// ✅ 2. APPLY TYPES TO MEMOIZED COMPONENT
const SidebarContent = React.memo(function SidebarContent({
  collapsed,
  pathname,
  user,
  logout,
  visibleNav,
  showDataManagement,
  dataOpen,
  setDataOpen,
  setMobileOpen,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Scale className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-white tracking-wide">LegalWings</h2>
            <p className="text-[10px] text-slate-400">CRM System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-teal-600/20 text-teal-400 font-medium'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-white'}`} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {showDataManagement && (
          <div className="mt-2">
            <div className="px-4 py-1">
              {!collapsed && <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Management</p>}
            </div>
            <button
              onClick={() => setDataOpen(prev => !prev)}
              className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white w-full transition-all"
            >
              <dataManagement.icon className="w-5 h-5 flex-shrink-0 text-slate-400" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{dataManagement.name}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${dataOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {dataOpen && !collapsed && dataManagement.subRoutes.map((sub) => {
              const isActive = pathname === sub.path;
              return (
                <Link
                  key={sub.path}
                  href={sub.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 mx-2 ml-8 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-teal-600/20 text-teal-400 font-medium'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <sub.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{sub.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700/50 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 mx-1 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all"
        >
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
});

// ✅ MAIN SIDEBAR COMPONENT
function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname() ?? '';
  const { user, logout } = useAuth();

  // ✅ MEMOIZE DERIVED STATE - Ensure boolean values with ?? false
  const isAdmin = useMemo(() => user?.roles?.includes('admin') ?? false, [user?.roles]);

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return isAdmin
      ? navItems
      : navItems.filter((n) => n.role === 'all' || user?.roles?.includes(n.role));
  }, [isAdmin, user?.roles]);

  const showDataManagement = isAdmin ?? false;

  // ✅ STABLE CALLBACKS
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const toggleMobile = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">LegalWings CRM</span>
        </div>
        <button
          onClick={toggleMobile}
          className="text-slate-300 p-1 hover:text-white transition-colors"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-slate-900 z-50 transform transition-transform duration-300 will-change-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          collapsed={false}
          pathname={pathname}
          user={user}
          logout={handleLogout}
          visibleNav={visibleNav}
          showDataManagement={showDataManagement}
          dataOpen={dataOpen}
          setDataOpen={setDataOpen}
          setMobileOpen={setMobileOpen}
        />
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden lg:flex flex-col h-screen bg-slate-900 border-r border-slate-700/50 sticky top-0 transition-all duration-300 will-change-transform ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          user={user}
          logout={handleLogout}
          visibleNav={visibleNav}
          showDataManagement={showDataManagement}
          dataOpen={dataOpen}
          setDataOpen={setDataOpen}
          setMobileOpen={setMobileOpen}
        />
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-teal-600 hover:text-white transition-colors z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>
    </>
  );
}

// ✅ PREVENT FULL COMPONENT RE-RENDERS
export default React.memo(Sidebar);