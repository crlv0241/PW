import React, { useEffect, useRef } from 'react';
import { XIcon, SpinnerIcon } from './icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    isLoading?: boolean;
    isDestructive?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl';
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    confirmText,
    cancelText = 'Cancel',
    onConfirm,
    isLoading = false,
    isDestructive = false,
    maxWidth = 'lg',
}: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
                onClick={() => {
                    if (!isLoading) onClose();
                }}
            />

            {/* Modal Dialog */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                className={`relative w-full ${maxWidthClasses[maxWidth]} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900`}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                        <h3 id="modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {title}
                        </h3>
                        {description && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="max-h-[75vh] overflow-y-auto p-5">
                    {children}
                </div>

                {/* Footer */}
                {(confirmText || onConfirm) && (
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`h-9 px-4 rounded-lg text-sm font-medium text-white shadow-sm transition inline-flex items-center gap-2 focus:outline-none disabled:opacity-50 ${
                                isDestructive
                                    ? 'bg-rose-600 hover:bg-rose-500'
                                    : 'bg-brand hover:opacity-90'
                            }`}
                        >
                            {isLoading && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                            <span>{confirmText ?? 'Confirm'}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
