import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Banknote, AlertCircle, Calendar, Plus, X, CreditCard, Megaphone } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Payment } from '../types';
import { orderBy, limit } from 'firebase/firestore';

export function MemberDashboard() {
  const { userProfile, currentUser, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyFine, setDailyFine] = useState(0);
  const [monthlyFee, setMonthlyFee] = useState(0);

  // Pay Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setDailyFine(docSnap.data().dailyFineAmount || 0);
        setMonthlyFee(docSnap.data().monthlyFeeAmount || 0);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));
    return unsubSettings;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !userProfile) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'payments'), where('userId', '==', currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentData: Payment[] = [];
      snapshot.forEach((doc) => {
        paymentData.push({ id: doc.id, ...doc.data() } as Payment);
      });
      paymentData.sort((a, b) => b.month.localeCompare(a.month));
      setPayments(paymentData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
      setLoading(false);
    });

    // Fetch Notifications
    const qNotif = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(15));
    const unsubNotifs = onSnapshot(qNotif, (snapshot) => {
      const notifs: any[] = [];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt) {
          const createdAtDate = data.createdAt.toDate();
          if (createdAtDate > sevenDaysAgo) {
            notifs.push({ id: doc.id, ...data });
          }
        } else {
          notifs.push({ id: doc.id, ...data });
        }
      });
      setNotifications(notifs.slice(0, 5));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => {
      unsubscribe();
      unsubNotifs();
    };
  }, [currentUser, userProfile, authLoading]);

  const calculateFine = (payment: Payment) => {
    if (payment.status === 'Paid') return payment.fine || 0;
    if (!payment.dueDate) return 0;
    const today = new Date();
    const due = new Date(payment.dueDate);
    if (today > due) {
      const diffTime = Math.abs(today.getTime() - due.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays * dailyFine;
    }
    return 0;
  };

  const totalContribution = payments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amountPaid, 0);
  
  const pendingPayments = payments.filter(p => p.status !== 'Paid');
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amountDue - p.amountPaid) + calculateFine(p), 0);

  const handlePayCurrentMonth = async () => {
    if (!currentUser || !userProfile) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Check if there's already a payment for this month
    const existingPayment = payments.find(p => p.month === currentMonth);
    
    if (existingPayment) {
      if (existingPayment.status !== 'Paid') {
        setSelectedPayment(existingPayment);
        setShowPayModal(true);
      } else {
        alert('You have already paid for the current month.');
      }
      return;
    }

    // If no payment exists, create a pending one for the current month and open modal
    try {
      const docRef = await addDoc(collection(db, 'payments'), {
        userId: currentUser.uid,
        memberId: userProfile.memberId,
        month: currentMonth,
        amountDue: monthlyFee,
        amountPaid: 0,
        dueDate: `${currentMonth}-10`,
        status: 'Pending',
        fine: 0
      });
      
      setSelectedPayment({
        id: docRef.id,
        userId: currentUser.uid,
        memberId: userProfile.memberId,
        month: currentMonth,
        amountDue: monthlyFee,
        amountPaid: 0,
        dueDate: `${currentMonth}-10`,
        status: 'Pending',
        fine: 0
      } as Payment);
      setShowPayModal(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setIsSubmitting(true);
    
    const finalFine = calculateFine(selectedPayment);
    const totalAmount = selectedPayment.amountDue + finalFine;

    try {
      await updateDoc(doc(db, 'payments', selectedPayment.id), {
        status: 'Verifying',
        amountPaid: totalAmount,
        fine: finalFine,
        paidDate: new Date().toISOString().split('T')[0],
        paymentMethod,
        transactionId
      });
      setShowPayModal(false);
      setSelectedPayment(null);
      setTransactionId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${selectedPayment.id}`);
    }
    setIsSubmitting(false);
  };

  if (loading || authLoading) {
    return <div className="p-8 text-center text-slate-500">Loading your dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, {userProfile?.name}</h2>
          <p className="text-slate-500 mt-1">Member ID: <span className="font-mono text-slate-700">{userProfile?.memberId}</span></p>
        </div>
        <button 
          onClick={handlePayCurrentMonth}
          className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <CreditCard size={18} />
          Pay Now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600">
            <span className="text-2xl font-bold">৳</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Contribution</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalContribution)}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Monthly Base Fee</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(monthlyFee)}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-rose-50 text-rose-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Payments & Fines</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPending)}</h3>
          </div>
        </div>
      </div>

      {showPayModal && selectedPayment && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowPayModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CreditCard className="text-indigo-600" />
              Pay Monthly Dues
            </h3>
            
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Month:</span>
                  <span className="font-medium text-slate-900">{selectedPayment.month}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Base Amount:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(selectedPayment.amountDue)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2 text-rose-600">
                  <span>Late Fine:</span>
                  <span className="font-medium">{formatCurrency(calculateFine(selectedPayment))}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                  <span>Total to Pay:</span>
                  <span>{formatCurrency(selectedPayment.amountDue + calculateFine(selectedPayment))}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              
              {paymentMethod !== 'Cash' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                  <input 
                    type="text" 
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g. 8A7B6C5D4E"
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-6 disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Submit Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="text-slate-400" size={20} />
            <h3 className="text-lg font-bold text-slate-900">Monthly Breakdown</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                  <th className="px-6 py-4 font-medium">Month</th>
                  <th className="px-6 py-4 font-medium">Amount Due</th>
                  <th className="px-6 py-4 font-medium">Fine</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{payment.month}</td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(payment.amountDue)}</td>
                    <td className="px-6 py-4 text-rose-600 font-medium">{formatCurrency(calculateFine(payment))}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        payment.status === 'Paid' ? "bg-emerald-100 text-emerald-700" :
                        payment.status === 'Verifying' ? "bg-blue-100 text-blue-700" :
                        payment.status === 'Pending' ? "bg-amber-100 text-amber-700" :
                        "bg-rose-100 text-rose-700"
                      )}>
                        {payment.status === 'Verifying' ? 'Verifying' : payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {payment.status !== 'Paid' && payment.status !== 'Verifying' && (
                        <button 
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowPayModal(true);
                          }}
                          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No payment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <Megaphone className="text-indigo-600" size={20} />
            <h3 className="text-lg font-bold text-slate-900">Notice Board</h3>
          </div>
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{notif.title}</h4>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{notif.message}</p>
                  <div className="mt-3 text-xs text-slate-400 flex justify-between items-center">
                    <span>By {notif.senderRole || notif.senderName}</span>
                    <span>{notif.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
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
  );
}
