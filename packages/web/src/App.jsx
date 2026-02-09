import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-midnight-deepblue flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-midnight-bright-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-midnight-silver">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analysis/:characterId?" element={<Analysis />} />
      </Route>
    </Routes>
  );
}
