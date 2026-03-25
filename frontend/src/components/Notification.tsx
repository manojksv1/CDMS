import React from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const Notification: React.FC = () => {
  const { notifications, remove } = useNotificationStore();

  if (notifications.length === 0) return null;

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return { bg: '#def7ec', text: '#03543f', icon: <CheckCircle size={18} /> };
      case 'error':
        return { bg: '#fde8e8', text: '#9b1c1c', icon: <AlertCircle size={18} /> };
      case 'warning':
        return { bg: '#fdf6b2', text: '#723b13', icon: <AlertTriangle size={18} /> };
      default:
        return { bg: '#e1effe', text: '#1e429f', icon: <Info size={18} /> };
    }
  };

  return (
    <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
      {notifications.map((n) => {
        const styles = getTypeStyles(n.type);
        return (
          <div 
            key={n.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              background: styles.bg, 
              color: styles.text, 
              padding: '1rem', 
              borderRadius: '8px', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', 
              borderLeft: `4px solid ${styles.text}`,
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {styles.icon}
            <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{n.message}</div>
            <button 
              onClick={() => remove(n.id)} 
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.25rem', display: 'flex', opacity: 0.7 }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Notification;
