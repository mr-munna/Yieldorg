import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { Shield, KeyRound, User as UserIcon, Mail, Phone, BookOpen, CheckCircle2, X } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';

export function Login() {
  const { bootstrapUser, currentUser } = useAuth();
  const [isLogin, setIsLogin] = useState(!currentUser);
  const [identifier, setIdentifier] = useState(''); // Email or Member ID
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [showConstitutionModal, setShowConstitutionModal] = useState(false);
  const [constitutionText, setConstitutionText] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser && !isLogin) {
      setMessage('Your authentication is active, but your profile was not found (this can happen after a database reset). Please fill in your details below to re-register and restore your access.');
    }
  }, [currentUser, isLogin]);

  const defaultConstitution = `The written rules governing the operations of Yield Organization:
- Membership: Open to individuals over 18 years of age. Requires a one-time admission fee and regular monthly contributions.
- Monthly Dues: Must be paid by the 10th of every month. Late payments incur a fine.
- Loans: Members can apply for loans up to 3x their total contribution after 6 months of active membership. Interest rate is fixed at 5% per annum.
- Profit Sharing: Net profits generated from loan interest and investments are distributed annually as dividends based on member contribution ratio.
- Meetings: General body meetings are held quarterly. Emergency meetings can be called by the President with 48 hours notice.`;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'governance'), (docSnap) => {
      if (docSnap.exists()) {
        setConstitutionText(docSnap.data().constitution || defaultConstitution);
      } else {
        setConstitutionText(defaultConstitution);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/governance'));
    return unsub;
  }, []);

  const handleResetPassword = async () => {
    setError('');
    setMessage('');
    const resetEmail = identifier.trim();
    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Please enter your email address in the Email/Member ID field to reset your password.');
      return;
    }
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, resetEmail);
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!isLogin && !agreedToRules) {
      setError('You must agree to the Constitution & Rules before submitting.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        let loginEmail = identifier.trim();
        
        // If it doesn't look like an email, assume it's a Member ID and resolve it
        if (!loginEmail.includes('@')) {
          const response = await fetch(`/api/resolve-member/${loginEmail}`);
          if (!response.ok) {
            throw new Error('Member ID not found. Please wait for admin approval or check your ID.');
          }
          const data = await response.json();
          loginEmail = data.email;
        }

        await signInWithEmailAndPassword(auth, loginEmail, password);
      } else {
        const regEmail = email.trim();
        if (!name || !regEmail || !phone) {
          throw new Error("Name, Email, and Phone are required for registration.");
        }
        
        // If already authenticated in Auth but no profile, just bootstrap
        if (!auth.currentUser) {
          await createUserWithEmailAndPassword(auth, regEmail, password);
        }
        
        await bootstrapUser(name, regEmail, phone);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Account not found or incorrect password. If you haven\'t registered yet, please use the registration form below.');
        setIsLogin(false); // Suggest registration
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered! Please click "Already approved? Sign in" below, and log in. If you forgot your password, use the "Forgot Password?" button.');
        setIsLogin(true); // Auto-switch to login
        setIdentifier(email.trim()); // Pre-fill the email
      } else {
        setError(`${err.code}: ${err.message}` || 'Failed to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderConstitution = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.trim().startsWith('- ') && line.includes(':')) {
        const [point, ...rest] = line.substring(2).split(':');
        return (
          <div key={index} className="mb-2">
            <span className="font-bold text-slate-800">• {point}:</span>
            {rest.join(':')}
          </div>
        );
      }
      return <div key={index} className="mb-2">{line}</div>;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className={cn("w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-500", !isLogin ? "max-w-xl" : "max-w-md")}>
        <div className="bg-emerald-900 p-8 text-center relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div className="absolute top-10 -right-10 w-40 h-40 bg-emerald-400 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center font-bold text-white text-3xl shadow-lg shadow-emerald-500/20 mx-auto mb-4 ring-4 ring-emerald-800/50">
              YO
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Yield Organization</h1>
            <p className="text-emerald-200/90 mt-2 text-sm font-medium">
              {isLogin ? "Member Portal Access" : "Join our community of investors"}
            </p>
          </div>
        </div>
        
        <div className="p-6 md:p-10">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-6 border border-rose-100">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm mb-6 border border-emerald-100">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin ? (
              <div className="space-y-5">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                    <UserIcon size={20} className="text-emerald-600" />
                    Personal Information
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Please provide your details to register.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="tel" 
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 ml-1">Must be at least 6 characters long.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl cursor-pointer hover:bg-emerald-100/80 transition-colors shadow-sm group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input 
                        type="checkbox" 
                        className="peer w-5 h-5 appearance-none border-2 border-emerald-400 rounded-md checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer"
                        checked={agreedToRules}
                        onChange={(e) => setAgreedToRules(e.target.checked)}
                      />
                      <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                    </div>
                    <span className="text-sm text-emerald-900 font-medium leading-relaxed">
                      I have read, understood, and agree to follow the{' '}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowConstitutionModal(true);
                        }}
                        className="text-emerald-700 font-bold underline hover:text-emerald-800"
                      >
                        Constitution & Rules
                      </button>
                      {' '}of Yield Organization.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email or Member ID</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Enter your email or member ID"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <button 
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            <button 
              type="submit" 
              disabled={loading || (!isLogin && !agreedToRules)}
              className={cn(
                "w-full text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg",
                !isLogin ? "bg-emerald-600 hover:bg-emerald-700 mt-8" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Submit Registration Request')}
              {!loading && !isLogin && <CheckCircle2 size={20} />}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium block w-full"
            >
              {isLogin ? "Don't have an account? Register" : "Already approved? Sign in"}
            </button>
            
            {currentUser && (
              <button 
                onClick={() => signOut(auth)}
                className="text-slate-400 hover:text-slate-500 text-xs font-medium block w-full"
              >
                Sign out and start over
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Constitution Modal */}
      {showConstitutionModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-900 text-white">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <BookOpen size={24} className="text-emerald-400" />
                Constitution & Rules
              </h3>
              <button 
                onClick={() => setShowConstitutionModal(false)}
                className="text-emerald-200 hover:text-white transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 text-slate-700 text-sm leading-relaxed">
              {renderConstitution(constitutionText)}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowConstitutionModal(false)}
                className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setAgreedToRules(true);
                  setShowConstitutionModal(false);
                }}
                className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-2"
              >
                <CheckCircle2 size={18} />
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
