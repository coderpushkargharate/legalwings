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
  Receipt,
  Store,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Scale,
  Users,
  LayoutTemplate,
} from 'lucide-react';

// 🔹 Nav items configuration
const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, role: 'all' },
  { name: 'Calling Team', path: '/calling-team', icon: Phone, role: 'calling' },
  { name: 'Executive Team', path: '/executive-team', icon: UserCheck, role: 'executive' },
  { name: 'Backend Team', path: '/backend-team', icon: Server, role: 'backend' },
  { name: 'Account Team', path: '/account-team', icon: DollarSign, role: 'accounting' },
  { name: 'Payment Statement', path: '/payment-statement', icon: Receipt, role: 'accounting' },
  { name: 'Marketing Team', path: '/marketing-team', icon: Megaphone, role: 'marketing' },
  { name: 'Shop Employee', path: '/shop-team', icon: Store, role: 'shop' },
  { name: 'Employees', path: '/employees', icon: Users, role: 'admin' },
];

const dataManagement = {
  name: 'Data Management',
  icon: Database,
  role: 'admin',
  subRoutes: [
    { name: 'Clients', path: '/clients', icon: Database },
    { name: 'Templates', path: '/template', icon: LayoutTemplate },
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
      <div className="flex items-center gap-3 px-4 h-[58px] border-b border-slate-200">
        <img 
          src="/WhatsApp_Image_2026-05-10_at_7.07.13_AM-removebg-preview.png" 
          alt="LegalWings Logo" 
          className={`w-full mx-auto ${collapsed ? 'h-10 object-contain' : 'h-[54px] max-w-[190px] object-cover'}`}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 mx-3 rounded-full text-[13.5px] font-semibold transition-all duration-200 group ${
                isActive
                  ? 'bg-teal-600 text-white shadow-[0_8px_18px_-10px_rgba(15,92,71,.7)]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-600'}`} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {showDataManagement && (
          <div className="mt-4 space-y-1">
            <div className="px-5 py-1">
              {!collapsed && <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-[0.1em]">Management</p>}
            </div>
            <button
              onClick={() => setDataOpen(prev => !prev)}
              className="flex items-center gap-3 px-4 py-2.5 mx-3 rounded-full text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 w-[calc(100%-1.5rem)] transition-all"
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
                  className={`flex items-center gap-3 px-4 py-2 mx-3 ml-8 rounded-full text-[13px] font-semibold border transition-all ${
                    isActive
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'
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
      <div className="border-t border-slate-200 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2.5 py-2 mb-2 rounded-xl border border-slate-200 bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex flex-shrink-0 items-center justify-center text-[11px] font-bold text-white">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[10.5px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#a9532d] hover:bg-[#fbeee8] w-full transition-all"
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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
           <img 
          src="/WhatsApp_Image_2026-05-10_at_7.07.13_AM-removebg-preview.png" 
          alt="LegalWings Logo" 
          className="h-11 w-[140px] object-cover"
        />
        </div>
        <button
          onClick={toggleMobile}
          className="text-slate-600 p-1.5 rounded-lg border border-slate-200 hover:text-teal-600 hover:border-teal-600 transition-colors"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 will-change-transform ${
          mobileOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
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
        className={`hidden lg:flex flex-col h-screen bg-white border-r border-slate-200 sticky top-0 transition-all duration-300 will-change-transform ${
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
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-500 hover:bg-teal-600 hover:border-teal-600 hover:text-white transition-colors z-10"
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