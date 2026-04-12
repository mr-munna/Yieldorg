import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  memberId?: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  joinDate: string;
  contact: string;
  status: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  bootstrapUser: (name: string, email: string, phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const bootstrapUser = async (name: string, email: string, phone: string) => {
    if (!auth.currentUser) return;
    
    const isAdmin = email.toLowerCase().startsWith('bijoy.mm112') || email.toLowerCase() === 'admin@yieldorg.com';
    
    const profile: UserProfile = {
      uid: auth.currentUser.uid,
      memberId: isAdmin ? 'YO-ADMIN' : null,
      name,
      email,
      phone,
      role: isAdmin ? 'Admin' : 'Member',
      joinDate: new Date().toISOString().split('T')[0],
      contact: email,
      status: isAdmin ? 'Active' : 'Pending'
    };
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      setUserProfile(profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, bootstrapUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
