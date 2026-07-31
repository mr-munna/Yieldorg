import React, { useEffect, useState } from 'react';
import { Users, Target, AlertCircle, Calendar, Megaphone, Edit2, Trash2, X, Save, Receipt, Info, ChevronRight, Landmark, CreditCard, Copy, Check, MapPin, Search } from 'lucide-react';
import { formatCurrency, formatDate, cn, calculateLateFine } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, orderBy, limit, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { Payment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { BankLogo } from '../components/BankLogo';
import { POPULAR_BANKS, getMatchingBranches } from '../lib/bankData';

export function Dashboard() {
  const { userProfile, currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalCollected: 0,
    monthlyTarget: 0,
    pendingDues: 0,
    totalFineCollected: 0,
    monthlyFeeAmount: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgAge, setOrgAge] = useState('');

  const [pendingCount, setPendingCount] = useState(0);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [dailyFine, setDailyFine] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  // Auto-refresh timer every 60 seconds for live fine calculation
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fine Breakdown modal for Admin
  const [showFineBreakdown, setShowFineBreakdown] = useState(false);

  // Bank Account State
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    branchName: '',
    mobileBankingNotes: ''
  });
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    branchName: '',
    mobileBankingNotes: ''
  });
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Broadcast Edit / Delete state
  const [editingNotif, setEditingNotif] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [notifToDelete, setNotifToDelete] = useState<string | null>(null);

  const canManageNotices = ['admin', 'president', 'secretary'].includes((userProfile?.role || '').toLowerCase());

  const handleCopyAccount = (accNum: string) => {
    if (!accNum) return;
    navigator.clipboard.writeText(accNum);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSaveBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        bankName: bankForm.bankName.trim(),
        accountName: bankForm.accountName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        branchName: bankForm.branchName.trim(),
        mobileBankingNotes: bankForm.mobileBankingNotes.trim()
      }, { merge: true });
      setShowBankModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/general');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSaveEditNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotif || !editTitle.trim() || !editMessage.trim()) return;
    setIsSavingNotif(true);
    try {
      await updateDoc(doc(db, 'notifications', editingNotif.id), {
        title: editTitle.trim(),
        message: editMessage.trim()
      });
      setEditingNotif(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${editingNotif.id}`);
    } finally {
      setIsSavingNotif(false);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setNotifToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  useEffect(() => {
    // Fetch Settings for Monthly Target and Foundation Date
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStats(prev => ({ ...prev, monthlyFeeAmount: data.monthlyFeeAmount || 0 }));
        setDailyFine(data.dailyFineAmount || 0);
        setBankInfo({
          bankName: data.bankName || '',
          accountName: data.accountName || '',
          accountNumber: data.accountNumber || '',
          branchName: data.branchName || '',
          mobileBankingNotes: data.mobileBankingNotes || ''
        });
        
        if (data.foundationDate) {
          const calculateAge = () => {
            const foundationDate = new Date(data.foundationDate);
            const today = new Date();
            
            let years = today.getFullYear() - foundationDate.getFullYear();
            let months = today.getMonth() - foundationDate.getMonth();
            let days = today.getDate() - foundationDate.getDate();

            if (days < 0) {
              months -= 1;
              const previousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
              days += previousMonth.getDate();
            }
            
            if (months < 0) {
              years -= 1;
              months += 12;
            }

            setOrgAge(`${years} years, ${months} months & ${days} days`);
          };
          calculateAge();
        } else {
          setOrgAge('Not Set');
        }
      } else {
        setOrgAge('Not Set');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    // Fetch Users for Total Members and Pending Count
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(allUsers);
      const pendingUsers = allUsers.filter((u: any) => u.status === 'Pending');
      setPendingCount(pendingUsers.length);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Fetch Payments
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      const pList: Payment[] = [];
      snapshot.forEach((doc) => {
        pList.push({ id: doc.id, ...doc.data() } as Payment);
      });
      setPaymentsList(pList);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    // Fetch Notifications (Fetch all saved broadcast notices permanently)
    const qNotif = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(qNotif, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(notifs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => {
      unsubSettings();
      unsubUsers();
      unsubPayments();
      unsubNotifs();
    };
  }, []);

  // Compute stats dynamically whenever users, payments, monthly fee, daily fine or nowTick changes
  useEffect(() => {
    const activeMembers = usersList.filter((u: any) => u.status === 'Active' && u.role !== 'Admin');
    const adminUserIds = new Set(
      usersList
        .filter((u: any) => u.role === 'Admin')
        .flatMap((u: any) => [u.id, u.memberId, u.email])
        .filter(Boolean)
    );

    let collected = 0;
    let pending = 0;
    let fineCollected = 0;

    const monthsMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      monthsMap.set(monthStr, 0);
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    const calcFine = (p: { status: string; fine?: number; dueDate?: string; month: string }, memberJoinDate?: string | null) => {
      if (p.status === 'Paid') return p.fine || 0;
      return calculateLateFine(p.month, p.dueDate, memberJoinDate, dailyFine, nowTick);
    };

    // Filter payments to exclude Admins
    const validPayments = paymentsList.filter(p => {
      if (p.userId && adminUserIds.has(p.userId)) return false;
      if (p.memberId && adminUserIds.has(p.memberId)) return false;
      return true;
    });

    validPayments.forEach((p) => {
      const member = usersList.find(u => u.id === p.userId || u.memberId === p.memberId);
      if (p.status === 'Paid') {
        collected += p.amountPaid;
        fineCollected += (p.fine || 0);
        if (monthsMap.has(p.month)) {
          monthsMap.set(p.month, monthsMap.get(p.month)! + p.amountPaid);
        }
      } else {
        // Pending or Verifying payment in DB
        const dynamicFine = calcFine(p, member?.joinDate);
        pending += (p.amountDue - p.amountPaid) + dynamicFine;
      }
    });

    // Account for active members who don't have a payment document created for the current month yet
    activeMembers.forEach((member: any) => {
      // If member joined after current month, ignore
      if (member.joinDate && member.joinDate.substring(0, 7) > currentMonth) {
        return;
      }
      const hasCurrentMonthPayment = validPayments.some(
        p => (p.userId === member.id || p.memberId === member.memberId) && p.month === currentMonth
      );
      if (!hasCurrentMonthPayment && stats.monthlyFeeAmount > 0) {
        const currentMonthFine = calcFine({ month: currentMonth, status: 'Pending' }, member.joinDate);
        pending += stats.monthlyFeeAmount + currentMonthFine;
      }
    });

    const currentMonthPayments = validPayments.filter(p => p.month === currentMonth);
    const currentMonthFines = currentMonthPayments.reduce((acc, p) => acc + (p.fine || 0), 0);
    const dynamicTarget = (activeMembers.length * stats.monthlyFeeAmount) + currentMonthFines;

    const newChartData = Array.from(monthsMap.entries()).map(([month, amount]) => {
      const date = new Date(month + '-01');
      return {
        name: date.toLocaleString('default', { month: 'short' }),
        target: month === currentMonth ? dynamicTarget : (activeMembers.length * stats.monthlyFeeAmount),
        collected: amount
      };
    });

    setChartData(newChartData);
    setStats(prev => ({
      ...prev,
      totalMembers: activeMembers.length,
      totalCollected: collected,
      pendingDues: pending,
      totalFineCollected: fineCollected,
      monthlyTarget: dynamicTarget
    }));
  }, [usersList, paymentsList, stats.monthlyFeeAmount, dailyFine, nowTick]);

  const statCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Total Collected',
      value: formatCurrency(stats.totalCollected),
      icon: () => <span className="text-2xl font-bold">৳</span>,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Monthly Target',
      value: formatCurrency(stats.monthlyTarget),
      icon: Target,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      title: 'Pending Dues',
      value: formatCurrency(stats.pendingDues),
      icon: AlertCircle,
      color: 'bg-rose-500',
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-600',
    },
    {
      title: 'Total Fine Collected',
      value: formatCurrency(stats.totalFineCollected),
      icon: AlertCircle,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yield Dashboard</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Overview of Yield Organization's current status.</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 text-emerald-800 self-start sm:self-auto">
          <Calendar size={16} className="text-emerald-600 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">Age: {orgAge}</span>
        </div>
      </div>

      {pendingCount > 0 && (userProfile?.role === 'Admin' || currentUser?.email?.startsWith('bijoy.mm112')) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-bold">
              <Users size={18} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-xs sm:text-sm">{pendingCount} Pending Registration Requests</h4>
              <p className="text-[11px] sm:text-xs text-amber-700">New or re-registering members are waiting for your approval.</p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'members' }))}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            Review Requests
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isFineCard = stat.title === 'Total Fine Collected';
          return (
            <div 
              key={index} 
              onClick={isFineCard ? () => setShowFineBreakdown(true) : undefined}
              className={cn(
                "bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-100 flex items-center gap-2.5 sm:gap-4 transition-all",
                isFineCard && "cursor-pointer hover:border-amber-300 hover:shadow-md group"
              )}
            >
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.bgColor} ${stat.textColor}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">{stat.title}</p>
                  {isFineCard && <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-600 transition-all shrink-0" />}
                </div>
                <h3 className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 truncate">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin Member Fine Breakdown Modal */}
      {showFineBreakdown && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowFineBreakdown(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Receipt size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Member Late Fine Collection Summary</h3>
                <p className="text-xs text-slate-500">সকল মেম্বারদের জরিমানা আদায় ও বকেয়ার মেম্বারভিত্তিক তালিকা</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 flex justify-between items-center">
              <div>
                <p className="text-xs text-amber-800 font-medium">মোট সংগৃহীত জরিমানা (Total Fine Collected)</p>
                <h4 className="text-2xl font-black text-amber-900 mt-0.5">{formatCurrency(stats.totalFineCollected)}</h4>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-3 py-1.5 rounded-full">
                {usersList.filter(u => u.status === 'Active' && u.role !== 'Admin').length} মেম্বার হিসাব
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-semibold">মেম্বার আইডি & নাম</th>
                    <th className="p-3 font-semibold">ফোন নম্বর</th>
                    <th className="p-3 font-semibold text-right">আদায়কৃত জরিমানা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList
                    .filter(u => u.status === 'Active' && u.role !== 'Admin')
                    .map(member => {
                      const mPayments = paymentsList.filter(p => p.userId === member.id || p.memberId === member.memberId);
                      const totalFinePaid = mPayments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + (p.fine || 0), 0);
                      return (
                        <tr key={member.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <span className="font-mono text-xs font-bold text-indigo-600 block">{member.memberId || 'N/A'}</span>
                            <span className="font-semibold text-slate-900">{member.name}</span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono">{member.phone || '-'}</td>
                          <td className="p-3 text-right font-bold text-amber-700 font-mono text-sm">
                            {formatCurrency(totalFinePaid)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowFineBreakdown(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-5 py-2 rounded-xl text-xs transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Collection vs Target (Last 6 Months)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `৳${value}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), undefined]}
                />
                <Area type="monotone" dataKey="target" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTarget)" name="Target" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" name="Collected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {/* Bank Account Details Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <Landmark size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bank Account Details</h3>
                  <p className="text-[11px] text-slate-500">সংস্থার অফিসিয়াল ব্যাংক অ্যাকাউন্ট</p>
                </div>
              </div>
              {canManageNotices && (
                <button
                  onClick={() => {
                    setBankForm({ ...bankInfo });
                    setShowBankModal(true);
                  }}
                  className="px-2.5 py-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium border border-slate-200"
                  title="Bank Details Edit"
                >
                  <Edit2 size={13} />
                  <span>{bankInfo.accountNumber ? 'Edit' : 'Add'}</span>
                </button>
              )}
            </div>

            {bankInfo.accountNumber || bankInfo.bankName ? (
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl p-4 shadow-md space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <BankLogo bankName={bankInfo.bankName} size="lg" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Bank / Provider</p>
                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                        {bankInfo.bankName || 'Yield Organization Bank'}
                      </h4>
                    </div>
                  </div>
                  <CreditCard className="text-emerald-400/80 shrink-0" size={22} />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Account Name</p>
                  <p className="font-semibold text-xs text-slate-200">{bankInfo.accountName || 'Yield Organization'}</p>
                </div>

                <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Account / Phone Number</p>
                    <p className="font-mono font-bold text-sm text-emerald-300 tracking-wide">{bankInfo.accountNumber}</p>
                  </div>
                  {bankInfo.accountNumber && (
                    <button
                      onClick={() => handleCopyAccount(bankInfo.accountNumber)}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1 shrink-0 active:scale-95"
                      title="Copy Account Number"
                    >
                      {copiedAccount ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {(bankInfo.branchName || bankInfo.mobileBankingNotes) && (
                  <div className="text-[11px] text-slate-300 pt-2 border-t border-slate-700/60 space-y-1">
                    {bankInfo.branchName && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-emerald-400 shrink-0" />
                        <span className="text-slate-400">Branch:</span> <span className="font-medium text-white">{bankInfo.branchName}</span>
                      </p>
                    )}
                    {bankInfo.mobileBankingNotes && (
                      <p className="text-emerald-200 text-[11px] leading-tight bg-emerald-900/40 p-2 rounded-lg border border-emerald-800/50 mt-1">
                        💡 {bankInfo.mobileBankingNotes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Landmark className="mx-auto text-slate-300 mb-2" size={28} />
                <p className="text-xs text-slate-500 font-medium">No bank account details added yet.</p>
                {canManageNotices && (
                  <button
                    onClick={() => {
                      setBankForm({ bankName: '', accountName: '', accountNumber: '', branchName: '', mobileBankingNotes: '' });
                      setShowBankModal(true);
                    }}
                    className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <Edit2 size={12} />
                    <span>Add Bank Account Number</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notice Board */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="text-indigo-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Notice Board</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {notifications.length} saved broadcast{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 relative group">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-900 text-sm">{notif.title}</h4>
                    {canManageNotices && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setEditingNotif(notif);
                            setEditTitle(notif.title);
                            setEditMessage(notif.message);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                          title="Edit Broadcast Message"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setNotifToDelete(notif.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete Broadcast Message"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{notif.message}</p>
                  <div className="mt-3 text-xs text-slate-400 flex justify-between items-center">
                    <span>By {notif.senderRole || notif.senderName}</span>
                    <span>{notif.createdAt ? formatDate(notif.createdAt.toDate()) : 'Just now'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-8 text-sm">
                No recent announcements.
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Edit Broadcast Modal */}
      {editingNotif && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative">
            <button 
              onClick={() => setEditingNotif(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Edit2 className="text-indigo-600" size={24} />
              Edit Broadcast Message
            </h3>
            <p className="text-slate-600 mb-6 text-sm">
              Update the title or content of this broadcast message.
            </p>
            
            <form onSubmit={handleSaveEditNotif} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Broadcast Title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea 
                  required
                  rows={4}
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  placeholder="Broadcast Message"
                ></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingNotif(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingNotif}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} />
                  {isSavingNotif ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {notifToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Broadcast Message?</h3>
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete this broadcast message? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setNotifToDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteNotif(notifToDelete)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bank Account Details Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowBankModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Landmark className="text-emerald-600" size={24} />
              Bank Account Details
            </h3>
            <p className="text-slate-500 mb-4 text-xs">
              অর্গানাইজেশনের ব্যাংক অ্যাকাউন্ট তথ্য সংরক্ষণ করুন যেন মেম্বাররা ব্যাংক ফি ও বকেয়া পরিশোধ করতে পারে।
            </p>
            
            <form onSubmit={handleSaveBankInfo} className="space-y-4 text-xs">
              {/* Select Popular Bank / MFS */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select Bank / MFS (পপুলার ব্যাংক সিলেক্ট করুন)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
                  {POPULAR_BANKS.map((b) => {
                    const isSelected = bankForm.bankName.toLowerCase().includes(b.shortName.toLowerCase());
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBankForm({ ...bankForm, bankName: b.name })}
                        className={cn(
                          "p-2 rounded-xl border text-center flex flex-col items-center justify-center transition-all hover:scale-[1.02]",
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-500/20" 
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <BankLogo bankName={b.name} size="sm" className="mb-1" />
                        <span className="text-[10px] font-bold leading-tight truncate w-full">{b.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank / Provider Name (ব্যাংক বা মাধ্যমের নাম)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                    placeholder="e.g. Dutch-Bangla Bank Ltd / Bkash Merchant"
                  />
                  <div className="absolute left-2.5 top-2.5">
                    <BankLogo bankName={bankForm.bankName} size="sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Holder Name (অ্যাকাউন্ট প্রদানকারীর নাম)</label>
                <input 
                  type="text" 
                  required
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                  placeholder="e.g. Yield Organization Fund"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Number / Phone Number (অ্যাকাউন্ট বা ফোন নম্বর)</label>
                <input 
                  type="text" 
                  required
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                  placeholder="e.g. 123.145.67890 or 01700000000"
                />
              </div>

              {/* Branch / Area Name Search and Selection */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Branch / Location (শাখার নাম / এরিয়া)</label>
                  <span className="text-[10px] text-slate-500">এরিয়ার নাম লিখলে শাখা সিলেক্ট করতে পারবেন</span>
                </div>
                
                {/* Popular Area Chips */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mr-1 self-center">
                    <Search size={10} /> এরিয়া ফিল্টার:
                  </span>
                  {['Uttara', 'Dhanmondi', 'Gulshan', 'Mirpur', 'Motijheel', 'Banani', 'Agrabad', 'Sylhet', 'Rajshahi', 'Khulna', 'Bogura', 'Mymensingh', 'Barishal', 'Comilla'].map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setBankForm({ ...bankForm, branchName: area })}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                        bankForm.branchName.toLowerCase().includes(area.toLowerCase())
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      )}
                    >
                      {area}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    value={bankForm.branchName}
                    onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                    placeholder="Type area name (e.g. Uttara, Dhanmondi, Gulshan, Agrabad, Sylhet)..."
                  />
                  <MapPin size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>

                {/* Live Branch Suggestions */}
                {(() => {
                  const suggestions = getMatchingBranches(bankForm.branchName, bankForm.bankName);
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider px-1">
                        উপলব্ধ শাখা ({suggestions.length}টি পাওয়া গেছে - ক্লিক করে সিলেক্ট করুন):
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {suggestions.map((branch, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setBankForm({ ...bankForm, branchName: branch })}
                            className={cn(
                              "w-full text-left p-2 rounded-lg text-xs transition-colors flex items-start gap-2 border",
                              bankForm.branchName === branch
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-medium"
                                : "bg-white hover:bg-emerald-50 text-slate-800 border-slate-200/80"
                            )}
                          >
                            <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                            <span>{branch}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional Instructions / Notes (অতিরিক্ত নির্দেশাবলী - ঐচ্ছিক)</label>
                <textarea 
                  rows={2}
                  value={bankForm.mobileBankingNotes}
                  onChange={(e) => setBankForm({ ...bankForm, mobileBankingNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 resize-none"
                  placeholder="e.g. Reference specific Member ID when making payment"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingBank}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSavingBank ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
