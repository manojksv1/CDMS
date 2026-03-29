import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Shield, Brain, User, Lock, Eye, EyeOff, BarChart3, Activity, Zap, CheckCircle2, Users } from 'lucide-react';
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

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
    <div className="login-page">
      <div className="login-background-overlay"></div>
      
      <div className="login-content">
        <div className="login-left">
          <div className="brand-section">
            <div className="brand-logo">
              <Shield size={64} className="shield-icon" />
              <div className="shield-inner">
                <Brain size={24} />
              </div>
            </div>
            <h1 className="brand-title">CLIENT DATA<br />MANAGEMENT<br />SYSTEM</h1>
            <p className="brand-subtitle">Powered by AI-driven insights and robust security.</p>
          </div>
        </div>

        <div className="login-center">
          <div className="login-card-v2">
            <div className="card-corner-top-left"></div>
            <div className="card-corner-bottom-right"></div>
            
            <div className="card-header">
              <Brain size={60} className="brain-icon-large" />
            </div>

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

              <div className="remember-me-v2">
                <label className="checkbox-container">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span className="checkmark"></span>
                  Remember Me
                </label>
              </div>
            </form>
          </div>
        </div>

        <div className="login-right">
          <div className="widget bar-widget">
            <div className="widget-header">
              <BarChart3 size={16} className="widget-icon" />
              <span>Engineers Activity</span>
            </div>
            <div className="widget-bars">
              {[40, 60, 80, 50, 70, 90, 65].map((h, i) => (
                <div key={i} className="bar-container">
                  <div className="bar" style={{height: `${h}%`}}></div>
                </div>
              ))}
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
              <div className="progress-bg"><div className="progress-fill" style={{width: '85%'}}></div></div>
            </div>
            <div className="status-item">
              <div className="status-label">
                <CheckCircle2 size={12} />
                <span>Installation</span>
              </div>
              <div className="progress-bg"><div className="progress-fill" style={{width: '92%'}}></div></div>
            </div>
            <div className="status-item">
              <div className="status-label">
                <Users size={12} />
                <span>Active Users</span>
              </div>
              <div className="progress-bg"><div className="progress-fill" style={{width: '100%'}}></div></div>
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
                <path className="donut-segment" strokeDasharray="95, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="donut-text">
                <span className="percentage">95%</span>
                <span className="label">COMPLETE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
