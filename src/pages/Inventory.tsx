import React, { useState, useEffect } from 'react';
import { Archive, CheckCircle2, AlertCircle, X, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  status: 'Available' | 'In Use' | 'Archived';
  assignedTo?: string;
}

export function Inventory() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'Admin';

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', status: 'Available' as const });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'inventory'), {
        name: newItem.name,
        description: newItem.description,
        status: newItem.status,
      });
      setNewItem({ name: '', description: '', status: 'Available' });
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory & Tools</h2>
          <p className="text-slate-500 mt-1">Track essential physical assets and documents of the society.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Item
          </button>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Asset</h3>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input 
                  type="text" 
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g., Official Stamp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="What is this item used for?"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  value={newItem.status}
                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value as any })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="Available">Available</option>
                  <option value="In Use">In Use</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-6 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading inventory...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventory.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                <Archive size={24} />
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
                item.status === 'Available' ? "bg-emerald-50 text-emerald-700" :
                item.status === 'In Use' ? "bg-amber-50 text-amber-700" :
                "bg-slate-100 text-slate-700"
              )}>
                {item.status === 'Available' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {item.status}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2">{item.name}</h3>
            <p className="text-slate-500 text-sm flex-1">{item.description}</p>
            
            {item.assignedTo && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Currently with</p>
                <p className="text-sm font-medium text-slate-900">{item.assignedTo}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
