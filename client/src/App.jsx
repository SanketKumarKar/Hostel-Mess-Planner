import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';

// Lazy load components for code-splitting (reduces initial bundle size)
const Login = lazy(() => import('./pages/Login.jsx'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'));
const CatererDashboard = lazy(() => import('./pages/CatererDashboard.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage.jsx'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage.jsx'));
const Layout = lazy(() => import('./components/Layout.jsx'));

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect based on actual role
    if (profile.role === 'admin') return <Navigate to="/admin" replace />;
    if (profile.role === 'caterer') return <Navigate to="/caterer" replace />;
    return <Navigate to="/student" replace />;
  }

  return children;
};

// A fallback loading component while lazy loading
const Loader = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
);

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Router>
        <AuthProvider>
          <Suspense fallback={<Loader />}>
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Private routes wrapped in Layout */}
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Navigate to="/student" replace />} />

                <Route path="events" element={
                  <PrivateRoute allowedRoles={['student', 'admin', 'caterer']}>
                    <EventsPage />
                  </PrivateRoute>
                } />

                <Route path="announcements" element={
                  <PrivateRoute allowedRoles={['student', 'admin']}>
                    <AnnouncementsPage />
                  </PrivateRoute>
                } />

                <Route path="student" element={
                  <PrivateRoute allowedRoles={['student']}>
                    <StudentDashboard />
                  </PrivateRoute>
                } />

                <Route path="feedback" element={
                  <PrivateRoute allowedRoles={['student']}>
                    <FeedbackPage />
                  </PrivateRoute>
                } />

                <Route path="caterer" element={
                  <PrivateRoute allowedRoles={['caterer']}>
                    <CatererDashboard />
                  </PrivateRoute>
                } />

                <Route path="admin" element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </PrivateRoute>
                } />
                
                {/* Catch-all route inside Layout */}
                <Route path="*" element={
                  <div className="text-center py-20 animate-fade-in">
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">404 - Page Not Found</h2>
                      <p className="text-gray-500 mb-6">The page you are looking for doesn't exist.</p>
                      <a href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Go Home</a>
                  </div>
                } />
              </Route>
              
              {/* Global fallback if navigating outside layout */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;
