import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, User, Eye, EyeOff, ShieldCheck, WifiOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem('jef_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setPassword('');
      setRememberMe(false);
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Blue header */}
        <div className="bg-primary p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden shadow-lg border-2 border-white/20">
            <img src="/pwa-192x192.png" alt="JIMS ERP" className="w-full h-full object-cover bg-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">JIMS ERP</h1>
          <p className="text-blue-200 mt-1 text-sm">One system. Total control.</p>
        </div>

        {/* Form body */}
        <div className="p-8">
          {error && (
            <div className={`p-3.5 rounded-lg text-sm mb-6 font-medium flex items-start gap-2.5 border ${
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

          <form onSubmit={handleLogin} className="space-y-5" autoComplete={rememberMe ? "on" : "off"}>
            {/* Email */}
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 pt-5 pb-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-primary outline-none transition peer"
                placeholder=" "
                required
                autoComplete={rememberMe ? "email" : "off"}
              />
              <label htmlFor="email" className="absolute left-10 top-3.5 text-gray-400 text-sm font-medium transition-all peer-placeholder-shown:opacity-100 peer-not-placeholder-shown:opacity-0 peer-focus:opacity-0 pointer-events-none">
                Email
              </label>
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 pt-5 pb-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-primary outline-none transition peer"
                placeholder=" "
                required
                autoComplete={rememberMe ? "current-password" : "new-password"}
              />
              <label htmlFor="password" className="absolute left-10 top-3.5 text-gray-400 text-sm font-medium transition-all peer-placeholder-shown:opacity-100 peer-not-placeholder-shown:opacity-0 peer-focus:opacity-0 pointer-events-none">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-primary underline underline-offset-2 hover:text-blue-700 transition font-semibold">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary underline underline-offset-2 hover:text-blue-700 transition font-semibold">
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Bottom footer */}
        <div className="flex items-center justify-center gap-1.5 pb-5 text-gray-400 text-[11px] font-medium">
          <ShieldCheck size={13} className="text-green-500" />
          <span>Powered by <span className="text-gray-500 font-semibold">Indelible Technologies</span></span>
        </div>
      </div>
    </div>
  );
}
