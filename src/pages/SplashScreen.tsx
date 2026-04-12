import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import CampaNestLogo from '../components/CampaNestLogo';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const isAdmin = (user?.email || '').toLowerCase() === 'campanest7@gmail.com';

    const timer = setTimeout(() => {
      if (!user) {
        console.log("SplashScreen: No user, navigating to login");
        navigate('/login');
      } else {
        console.log(`SplashScreen: User detected: ${user.email}`);
        navigate(isAdmin ? '/admin' : '/home');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [loading, user, navigate]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <CampaNestLogo size={120} />
      </motion.div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center mt-6"
      >
        <h1 className="text-4xl font-bold text-primary">CampaNest</h1>
        <p className="text-accent font-medium tracking-widest uppercase text-sm">Pune</p>
        <p className="text-zinc-500 text-xs mt-4">Your campus. Your neighbourhood.</p>
      </motion.div>
    </div>
  );
}
