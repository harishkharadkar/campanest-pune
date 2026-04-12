import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { GraduationCap, Store } from 'lucide-react';
import { motion } from 'motion/react';

export default function RoleSelect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const selectRole = async (role: 'student' | 'provider') => {
    console.log(`RoleSelect: Button clicked for role: ${role}`);
    
    // Save role in localStorage as requested
    localStorage.setItem("userRole", role);
    console.log(`RoleSelect: Role saved to localStorage: ${role}`);

    const redirectPath = role === 'student' ? '/home' : '/home';

    if (user) {
      showToast(`Role selected: ${role}`, "success");
      console.log(`RoleSelect: User already authenticated, navigating to ${redirectPath}`);
      navigate(redirectPath);

      void setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          role,
          banned: false,
          theme: 'dark',
          language: 'en',
          lastLogin: serverTimestamp()
        }, { merge: true }).then(() => {
          console.log(`RoleSelect: Profile synced to Firestore with role: ${role}`);
        }).catch((error) => {
          console.warn("RoleSelect: Could not sync profile to Firestore, using local role fallback", error);
        });
      return;
    }
    
    showToast(`Role selected: ${role}`, "success");
    
    console.log("RoleSelect: Navigating to login page (/login)");
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">Welcome to CampaNest</h1>
      <p className="text-zinc-400 text-center mb-10">Choose how you want to use the platform</p>

      <div className="space-y-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => selectRole('student')}
          className="w-full card text-left flex items-start gap-4 hover:border-primary transition-colors"
        >
          <div className="bg-primary/10 p-4 rounded-xl text-primary">
            <GraduationCap size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold">I am a Student</h3>
            <p className="text-zinc-400 text-sm mt-1">Find PGs, mess, shops and more near your college. Always free.</p>
            <div className="mt-4 text-primary font-semibold text-sm">Enter as Student</div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => selectRole('provider')}
          className="w-full card text-left flex items-start gap-4 hover:border-accent transition-colors"
        >
          <div className="bg-accent/10 p-4 rounded-xl text-accent">
            <Store size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold">I am a Service Provider</h3>
            <p className="text-zinc-400 text-sm mt-1">List your service and reach thousands of students in Pune.</p>
            <div className="mt-4 text-accent font-semibold text-sm">Enter as Service Provider</div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
