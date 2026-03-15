import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: 'text-emerald-400',
    text: 'text-emerald-300',
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: 'text-red-400',
    text: 'text-red-300',
  },
  warning: {
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    icon: 'text-yellow-400',
    text: 'text-yellow-300',
  },
  info: {
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    icon: 'text-cyan-400',
    text: 'text-cyan-300',
  },
};

const DURATIONS = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3500,
};

const ToastItem = ({ toast, onDismiss }) => {
  const style = STYLES[toast.type] || STYLES.info;
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || DURATIONS[toast.type] || 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg ${style.bg} min-w-[320px] max-w-[480px]`}
    >
      <Icon size={18} className={`${style.icon} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-semibold ${style.text}`}>{toast.title}</p>
        )}
        <p className="text-sm text-slate-300">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 cursor-pointer"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration }) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (message, opts = {}) => addToast({ type: 'success', message, ...opts }),
    error: (message, opts = {}) => addToast({ type: 'error', message, ...opts }),
    warning: (message, opts = {}) => addToast({ type: 'warning', message, ...opts }),
    info: (message, opts = {}) => addToast({ type: 'info', message, ...opts }),
  }, [addToast]);

  // Make toast callable as toast.success(), toast.error(), etc.
  const toastApi = useCallback(
    Object.assign(
      (message, opts = {}) => addToast({ type: 'info', message, ...opts }),
      {
        success: (message, opts = {}) => addToast({ type: 'success', message, ...opts }),
        error: (message, opts = {}) => addToast({ type: 'error', message, ...opts }),
        warning: (message, opts = {}) => addToast({ type: 'warning', message, ...opts }),
        info: (message, opts = {}) => addToast({ type: 'info', message, ...opts }),
      }
    ),
    [addToast]
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}

      {/* Toast container — fixed top-center */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
