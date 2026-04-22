import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { PWAProvider } from './context/PWAContext';
import CampaNestLogo from './components/CampaNestLogo';
import PanicButton from './components/PanicButton';

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

const SiteChrome = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = React.useState(false);
  const isAuthPage = location.pathname === '/login';

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="mobile-container">
      {!isAuthPage && (
        <header className={`sticky top-0 z-40 ${scrolled ? 'glass-navbar' : 'glass-navbar bg-[#0A0A0F]/50'}`}>
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
            <Link to="/home" className="flex items-center gap-3">
              <CampaNestLogo size={34} />
              <span className="hidden md:inline text-lg font-extrabold text-[#FF7A00] leading-none">CampaNest</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link className="nav-link" to="/home">Buy/Rent</Link>
              <Link className="nav-link" to="/home">PG & Hostels</Link>
              <Link className="nav-link" to="/emergency">Emergency</Link>
              <Link className="nav-link" to="/about">About</Link>
            </nav>
            <Link to={user ? '/home' : '/login'} className="btn-primary py-2 px-5 text-sm">
              {user ? 'Dashboard' : 'Login / Sign up'}
            </Link>
          </div>
        </header>
      )}

      {children}

      {!isAuthPage && (
        <footer className="mt-14 border-t border-border bg-[#0B0B12]">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-sm font-bold">CampaNest</h4>
              <p className="mt-2 text-sm text-text-muted">Verified student-friendly rental and local services platform built with trust-first design.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold">Explore</h4>
              <div className="mt-3 space-y-2 text-sm text-text-muted">
                <p>PG & Hostel Listings</p>
                <p>Flats & Shared Rooms</p>
                <p>Food, Shops, Essentials</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold">Connect</h4>
              <div className="mt-3 flex items-center gap-3 text-sm text-text-muted">
                <span className="card px-3 py-2">IG</span>
                <span className="card px-3 py-2">X</span>
                <span className="card px-3 py-2">WA</span>
              </div>
              <p className="mt-4 text-xs text-text-muted">Home away from home for Pune students.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const AppContent = () => {
  return (
    <Router>
      <SiteChrome>
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-background"><CampaNestLogo size={60} /></div>}>
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<ProtectedRoute role="student"><Home /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute role="student"><EmergencyPage /></ProtectedRoute>} />
            <Route path="/student-dashboard" element={<Navigate to="/home" replace />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/add-listing" element={<ProtectedRoute role="admin"><AdminAddListing /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute role="student"><AboutPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
        <PanicButton />
      </SiteChrome>
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
