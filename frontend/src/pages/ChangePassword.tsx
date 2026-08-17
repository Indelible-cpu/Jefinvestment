import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { onSnapshot, doc } from 'firebase/firestore';

export default function ChangePassword() {
  const { user, submitPasswordRequest, clearPasswordChangeFlag } = useAuthStore();
  const navigate = useNavigate();
  
  const isForced = user?.requiresPasswordChange;
  const [reason, setReason] = useState(isForced ? 'New User' : '');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DONE'>('IDLE');
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!requestId) return;
    const unsub = onSnapshot(doc(db, 'passwordRequests', requestId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStatus(data.status);
        if (data.status === 'APPROVED' && auth.currentUser) {
           try {
             await updatePassword(auth.currentUser, newPassword);
             await clearPasswordChangeFlag(user!.id);
             setStatus('DONE');
             toast.success('Password updated securely!');
             setTimeout(() => {
                navigate('/');
             }, 2000);
           } catch(err: any) {
             toast.error('Failed to update password: ' + err.message);
             setStatus('IDLE'); // Let them try again
           }
        } else if (data.status === 'REJECTED') {
          toast.error('Password change request was rejected by an Administrator.');
        }
      }
    });
    return () => unsub();
  }, [requestId, newPassword, user, navigate, clearPasswordChangeFlag]);

  const checkPasswordStrength = (pw: string) => {
    let score = 0;
    if (!pw) return { score, text: '', color: 'bg-gray-200' };
    if (pw.length > 5) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    
    if (pw.length < 6) return { score: 0, text: 'Too short (min 6 chars)', color: 'bg-red-500' };
    if (score <= 1) return { score, text: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score, text: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score, text: 'Good', color: 'bg-blue-500' };
    return { score, text: 'Strong', color: 'bg-green-500' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!reason) {
      toast.error('Please specify a reason for changing your password.');
      return;
    }
    if (checkPasswordStrength(newPassword).score < 3) {
      toast.error('Password is too weak. Please use a stronger password.');
      return;
    }

    try {
      setStatus('PENDING');
      const reqId = await submitPasswordRequest(user.id, user.name, reason);
      setRequestId(reqId);
    } catch(err: any) {
      setStatus('IDLE');
      toast.error('Failed to submit request: ' + err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border-t-8 border-primary">
        <div className="p-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-center text-gray-900 mb-2 tracking-tight">Security Update</h1>
          <p className="text-gray-500 text-center mb-8 font-medium text-sm">
            {isForced 
              ? 'As a new user, you must set a secure password before continuing.' 
              : 'Request an Administrator to approve your password change.'}
          </p>

          {status === 'IDLE' || status === 'REJECTED' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {status === 'REJECTED' && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm border border-red-200">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  Your previous request was rejected. Please contact your administrator or try again.
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Reason for change</label>
                {isForced ? (
                  <input type="text" readOnly value="New User" className="w-full p-2.5 bg-gray-50 border rounded-lg text-gray-500 cursor-not-allowed outline-none font-medium" />
                ) : (
                  <select 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    required
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                  >
                    <option value="" disabled>Select a reason...</option>
                    <option value="Security Compromise">Security Compromise</option>
                    <option value="Forgot Password">Forgot Password / Weak Password</option>
                    <option value="Routine Update">Routine Update</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Secure Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none transition"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowPw(true)}
                    onMouseUp={() => setShowPw(false)}
                    onMouseLeave={() => setShowPw(false)}
                    onTouchStart={() => setShowPw(true)}
                    onTouchEnd={() => setShowPw(false)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition"
                    title="Click and hold to show password"
                  >
                    {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level} className={`h-full flex-1 ${checkPasswordStrength(newPassword).score >= level ? checkPasswordStrength(newPassword).color : 'bg-transparent'}`} />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 font-medium text-right ${checkPasswordStrength(newPassword).color.replace('bg-', 'text-')}`}>
                      {checkPasswordStrength(newPassword).text}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!newPassword || checkPasswordStrength(newPassword).score < 3 || !reason}
                className="w-full py-3 mt-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition active:scale-95"
              >
                Submit Request
              </button>
            </form>
          ) : status === 'PENDING' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <Loader2 size={48} className="text-amber-500 animate-spin" />
              <div>
                <h3 className="text-lg font-bold text-gray-800">Waiting for Approval</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-[250px] mx-auto">
                  Your request has been sent to the Administrator. Please wait here until they confirm.
                </p>
              </div>
            </div>
          ) : status === 'DONE' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 size={56} className="text-emerald-500" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">All Set!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your password was updated successfully. Redirecting you...
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
