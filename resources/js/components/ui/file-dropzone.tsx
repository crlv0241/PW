import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloudIcon, ImageIcon, TrashIcon, CheckIcon, XIcon } from './icons';

interface FileDropzoneProps {
    label: string;
    description: string;
    accept: string;
    currentUrl?: string | null;
    file: File | null;
    onFileSelect: (file: File | null) => void;
    onRemoveCurrent?: () => void;
    isRemoved?: boolean;
    maxSizeMb?: number;
    dimensionsHint?: string;
}

export function FileDropzone({
    label,
    description,
    accept,
    currentUrl,
    file,
    onFileSelect,
    onRemoveCurrent,
    isRemoved = false,
    maxSizeMb = 2,
    dimensionsHint,
}: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const validateAndProcessFile = (selectedFile: File) => {
        setError(null);

        // Check file size
        const maxBytes = maxSizeMb * 1024 * 1024;
        if (selectedFile.size > maxBytes) {
            setError(`File size exceeds ${maxSizeMb}MB maximum limit.`);
            return;
        }

        onFileSelect(selectedFile);

        // Generate local preview URL
        const reader = new FileReader();
        reader.onload = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            validateAndProcessFile(droppedFile);
        }
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selected = e.target.files[0];
            validateAndProcessFile(selected);
        }
    };

    const handleClearSelected = () => {
        onFileSelect(null);
        setPreviewUrl(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const hasActiveMedia = !isRemoved && (previewUrl || currentUrl);
    const activeMediaUrl = previewUrl || (isRemoved ? null : currentUrl);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {label}
                </label>
                {dimensionsHint && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {dimensionsHint}
                    </span>
                )}
            </div>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative group cursor-pointer flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
                    isDragging
                        ? 'border-brand bg-brand-subtle scale-[1.01]'
                        : 'border-slate-200 hover:border-brand-subtle bg-slate-50/50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                {hasActiveMedia && activeMediaUrl ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <img
                                src={activeMediaUrl}
                                alt={label}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {file ? file.name : 'Current active asset'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                Click or drag a new file to replace
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand group-hover:scale-110 transition-transform">
                            <UploadCloudIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-brand">
                                Drag & drop file here
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {' '}or click to browse
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {description} (Max {maxSizeMb}MB)
                        </p>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500">
                    <XIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between text-xs pt-1">
                {file && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckIcon className="h-3.5 w-3.5" />
                        <span>Ready to upload: {file.name}</span>
                    </div>
                )}

                <div className="flex items-center gap-3 ml-auto">
                    {file && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearSelected();
                            }}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            Cancel selection
                        </button>
                    )}

                    {currentUrl && !isRemoved && onRemoveCurrent && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearSelected();
                                onRemoveCurrent();
                            }}
                            className="flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium"
                        >
                            <TrashIcon className="h-3.5 w-3.5" />
                            <span>Remove existing asset</span>
                        </button>
                    )}

                    {isRemoved && (
                        <span className="text-rose-500 text-[11px] font-medium">
                            Existing asset marked for removal
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
