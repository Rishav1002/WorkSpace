import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
          info: <Info className="w-4 h-4 text-brand shrink-0" />
        };

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-surface/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg flex items-start justify-between gap-2.5 transition-all animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {icons[toast.type]}
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-primary leading-tight">{toast.title}</h5>
                <p className="text-[11px] text-muted mt-0.5 leading-snug">{toast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="text-muted hover:text-primary p-1 rounded-lg transition-colors"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-5 space-y-4 shadow-2xl bg-surface animate-in zoom-in-95">
        <h3 className="font-display text-base font-bold text-primary">{title}</h3>
        <p className="text-xs text-muted leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-bold text-muted hover:text-primary bg-surface-hover rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all active:scale-95 ${
              isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-brand hover:opacity-90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
