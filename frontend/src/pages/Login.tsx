import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Eye, EyeOff, TrendingUp, Activity, Zap, CheckCircle2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    setIsMounted(true);
    // Animate the percentage counter
    const duration = 1500;
    const target = 95;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const easedProgress = progress * (2 - progress);
      setProgressValue(Math.floor(easedProgress * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const user = response.data;
      
      // Token is now in HttpOnly cookie, we just pass empty string for token
      login('', user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials or server error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      className="login-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="login-background-overlay"></div>
      
      <div className="login-content">
        <div className="login-left">
          <div className="brand-section">
            <h1 className="brand-title">CUSTOMER DATA<br />MANAGEMENT<br />SYSTEM</h1>
            <p className="brand-subtitle">Powered by AI-driven insights and robust security.</p>
          </div>
        </div>

        <div className="login-center">
          <div className="login-card-v2">
            <div className="card-corner-top-left"></div>
            <div className="card-corner-bottom-right"></div>
            

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleLogin} className="login-form-v2">
              <div className="form-group-v2">
                <label>Username</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                  />
                </div>
              </div>

              <div className="form-group-v2">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-button-v2">
                {isLoading ? 'Processing...' : 'Login'}
              </button>
            </form>
          </div>
        </div>

        <div className="login-right">
          <div className="widget line-widget">
            <div className="widget-header">
              <TrendingUp size={16} className="widget-icon" />
              <span>Engineers Activity</span>
            </div>
            <div className="widget-graph">
              <svg viewBox="0 0 200 80" className={`line-graph ${isMounted ? 'animate' : ''}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
                <path 
                  className="graph-path"
                  d="M0,60 C20,60 40,20 60,30 C80,40 100,10 120,20 C140,30 160,10 180,15 L200,10" 
                  fill="none" 
                  stroke="url(#lineGradient)" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />
                <path 
                  className="graph-area"
                  d="M0,60 C20,60 40,20 60,30 C80,40 100,10 120,20 C140,30 160,10 180,15 L200,10 L200,80 L0,80 Z" 
                  fill="url(#areaGradient)" 
                />
                <circle cx="60" cy="30" r="3" fill="#3b82f6" className="graph-dot" />
                <circle cx="120" cy="20" r="3" fill="#3b82f6" className="graph-dot" />
                <circle cx="180" cy="15" r="3" fill="#60a5fa" className="graph-dot" />
              </svg>
            </div>
          </div>
          
          <div className="widget system-widget">
            <div className="widget-header">
              <Activity size={16} className="widget-icon" />
              <span>Project Statistics</span>
            </div>
            <div className="status-item">
              <div className="status-label">
                <Zap size={12} />
                <span>Implementation</span>
              </div>
              <div className="progress-bg">
                <div 
                  className="progress-fill" 
                  style={{width: isMounted ? '85%' : '0%'}}
                ></div>
              </div>
            </div>
            <div className="status-item">
              <div className="status-label">
                <CheckCircle2 size={12} />
                <span>Installation</span>
              </div>
              <div className="progress-bg">
                <div 
                  className="progress-fill" 
                  style={{width: isMounted ? '92%' : '0%'}}
                ></div>
              </div>
            </div>
            <div className="status-item">
              <div className="status-label">
                <Users size={12} />
                <span>Active Users</span>
              </div>
              <div className="progress-bg">
                <div 
                  className="progress-fill" 
                  style={{width: isMounted ? '100%' : '0%'}}
                ></div>
              </div>
            </div>
          </div>

          <div className="widget circle-widget">
            <div className="widget-header">
              <Activity size={16} className="widget-icon" />
              <span>CDMS Progress</span>
            </div>
            <div className="donut-container">
              <svg viewBox="0 0 36 36" className="donut">
                <path className="donut-ring" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path 
                  className="donut-segment" 
                  strokeDasharray={`${progressValue}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                />
              </svg>
              <div className="donut-text">
                <span className="percentage">{progressValue}%</span>
                <span className="label">COMPLETE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Login;
