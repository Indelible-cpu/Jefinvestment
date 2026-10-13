import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, User, Eye, EyeOff, ShieldCheck, WifiOff, AlertCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated, don't let them sit on the login page
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.user) {
      navigate(state.user.role === 'CASHIER' ? '/pos' : '/', { replace: true });
      return;
    }

    const savedEmail = localStorage.getItem('jef_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setPassword('');
      setRememberMe(false);
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsNetworkError(false);
    setLoading(true);

    if (rememberMe) {
      localStorage.setItem('jef_remembered_email', email.trim());
    } else {
      localStorage.removeItem('jef_remembered_email');
    }

    try {
      // Set Firebase persistence based on Remember Me checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      // Non-critical, continue anyway
    }
    const { login } = useAuthStore.getState();
    const result = await login(email, password);
    setLoading(false);

    const isSuccess = typeof result === 'boolean' ? result : result.success;

    if (isSuccess) {
      const user = useAuthStore.getState().user;
      toast.success(`Welcome back, ${user?.name || 'User'}!`, { description: `Signed in as ${user?.role?.toLowerCase()}` });
      navigate(user?.role === 'CASHIER' ? '/pos' : '/');
    } else {
      const msg = typeof result === 'object' && result.error
        ? result.error
        : 'Invalid username or password. Please check your credentials.';
      const isNet = typeof result === 'object' ? !!result.isNetworkError : false;
      setError(msg);
      setIsNetworkError(isNet);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Email required', {
        description: 'Please enter your email address in the field above first.'
      });
      return;
    }
    try {
      setIsResetting(true);
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent!', {
        description: `Check your inbox at ${email.trim()} for instructions to reset your password.`
      });
    } catch (err: any) {
      toast.error('Password reset failed', {
        description: err?.message || 'Please contact your administrator to reset your password.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Cinematic Dark Cosmic Atmosphere Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundColor: '#020617',
          backgroundImage: `
            radial-gradient(circle at 50% 15%, rgba(14, 165, 233, 0.12) 0%, transparent 50%),
            linear-gradient(to bottom, rgba(2, 6, 23, 0.4) 0%, rgba(2, 6, 23, 0.2) 50%, rgba(2, 6, 23, 0.6) 100%),
            url('/cosmic-bg.jpg')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat'
        }}
      />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center my-auto py-6">
        {/* Brand Header above card */}
        <div className="text-center mb-5 flex flex-col items-center">
          {/* Logo with Cyan / Electric Blue Atmospheric Halo */}
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full bg-cyan-400/30 blur-2xl pointer-events-none" />
            <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-full p-[3px] bg-gradient-to-tr from-cyan-400 via-blue-400 to-white shadow-[0_0_30px_rgba(56,189,248,0.55)] flex items-center justify-center relative">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5 shadow-inner">
                <img 
                  src="/pwa-512x512.png" 
                  alt="MsikaFlo" 
                  className="w-full h-full object-contain" 
                />
              </div>
            </div>
          </div>

          {/* MsikaFlo Wordmark: White "Msika" and Green "Flo" */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center justify-center">
            <span className="text-white drop-shadow-md">Msika</span>
            <span className="text-[#22c55e] drop-shadow-md">Flo</span>
          </h1>

          {/* Tagline with subtle green accent lines */}
          <div className="flex items-center justify-center gap-2.5 mt-2">
            <span className="w-7 sm:w-9 h-[2px] bg-[#22c55e] rounded-full inline-block" />
            <p className="text-white/95 text-xs sm:text-sm font-medium tracking-wide drop-shadow-sm">
              One system. Total control.
            </p>
            <span className="w-7 sm:w-9 h-[2px] bg-[#22c55e] rounded-full inline-block" />
          </div>
        </div>

        {/* Clean White Login Card */}
        <div 
          className="w-full rounded-[26px] shadow-2xl p-6 sm:p-8 border border-white/40"
          style={{ backgroundColor: '#ffffff' }}
        >
          {error && (
            <div className={`p-3.5 rounded-xl text-sm mb-5 font-medium flex items-start gap-2.5 border ${
              isNetworkError 
                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {isNetworkError ? (
                <WifiOff size={20} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete={rememberMe ? "on" : "off"}>
            {/* Email Field */}
            <div className="relative flex items-center rounded-xl border border-blue-200 bg-[#f0f6ff] px-3.5 py-3 transition focus-within:border-[#1d64ec] focus-within:ring-2 focus-within:ring-[#1d64ec]/20">
              <User className="text-[#1d64ec] shrink-0 mr-3" size={20} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-medium outline-none"
                placeholder="Email address"
                required
                autoComplete={rememberMe ? "email" : "off"}
              />
            </div>

            {/* Password Field */}
            <div className="relative flex items-center rounded-xl border border-blue-200 bg-[#f0f6ff] px-3.5 py-3 transition focus-within:border-[#1d64ec] focus-within:ring-2 focus-within:ring-[#1d64ec]/20">
              <Lock className="text-[#1d64ec] shrink-0 mr-3" size={20} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-medium outline-none pr-8"
                placeholder="Password"
                required
                autoComplete={rememberMe ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                onTouchStart={() => setShowPassword(true)}
                onTouchEnd={() => setShowPassword(false)}
                className="absolute right-3 text-[#1d64ec] hover:text-blue-700 transition p-1"
                tabIndex={-1}
                title="Toggle password visibility"
              >
                {showPassword ? <Eye size={19} /> : <EyeOff size={19} />}
              </button>
            </div>

            {/* Remember Me and Password Recovery */}
            <div className="flex items-center justify-between pt-1">
              <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1d64ec] border-blue-300 accent-[#1d64ec] cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-sm font-semibold text-[#1d64ec] hover:text-blue-800 transition hover:underline cursor-pointer disabled:opacity-50"
              >
                {isResetting ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>

            {/* Sign In Button with Blue Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#1d64ec] via-[#1a56db] to-[#0f3ea3] hover:from-[#1754c7] hover:to-[#0c3182] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-base tracking-wide disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} className="text-white stroke-[2.5]" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Legal Links */}
          <p className="text-center text-xs text-slate-500 mt-5 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-[#1d64ec] underline underline-offset-2 hover:text-blue-800 transition font-semibold">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-[#1d64ec] underline underline-offset-2 hover:text-blue-800 transition font-semibold">
              Privacy Policy
            </Link>
          </p>

          {/* Attribution Footer inside Card */}
          <div className="flex items-center justify-center gap-1.5 mt-5 pt-1 text-slate-500 text-xs font-medium">
            <ShieldCheck size={18} className="text-[#16a34a] stroke-[2.5] shrink-0" />
            <span>Powered by <span className="text-[#1e1b4b] font-bold">Indelible Technologies</span></span>
          </div>
        </div>

        {/* Brand Tagline Footer below Card */}
        <div className="flex items-center justify-center gap-2.5 mt-6 text-xs sm:text-sm font-medium text-white/90">
          <span className="w-8 sm:w-12 h-[2px] bg-[#22c55e] rounded-full inline-block" />
          <span className="tracking-wide text-white">Smarter Tools</span>
          <span className="text-emerald-400 font-bold">•</span>
          <span className="tracking-wide text-white">Stronger Business</span>
          <span className="w-8 sm:w-12 h-[2px] bg-[#22c55e] rounded-full inline-block" />
        </div>
      </div>
    </div>
  );
}
