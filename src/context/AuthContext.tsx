import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthContext: Initializing auth listener");
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        console.log(`AuthContext: User authenticated: ${firebaseUser.uid}`);
        setLoading(true);
        let authResolved = false;

        const loadingTimeout = window.setTimeout(() => {
          if (authResolved) return;
          console.info("AuthContext: Profile listener delayed, allowing app render");
          setLoading(false);
        }, 8000);

        const userDoc = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userDoc, (doc) => {
          authResolved = true;
          window.clearTimeout(loadingTimeout);
          if (doc.exists()) {
            const profileData = { uid: firebaseUser.uid, ...doc.data() } as UserProfile;
            setProfile(profileData);
            console.log(`AuthContext: Profile loaded for role: ${profileData.role}`);
            
            // Sync role to localStorage
            if (profileData.role) {
              localStorage.setItem("userRole", profileData.role);
            }
          } else {
            console.info("AuthContext: No user profile found, creating fallback profile");
            const resolvedRole =
              (firebaseUser.email || '').toLowerCase() === 'campanest7@gmail.com'
                ? 'admin'
                : 'student';

            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: resolvedRole,
              createdAt: null,
              language: 'en',
              theme: 'dark',
              banned: false
            };
            setProfile(fallbackProfile);
            localStorage.setItem('userRole', resolvedRole);

            void setDoc(userDoc, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: resolvedRole,
              createdAt: serverTimestamp(),
              language: 'en',
              theme: 'dark',
              banned: false
            }, { merge: true }).catch((error) => {
              console.warn('AuthContext: Failed to auto-create user profile', error);
            });
          }
          setLoading(false);
        }, (error) => {
          authResolved = true;
          window.clearTimeout(loadingTimeout);
          console.error("AuthContext: Profile fetch error:", error);
          setLoading(false);
        });
      } else {
        console.log("AuthContext: No user authenticated");
        setProfile(null);
        setLoading(false);
        // Clear role if logged out
        localStorage.removeItem("userRole");
      }
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
