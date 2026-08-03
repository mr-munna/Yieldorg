import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, ChevronDown, ChevronUp, UserCheck, Calendar, Coins, CheckCircle2, Filter, ShieldAlert } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { formatCurrency, calculateLateFine, getMonthsRange, cn } from '../lib/utils';
import { Payment } from '../types';

interface PendingDuesOverviewProps {
  usersList?: any[];
  paymentsList?: Payment[];
  monthlyFee?: number;
  dailyFine?: number;
  title?: string;
}

export interface MemberUnpaidRecord {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  role: string;
  joinDate: string;
  unpaidMonths: {
    month: string;
    formattedMonth: string;
    baseFee: number;
    fine: number;
    totalDue: number;
    status: 'Pending' | 'Verifying' | 'Missing';
  }[];
  totalUnpaidMonthsCount: number;
  totalPendingAmount: number;
  totalFineAmount: number;
}

export function formatMonthName(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const PendingDuesOverview: React.FC<PendingDuesOverviewProps> = ({
  usersList: propUsers,
  paymentsList: propPayments,
  monthlyFee: propFee,
  dailyFine: propFine,
  title = "Unpaid Dues List"
}) => {
  const [localUsers, setLocalUsers] = useState<any[]>([]);
  const [localPayments, setLocalPayments] = useState<Payment[]>([]);
  const [localFee, setLocalFee] = useState<number>(0);
  const [localFine, setLocalFine] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(!propUsers || !propPayments);

  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<'all' | '1' | '2+' | '3+'>('all');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Self-subscribe if props are not fully passed
  useEffect(() => {
    if (propUsers && propPayments && propFee !== undefined && propFine !== undefined) {
      setLocalUsers(propUsers);
      setLocalPayments(propPayments);
      setLocalFee(propFee);
      setLocalFine(propFine);
      setLoading(false);
      return;
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setLocalFee(docSnap.data().monthlyFeeAmount || 0);
        setLocalFine(docSnap.data().dailyFineAmount || 0);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalUsers(uList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      const pList: Payment[] = [];
      snapshot.forEach(docSnap => pList.push({ id: docSnap.id, ...docSnap.data() } as Payment));
      setLocalPayments(pList);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    return () => {
      unsubSettings();
      unsubUsers();
      unsubPayments();
    };
  }, [propUsers, propPayments, propFee, propFine]);

  const activeUsers = (propUsers || localUsers).filter((u: any) => u.status === 'Active' && u.role !== 'Admin');
  const payments = propPayments || localPayments;
  const currentFee = propFee !== undefined ? propFee : localFee;
  const currentFine = propFine !== undefined ? propFine : localFine;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const nowTick = Date.now();

  // Compute unpaid status per active member
  const unpaidRecords: MemberUnpaidRecord[] = activeUsers.map((member: any) => {
    const joinMonthStr = member.joinDate ? member.joinDate.substring(0, 7) : currentMonth;
    const startMonthStr = (joinMonthStr && joinMonthStr <= currentMonth) ? joinMonthStr : currentMonth;
    const targetMonths = getMonthsRange(startMonthStr, currentMonth);

    const unpaidMonthsList: MemberUnpaidRecord['unpaidMonths'] = [];
    let totalPending = 0;
    let totalFines = 0;

    targetMonths.forEach((m) => {
      const paymentDoc = payments.find(
        p => (p.userId === member.id || p.memberId === member.memberId) && p.month === m
      );

      if (paymentDoc) {
        if (paymentDoc.status !== 'Paid') {
          const fineAmt = calculateLateFine(m, paymentDoc.dueDate, member.joinDate, currentFine, nowTick);
          const baseDue = paymentDoc.amountDue - paymentDoc.amountPaid;
          const monthTotal = baseDue + fineAmt;

          totalPending += monthTotal;
          totalFines += fineAmt;

          unpaidMonthsList.push({
            month: m,
            formattedMonth: formatMonthName(m),
            baseFee: baseDue,
            fine: fineAmt,
            totalDue: monthTotal,
            status: paymentDoc.status as 'Pending' | 'Verifying'
          });
        }
      } else {
        // Missing payment doc
        if (currentFee > 0) {
          const fineAmt = calculateLateFine(m, undefined, member.joinDate, currentFine, nowTick);
          const monthTotal = currentFee + fineAmt;

          totalPending += monthTotal;
          totalFines += fineAmt;

          unpaidMonthsList.push({
            month: m,
            formattedMonth: formatMonthName(m),
            baseFee: currentFee,
            fine: fineAmt,
            totalDue: monthTotal,
            status: 'Missing'
          });
        }
      }
    });

    return {
      id: member.id,
      memberId: member.memberId || member.id,
      name: member.name || 'Member',
      phone: member.phone || '',
      role: member.role || 'Member',
      joinDate: member.joinDate || '',
      unpaidMonths: unpaidMonthsList,
      totalUnpaidMonthsCount: unpaidMonthsList.length,
      totalPendingAmount: totalPending,
      totalFineAmount: totalFines
    };
  }).filter(record => record.totalUnpaidMonthsCount > 0);

  // Sort defaulters: highest unpaid months first, then highest amount
  unpaidRecords.sort((a, b) => {
    if (b.totalUnpaidMonthsCount !== a.totalUnpaidMonthsCount) {
      return b.totalUnpaidMonthsCount - a.totalUnpaidMonthsCount;
    }
    return b.totalPendingAmount - a.totalPendingAmount;
  });

  // Filter based on search & month filter
  const filteredRecords = unpaidRecords.filter(record => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.phone.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (monthFilter === '1') return record.totalUnpaidMonthsCount === 1;
    if (monthFilter === '2+') return record.totalUnpaidMonthsCount >= 2;
    if (monthFilter === '3+') return record.totalUnpaidMonthsCount >= 3;

    return true;
  });

  const totalOrgDefaulters = unpaidRecords.length;
  const totalOrgDefaulterAmount = unpaidRecords.reduce((sum, r) => sum + r.totalPendingAmount, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 text-white p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              {title}
              {totalOrgDefaulters > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                  {totalOrgDefaulters} Defaulter{totalOrgDefaulters > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Overview of members with unpaid monthly dues, pending months, fines, and total balance.
            </p>
          </div>
        </div>

        {totalOrgDefaulterAmount > 0 && (
          <div className="bg-rose-900/40 border border-rose-500/30 rounded-xl px-3 py-1.5 self-start sm:self-auto flex items-center gap-2">
            <Coins size={15} className="text-rose-400" />
            <span className="text-xs text-rose-200">
              Total Outstanding: <strong className="text-white font-bold">{formatCurrency(totalOrgDefaulterAmount)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Controls: Search & Filter */}
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or Member ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
            <Filter size={12} /> Filter:
          </span>
          {[
            { key: 'all', label: 'All' },
            { key: '1', label: '1 Month' },
            { key: '2+', label: '2+ Months' },
            { key: '3+', label: '3+ Months' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setMonthFilter(f.key as any)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border",
                monthFilter === f.key
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Content */}
      <div className="p-3 sm:p-5">
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Loading pending dues data...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-8 px-4 text-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/50">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800 text-sm sm:text-base">All Members Are Up To Date!</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchTerm || monthFilter !== 'all' 
                ? 'No unpaid members matched your search criteria.'
                : 'All active members have paid their dues. There are no outstanding payments.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const isExpanded = expandedMemberId === record.id;

              return (
                <div
                  key={record.id}
                  className={cn(
                    "border rounded-xl p-3 sm:p-4 transition-all bg-white hover:shadow-md",
                    record.totalUnpaidMonthsCount >= 3 
                      ? "border-rose-300/80 bg-rose-50/20" 
                      : "border-slate-200"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Member Details */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl font-bold flex items-center justify-center shrink-0 text-sm shadow-sm border",
                        record.totalUnpaidMonthsCount >= 3
                          ? "bg-rose-600 text-white border-rose-700"
                          : "bg-amber-500 text-white border-amber-600"
                      )}>
                        {record.name.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base">{record.name}</h4>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                            {record.memberId}
                          </span>
                          {record.totalUnpaidMonthsCount >= 3 && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                              Urgent Notice!
                            </span>
                          )}
                        </div>

                        {/* Unpaid Months Chips */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-rose-700 flex items-center gap-1 bg-rose-100/80 px-2 py-0.5 rounded-lg border border-rose-200">
                            <Calendar size={12} />
                            {record.totalUnpaidMonthsCount} Month{record.totalUnpaidMonthsCount > 1 ? 's' : ''} Unpaid
                          </span>
                          
                          <div className="flex items-center gap-1 flex-wrap">
                            {record.unpaidMonths.slice(0, 3).map((um, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                {um.formattedMonth}
                              </span>
                            ))}
                            {record.unpaidMonths.length > 3 && (
                              <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md font-bold">
                                +{record.unpaidMonths.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Expand Toggle */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Payable Dues</p>
                        <p className="font-bold text-sm sm:text-base text-rose-600">
                          {formatCurrency(record.totalPendingAmount)}
                        </p>
                        {record.totalFineAmount > 0 && (
                          <p className="text-[10px] text-slate-500">
                            (Includes Fine: {formatCurrency(record.totalFineAmount)})
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(isExpanded ? null : record.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1 text-xs font-medium"
                        title="View details"
                      >
                        <span className="hidden sm:inline">{isExpanded ? 'Hide' : 'Details'}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Breakdown for each unpaid month */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 bg-slate-50/80 rounded-xl p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Pending Months Breakdown:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {record.unpaidMonths.map((um, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200/90 rounded-lg p-2 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{um.formattedMonth}</p>
                              <p className="text-[10px] text-slate-500">
                                Base Fee: {formatCurrency(um.baseFee)}
                                {um.fine > 0 && ` + Fine: ${formatCurrency(um.fine)}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-rose-600 text-xs">
                                {formatCurrency(um.totalDue)}
                              </span>
                              <div>
                                {um.status === 'Verifying' ? (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                    Verifying
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
