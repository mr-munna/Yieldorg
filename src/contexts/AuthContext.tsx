import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  memberId?: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  joinDate: string;
  contact: string;
  status: string;
  organizationId: string;
  organizationName?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  bootstrapUser: (name: string, email: string, phone: string, orgCode?: string, orgName?: string) => Promise<void>;
  switchOrganization: (newOrgId: string, newOrgName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (unsubProfile) {
          unsubProfile();
        }
        const docRef = doc(db, 'users', user.uid);
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const orgId = data.organizationId || 'org_default';
            
            // Auto-upgrade specific emails to Admin if they aren't already
            const email = user.email?.toLowerCase() || '';
            const isAdminEmail = email.startsWith('bijoy.mm112');
            
            let needsUpdate = false;
            const updatedProfile = { ...data, organizationId: orgId };

            if (!data.organizationId) {
              needsUpdate = true;
            }

            if (isAdminEmail && (data.role !== 'Admin' || data.status !== 'Active')) {
              updatedProfile.role = 'Admin';
              updatedProfile.status = 'Active';
              updatedProfile.memberId = data.memberId || 'YO-ADMIN';
              needsUpdate = true;
            }

            if (needsUpdate) {
              await setDoc(docRef, updatedProfile, { merge: true });
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(data);
            }
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = undefined;
        }
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubProfile) {
        unsubProfile();
      }
      unsubscribe();
    };
  }, []);

  const bootstrapUser = async (name: string, email: string, phone: string, orgCode?: string, orgName?: string) => {
    if (!auth.currentUser) return;
    
    const formattedOrgId = orgCode && orgCode.trim() ? orgCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') : 'org_default';

    const profile: UserProfile = {
      uid: auth.currentUser.uid,
      memberId: null,
      name,
      email,
      phone,
      role: 'Member',
      joinDate: new Date().toISOString().split('T')[0],
      contact: email,
      status: 'Pending',
      organizationId: formattedOrgId,
      organizationName: orgName?.trim() || (formattedOrgId === 'org_default' ? 'Triangle' : formattedOrgId.toUpperCase())
    };
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      setUserProfile(profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}`);
    }
  };

  const switchOrganization = async (newOrgId: string, newOrgName?: string) => {
    if (!auth.currentUser) return;
    const formattedOrgId = newOrgId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!formattedOrgId) return;

    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(docRef, {
        organizationId: formattedOrgId,
        organizationName: newOrgName?.trim() || (formattedOrgId === 'org_default' ? 'Triangle' : formattedOrgId.toUpperCase())
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, bootstrapUser, switchOrganization }}>
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
