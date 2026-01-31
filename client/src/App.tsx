
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import Login from './pages/Login.tsx';
import StudentDashboard from './pages/StudentDashboard.tsx';
import CatererDashboard from './pages/CatererDashboard.tsx';
import AdminDashboard from './pages/AdminDashboard.tsx';
import EventsPage from './pages/EventsPage.tsx';
import Layout from './components/Layout.tsx';
import type { JSX } from 'react';

const PrivateRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect based on actual role
    if (profile.role === 'admin') return <Navigate to="/admin" />;
    if (profile.role === 'caterer') return <Navigate to="/caterer" />;
    return <Navigate to="/student" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/student" />} />

            <Route path="events" element={
              <PrivateRoute allowedRoles={['student', 'admin', 'caterer']}>
                <EventsPage />
              </PrivateRoute>
            } />

            <Route path="student" element={
              <PrivateRoute allowedRoles={['student']}>
                <StudentDashboard />
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
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
