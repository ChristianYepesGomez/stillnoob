import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await register(email, password, displayName);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-cinzel text-3xl font-bold">
            <span className="text-void-accent">Still</span>
            <span className="text-white">Noob</span>
          </h1>
        </Link>

        <div className="bg-void-mid/50 border border-void-bright/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {t('auth.register')}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-void-text mb-1">{t('auth.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-void-deep border border-void-bright/20 rounded-lg text-white focus:border-void-bright focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-void-text mb-1">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-void-deep border border-void-bright/20 rounded-lg text-white focus:border-void-bright focus:outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-void-text mb-1">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-void-deep border border-void-bright/20 rounded-lg text-white focus:border-void-bright focus:outline-none transition-colors"
                required
                minLength={8}
              />
              <p className="text-xs text-void-text/50 mt-1">{t('auth.passwordTooShort')}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-void-bright hover:bg-void-glow text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.register')}
            </button>
          </form>

          <p className="text-center text-sm text-void-text mt-4">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-void-accent hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
