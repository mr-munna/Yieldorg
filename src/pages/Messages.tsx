import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, addDoc, setDoc, serverTimestamp, orderBy, limit, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Send, User, Users, Plus, X, MessageSquare, Settings, Trash2, Edit2, UserMinus, Image as ImageIcon, Mic, Phone, Video, Square, Download as DownloadIcon } from 'lucide-react';
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
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembersForGroup, setSelectedMembersForGroup] = useState<string[]>([]);
  
  // Media State
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        msgs.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) });
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`));

    return () => unsubMessages();
  }, [activeChat, userProfile]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, mediaType?: 'image' | 'audio') => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaUrl) || !activeChat || !userProfile) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      let lastMessageText = messageText;
      if (mediaType === 'image') lastMessageText = '📷 Photo';
      if (mediaType === 'audio') lastMessageText = '🎤 Audio message';

      // Update the chat document with the last message
      const chatRef = doc(db, 'chats', activeChat.id);
      await setDoc(chatRef, {
        lastMessage: lastMessageText,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userProfile.name,
        participants: activeChat.type === 'direct' ? [userProfile.uid, activeChat.member!.id] : undefined
      }, { merge: true });

      const messageData: any = {
        senderId: userProfile.uid,
        senderName: userProfile.name,
        createdAt: serverTimestamp()
      };

      if (messageText) messageData.text = messageText;
      if (mediaUrl && mediaType === 'image') messageData.imageUrl = mediaUrl;
      if (mediaUrl && mediaType === 'audio') messageData.audioUrl = mediaUrl;

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), messageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeChat.id}/messages`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !userProfile) return;

    setIsUploading(true);
    try {
      // Resize image to ensure it fits in Firestore (1MB limit)
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64Url = canvas.toDataURL('image/jpeg', 0.7);
          await handleSendMessage(undefined, base64Url, 'image');
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image');
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0 && activeChat && userProfile) {
          setIsUploading(true);
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              await handleSendMessage(undefined, base64Audio, 'audio');
              setIsUploading(false);
            };
            reader.readAsDataURL(audioBlob);
          } catch (error) {
            console.error('Error processing audio:', error);
            alert('Failed to process audio message');
            setIsUploading(false);
          }
        }
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; // Clear chunks so it doesn't upload
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCall = (type: 'audio' | 'video') => {
    if (!activeChat) return;
    const roomName = `YieldOrg_Chat_${activeChat.id}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}`;
    setActiveCallUrl(jitsiUrl);
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

  const handleUpdateGroupName = async () => {
    if (!activeChat || !editingGroupName.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', activeChat.id), {
        name: editingGroupName.trim()
      });
      setActiveChat({ ...activeChat, name: editingGroupName.trim() });
      setEditingGroupName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeChat) return;
    try {
      await deleteDoc(doc(db, 'chats', activeChat.id));
      setShowGroupSettings(false);
      setShowDeleteConfirm(false);
      setActiveChat(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chats');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeChat) return;
    const chatData = allChats.find(c => c.id === activeChat.id);
    if (!chatData) return;
    
    const newParticipants = chatData.participants.filter((p: string) => p !== memberId);
    try {
      await updateDoc(doc(db, 'chats', activeChat.id), {
        participants: newParticipants
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-[calc(100vh-120px)] md:h-[calc(100vh-8rem)] flex overflow-hidden relative">
      {/* Sidebar - Member List */}
      <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col absolute md:relative inset-0 z-10 bg-white transition-transform duration-300 ${activeChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
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
      <div className={`flex-1 flex flex-col w-full absolute md:relative inset-0 z-20 bg-slate-50 transition-transform duration-300 ${!activeChat ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
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
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{activeChat.name}</h3>
                <p className="text-xs text-slate-500">
                  {activeChat.type === 'group' ? 'Group Chat' : activeChat.member?.role}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleCall('audio')}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Audio Call"
                >
                  <Phone size={20} />
                </button>
                <button 
                  onClick={() => handleCall('video')}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Video Call"
                >
                  <Video size={20} />
                </button>
                {activeChat.type === 'group' && (
                  <button 
                    onClick={() => setShowGroupSettings(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                    title="Group Settings"
                  >
                    <Settings size={20} />
                  </button>
                )}
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
                      {msg.imageUrl && (
                        <div className="relative group">
                          <img 
                            src={msg.imageUrl} 
                            alt="Uploaded" 
                            className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" 
                            style={{ maxHeight: '200px', objectFit: 'contain' }} 
                            onClick={() => setSelectedImage(msg.imageUrl)}
                          />
                          <a 
                            href={msg.imageUrl} 
                            download={`image_${msg.id}.jpg`}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download Image"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DownloadIcon size={14} />
                          </a>
                        </div>
                      )}
                      {msg.audioUrl && (
                        <div className="flex flex-col gap-1 mb-2">
                          <audio src={msg.audioUrl} controls className="max-w-full" style={{ height: '40px' }} />
                          <a 
                            href={msg.audioUrl} 
                            download={`audio_${msg.id}.webm`}
                            className={`text-[10px] flex items-center gap-1 w-fit hover:underline ${isMine ? 'text-indigo-200' : 'text-indigo-600'}`}
                          >
                            <DownloadIcon size={10} /> Download Audio
                          </a>
                        </div>
                      )}
                      {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
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
              {isRecording ? (
                <div className="flex items-center gap-3 bg-red-50 p-2 rounded-full border border-red-100">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse ml-2" />
                  <span className="text-red-600 font-medium text-sm flex-1">
                    Recording... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                  >
                    <Square size={18} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors disabled:opacity-50"
                    title="Send Photo"
                  >
                    <ImageIcon size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                    title="Send Audio"
                  >
                    <Mic size={20} />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isUploading ? "Uploading..." : "Type a message..."}
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isUploading}
                    className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
                  >
                    <Send size={18} className="ml-1" />
                  </button>
                </form>
              )}
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

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setSelectedImage(null)}>
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={selectedImage} 
            alt="Full size" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <a 
            href={selectedImage} 
            download="yield_image.jpg"
            className="absolute bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 transition-colors shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadIcon size={18} />
            Download
          </a>
        </div>
      )}

      {/* Call Modal */}
      {activeCallUrl && (
        <div className="fixed inset-0 bg-slate-900/90 flex flex-col z-50">
          <div className="p-4 flex justify-between items-center bg-slate-900 text-white">
            <h3 className="font-bold flex items-center gap-2">
              <Video size={20} />
              Ongoing Call: {activeChat?.name}
            </h3>
            <button 
              onClick={() => setActiveCallUrl(null)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              End Call
            </button>
          </div>
          <div className="flex-1 w-full bg-black">
            <iframe 
              src={activeCallUrl} 
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full h-full border-0"
            ></iframe>
          </div>
        </div>
      )}

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
      {/* Group Settings Modal */}
      {showGroupSettings && activeChat?.type === 'group' && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setShowGroupSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Settings className="text-indigo-600" />
              Group Settings
            </h3>
            
            <div className="flex flex-col flex-1 min-h-0 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editingGroupName || activeChat.name}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Group Name"
                  />
                  <button 
                    onClick={handleUpdateGroupName}
                    disabled={!editingGroupName.trim() || editingGroupName.trim() === activeChat.name}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-sm font-medium text-slate-700 mb-2">Members</label>
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {allChats.find(c => c.id === activeChat.id)?.participants?.map((participantId: string) => {
                    const member = members.find(m => m.id === participantId);
                    if (!member) return null;
                    const isMe = participantId === userProfile?.uid;
                    const isCreator = allChats.find(c => c.id === activeChat.id)?.createdBy === userProfile?.uid;
                    
                    return (
                      <div key={participantId} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <User size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {member.name} {isMe && '(You)'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{member.role}</p>
                          </div>
                        </div>
                        {isCreator && !isMe && (
                          <button 
                            onClick={() => handleRemoveMember(participantId)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="Remove Member"
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {allChats.find(c => c.id === activeChat.id)?.createdBy === userProfile?.uid && (
                <div className="pt-4 border-t border-slate-100">
                  {!showDeleteConfirm ? (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium py-2.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                      Delete Group
                    </button>
                  ) : (
                    <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                      <p className="text-sm text-rose-800 font-medium mb-3 text-center">Are you sure you want to delete this group?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-md border border-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleDeleteGroup}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 rounded-md transition-colors"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
