import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useToast } from '../components/Toast';
import CampaNestLogo from '../components/CampaNestLogo';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const isOfflineFirestoreError = (error: any) =>
    error?.code === 'unavailable' ||
    error?.code === 'failed-precondition' ||
    String(error?.message || '').toLowerCase().includes('offline');
  const isAdminEmail = (value?: string | null) => (value || '').toLowerCase() === 'campanest7@gmail.com';
  const getPostLoginPath = (value?: string | null) => isAdminEmail(value) ? '/admin' : '/home';

  useEffect(() => {
    if (authLoading || !user) return;

    const loggedInEmail = user.email || '';
    console.log("Logged in email:", loggedInEmail);
    navigate(getPostLoginPath(loggedInEmail), { replace: true });
  }, [authLoading, user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`LoginPage: handleAuth called (isLogin: ${isLogin})`);
    setLoading(true);

    try {
      const userRole = isAdminEmail(email) ? 'admin' : 'student';

      if (isLogin) {
        console.log(`LoginPage: Attempting email login for ${email}`);
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in email:", userCred.user.email || '');
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        
        if (userDoc.exists() && userDoc.data().banned) {
          console.warn("LoginPage: User is banned");
          await auth.signOut();
          showToast("Your account has been banned.", "error");
          return;
        }

        // Update role in Firestore if it's missing or if it's admin
        const currentRole = userDoc.exists() ? userDoc.data().role : null;
        const finalRole = isAdminEmail(userCred.user.email) ? 'admin' : (currentRole || userRole);

        await setDoc(doc(db, 'users', userCred.user.uid), {
          email: userCred.user.email,
          role: finalRole,
          lastLogin: serverTimestamp()
        }, { merge: true });

        console.log(`LoginPage: Login successful for ${userCred.user.email}, role detected: ${finalRole}`);
        showToast("Welcome back!", "success");
        
        const redirectPath = getPostLoginPath(userCred.user.email);
        console.log(`LoginPage: Redirecting to ${redirectPath}`);
        navigate(redirectPath);

      } else {
        console.log(`LoginPage: Attempting email signup for ${email}`);
        if (password !== confirmPassword) {
          showToast("Passwords do not match", "error");
          return;
        }
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Logged in email:", userCred.user.email || '');
        
        const finalRole = isAdminEmail(userCred.user.email) ? 'admin' : 'student';

        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          name: fullName,
          email,
          role: finalRole,
          createdAt: serverTimestamp(),
          banned: false,
          theme: 'dark',
          language: 'en'
        });

        console.log(`LoginPage: Signup successful for ${email}, role detected: ${finalRole}`);
        showToast("Account created!", "success");
        
        const redirectPath = getPostLoginPath(userCred.user.email);
        console.log(`LoginPage: Redirecting to ${redirectPath}`);
        navigate(redirectPath);
      }
    } catch (error: any) {
      console.error("LoginPage: Auth error", error);
      showToast(error.message || "Authentication failed. Please check your credentials.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log("LoginPage: Google login button clicked");
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      console.log(`LoginPage: Google popup successful for ${result.user.email}`);
      console.log("Logged in email:", result.user.email || '');
      
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      const userRole = isAdminEmail(result.user.email) ? 'admin' : 'student';
      
      if (!userDoc.exists()) {
        console.log("LoginPage: New Google user, creating profile");
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          name: result.user.displayName,
          email: result.user.email,
          role: userRole,
          createdAt: serverTimestamp(),
          banned: false,
          theme: 'dark',
          language: 'en'
        });
        
        console.log(`LoginPage: Google signup successful for ${result.user.email}, role detected: ${userRole}`);
        const redirectPath = getPostLoginPath(result.user.email);
        console.log(`LoginPage: Redirecting to ${redirectPath}`);
        navigate(redirectPath);
      } else {
        console.log("LoginPage: Existing Google user found");
        const data = userDoc.data();
        if (data.banned) {
          console.warn("LoginPage: Google user is banned");
          await auth.signOut();
          showToast("Your account has been banned.", "error");
          return;
        }
        
        const finalRole = isAdminEmail(result.user.email) ? 'admin' : (data.role || userRole);
        
        // Update role if it was missing or if it's admin
        if (finalRole !== data.role) {
          await setDoc(doc(db, 'users', result.user.uid), { role: finalRole }, { merge: true });
        }

        console.log(`LoginPage: Google login successful for ${result.user.email}, role detected: ${finalRole}`);
        const redirectPath = getPostLoginPath(result.user.email);
        console.log(`LoginPage: Redirecting to ${redirectPath}`);
        navigate(redirectPath);
      }
    } catch (error: any) {
      console.error("LoginPage: Google login error", error);

      if (auth.currentUser && isOfflineFirestoreError(error)) {
        const redirectPath = getPostLoginPath(auth.currentUser.email);

        showToast("Signed in, but profile sync is offline. Continuing with saved role.", "info");
        navigate(redirectPath);
        return;
      }

      const code = error?.code as string | undefined;
      if (code === 'auth/user-cancelled' || code === 'auth/popup-closed-by-user') {
        showToast("Google sign-in was cancelled. Please try again and complete the popup.", "info");
        return;
      }
      if (code === 'auth/popup-blocked') {
        showToast("Popup was blocked by browser. Allow popups for localhost and retry.", "error");
        return;
      }

      showToast(error.message || "Google login failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      showToast("Please enter your email", "error");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Reset link sent to your email!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <CampaNestLogo size={80} />
        <h1 className="text-3xl font-bold text-primary mt-4">CampaNest Pune</h1>
        <p className="text-zinc-400 text-sm mt-1">Sign in to find your home away from home</p>
      </div>

      <div className="flex bg-zinc-900 rounded-xl p-1 mb-8">
        <button 
          onClick={() => setIsLogin(true)}
          className={clsx(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            isLogin ? "bg-primary text-white" : "text-zinc-500"
          )}
        >
          Login
        </button>
        <button 
          onClick={() => setIsLogin(false)}
          className={clsx(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            !isLogin ? "bg-primary text-white" : "text-zinc-500"
          )}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        {!isLogin && (
          <input 
            type="text" 
            placeholder="Full Name" 
            className="input-field" 
            required 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}
        <input 
          type="email" 
          placeholder="Email Address" 
          className="input-field" 
          required 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="input-field" 
          required 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!isLogin && (
          <input 
            type="password" 
            placeholder="Confirm Password" 
            className="input-field" 
            required 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}

        {isLogin && (
          <button 
            type="button" 
            onClick={handleResetPassword}
            className="text-primary text-xs font-medium block ml-auto"
          >
            Forgot Password?
          </button>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary w-full mt-4"
        >
          {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
        </button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-zinc-500">Or continue with</span>
        </div>
      </div>

      <button 
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 px-6 rounded-lg active:scale-95 transition-all w-full"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
        Sign in with Google
      </button>
    </div>
  );
}
