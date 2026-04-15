import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Newspaper, Plus, Trash2, X, Image as ImageIcon } from 'lucide-react';

interface NewsPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  imageUrl?: string;
}

export function NewsFeed() {
  const { userProfile } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  
  // New Post State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = (userProfile?.role || '').toLowerCase();
  const canPost = ['admin', 'president', 'secretary'].includes(userRole);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const newsData: NewsPost[] = [];
      snapshot.forEach((doc) => {
        newsData.push({ id: doc.id, ...doc.data() } as NewsPost);
      });
      setPosts(newsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'news'));

    return () => unsub();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
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
        
        setImageBase64(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !userProfile) return;

    setIsSubmitting(true);
    try {
      const postData: any = {
        title: title.trim(),
        content: content.trim(),
        authorId: userProfile.uid,
        authorName: userProfile.name,
        createdAt: serverTimestamp()
      };

      if (imageBase64) {
        postData.imageUrl = imageBase64;
      }

      await addDoc(collection(db, 'news'), postData);
      
      setTitle('');
      setContent('');
      setImageBase64(null);
      setShowNewPostModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'news');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'news', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'news');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading news feed...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">News Feed</h1>
          <p className="text-slate-500 mt-1">Latest updates and announcements from Yield Organization.</p>
        </div>
        {canPost && (
          <button 
            onClick={() => setShowNewPostModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">New Post</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Newspaper size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No News Yet</h3>
            <p className="text-slate-500">Check back later for updates and announcements.</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {post.imageUrl && (
                <div className="w-full h-64 sm:h-80 bg-slate-100 relative">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <h2 className="text-xl font-bold text-slate-900">{post.title}</h2>
                  {canPost && (
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title="Delete Post"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed mb-6">
                  {post.content}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-sm text-slate-500">
                  <span className="font-medium text-emerald-700">{post.authorName}</span>
                  <span>{post.createdAt?.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Post Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Create News Post</h2>
              <button 
                onClick={() => setShowNewPostModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePost} className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Post title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                  <textarea 
                    required
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    placeholder="Write your announcement here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cover Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <ImageIcon size={18} />
                      Choose Image
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    {imageBase64 && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                        <img src={imageBase64} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImageBase64(null)}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
