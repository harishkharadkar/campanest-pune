import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { PWAProvider } from './context/PWAContext';
import Disclaimer from './components/Disclaimer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import CampaNestLogo from './components/CampaNestLogo';
import PanicButton from './components/PanicButton';
import CustomPopup from './components/CustomPopup';

const SplashScreen = lazy(() => import('./pages/SplashScreen'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Home = lazy(() => import('./pages/Home'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminAddListing = lazy(() => import('./pages/AdminAddListing'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: 'student' | 'admin' }> = ({ children, role = 'student' }) => {
  const { user, loading } = useAuth();
  const email = user?.email?.toLowerCase() || '';
  const isAdmin = email === 'campanest7@gmail.com';

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-background"><CampaNestLogo size={60} /></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin' && !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  return (
    <Router>
      <div className="mobile-container">
        <Disclaimer />
        <PWAInstallPrompt />
        <CustomPopup message="Welcome to CampaNest" />
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-background"><CampaNestLogo size={60} /></div>}>
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<ProtectedRoute role="student"><Home /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute role="student"><EmergencyPage /></ProtectedRoute>} />
            <Route path="/student-dashboard" element={<Navigate to="/home" replace />} />
            <Route path="/listing/:id" element={<ProtectedRoute role="student"><ListingDetail /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/add-listing" element={<ProtectedRoute role="admin"><AdminAddListing /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute role="student"><AboutPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
        <PanicButton />
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <PWAProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PWAProvider>
    </ToastProvider>
  );
}
