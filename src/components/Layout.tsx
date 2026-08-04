import React, { useState } from 'react';
import { LayoutDashboard, Users, User, DollarSign, Scale, Archive, Menu, X, LogOut, MessageSquare, Newspaper, Building2, ArrowLeftRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [targetOrgCode, setTargetOrgCode] = useState('');
  const [targetOrgName, setTargetOrgName] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const { userProfile, switchOrganization } = useAuth();
  const initialLoadRef = React.useRef(true);

  React.useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  React.useEffect(() => {
    if (!userProfile?.uid) return;

    const orgId = userProfile.organizationId || 'org_default';
    const qChats = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', userProfile.uid)
    );

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return;
      }

      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          if (orgId === 'org_default' ? (!data.organizationId || data.organizationId === 'org_default') : data.organizationId === orgId) {
            // Check if there's a new message and it's not from the current user
            if (data.lastMessageSender && data.lastMessageSender !== userProfile.name) {
              // Show notification if permission granted
              if ('Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification(`New message from ${data.lastMessageSender}`, {
                  body: data.lastMessage,
                  icon: '/favicon.svg'
                });
                
                notification.onclick = () => {
                  window.focus();
                  setActiveTab('messages');
                  notification.close();
                };
              }
            }
          }
        }
      });
    });

    return () => unsubChats();
  }, [userProfile, setActiveTab]);

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

  const navItems = [
    { id: 'dashboard', label: 'Yield Dashboard', icon: LayoutDashboard },
    { id: 'member-dashboard', label: 'My Dashboard', icon: User },
    { id: 'members', label: 'Member Management', icon: Users },
    { id: 'news-feed', label: 'News Feed', icon: Newspaper },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'finances', label: 'Financial Tracker', icon: DollarSign },
    { id: 'governance', label: 'Governance', icon: Scale },
    { id: 'inventory', label: 'Inventory & Tools', icon: Archive },
  ];

  const handleLogout = () => {
    signOut(auth);
  };

  // Items explicitly requested for mobile bottom navigation
  const mobileBottomItems = [
    { id: 'dashboard', label: 'Yield Dashboard', mobileLabel: 'Yield', icon: LayoutDashboard },
    { id: 'members', label: 'Member Management', mobileLabel: 'Members', icon: Users },
    { id: 'member-dashboard', label: 'My Dashboard', mobileLabel: 'My Dash', icon: User },
    { id: 'messages', label: 'Messages', mobileLabel: 'Messages', icon: MessageSquare },
    { id: 'finances', label: 'Financial Tracker', mobileLabel: 'Finances', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-emerald-900 text-white px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Yield Organization Logo" className="w-7 h-7 rounded-lg object-contain bg-white p-0.5" />
          <span className="font-semibold text-base tracking-tight">Yield Org</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 text-slate-200 hover:text-white rounded-lg active:bg-emerald-800">
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
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
        <div className="p-6 hidden md:flex items-center justify-between gap-3 border-b border-emerald-800/60 pb-5">
          <div className="flex items-center gap-3 truncate">
            <img src="/logo.png" alt="Yield Organization Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-lg shadow-emerald-500/20 shrink-0" />
            <div className="truncate">
              <h1 className="font-bold text-white text-lg leading-tight truncate">
                {userProfile?.organizationName || 'Triangle'}
              </h1>
              <p className="text-emerald-400 text-xs font-medium tracking-wider uppercase truncate">
                ID: {userProfile?.organizationId || 'org_default'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTargetOrgCode(userProfile?.organizationId || '');
              setTargetOrgName(userProfile?.organizationName || '');
              setShowOrgModal(true);
            }}
            title="Switch Organization / অর্গানাইজেশন পরিবর্তন"
            className="p-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-200 transition-colors shrink-0 flex items-center justify-center border border-emerald-700/60"
          >
            <ArrowLeftRight size={16} />
          </button>
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
              <button
                type="button"
                onClick={() => {
                  setTargetOrgCode(userProfile?.organizationId || '');
                  setTargetOrgName(userProfile?.organizationName || '');
                  setShowOrgModal(true);
                }}
                className="mt-1 text-[10px] bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 hover:text-white px-2 py-1 rounded font-mono flex items-center gap-1 border border-emerald-700/50 transition-colors"
              >
                <Building2 size={11} className="text-emerald-400" />
                <span>Org: {userProfile?.organizationId || 'org_default'}</span>
                <ArrowLeftRight size={10} className="ml-0.5 text-emerald-400" />
              </button>
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 py-3.5 sm:p-6 md:p-8 pb-20 md:pb-8 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-emerald-950/95 backdrop-blur-md border-t border-emerald-800/80 z-40 px-1 py-1 flex justify-around items-center shadow-2xl">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all text-xs font-medium min-w-0 flex-1 active:scale-95",
                isActive
                  ? "text-white bg-emerald-800/90 font-semibold shadow-inner"
                  : "text-slate-300 hover:text-white"
              )}
            >
              <Icon size={17} className={cn(isActive ? "text-emerald-400" : "text-slate-400")} />
              <span className="text-[10px] mt-0.5 truncate w-full text-center leading-tight font-medium">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Organization Switcher Modal */}
      <AnimatePresence>
        {showOrgModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 border border-slate-100 relative"
            >
              <button
                type="button"
                onClick={() => setShowOrgModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Switch Organization</h3>
                  <p className="text-xs text-slate-500">অর্গানাইজেশন সুইচার (Admin Control)</p>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3 mb-4 text-xs text-emerald-900 leading-relaxed">
                <p className="font-semibold mb-1">Current Active Organization:</p>
                <p className="font-mono text-emerald-800">ID: {userProfile?.organizationId || 'org_default'}</p>
                <p className="text-emerald-700">Name: {userProfile?.organizationName || 'Triangle'}</p>
              </div>

              {/* Quick Presets */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Quick Switch / দ্রুত নির্বাচন:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetOrgCode('org_default');
                      setTargetOrgName('Triangle');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                      targetOrgCode === 'org_default'
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold shadow-sm"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    <Building2 size={13} />
                    <span>Main Org (`org_default`)</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!targetOrgCode.trim()) return;
                  setIsSwitching(true);
                  await switchOrganization(targetOrgCode, targetOrgName);
                  setIsSwitching(false);
                  setShowOrgModal(false);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Code / ID
                  </label>
                  <input
                    type="text"
                    required
                    value={targetOrgCode}
                    onChange={(e) => setTargetOrgCode(e.target.value)}
                    placeholder="e.g. org_default, club_101, dhaka_branch"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm bg-slate-50 focus:bg-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    আপনার আগের মূল অর্গানাইজেশনে ফিরতে <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-bold">org_default</code> টাইপ করুন।
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetOrgName}
                    onChange={(e) => setTargetOrgName(e.target.value)}
                    placeholder="e.g. Triangle"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOrgModal(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSwitching || !targetOrgCode.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check size={16} />
                    {isSwitching ? 'Switching...' : 'Switch Organization'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
