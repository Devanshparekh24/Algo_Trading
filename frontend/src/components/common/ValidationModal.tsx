import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, X, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { useAppStore, type ValidationModalConfig } from '../../store';

export interface ValidationModalProps {
  overrideConfig?: ValidationModalConfig | null;
  onClose?: () => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  overrideConfig,
  onClose: overrideOnClose,
}) => {
  const storeModal = useAppStore((state) => state.validationModal);
  const closeValidationModal = useAppStore((state) => state.closeValidationModal);

  const config = overrideConfig !== undefined ? overrideConfig : storeModal;
  const handleClose = overrideOnClose || closeValidationModal;
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape & Enter hotkey
  useEffect(() => {
    if (!config?.isOpen) return;

    // Focus primary button when modal opens
    setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config?.isOpen, handleClose]);

  if (!config || !config.isOpen) return null;

  const type = config.type || 'warning';

  const typeStyles = {
    warning: {
      badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30',
      iconGlow: 'bg-amber-500/10 ring-8 ring-amber-500/5',
      icon: <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />,
      calloutBg: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200',
      btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
    },
    error: {
      badgeBg: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30',
      iconGlow: 'bg-rose-500/10 ring-8 ring-rose-500/5',
      icon: <AlertCircle className="w-6 h-6 text-rose-500 dark:text-rose-400" />,
      calloutBg: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200',
      btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
    },
    info: {
      badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30',
      iconGlow: 'bg-blue-500/10 ring-8 ring-blue-500/5',
      icon: <Info className="w-6 h-6 text-blue-500 dark:text-blue-400" />,
      calloutBg: 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-200',
      btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
    },
  }[type];

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="validation-modal-title"
      aria-describedby="validation-modal-desc"
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5 animate-in fade-in zoom-in-95 duration-200 transition-colors"
      >
        {/* Header with Icon & Close */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-2xl ${typeStyles.badgeBg} ${typeStyles.iconGlow} flex items-center justify-center shrink-0`}>
              {typeStyles.icon}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Action Validation
              </span>
              <h3
                id="validation-modal-title"
                className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug"
              >
                {config.title || 'Validation Notice'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Primary Message */}
        <div className="space-y-3">
          <div
            id="validation-modal-desc"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed"
          >
            {config.message}
          </div>

          {/* Contextual Suggestion / Guidance Callout */}
          {config.suggestion && (
            <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${typeStyles.calloutBg}`}>
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Guidance & Guardrails</span>
              </div>
              <p className="opacity-90">{config.suggestion}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80">
          {config.actionLabel && config.onAction && (
            <button
              type="button"
              onClick={() => {
                config.onAction?.();
                handleClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{config.actionLabel}</span>
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleClose}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 ${typeStyles.btnBg}`}
          >
            <Check className="w-4 h-4" />
            <span>Got It</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationModal;

