import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import CharacterPublic from './pages/CharacterPublic';
import GuildPage from './pages/Guild';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      {/* Public character profile (no auth) */}
      <Route path="/character/:region/:realm/:name" element={<CharacterPublic />} />

      {/* Authenticated app */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analysis/:characterId?" element={<Analysis />} />
        <Route path="/guild/:guildId?" element={<GuildPage />} />
      </Route>
    </Routes>
  );
}
