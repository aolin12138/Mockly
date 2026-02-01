import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  primaryButtonText = 'Confirm',
  secondaryButtonText = 'Cancel',
  onPrimaryClick,
  onSecondaryClick,
  type = 'info', // 'info', 'warning', 'error', 'success'
  children, // For custom content
  showCloseButton = true,
  isPrimaryLoading = false,
  isSecondaryLoading = false
}) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-amber-400" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-emerald-400" />;
      default:
        return <Info className="w-6 h-6 text-cyan-400" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case 'warning':
        return 'from-amber-500/20 to-orange-500/20';
      case 'error':
        return 'from-red-500/20 to-red-600/20';
      case 'success':
        return 'from-emerald-500/20 to-green-500/20';
      default:
        return 'from-cyan-500/20 to-blue-500/20';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'warning':
        return 'border-amber-500/30';
      case 'error':
        return 'border-red-500/30';
      case 'success':
        return 'border-emerald-500/30';
      default:
        return 'border-cyan-500/30';
    }
  };

  const getPrimaryButtonColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-black';
      case 'error':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'success':
        return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      default:
        return 'bg-cyan-500 hover:bg-cyan-600 text-white';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onSecondaryClick || onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className={`w-full max-w-md bg-gradient-to-br ${getAccentColor()} backdrop-blur-xl border ${getBorderColor()} rounded-2xl p-6 shadow-2xl`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  {getIcon()}
                  <h2 className="text-xl font-bold text-white">{title}</h2>
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="mb-6">
                {children ? (
                  children
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                {secondaryButtonText && (
                  <button
                    onClick={onSecondaryClick || onClose}
                    disabled={isSecondaryLoading}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSecondaryLoading ? 'Loading...' : secondaryButtonText}
                  </button>
                )}
                <button
                  onClick={onPrimaryClick}
                  disabled={isPrimaryLoading}
                  className={`flex-1 px-4 py-2.5 rounded-lg ${getPrimaryButtonColor()} transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isPrimaryLoading ? 'Loading...' : primaryButtonText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
