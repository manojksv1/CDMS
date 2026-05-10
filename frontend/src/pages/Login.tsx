import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AuthUser } from '../types/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Client-side validation
  const usernameError = username.length > 0 && username.trim().length === 0
    ? 'Username cannot be blank'
    : '';
  const passwordError = password.length > 0 && password.trim().length === 0
    ? 'Password cannot be blank'
    : '';
  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // Animate the progress counter on mount
  useEffect(() => {
    const target = 95;
    const duration = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = p * (2 - p);
      setProgress(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      const res = await api.post<AuthUser>('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      login(res.data);
      navigate('/');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-900 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

        {/* Left — Branding */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield size={22} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">CDMS</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Customer Data<br />Management<br />System
          </h1>
          <p className="text-gray-400 text-base mb-10">
            AI-powered insights. Robust security. Full project visibility.
          </p>

          {/* Stats widget */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              System Overview
            </p>
            {[
              { label: 'Implementation Tracker', value: 85 },
              { label: 'Installation Tracker', value: 92 },
              { label: 'Active Users', value: 100 },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                  />
                </div>
              </div>
            ))}

            {/* Donut */}
            <div className="flex items-center gap-4 pt-2">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <motion.circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#3b82f6" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - progress }}
                    transition={{ duration: 1.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white text-xs font-bold">{progress}%</span>
                </div>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">CDMS Progress</p>
                <p className="text-gray-400 text-xs">Overall completion</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Login form */}
        <div className="w-full max-w-sm mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <span className="font-bold text-gray-900">CDMS</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

            {error && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} noValidate>
              <div className="form-group">
                <label htmlFor="username" className="label">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    autoComplete="username"
                    className={`input pl-9 ${usernameError ? 'border-red-400 focus:ring-red-400' : ''}`}
                    aria-required="true"
                    aria-describedby={usernameError ? 'username-error' : undefined}
                  />
                </div>
                {usernameError && (
                  <p id="username-error" className="text-xs text-red-500 mt-1">{usernameError}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className={`input pl-9 pr-10 ${passwordError ? 'border-red-400 focus:ring-red-400' : ''}`}
                    aria-required="true"
                    aria-describedby={passwordError ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <p id="password-error" className="text-xs text-red-500 mt-1">{passwordError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className="btn-primary w-full justify-center mt-2 py-2.5"
                title={!canSubmit ? 'Please enter your username and password' : undefined}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Login;
