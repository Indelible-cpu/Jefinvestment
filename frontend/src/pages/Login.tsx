import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';

// Inline SVG icons for Google, Microsoft, Fingerprint
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path fill="#F25022" d="M1 1h10v10H1z"/>
      <path fill="#00A4EF" d="M13 1h10v10H13z"/>
      <path fill="#7FBA00" d="M1 13h10v10H1z"/>
      <path fill="#FFB900" d="M13 13h10v10H13z"/>
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" stroke="#6366f1"/>
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" stroke="#6366f1"/>
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" stroke="#6366f1"/>
      <path d="M2 12a10 10 0 0 1 18-6" stroke="#6366f1"/>
      <path d="M2 17.5a14.5 14.5 0 0 0 4.24 5.5" stroke="#6366f1"/>
      <path d="M12 2a10 10 0 0 1 8 4" stroke="#6366f1"/>
      <path d="M6 10a6 6 0 0 1 12 0c0 1.25-.16 2.61-.42 3.94" stroke="#6366f1"/>
      <path d="M6 16a14 14 0 0 0 2.49 5.38" stroke="#6366f1"/>
    </svg>
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { login } = useAuthStore.getState();
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      const role = useAuthStore.getState().user?.role;
      navigate(role === 'CASHIER' ? '/pos' : '/');
    } else {
      setError('Invalid username or password. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f5b] via-[#003591] to-[#0057d8] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02] blur-3xl" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">

        {/* Header / Brand */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
            <img src="/icons/icon-192.png" alt="JIMS ERP" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">JIMS ERP</h1>
          <p className="text-blue-200 mt-1 text-sm font-medium tracking-wider uppercase">One System. Total Control.</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">

          {error && (
            <div className="bg-red-500/20 text-red-200 border border-red-400/30 p-3 rounded-xl text-sm mb-5 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-blue-100 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-blue-300" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/60 focus:ring-2 focus:ring-white/40 focus:border-white/40 outline-none transition text-sm"
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-blue-100 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-blue-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/60 focus:ring-2 focus:ring-white/40 focus:border-white/40 outline-none transition text-sm"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-blue-300 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-white/10 accent-white cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-blue-200 cursor-pointer select-none">
                Remember me
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-[#004bb4] font-bold py-3 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all shadow-xl mt-2 disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-[#004bb4]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-blue-300 text-xs font-medium">or continue with</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Social / Auth icons */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-medium transition active:scale-95 group"
              title="Continue with Google"
            >
              <GoogleIcon />
              <span className="hidden sm:inline">Google</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-medium transition active:scale-95"
              title="Continue with Microsoft"
            >
              <MicrosoftIcon />
              <span className="hidden sm:inline">Microsoft</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-medium transition active:scale-95"
              title="Fingerprint / Biometric"
            >
              <FingerprintIcon />
              <span className="hidden sm:inline">Biometric</span>
            </button>
          </div>

          {/* Terms & Privacy */}
          <p className="text-center text-xs text-blue-300/80 mt-5 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-white underline underline-offset-2 hover:text-blue-200 transition font-semibold">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-white underline underline-offset-2 hover:text-blue-200 transition font-semibold">
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-8 text-blue-300/60 text-xs font-medium">
          <ShieldCheck size={14} className="text-green-400" />
          <span>Powered by <span className="text-white/70 font-semibold">Indelible Technologies</span></span>
        </div>
      </div>
    </div>
  );
}
