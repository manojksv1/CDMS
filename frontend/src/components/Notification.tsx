import React from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';
import type { NotificationType } from '../store/notificationStore';

const CONFIG: Record<NotificationType, { icon: React.ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 size={18} className="text-emerald-600" />,
    classes: 'bg-white border-l-4 border-emerald-500',
  },
  error: {
    icon: <XCircle size={18} className="text-red-600" />,
    classes: 'bg-white border-l-4 border-red-500',
  },
  warning: {
    icon: <AlertTriangle size={18} className="text-amber-500" />,
    classes: 'bg-white border-l-4 border-amber-400',
  },
  info: {
    icon: <Info size={18} className="text-blue-600" />,
    classes: 'bg-white border-l-4 border-blue-500',
  },
};

const Notification: React.FC = () => {
  const { notifications, remove } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {notifications.map((n) => {
        const { icon, classes } = CONFIG[n.type];
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg ${classes} animate-in slide-in-from-right-4 duration-200`}
            role="alert"
          >
            <span className="flex-shrink-0 mt-0.5">{icon}</span>
            <p className="flex-1 text-sm text-gray-800 font-medium leading-snug">{n.message}</p>
            <button
              onClick={() => remove(n.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Notification;
