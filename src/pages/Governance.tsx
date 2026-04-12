import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Users, Shield, ChevronDown, ChevronUp, Trash2, Download, AlertCircle, Upload, Edit2, Save, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';

export function Governance() {
  const [openSection, setOpenSection] = useState<string | null>('structure');
  const { currentUser } = useAuth();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [constitutionText, setConstitutionText] = useState('');
  const [ethicsText, setEthicsText] = useState('');
  const [isEditingConstitution, setIsEditingConstitution] = useState(false);
  const [isEditingEthics, setIsEditingEthics] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.email?.toLowerCase().startsWith('bijoy.mm112');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'governance'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConstitutionText(data.constitution || 'No constitution rules set yet.');
        setEthicsText(data.ethics || 'No ethical guidelines set yet.');
      } else {
        setConstitutionText('No constitution rules set yet.');
        setEthicsText('No ethical guidelines set yet.');
      }
    });
    return unsub;
  }, []);

  const handleSaveGovernance = async (type: 'constitution' | 'ethics') => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'governance'), {
        [type]: type === 'constitution' ? constitutionText : ethicsText
      }, { merge: true });
      if (type === 'constitution') setIsEditingConstitution(false);
      if (type === 'ethics') setIsEditingEthics(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/governance');
      alert('Failed to save changes.');
    }
    setIsSaving(false);
  };

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleBackupData = async () => {
    setIsBackingUp(true);
    setActionMessage(null);
    try {
      const backup: any = {
        timestamp: new Date().toISOString(),
        users: [],
        payments: [],
        inventory: [],
        settings: {}
      };

      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(doc => backup.users.push({ id: doc.id, ...doc.data() }));

      const paymentsSnap = await getDocs(collection(db, 'payments'));
      paymentsSnap.forEach(doc => backup.payments.push({ id: doc.id, ...doc.data() }));

      const inventorySnap = await getDocs(collection(db, 'inventory'));
      inventorySnap.forEach(doc => backup.inventory.push({ id: doc.id, ...doc.data() }));

      const settingsSnap = await getDocs(collection(db, 'settings'));
      settingsSnap.forEach(doc => backup.settings[doc.id] = doc.data());

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `yield_org_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setActionMessage({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (error) {
      console.error('Backup failed:', error);
      setActionMessage({ type: 'error', text: 'Failed to create backup.' });
    }
    setIsBackingUp(false);
  };

  const handleRestoreData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Restoring data will overwrite existing data. Are you sure you want to proceed?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    setActionMessage(null);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.users || !backup.payments || !backup.inventory) {
        throw new Error('Invalid backup file format.');
      }

      // Restore Users
      for (const user of backup.users) {
        const { id, ...data } = user;
        await setDoc(doc(db, 'users', id), data);
      }

      // Restore Payments
      for (const payment of backup.payments) {
        const { id, ...data } = payment;
        await setDoc(doc(db, 'payments', id), data);
      }

      // Restore Inventory
      for (const item of backup.inventory) {
        const { id, ...data } = item;
        await setDoc(doc(db, 'inventory', id), data);
      }

      // Restore Settings
      if (backup.settings) {
        for (const [id, data] of Object.entries(backup.settings)) {
          await setDoc(doc(db, 'settings', id), data);
        }
      }

      setActionMessage({ type: 'success', text: 'Data restored successfully!' });
    } catch (error) {
      console.error('Restore failed:', error);
      setActionMessage({ type: 'error', text: 'Failed to restore data. Please check the backup file.' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsRestoring(false);
  };

  const handleResetDatabase = async () => {
    setIsDeleting(true);
    setActionMessage(null);
    try {
      // Delete all users except current admin
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const userDoc of usersSnap.docs) {
        if (userDoc.id !== currentUser?.uid) {
          await deleteDoc(doc(db, 'users', userDoc.id));
        }
      }

      // Delete all payments
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      for (const paymentDoc of paymentsSnap.docs) {
        await deleteDoc(doc(db, 'payments', paymentDoc.id));
      }

      // Delete all inventory
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      for (const itemDoc of inventorySnap.docs) {
        await deleteDoc(doc(db, 'inventory', itemDoc.id));
      }

      setActionMessage({ type: 'success', text: 'Database has been successfully reset. All test data removed.' });
      setShowResetModal(false);
    } catch (error) {
      console.error('Error resetting database:', error);
      setActionMessage({ type: 'error', text: 'An error occurred while resetting the database.' });
    }
    setIsDeleting(false);
  };

  const sections = [
    {
      id: 'structure',
      title: 'Organizational Structure',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>The Yield Organization is governed by an elected executive committee comprising the following key roles:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">President</h4>
              <p className="text-sm mt-2">Oversees all operations, chairs meetings, and acts as the primary representative of the society.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">Secretary</h4>
              <p className="text-sm mt-2">Maintains records, manages correspondence, and ensures compliance with the constitution.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-bold text-slate-900">Treasurer</h4>
              <p className="text-sm mt-2">Manages all financial assets, collects dues, disburses loans, and maintains the ledger.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'constitution',
      title: 'Constitution & Rules',
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <div className="flex items-center justify-between">
            <p>The written rules governing the operations of Yield Organization:</p>
            {isAdmin && !isEditingConstitution && (
              <button 
                onClick={() => setIsEditingConstitution(true)}
                className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm font-medium"
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>
          
          {isEditingConstitution ? (
            <div className="space-y-3">
              <textarea
                value={constitutionText}
                onChange={(e) => setConstitutionText(e.target.value)}
                className="w-full h-48 p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Enter constitution rules here..."
              />
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setIsEditingConstitution(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSaveGovernance('constitution')}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
              {constitutionText}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'ethics',
      title: 'Ethical Guidelines',
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <div className="flex items-center justify-between">
            <p>Unwritten and ethical rules that all members are expected to uphold:</p>
            {isAdmin && !isEditingEthics && (
              <button 
                onClick={() => setIsEditingEthics(true)}
                className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm font-medium"
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>

          {isEditingEthics ? (
            <div className="space-y-3">
              <textarea
                value={ethicsText}
                onChange={(e) => setEthicsText(e.target.value)}
                className="w-full h-48 p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                placeholder="Enter ethical guidelines here..."
              />
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setIsEditingEthics(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSaveGovernance('ethics')}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
              {ethicsText}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Governance Section</h2>
        <p className="text-slate-500 mt-1">Rules, structure, and ethical guidelines of Yield Organization.</p>
      </div>

      {currentUser?.email?.toLowerCase().startsWith('bijoy.mm112') && (
        <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200">
          <h3 className="text-lg font-bold text-rose-900 mb-2 flex items-center gap-2">
            <Shield size={20} />
            Admin Tools & Data Management
          </h3>
          <p className="text-rose-700 text-sm mb-4">
            Manage your organization's data. You can backup all data to a JSON file or completely reset the database.
          </p>

          {actionMessage && (
            <div className={cn("p-3 rounded-lg mb-4 text-sm font-medium", actionMessage.type === 'success' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
              {actionMessage.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleBackupData}
              disabled={isBackingUp || isRestoring}
              className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              {isBackingUp ? 'Backing up...' : 'Backup Data'}
            </button>
            
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleRestoreData} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isBackingUp || isRestoring}
              className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Upload size={18} />
              {isRestoring ? 'Restoring...' : 'Restore Data'}
            </button>

            <button 
              onClick={() => setShowResetModal(true)}
              disabled={isDeleting || isRestoring}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Trash2 size={18} />
              Reset Database
            </button>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-xl font-bold text-rose-600 mb-2 flex items-center gap-2">
              <AlertCircle size={24} />
              Confirm Database Reset
            </h3>
            <p className="text-slate-600 mb-6">
              WARNING: This action cannot be undone. It will permanently delete ALL users (except you), payments, and inventory data. Are you absolutely sure you want to proceed?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetDatabase}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;

          return (
            <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", section.bgColor, section.color)}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
                </div>
                {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </button>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50">
                      {section.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
