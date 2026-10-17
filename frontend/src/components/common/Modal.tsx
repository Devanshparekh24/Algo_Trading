import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className = '',
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-3xl w-full ${maxWidthClasses} p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-200 ${className}`}
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-gray-700/80">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-xs text-gray-400 font-mono mt-0.5">{subtitle}</div>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
