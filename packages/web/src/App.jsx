import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import ColdStartOverlay from './components/ColdStartOverlay';
import Layout from './components/layout/Layout';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analysis = lazy(() => import('./pages/Analysis'));
const CharacterPublic = lazy(() => import('./pages/CharacterPublic'));
const GuildPage = lazy(() => import('./pages/Guild'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      {loading ? (
        <LoadingScreen />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
            <Route
              path="/login"
              element={user ? <Navigate to="/dashboard" replace /> : <Login />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to="/dashboard" replace /> : <Register />}
            />
            {/* Public character profile (no auth) */}
            <Route path="/character/:region/:realm/:name" element={<CharacterPublic />} />

            {/* Authenticated app */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analysis/:characterId?" element={<Analysis />} />
              <Route path="/guild/:guildId?" element={<GuildPage />} />
            </Route>
          </Routes>
        </Suspense>
      )}
      <ColdStartOverlay />
    </>
  );
}
