import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Finances } from './pages/Finances';
import { Governance } from './pages/Governance';
import { Inventory } from './pages/Inventory';
import { Login } from './pages/Login';
import { MemberDashboard } from './pages/MemberDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

function AppContent() {
  const { currentUser, userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'Member') {
        setActiveTab('member-dashboard');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [userProfile]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  if (userProfile?.status === 'Pending' && !currentUser?.email?.startsWith('bijoy.mm112') && currentUser?.email !== 'admin@yieldorg.com') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ⏳
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Pending</h2>
          <p className="text-slate-600 mb-6">
            Your registration request has been received. Please wait for the administrator to approve your account and assign you a Member ID.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'member-dashboard':
        return <MemberDashboard />;
      case 'members':
        return <Members />;
      case 'finances':
        return <Finances />;
      case 'governance':
        return <Governance />;
      case 'inventory':
        return <Inventory />;
      default:
        return userProfile?.role === 'Member' ? <MemberDashboard /> : <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
