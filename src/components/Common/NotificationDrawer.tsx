import React from 'react';
import { Bell, X, Trash2, CheckCircle2, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, clearNotifications } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-sm bg-surface border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display text-sm font-bold text-primary leading-tight">Notifications</h4>
              <p className="text-[11px] font-mono text-muted">{notifications.length} alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                className="p-1.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted">
              <Bell className="w-8 h-8 opacity-25 mb-2" />
              <p className="text-xs font-semibold text-primary">No new alerts</p>
              <p className="text-[11px] text-muted mt-1 max-w-[200px]">
                Upcoming classes, deadlines, and meals will appear here.
              </p>
            </div>
          ) : (
            notifications.map(n => {
              const iconMap = {
                class: <Clock className="w-3.5 h-3.5 text-brand" />,
                task: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
                exam: <BookOpen className="w-3.5 h-3.5 text-indigo-500" />,
                meal: <Clock className="w-3.5 h-3.5 text-amber-500" />,
                laundry: <Clock className="w-3.5 h-3.5 text-purple-500" />,
                system: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              };

              return (
                <div
                  key={n.id}
                  className="p-3 bg-background border border-border rounded-xl flex items-start gap-2.5 hover:border-brand/40 transition-colors"
                >
                  <div className="mt-0.5">{iconMap[n.type] || <Bell className="w-3.5 h-3.5 text-brand" />}</div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-primary leading-tight">{n.title}</h5>
                    <p className="text-[11px] text-muted mt-0.5 leading-snug">{n.body}</p>
                    <span className="text-[10px] font-mono text-muted/70 block mt-1">{n.time}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
