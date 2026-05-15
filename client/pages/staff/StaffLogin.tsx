import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';

export default function StaffLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details || 'Login failed');
        return;
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('staffId', data.staffId);
      localStorage.setItem('isStaff', 'true');
      
      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Redirect to main dashboard (staff uses same UI with permission locks)
      navigate('/dashboard');
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center text-slate-400 hover:text-slate-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.backToHome')}
        </Link>

        {/* Card */}
        <div className="bg-slate-800 dark:bg-slate-900 rounded-lg shadow-2xl shadow-black/50 p-8 border border-slate-700 dark:border-slate-700">
          {/* Header */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-12 h-12 bg-blue-900 dark:bg-blue-950 rounded-lg flex items-center justify-center border border-blue-700 dark:border-blue-800">
              <Users className="w-6 h-6 text-blue-400 dark:text-blue-300" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-2">
            {t('staff.login')}
          </h1>
          <p className="text-center text-slate-400 mb-8">
            Access your store management dashboard
          </p>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 dark:bg-red-950/30 border border-red-700/50 dark:border-red-800/50 text-red-300 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                {t('staff.username')}
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                className="h-10 bg-slate-700 dark:bg-slate-800 border-slate-600 dark:border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                {t('staff.password')}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="h-10 bg-slate-700 dark:bg-slate-800 border-slate-600 dark:border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-blue-500 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? (t('auth.hidePassword') || 'Hide password') : (t('auth.showPassword') || 'Show password')}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium transition-colors"
            >
              {loading ? t('common.processing') : t('staff.signIn')}
            </Button>
          </form>

          {/* Info Box */}
          <div className="mt-8 bg-blue-900/20 dark:bg-blue-950/30 border border-blue-700/50 dark:border-blue-800/50 rounded-lg p-4">
            <p className="text-sm text-blue-300 dark:text-blue-200">
              <strong>First time logging in?</strong> Use the credentials provided by your store owner in the invitation email. You may need to change your password on first login.
            </p>
          </div>

          {/* Store Owner Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Are you a store owner?{' '}
              <Link to="/seller/login" className="text-blue-400 dark:text-blue-300 hover:text-blue-300 dark:hover:text-blue-200 font-medium transition-colors">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
