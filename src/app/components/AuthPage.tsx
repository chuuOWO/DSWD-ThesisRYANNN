import { FormEvent, useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react';
import { authApi, UserRole } from '../services/authApi';
import { useAuth } from '../contexts/AuthContext';

const roleOptions: Array<{ value: UserRole; label: string; helper: string }> = [
  { value: 'dswd_admin', label: 'DSWD Admin', helper: 'Dashboard, inventory, releases, and tracking map.' },
  { value: 'receiver', label: 'Receiver', helper: 'Mobile GPS sharing, MetaMask pickup signing, and LGU receipt confirmation.' }
];

const generateTruckId = () => {
  const number = Math.floor(1 + Math.random() * 9999);
  return `RCVR-${String(number).padStart(4, '0')}`;
};

export function AuthPage() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('dswd_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [truckId] = useState(generateTruckId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await authApi.signIn(email.trim(), password);
      } else {
        const data = await authApi.signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role,
          truckId: role === 'receiver' ? truckId.trim() : undefined
        });

        if (!data.session) {
          setMessage({ type: 'info', text: 'Account created. Check email confirmation settings in Supabase, then login.' });
          return;
        }
      }

      await refreshProfile();
      setMessage({ type: 'info', text: mode === 'signup' ? 'Account ready. Redirecting...' : 'Signed in. Redirecting...' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Authentication failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden grid md:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-blue-800 text-white p-8 flex flex-col justify-between min-h-[520px]">
          <div>
            <div className="w-14 h-14 bg-white/10 rounded-lg flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold">DSWD FNFI Access</h1>
            <p className="text-blue-100 mt-3 leading-relaxed">
              Temporary role-based signup for admin dashboard access and receiver mobile custody workflows.
            </p>
          </div>

          <div className="grid gap-3 mt-8">
            {roleOptions.map((option) => (
              <div key={option.value} className="rounded-lg border border-white/15 bg-white/10 p-4">
                <p className="font-bold">{option.label}</p>
                <p className="text-sm text-blue-100 mt-1">{option.helper}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 h-11 rounded-md text-sm font-bold ${mode === 'login' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-600'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 h-11 rounded-md text-sm font-bold ${mode === 'signup' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-600'}`}
            >
              Sign Up
            </button>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-sm font-bold text-gray-700">User Role</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="mt-2 w-full h-12 rounded-lg border border-gray-300 px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="text-sm font-bold text-gray-700">Full Name</label>
              <div className="mt-2 relative">
                <Users className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  className="w-full h-12 rounded-lg border border-gray-300 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Juan Dela Cruz"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-gray-700">Email</label>
            <div className="mt-2 relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full h-12 rounded-lg border border-gray-300 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700">Password</label>
            <div className="mt-2 relative">
              <LockKeyhole className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full h-12 rounded-lg border border-gray-300 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>

          {message && (
            <div className={`rounded-lg border p-3 text-sm font-semibold ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-lg bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
