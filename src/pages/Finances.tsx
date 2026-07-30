import React, { useState, useEffect } from 'react';
import { formatCurrency, cn, formatDate, calculateLateFine, getEffectiveDueDate } from '../lib/utils';
import { Download, Settings, Save, CheckCircle2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Payment, Member } from '../types';
import { useAuth } from '../contexts/AuthContext';

const monthsList = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const yearsList = Array.from({ length: 25 }, (_, i) => String(2026 + i));

export function Finances() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'Admin';

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dailyFine, setDailyFine] = useState<number>(0);
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(0);
  const [foundationDate, setFoundationDate] = useState<string>('');
  const [isSavingFine, setIsSavingFine] = useState(false);

  const [selectedYear, selectedMonthNum] = selectedMonth.split('-');

  const handleMonthChange = (mNum: string) => {
    setSelectedMonth(`${selectedYear || '2026'}-${mNum}`);
  };

  const handleYearChange = (yr: string) => {
    setSelectedMonth(`${yr}-${selectedMonthNum || '07'}`);
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prevY = date.getFullYear();
    const prevM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${prevY}-${prevM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${y}-${m}`);
  };

  useEffect(() => {
    // Fetch Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setDailyFine(docSnap.data().dailyFineAmount || 0);
        setMonthlyFee(docSnap.data().monthlyFeeAmount || 0);
        setMonthlyTarget(docSnap.data().monthlyTarget || 0);
        setFoundationDate(docSnap.data().foundationDate || '');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    // Fetch Members
    const unsubMembers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const m: Member[] = [];
      snapshot.forEach(d => m.push({ id: d.id, ...d.data() } as Member));
      setMembers(m);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Fetch Payments
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      const p: Payment[] = [];
      snapshot.forEach(d => p.push({ id: d.id, ...d.data() } as Payment));
      setPayments(p);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    return () => { unsubSettings(); unsubMembers(); unsubPayments(); };
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingFine(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), { 
        dailyFineAmount: dailyFine,
        monthlyFeeAmount: monthlyFee,
        foundationDate: foundationDate
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/general');
    }
    setIsSavingFine(false);
  };

  const handleApprovePayment = async (paymentItem: any) => {
    try {
      const docId = paymentItem.isMock ? `${paymentItem.userId}_${selectedMonth}` : paymentItem.id;
      await setDoc(doc(db, 'payments', docId), {
        userId: paymentItem.userId,
        memberId: paymentItem.memberId,
        month: selectedMonth,
        amountDue: paymentItem.amountDue,
        amountPaid: paymentItem.amountPaid > 0 ? paymentItem.amountPaid : paymentItem.amountDue,
        dueDate: paymentItem.dueDate,
        paidDate: new Date().toISOString().split('T')[0],
        status: 'Paid',
        fine: paymentItem.dynamicFine || 0,
        approvedBy: userProfile?.email || userProfile?.name || 'Admin'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `payments/${paymentItem.id}`);
    }
  };

  // Join payments with member names and calculate dynamic fine (Admins are exempt from dues)
  const activeMembers = members.filter(m => m.status === 'Active' && m.role !== 'Admin').sort((a, b) => {
    const idA = a.memberId || '';
    const idB = b.memberId || '';
    return idA.localeCompare(idB);
  });
  const paymentsWithMembers = activeMembers
    .filter(m => {
      // Exclude members who joined after the selected month
      if (!m.joinDate) return true;
      const joinMonth = m.joinDate.substring(0, 7);
      return joinMonth <= selectedMonth;
    })
    .map(member => {
      const payment = payments.find(p => (p.userId === member.id || p.memberId === member.memberId) && p.month === selectedMonth);
      
      let status = payment ? payment.status : 'Pending';
      let amountDue = payment ? payment.amountDue : monthlyFee;
      let amountPaid = payment ? payment.amountPaid : 0;
      let dueDate = payment?.dueDate || getEffectiveDueDate(selectedMonth, member.joinDate);
      let paymentMethod = payment ? payment.paymentMethod : '';
      let transactionId = payment ? payment.transactionId : '';
      let paidDate = payment ? payment.paidDate : '';
      let approvedBy = payment ? payment.approvedBy : '';
      let submittedBy = payment?.submittedBy || (payment && payment.status !== 'Pending' ? (member.email || member.name) : '');
      
      let calculatedFine = payment?.fine || 0;
      if (status !== 'Paid') {
        calculatedFine = calculateLateFine(selectedMonth, payment?.dueDate, member.joinDate, dailyFine);
      }

      return { 
        id: payment?.id || `mock-${member.id}`,
        userId: member.id,
        memberId: member.memberId,
        month: selectedMonth,
        amountDue,
        amountPaid,
        dueDate,
        paidDate,
        status,
        paymentMethod,
        transactionId,
        approvedBy,
        submittedBy,
        memberName: member.name,
        dynamicFine: calculatedFine,
        isMock: !payment
      };
    });

  const handleExport = () => {
    const headers = ['Member Name', 'Member ID', 'Amount Due', 'Amount Paid', 'Due Date', 'Paid Date', 'Late Fine', 'Approved By', 'Status', 'Payment Method', 'Transaction ID'];
    const rows = paymentsWithMembers.map(p => [
      p.memberName,
      p.memberId,
      p.amountDue,
      p.amountPaid,
      p.dueDate,
      p.paidDate || '',
      p.dynamicFine,
      p.approvedBy || '',
      p.status,
      p.paymentMethod || '',
      p.transactionId || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Tracker</h2>
          <p className="text-slate-500 mt-1">Track monthly dues, payments, and configure late fines.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Month & Year Selection Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-1.5 px-2 text-slate-500">
              <Calendar size={18} className="text-emerald-600" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:inline">Period:</span>
            </div>

            {/* Month Dropdown */}
            <select
              value={selectedMonthNum || '01'}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm font-semibold py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear || '2026'}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm font-semibold py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* HTML Month Input */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs py-1.5 px-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              title="Select Month & Year using Calendar Picker"
            />

            {/* Previous / Current / Next navigation buttons */}
            <div className="flex items-center border-l border-slate-200 pl-1.5 gap-0.5">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleCurrentMonth}
                title="Go to Current Month"
                className="text-xs font-semibold px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                Current
              </button>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {isAdmin && (
            <button 
              onClick={handleExport}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Fine Configuration Section */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <span className="font-bold">৳</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Monthly Fee Setup</h3>
                <p className="text-sm text-slate-500">Set the base monthly fee for members.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">৳</span>
                <input 
                  type="number" 
                  min="0"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-32 pl-8 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Daily Late Fine Setup</h3>
                <p className="text-sm text-slate-500">Set the fine amount added per day.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">৳</span>
                <input 
                  type="number" 
                  min="0"
                  value={dailyFine}
                  onChange={(e) => setDailyFine(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-32 pl-8 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Foundation Date</h3>
                <p className="text-sm text-slate-500">Set the organization's start date.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={foundationDate}
                onChange={(e) => setFoundationDate(e.target.value)}
                disabled={!isAdmin}
                className="w-40 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <button 
            onClick={handleSaveSettings}
            disabled={isSavingFine}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {isSavingFine ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm md:text-base">Payment Records:</span>
            <span className="bg-emerald-100 text-emerald-900 text-xs px-3 py-1 rounded-full font-bold shadow-sm">
              {monthsList.find(m => m.value === selectedMonthNum)?.label || ''} {selectedYear}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-3">
            <span>Total Members: <strong className="text-slate-800">{paymentsWithMembers.length}</strong></span>
            <span>Paid: <strong className="text-emerald-700">{paymentsWithMembers.filter(p => p.status === 'Paid').length}</strong></span>
            <span>Pending/Verifying: <strong className="text-amber-700">{paymentsWithMembers.filter(p => p.status !== 'Paid').length}</strong></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Amount Due</th>
                <th className="px-6 py-4 font-medium">Amount Paid</th>
                <th className="px-6 py-4 font-medium">Method</th>
                <th className="px-6 py-4 font-medium">Transaction ID</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 font-medium">Paid Date</th>
                <th className="px-6 py-4 font-medium">Late Fine</th>
                <th className="px-6 py-4 font-medium">Approved By</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentsWithMembers.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{payment.memberName}</div>
                    <div className="text-xs text-slate-500 font-mono">{payment.memberId}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{formatCurrency(payment.amountDue)}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{formatCurrency(payment.amountPaid)}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{payment.paymentMethod || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs font-mono">{payment.transactionId || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(payment.dueDate)}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(payment.paidDate)}</td>
                  <td className="px-6 py-4 text-rose-600 font-medium">{formatCurrency(payment.dynamicFine)}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {payment.approvedBy ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-mono">
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                        <span>{isAdmin ? payment.approvedBy : 'Admin'}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-sans italic text-xs">
                        {payment.status === 'Verifying' ? 'Pending Approval' : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      payment.status === 'Paid' ? "bg-emerald-100 text-emerald-700" :
                      payment.status === 'Verifying' ? "bg-blue-100 text-blue-700" :
                      payment.status === 'Pending' ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && payment.status !== 'Paid' && (payment.paymentMethod && payment.paymentMethod.trim() !== '' && payment.transactionId && payment.transactionId.trim() !== '') ? (
                      <button 
                        onClick={() => handleApprovePayment(payment)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm ml-auto"
                      >
                        <CheckCircle2 size={13} />
                        Approve
                      </button>
                    ) : isAdmin && payment.status !== 'Paid' ? (
                      <span className="text-slate-400 font-sans italic text-xs">
                        No Method/TxID
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {paymentsWithMembers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                    No payment records found for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
