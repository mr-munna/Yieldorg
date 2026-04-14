import React, { useState, useEffect } from 'react';
import { Search, Plus, MoreVertical, CheckCircle, XCircle, X, Megaphone } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Member } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function Members() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'Admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [roleModalMember, setRoleModalMember] = useState<Member | null>(null);

  const canBroadcast = ['admin', 'president', 'secretary'].includes(userProfile?.role?.toLowerCase() || '');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: Member[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as Member);
      });
      setMembers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let maxIdNumber = 0;
      
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.memberId && data.memberId.startsWith('YO-')) {
          const numPart = parseInt(data.memberId.split('-')[1], 10);
          if (!isNaN(numPart) && numPart > maxIdNumber) {
            maxIdNumber = numPart;
          }
        }
      });
      
      const nextIdNumber = maxIdNumber + 1;
      const newMemberId = `YO-${nextIdNumber.toString().padStart(3, '0')}`;

      await updateDoc(doc(db, 'users', userId), {
        status: 'Active',
        memberId: newMemberId
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'Inactive'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: currentStatus === 'Active' ? 'Inactive' : 'Active'
      });
      setActionMenuId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setRoleModalMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    
    setIsBroadcasting(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: broadcastTitle,
        message: broadcastMessage,
        type: 'broadcast',
        senderId: userProfile?.uid,
        senderName: userProfile?.name,
        senderRole: userProfile?.role,
        createdAt: serverTimestamp()
      });
      setShowBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.memberId && member.memberId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingRequests = filteredMembers.filter(m => m.status === 'Pending');
  const activeMembers = filteredMembers.filter(m => m.status !== 'Pending').sort((a, b) => {
    if (a.role === 'Admin' && b.role !== 'Admin') return -1;
    if (b.role === 'Admin' && a.role !== 'Admin') return 1;
    const idA = a.memberId || '';
    const idB = b.memberId || '';
    return idA.localeCompare(idB);
  });

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Management</h2>
          <p className="text-slate-500 mt-1">Manage society members, roles, and approve new requests.</p>
        </div>
        <div className="flex items-center gap-3">
          {canBroadcast && (
            <button 
              onClick={() => setShowBroadcastModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Megaphone size={18} />
              Broadcast Message
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Add Member
            </button>
          )}
        </div>
      </div>

      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative">
            <button 
              onClick={() => setShowBroadcastModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Megaphone className="text-indigo-600" size={24} />
              Broadcast Message
            </h3>
            <p className="text-slate-600 mb-6 text-sm">
              Send an announcement or notice to all members. This will appear on their dashboard.
            </p>
            
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="e.g., Important Notice: Monthly Meeting"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea 
                  required
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  placeholder="Type your message here..."
                ></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isBroadcasting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isBroadcasting ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Add New Member</h3>
            <p className="text-slate-600 mb-6">
              For security reasons, new members must register themselves to create a secure password.
            </p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
              <p className="text-emerald-800 text-sm font-medium">
                Please instruct the new member to visit the login page and click "Don't have an account? Register". Once they submit their request, it will appear here for your approval.
              </p>
            </div>
            <button 
              onClick={() => setShowAddModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="p-4 border-b border-amber-200 bg-amber-100/50">
            <h3 className="font-bold text-amber-900">Pending Registration Requests ({pendingRequests.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-200 text-amber-800 text-sm">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/50">
                {pendingRequests.map((member) => (
                  <tr key={member.id} className="hover:bg-amber-100/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{member.name}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{member.email}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{member.phone}</td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => handleApprove(member.id)}
                          className="flex items-center gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                        <button 
                          onClick={() => handleReject(member.id)}
                          className="flex items-center gap-1 bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search members by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">Member ID</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Contact Info</th>
                <th className="px-6 py-4 font-medium">Joining Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-600">{member.memberId || 'N/A'}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{member.name}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      member.role === 'President' ? "bg-purple-100 text-purple-700" :
                      member.role === 'Secretary' ? "bg-blue-100 text-blue-700" :
                      member.role === 'Treasurer' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    <div>{member.email}</div>
                    <div className="text-xs text-slate-400">{member.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{formatDate(member.joinDate)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit",
                      member.status === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", member.status === 'Active' ? "bg-emerald-500" : "bg-rose-500")}></span>
                      {member.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {actionMenuId === member.id && (
                        <div className="absolute right-8 top-10 w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-10">
                          <button 
                            onClick={() => {
                              setRoleModalMember(member);
                              setActionMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                          >
                            Change Role
                          </button>
                          <button 
                            onClick={() => toggleStatus(member.id, member.status)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                          >
                            Mark as {member.status === 'Active' ? 'Inactive' : 'Active'}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {activeMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No active members found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {roleModalMember && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setRoleModalMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Change Role</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Select a new role for <span className="font-medium text-slate-900">{roleModalMember.name}</span>.
            </p>
            
            <div className="space-y-3 mb-6">
              {['Member', 'Admin', 'President', 'Secretary', 'Treasurer'].map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(roleModalMember.id, role)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all",
                    roleModalMember.role === role 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium" 
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setRoleModalMember(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
