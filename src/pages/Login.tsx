import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { Shield, KeyRound, User as UserIcon, Mail, Phone } from 'lucide-react';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(''); // Email or Member ID
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { bootstrapUser } = useAuth();

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
        await createUserWithEmailAndPassword(auth, regEmail, password);
        await bootstrapUser(name, regEmail, phone);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect password. If you forgot it, type your email and click "Forgot Password?".');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered! Please click "Already approved? Sign in" below, and log in. If you forgot your password, use the "Forgot Password?" button.');
        setIsLogin(true); // Auto-switch to login
        setIdentifier(email.trim()); // Pre-fill the email
      } else {
        setError(err.message || 'Failed to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-emerald-900 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center font-bold text-white text-3xl shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            YO
          </div>
          <h1 className="text-2xl font-bold text-white">Yield Organization</h1>
          <p className="text-emerald-200/80 mt-2 text-sm">Member Portal Access</p>
        </div>
        
        <div className="p-8">
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
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="tel" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>
              </>
            )}

            {isLogin && (
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
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Forgot Password?
                  </button>
                )}
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

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Submit Registration Request')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              {isLogin ? "Don't have an account? Register" : "Already approved? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
