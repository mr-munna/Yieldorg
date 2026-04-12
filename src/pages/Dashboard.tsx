import React, { useEffect, useState } from 'react';
import { Users, Target, AlertCircle, Calendar } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { Payment } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalCollected: 0,
    monthlyTarget: 0,
    pendingDues: 0,
    totalFineCollected: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgAge, setOrgAge] = useState('');

  useEffect(() => {
    // Fetch Settings for Monthly Target and Foundation Date
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const target = data.monthlyTarget !== undefined ? data.monthlyTarget : 0;
        setStats(prev => ({ ...prev, monthlyTarget: target }));
        
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
    });

    // Fetch Users for Total Members
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats(prev => ({ ...prev, totalMembers: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Fetch Payments for Collected, Pending, and Chart
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      let collected = 0;
      let pending = 0;
      let fineCollected = 0;
      
      // For Chart Data (Last 6 months)
      const monthsMap = new Map<string, number>();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
        monthsMap.set(monthStr, 0);
      }

      snapshot.forEach((doc) => {
        const data = doc.data() as Payment;
        
        if (data.status === 'Paid') {
          collected += data.amountPaid;
          fineCollected += (data.fine || 0);
          
          if (monthsMap.has(data.month)) {
            monthsMap.set(data.month, monthsMap.get(data.month)! + data.amountPaid);
          }
        } else {
          pending += (data.amountDue - data.amountPaid) + (data.fine || 0);
        }
      });

      setStats(prev => ({ ...prev, totalCollected: collected, pendingDues: pending, totalFineCollected: fineCollected }));

      // Format Chart Data
      const newChartData = Array.from(monthsMap.entries()).map(([month, amount]) => {
        const date = new Date(month + '-01');
        return {
          name: date.toLocaleString('default', { month: 'short' }),
          target: stats.monthlyTarget || 0,
          collected: amount
        };
      });
      
      setChartData(newChartData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    return () => {
      unsubSettings();
      unsubUsers();
      unsubPayments();
    };
  }, [stats.monthlyTarget]);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Yield Dashboard</h2>
          <p className="text-slate-500 mt-1">Overview of Yield Organization's current status.</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg flex items-center gap-2 text-emerald-800">
          <Calendar size={18} className="text-emerald-600" />
          <span className="text-sm font-medium">Age: {orgAge}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stat.bgColor} ${stat.textColor}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
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
    </div>
  );
}
