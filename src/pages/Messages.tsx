import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, addDoc, setDoc, serverTimestamp, orderBy, limit, where } from 'firebase/firestore';
import { Search, Send, User, Users, Plus, X, MessageSquare } from 'lucide-react';
import { Member } from '../types';

interface GroupChat {
  id: string;
  name: string;
  participants: string[];
  isGroup: boolean;
}

type ActiveChat = {
  id: string;
  name: string;
  type: 'direct' | 'group';
  member?: Member;
};

export function Messages() {
  const { userProfile, currentUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Group Modal State
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembersForGroup, setSelectedMembersForGroup] = useState<string[]>([]);

  useEffect(() => {
    // Fetch all active members except current user
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Member;
        if (data.status === 'Active' && doc.id !== userProfile?.uid) {
          allUsers.push({ ...data, id: doc.id });
        }
      });
      setMembers(allUsers);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubUsers();
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile?.uid) return;
    // Fetch all chats
    const qChats = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', userProfile.uid)
    );
    const unsubChats = onSnapshot(qChats, (snapshot) => {
      const chats: any[] = [];
      snapshot.forEach(doc => {
        chats.push({ id: doc.id, ...doc.data() });
      });
      setAllChats(chats);
      
      const grps = chats.filter(c => c.isGroup);
      setGroups(grps as GroupChat[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    return () => unsubChats();
  }, [userProfile]);

  useEffect(() => {
    if (!activeChat || !userProfile) return;

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`));

    return () => unsubMessages();
  }, [activeChat, userProfile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !userProfile) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Update the chat document with the last message
      const chatRef = doc(db, 'chats', activeChat.id);
      await setDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userProfile.name,
        participants: activeChat.type === 'direct' ? [userProfile.uid, activeChat.member!.id] : undefined
      }, { merge: true });

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        text: messageText,
        senderId: userProfile.uid,
        senderName: userProfile.name,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeChat.id}/messages`);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMembersForGroup.length === 0 || !userProfile) return;
    
    try {
      const participants = [userProfile.uid, ...selectedMembersForGroup];
      await addDoc(collection(db, 'chats'), {
        name: newGroupName.trim(),
        participants,
        isGroup: true,
        createdAt: serverTimestamp(),
        createdBy: userProfile.uid
      });
      setShowNewGroupModal(false);
      setNewGroupName('');
      setSelectedMembersForGroup([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.memberId && m.memberId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const chatA = allChats.find(c => c.id === [userProfile?.uid, a.id].sort().join('_'));
    const chatB = allChats.find(c => c.id === [userProfile?.uid, b.id].sort().join('_'));
    const timeA = chatA?.lastMessageTime?.toMillis?.() || 0;
    const timeB = chatB?.lastMessageTime?.toMillis?.() || 0;
    return timeB - timeA;
  });

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    const chatA = allChats.find(c => c.id === a.id);
    const chatB = allChats.find(c => c.id === b.id);
    const timeA = chatA?.lastMessageTime?.toMillis?.() || 0;
    const timeB = chatB?.lastMessageTime?.toMillis?.() || 0;
    return timeB - timeA;
  });

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading messages...</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-[calc(100vh-8rem)] flex overflow-hidden relative">
      {/* Sidebar - Member List */}
      <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Messages</h2>
            <button 
              onClick={() => setShowNewGroupModal(true)}
              className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
              title="New Group"
            >
              <Users size={20} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search members or groups..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedGroups.length > 0 && (
            <div className="py-2">
              <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Groups</h3>
              {sortedGroups.map(group => {
                const chatData = allChats.find(c => c.id === group.id);
                return (
                <button
                  key={group.id}
                  onClick={() => setActiveChat({ id: group.id, name: group.name, type: 'group' })}
                  className={`w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${activeChat?.id === group.id ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 truncate">{group.name}</h4>
                    {chatData?.lastMessage ? (
                      <p className="text-xs truncate font-medium text-indigo-600">{chatData.lastMessageSender}: {chatData.lastMessage}</p>
                    ) : (
                      <p className="text-xs text-slate-500 truncate">{group.participants.length} members</p>
                    )}
                  </div>
                </button>
              )})}
            </div>
          )}

          <div className="py-2">
            <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Direct Messages</h3>
            {sortedMembers.map(member => {
              const chatId = [userProfile?.uid, member.id].sort().join('_');
              const chatData = allChats.find(c => c.id === chatId);
              return (
                <button
                  key={member.id}
                  onClick={() => setActiveChat({ id: chatId, name: member.name, type: 'direct', member })}
                  className={`w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${activeChat?.id === chatId ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <User size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 truncate">{member.name}</h4>
                    {chatData?.lastMessage ? (
                      <p className="text-xs truncate font-medium text-indigo-600">{chatData.lastMessage}</p>
                    ) : (
                      <p className="text-xs text-slate-500 truncate">{member.role} • {member.memberId}</p>
                    )}
                  </div>
                </button>
              );
            })}
            {sortedMembers.length === 0 && sortedGroups.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No results found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
              <button 
                onClick={() => setActiveChat(null)}
                className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600"
              >
                ←
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activeChat.type === 'group' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {activeChat.type === 'group' ? <Users size={20} /> : <User size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{activeChat.name}</h3>
                <p className="text-xs text-slate-500">
                  {activeChat.type === 'group' ? 'Group Chat' : activeChat.member?.role}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {messages.map((msg) => {
                const isMine = msg.senderId === userProfile?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && activeChat.type === 'group' && (
                      <span className="text-xs text-slate-500 ml-1 mb-1">{msg.senderName}</span>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Sending...'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  No messages yet. Start the conversation!
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <MessageSquare size={32} />
            </div>
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setShowNewGroupModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="text-indigo-600" />
              Create New Group
            </h3>
            
            <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 min-h-0">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                <input 
                  type="text" 
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="e.g., Executive Committee"
                />
              </div>

              <div className="mb-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Members</label>
              </div>
              
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg p-2 mb-4 space-y-1">
                {members.map(member => (
                  <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedMembersForGroup.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembersForGroup(prev => [...prev, member.id]);
                        } else {
                          setSelectedMembersForGroup(prev => prev.filter(id => id !== member.id));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.role}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-2 mt-auto">
                <button 
                  type="button"
                  onClick={() => setShowNewGroupModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newGroupName.trim() || selectedMembersForGroup.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
