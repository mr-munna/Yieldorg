import React, { useState, useEffect } from 'react';
import { formatCurrency, cn } from '../lib/utils';
import { Download, Settings, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Payment, Member } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function Finances() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'Admin';

  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dailyFine, setDailyFine] = useState<number>(0);
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(0);
  const [foundationDate, setFoundationDate] = useState<string>('');
  const [isSavingFine, setIsSavingFine] = useState(false);

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
      alert('Settings updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/general');
      alert('Failed to update settings.');
    }
    setIsSavingFine(false);
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'Paid'
      });
      alert('Payment approved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
      alert('Failed to approve payment.');
    }
  };

  // Join payments with member names and calculate dynamic fine
  const activeMembers = members.filter(m => m.status === 'Active');
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
      let dueDate = payment ? payment.dueDate : `${selectedMonth}-10`;
      let paymentMethod = payment ? payment.paymentMethod : '';
      let transactionId = payment ? payment.transactionId : '';
      let paidDate = payment ? payment.paidDate : '';
      
      let calculatedFine = payment?.fine || 0;
      if (status !== 'Paid') {
        const today = new Date();
        const due = new Date(dueDate);
        
        // Late fine starts after the 10th of the month (from the 11th)
        if (today > due) {
          const diffTime = Math.abs(today.getTime() - due.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          calculatedFine = diffDays * dailyFine;
        }
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
        memberName: member.name,
        dynamicFine: calculatedFine,
        isMock: !payment
      };
    });

  const handleExport = () => {
    const headers = ['Member Name', 'Member ID', 'Amount Due', 'Amount Paid', 'Due Date', 'Paid Date', 'Late Fine', 'Status', 'Payment Method', 'Transaction ID'];
    const rows = paymentsWithMembers.map(p => [
      p.memberName,
      p.memberId,
      p.amountDue,
      p.amountPaid,
      p.dueDate,
      p.paidDate || '',
      p.dynamicFine,
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
        <div className="flex items-center gap-3">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
          >
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
            <option value="2026-02">February 2026</option>
          </select>
          <button 
            onClick={handleExport}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Fine Configuration Section */}
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
                  <td className="px-6 py-4 text-slate-600 text-sm">{payment.dueDate}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{payment.paidDate || '-'}</td>
                  <td className="px-6 py-4 text-rose-600 font-medium">{formatCurrency(payment.dynamicFine)}</td>
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
                    {isAdmin && payment.status === 'Verifying' && !payment.isMock && (
                      <button 
                        onClick={() => handleApprovePayment(payment.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        Approve
                      </button>
                    )}
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
