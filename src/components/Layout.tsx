import React from 'react';
import { LayoutDashboard, Users, DollarSign, Scale, Archive, Menu, X, LogOut, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { userProfile } = useAuth();

  React.useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, [setActiveTab]);

  // If user is not an admin/president/secretary/treasurer, they see limited views
  const userRole = (userProfile?.role || '').toLowerCase();
  const isPrivileged = ['admin', 'president', 'secretary', 'treasurer'].includes(userRole);

  const navItems = !isPrivileged ? [
    { id: 'dashboard', label: 'Yield Dashboard', icon: LayoutDashboard },
    { id: 'member-dashboard', label: 'My Dashboard', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'finances', label: 'Financial Tracker', icon: DollarSign },
    { id: 'governance', label: 'Governance', icon: Scale },
    { id: 'inventory', label: 'Inventory & Tools', icon: Archive },
  ] : [
    { id: 'dashboard', label: 'Yield Dashboard', icon: LayoutDashboard },
    { id: 'member-dashboard', label: 'My Dashboard', icon: Users },
    { id: 'members', label: 'Member Management', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'finances', label: 'Financial Tracker', icon: DollarSign },
    { id: 'governance', label: 'Governance', icon: Scale },
    { id: 'inventory', label: 'Inventory & Tools', icon: Archive },
  ];

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-emerald-900 text-white p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white">
            YO
          </div>
          <span className="font-semibold text-lg">Yield Org</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 h-screen w-64 bg-emerald-900 text-slate-300 flex flex-col z-30 transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-emerald-500/20">
            YO
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Yield</h1>
            <p className="text-emerald-400 text-xs font-medium tracking-wider uppercase">Organization</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto mt-4 md:mt-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                  isActive
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "hover:bg-emerald-800/50 hover:text-white"
                )}
              >
                <Icon size={18} className={cn(isActive ? "text-emerald-400" : "text-slate-400")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 m-4 bg-emerald-800/50 rounded-xl border border-emerald-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate pr-2">
              <p className="text-sm font-medium text-white truncate">{userProfile?.name || auth.currentUser?.displayName || auth.currentUser?.email || 'Loading...'}</p>
              <p className="text-xs text-emerald-300 truncate">{userProfile?.memberId || 'Pending'} • {userProfile?.role || 'Pending'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-emerald-900/50 hover:bg-emerald-700 text-emerald-100 py-2 rounded-lg text-sm transition-colors mb-4"
          >
            <LogOut size={16} />
            Sign Out
          </button>
          <div className="pt-3 border-t border-emerald-700/50 text-center">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Developed with ❤️ by</p>
            <p className="text-xs font-semibold text-emerald-300">Bijoy Mahmud Munna</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
