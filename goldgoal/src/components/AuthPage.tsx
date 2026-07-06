import React, { useState, FormEvent } from 'react';
import { Coins, Lock, User as UserIcon, ShieldCheck, ArrowRight, Wallet } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface AuthPageProps {
  onAuthSuccess: (token: string, user: { id: string; username: string; currency: 'USD' | 'INR' | 'EUR' | 'GBP' }) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'GBP'>('INR');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { username, password } : { username, password, currency };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col justify-between p-4 md:p-8">
      {/* Top Header Row */}
      <header className="max-w-7xl w-full mx-auto flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded bg-yellow-500 flex items-center justify-center shadow-sm">
            <Coins className="h-5 w-5 text-black" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white font-sans">
            Gold<span className="text-yellow-500">Goal</span>
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center max-w-md w-full mx-auto my-8">
        <div className="w-full bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 rounded-xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          {/* Subtle gold decoration bubble */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 dark:bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isLogin ? 'Welcome back' : 'Start your gold journey'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              {isLogin ? 'Log in securely to track your gold savings' : 'Create an account to monitor and project your goals'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. gold_saver"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 dark:bg-black/40 text-gray-900 dark:text-white text-sm border border-gray-250 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 dark:bg-black/40 text-gray-900 dark:text-white text-sm border border-gray-250 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

             <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/50 text-black font-bold text-xs uppercase tracking-tight rounded transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-150 dark:border-white/5 flex justify-center text-xs text-gray-500 dark:text-gray-400">
            <span>
              {isLogin ? "Don't have an account?" : "Already registered?"}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="font-bold text-yellow-500 hover:text-yellow-400 transition-all cursor-pointer focus:outline-none"
              >
                {isLogin ? 'Sign up free' : 'Sign in here'}
              </button>
            </span>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl w-full mx-auto flex flex-col md:flex-row justify-between items-center py-4 border-t border-gray-200/50 dark:border-white/5 text-[10px] text-gray-400 dark:text-gray-650 gap-2">
        <div className="flex items-center gap-1.5 font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Salted SHA-256 Cryptographic Secure Hashing in use. No plain-text passwords stored.</span>
        </div>
        <span className="font-mono">© 2026 GoldGoal. Secure, private and analytical.</span>
      </footer>
    </div>
  );
}
