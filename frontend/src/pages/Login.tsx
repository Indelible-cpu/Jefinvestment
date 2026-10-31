import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, User, Eye, EyeOff, ShieldCheck, WifiOff, AlertCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { APP_VERSION } from '../utils/version';
import { Fingerprint } from 'lucide-react';
import { authenticateWithPasskey, passkeysAvailable, getDeviceBiometricInfo } from '../utils/passkeys';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const biometricInfo = getDeviceBiometricInfo();
  
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated, don't let them sit on the login page
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.user) {
      navigate(state.user.role === 'CASHIER' ? '/pos' : '/', { replace: true });
      return;
    }

    // Set Android status bar to dark cosmic with light icons
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const prevTheme = metaTheme?.getAttribute('content') || '#004bb4';
    if (metaTheme) metaTheme.setAttribute('content', '#020617');

    const savedEmail = localStorage.getItem('jef_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setPassword('');
      setRememberMe(false);
    }

    return () => {
      if (metaTheme) metaTheme.setAttribute('content', prevTheme);
    };
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


  const handlePasskeyLogin = async () => {
    let targetEmail = email.trim();
    if (!targetEmail) {
      const savedEmail = localStorage.getItem('jef_remembered_email');
      if (savedEmail) {
        targetEmail = savedEmail;
        setEmail(savedEmail);
      }
    }
    if (!targetEmail) {
      setError('Please enter your email address to sign in.');
      return;
    }
    if (!passkeysAvailable()) {
      setError('Biometric sign-in is not supported on this browser or deployment.');
      return;
    }
    setError('');
    setIsNetworkError(false);
    setBiometricBusy(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const customToken = await authenticateWithPasskey(targetEmail);
      const result = await useAuthStore.getState().passkeyLogin(customToken);
      if (!result.success) throw new Error(result.error || 'Biometric sign-in failed.');
      const signedInUser = useAuthStore.getState().user;
      toast.success(`Welcome back, ${signedInUser?.name || 'User'}!`, { description: `Signed in as ${signedInUser?.role?.toLowerCase()}` });
      navigate(signedInUser?.role === 'CASHIER' ? '/pos' : '/');
    } catch (err: any) {
      setError(err?.name === 'NotAllowedError' ? 'Biometric verification was cancelled.' : (err?.message || 'Biometric sign-in failed.'));
    } finally {
      setBiometricBusy(false);
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-4 sm:py-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Cinematic Dark Cosmic Atmosphere Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundColor: '#020617',
          backgroundImage: `
            radial-gradient(circle at 50% 16%, rgba(37, 99, 235, 0.16) 0%, rgba(14, 165, 233, 0.06) 40%, transparent 65%),
            radial-gradient(ellipse 90% 45% at 50% 98%, rgba(14, 165, 233, 0.22) 0%, rgba(30, 58, 138, 0.15) 35%, transparent 70%),
            linear-gradient(to bottom, rgba(2, 6, 23, 0.3) 0%, rgba(2, 6, 23, 0.1) 45%, rgba(2, 6, 23, 0.45) 100%),
            url('/cosmic-bg.webp')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat'
        }}
      />

      <div className="relative z-10 w-full max-w-[390px] sm:max-w-[400px] flex flex-col items-center my-auto">
        {/* Brand Header above card */}
        <div className="text-center mb-4 sm:mb-5 flex flex-col items-center">
          {/* Logo with Cyan / Electric Blue Atmospheric Halo */}
          <div className="relative mb-2.5 flex items-center justify-center">
            <div className="absolute w-24 h-24 sm:w-26 sm:h-26 rounded-full bg-cyan-400/25 blur-xl pointer-events-none" />
            <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full p-[2.5px] bg-gradient-to-tr from-cyan-400 via-blue-400 to-white shadow-[0_0_26px_rgba(56,189,248,0.5)] flex items-center justify-center relative">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center p-1 shadow-inner">
                <img 
                  src="/pwa-512x512.png" 
                  alt="MsikaFlo" 
                  className="w-full h-full object-contain" 
                />
              </div>
            </div>
          </div>

          {/* MsikaFlo Wordmark: White "Msika" and Green "Flo" */}
          <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight flex items-center justify-center leading-none">
            <span className="text-white drop-shadow-sm">Msika</span>
            <span className="text-[#22c55e] drop-shadow-sm">Flo</span>
          </h1>

          {/* Tagline with subtle green accent lines */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="w-6 sm:w-8 h-[2px] bg-[#22c55e] rounded-full inline-block" />
            <p className="text-white/95 text-xs sm:text-[13px] font-medium tracking-wide drop-shadow-sm">
              One system. Total control.
            </p>
            <span className="w-6 sm:w-8 h-[2px] bg-[#22c55e] rounded-full inline-block" />
          </div>
        </div>

        {/* Clean White Login Card */}
        <div 
          className="w-full rounded-[24px] shadow-xl shadow-slate-950/40 p-5 sm:p-7 border border-white/50"
          style={{ backgroundColor: '#ffffff' }}
        >
          {error && (
            <div className={`p-3 rounded-xl text-sm mb-4 font-medium flex items-start gap-2.5 border ${
              isNetworkError 
                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {isNetworkError ? (
                <WifiOff size={18} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug text-xs sm:text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4" autoComplete={rememberMe ? "on" : "off"}>
            {/* Email Field */}
            <div className="relative flex items-center rounded-xl border border-blue-200/90 bg-[#f0f6ff] px-3.5 py-2.5 sm:py-3 transition focus-within:border-[#1d64ec] focus-within:ring-2 focus-within:ring-[#1d64ec]/20">
              <User className="text-[#1d64ec] shrink-0 mr-2.5" size={19} />
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
            <div className="relative flex items-center rounded-xl border border-blue-200/90 bg-[#f0f6ff] px-3.5 py-2.5 sm:py-3 transition focus-within:border-[#1d64ec] focus-within:ring-2 focus-within:ring-[#1d64ec]/20">
              <Lock className="text-[#1d64ec] shrink-0 mr-2.5" size={19} />
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
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            {/* Remember Me and Password Recovery */}
            <div className="flex items-center justify-between pt-0.5 pb-0.5">
              <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1d64ec] border-blue-300 accent-[#1d64ec] cursor-pointer"
                />
                <span className="text-xs sm:text-[13px] font-semibold text-slate-700">
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs sm:text-[13px] font-semibold text-[#1d64ec] hover:text-blue-800 transition hover:underline cursor-pointer disabled:opacity-50"
              >
                {isResetting ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>

            {/* Sign In Button with Blue Gradient */}
            <button
              type="submit"
              disabled={loading || biometricBusy}
              className="w-full mt-1.5 bg-gradient-to-r from-[#1d64ec] via-[#1a56db] to-[#0f3ea3] hover:from-[#1754c7] hover:to-[#0c3182] text-white font-bold py-3 sm:py-3.5 px-6 rounded-xl shadow-md shadow-blue-600/25 hover:shadow-blue-600/40 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm sm:text-base tracking-wide disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
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
                  <LogIn size={19} className="text-white stroke-[2.5]" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>


          {passkeysAvailable() && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loading || biometricBusy}
              className="w-full mt-3 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
            >
              <Fingerprint size={19} className="text-[#1d64ec]" />
              <span>{biometricInfo.label}</span>
            </button>
          )}

          {/* Legal Links */}
          <p className="text-center text-[11px] sm:text-xs text-slate-500 mt-4 leading-relaxed">
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
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-0.5 text-slate-500 text-[11px] sm:text-xs font-medium">
            <ShieldCheck size={16} className="text-[#16a34a] stroke-[2.5] shrink-0" />
            <span>Powered by <span className="text-[#1e1b4b] font-bold">Indelible Technologies</span></span>
          </div>
        </div>

        {/* Brand Tagline Footer below Card */}
        <div className="relative flex items-center justify-center gap-2 mt-4 sm:mt-5 text-[11.5px] sm:text-xs font-medium text-white/95 select-none">
          {/* Restrained subtle blue glow aura behind slogan */}
          <div className="absolute inset-0 -inset-x-3 bg-blue-500/15 blur-md rounded-full pointer-events-none" />
          <span className="w-6 sm:w-8 h-[2px] bg-[#22c55e] rounded-full inline-block relative z-10" />
          <span className="tracking-wide text-white relative z-10">Smarter Tools</span>
          <span className="text-emerald-400 font-bold relative z-10">•</span>
          <span className="tracking-wide text-white relative z-10">Stronger Business</span>
          <span className="w-6 sm:w-8 h-[2px] bg-[#22c55e] rounded-full inline-block relative z-10" />
        </div>

        {/* Discreet Version Tag */}
        <div className="text-center mt-2.5 text-[10px] text-white/40 font-mono tracking-widest select-none">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
