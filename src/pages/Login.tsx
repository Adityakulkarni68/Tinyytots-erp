import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — dark form panel */}
      <div className="flex-1 bg-[#1a1a2e] flex flex-col justify-center px-10 py-12 lg:px-16">
        <div className="max-w-sm w-full mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-2xl">TT</span>
            </div>
            <p className="text-purple-400 font-bold text-lg tracking-wide uppercase">Tinyy Tots Pre-School</p>
            <p className="text-white/60 text-sm mt-1">Attendance Portal</p>
          </div>

          <h1 className="text-3xl font-bold text-white mb-1">Login</h1>
          <p className="text-white/50 text-sm mb-8">Enter your account details</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="border-b border-white/20 pb-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Email"
                className="w-full bg-transparent text-white placeholder-white/30 text-sm focus:outline-none py-1"
              />
            </div>

            {/* Password */}
            <div className="border-b border-white/20 pb-1 flex items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Password"
                className="flex-1 bg-transparent text-white placeholder-white/30 text-sm focus:outline-none py-1"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-white/30 hover:text-white/60 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7a9.77 9.77 0 012.168-3.168M6.343 6.343A9.956 9.956 0 0112 5c5 0 9 4 9 7a9.77 9.77 0 01-1.343 2.657M15 12a3 3 0 11-6 0 3 3 0 016 0zM3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white font-semibold py-3 rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {/* Right — purple branding panel */}
      <div className="hidden lg:flex flex-1 bg-purple-500 flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-60px] right-[-60px] w-64 h-64 bg-purple-400 rounded-full opacity-40" />
        <div className="absolute bottom-[-40px] left-[-40px] w-48 h-48 bg-purple-600 rounded-full opacity-30" />

        <div className="relative z-10 text-center max-w-md">
          <p className="text-white/80 text-sm font-semibold tracking-widest uppercase mb-3">
            Tinyy Tots Pre-School
          </p>
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-2">Welcome to</h2>
          <h2 className="text-5xl font-light text-white leading-tight mb-4">Attendance Portal</h2>
          <p className="text-white/70 text-sm">Login to access your account</p>

          {/* Illustration */}
          <div className="mt-10">
            <svg viewBox="0 0 400 280" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="120" y="60" width="160" height="200" rx="12" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="2"/>
              <rect x="140" y="90" width="80" height="8" rx="4" fill="white" fillOpacity="0.5"/>
              <rect x="140" y="110" width="100" height="6" rx="3" fill="white" fillOpacity="0.3"/>
              <rect x="140" y="126" width="90" height="6" rx="3" fill="white" fillOpacity="0.3"/>
              <rect x="140" y="142" width="95" height="6" rx="3" fill="white" fillOpacity="0.3"/>
              <rect x="140" y="158" width="70" height="6" rx="3" fill="white" fillOpacity="0.3"/>
              <circle cx="190" cy="210" r="22" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.1"/>
              <path d="M180 210 l8 8 l14-16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="100" cy="110" r="14" fill="white" fillOpacity="0.9"/>
              <path d="M86 145 Q100 135 114 145 L118 200 H82 Z" fill="white" fillOpacity="0.85"/>
              <line x1="82" y1="200" x2="76" y2="240" stroke="white" strokeWidth="6" strokeLinecap="round"/>
              <line x1="118" y1="200" x2="124" y2="240" stroke="white" strokeWidth="6" strokeLinecap="round"/>
              <line x1="88" y1="160" x2="72" y2="185" stroke="white" strokeWidth="5" strokeLinecap="round"/>
              <rect x="60" y="178" width="14" height="20" rx="3" fill="white" fillOpacity="0.7"/>
              <circle cx="300" cy="85" r="14" fill="white" fillOpacity="0.9"/>
              <path d="M286 118 Q300 108 314 118 L316 160 H284 Z" fill="white" fillOpacity="0.85"/>
              <line x1="284" y1="160" x2="270" y2="195" stroke="white" strokeWidth="6" strokeLinecap="round"/>
              <line x1="316" y1="160" x2="330" y2="175" stroke="white" strokeWidth="6" strokeLinecap="round"/>
              <line x1="330" y1="175" x2="355" y2="175" stroke="white" strokeWidth="6" strokeLinecap="round"/>
              <line x1="314" y1="130" x2="340" y2="118" stroke="white" strokeWidth="5" strokeLinecap="round"/>
              <rect x="330" y="100" width="30" height="20" rx="3" fill="white" fillOpacity="0.7"/>
              <rect x="326" y="120" width="38" height="4" rx="2" fill="white" fillOpacity="0.5"/>
              <rect x="340" y="220" width="20" height="30" rx="4" fill="white" fillOpacity="0.4"/>
              <ellipse cx="350" cy="210" rx="18" ry="22" fill="white" fillOpacity="0.3"/>
              <ellipse cx="335" cy="215" rx="12" ry="16" fill="white" fillOpacity="0.25"/>
              <ellipse cx="365" cy="215" rx="12" ry="16" fill="white" fillOpacity="0.25"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
