import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
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
    try {
      // Set Firebase persistence based on Remember Me checkbox
      // LOCAL = survives browser restarts; SESSION = cleared when browser closes
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      // Non-critical, continue anyway
    }
    const { login } = useAuthStore.getState();
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      const user = useAuthStore.getState().user;
      toast.success(`Welcome back, ${user?.name || 'User'}!`, { description: `Signed in as ${user?.role?.toLowerCase()}` });
      navigate(user?.role === 'CASHIER' ? '/pos' : '/');
    } else {
      setError('Invalid username or password. Please check your credentials.');
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
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 font-medium text-center border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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
                autoComplete="email"
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
                autoComplete="current-password"
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
