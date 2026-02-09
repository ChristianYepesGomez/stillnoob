import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
    localStorage.setItem('stillnoob-lang', next);
  };

  const navItems = [
    { to: '/dashboard', icon: 'fa-home', label: t('nav.dashboard') },
    { to: '/analysis', icon: 'fa-chart-bar', label: t('nav.analysis') },
  ];

  return (
    <div className="min-h-screen bg-midnight-deepblue">
      {/* Top navbar */}
      <nav className="bg-midnight-spaceblue/80 backdrop-blur-sm border-b border-midnight-bright-purple/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <span className="font-cinzel text-xl font-bold text-midnight-glow">StillNoob</span>
          </NavLink>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-midnight-bright-purple/20 text-midnight-glow'
                      : 'text-midnight-silver hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <i className={`fas ${item.icon} mr-1.5`} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="text-xs px-2 py-1 rounded bg-midnight-purple/20 text-midnight-silver hover:text-white transition-colors"
            >
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-midnight-silver">{user?.displayName}</span>
              <button
                onClick={handleLogout}
                className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
              >
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
