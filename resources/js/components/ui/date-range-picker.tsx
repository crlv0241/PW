import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon, ChevronDownIcon, XIcon, ArrowRightIcon, CheckIcon } from './icons';

interface DateRangePickerProps {
    startDate?: string;
    endDate?: string;
    onChange: (startDate: string, endDate: string) => void;
    placeholder?: string;
    className?: string;
}

interface Preset {
    id: string;
    label: string;
    getRange: () => { start: string; end: string };
}

/**
 * Format YYYY-MM-DD string to "Oct 14, 2026" or short "Oct 14"
 */
function formatLocalDate(dateStr?: string | null, includeYear = true): string {
    if (!dateStr) return '';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: includeYear ? 'numeric' : undefined,
            });
        }
    }
    return dateStr;
}

function toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function DateRangePicker({
    startDate = '',
    endDate = '',
    onChange,
    placeholder = 'Filter by date range...',
    className = '',
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftStart, setDraftStart] = useState(startDate);
    const [draftEnd, setDraftEnd] = useState(endDate);
    const containerRef = useRef<HTMLDivElement>(null);

    // Synchronize internal draft when external props change
    useEffect(() => {
        setDraftStart(startDate);
        setDraftEnd(endDate);
    }, [startDate, endDate]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const presets: Preset[] = [
        {
            id: 'today',
            label: 'Today',
            getRange: () => {
                const today = toIsoDate(new Date());
                return { start: today, end: today };
            },
        },
        {
            id: 'yesterday',
            label: 'Yesterday',
            getRange: () => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const yesterday = toIsoDate(d);
                return { start: yesterday, end: yesterday };
            },
        },
        {
            id: 'last_7_days',
            label: 'Last 7 Days',
            getRange: () => {
                const today = toIsoDate(new Date());
                const d = new Date();
                d.setDate(d.getDate() - 6);
                return { start: toIsoDate(d), end: today };
            },
        },
        {
            id: 'last_30_days',
            label: 'Last 30 Days',
            getRange: () => {
                const today = toIsoDate(new Date());
                const d = new Date();
                d.setDate(d.getDate() - 29);
                return { start: toIsoDate(d), end: today };
            },
        },
        {
            id: 'this_month',
            label: 'This Month',
            getRange: () => {
                const now = new Date();
                const start = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
                const end = toIsoDate(now);
                return { start, end };
            },
        },
        {
            id: 'this_year',
            label: 'This Year',
            getRange: () => {
                const now = new Date();
                const start = `${now.getFullYear()}-01-01`;
                const end = toIsoDate(now);
                return { start, end };
            },
        },
    ];

    const handleApply = () => {
        onChange(draftStart, draftEnd);
        setIsOpen(false);
    };

    const handleClear = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDraftStart('');
        setDraftEnd('');
        onChange('', '');
        setIsOpen(false);
    };

    const applyPreset = (preset: Preset) => {
        const { start, end } = preset.getRange();
        setDraftStart(start);
        setDraftEnd(end);
        onChange(start, end);
        setIsOpen(false);
    };

    const hasValue = Boolean(startDate || endDate);

    const displayLabel = () => {
        if (startDate && endDate) {
            if (startDate === endDate) {
                return formatLocalDate(startDate);
            }
            return `${formatLocalDate(startDate, false)} – ${formatLocalDate(endDate)}`;
        }
        if (startDate) return `From ${formatLocalDate(startDate)}`;
        if (endDate) return `Until ${formatLocalDate(endDate)}`;
        return placeholder;
    };

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-xs font-medium transition-all ${
                    hasValue
                        ? 'border-brand/40 bg-brand/5 text-brand dark:border-brand/50 dark:bg-brand/10 dark:text-brand-light'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
                title="Select date range"
            >
                <div className="flex items-center gap-2 truncate">
                    <CalendarIcon
                        className={`h-4 w-4 shrink-0 ${
                            hasValue ? 'text-brand' : 'text-slate-400 dark:text-slate-500'
                        }`}
                    />
                    <span className="truncate">{displayLabel()}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {hasValue && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleClear}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleClear();
                                }
                            }}
                            className="p-0.5 rounded text-slate-400 hover:bg-slate-200/60 hover:text-rose-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                            title="Clear date filter"
                        >
                            <XIcon className="h-3 w-3" />
                        </span>
                    )}
                    <ChevronDownIcon
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                            isOpen ? 'rotate-180 text-brand' : ''
                        }`}
                    />
                </div>
            </button>

            {/* Popover Dropdown */}
            {isOpen && (
                <div className="absolute left-0 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl ring-1 ring-black/5 z-50 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Date Range Filter
                        </span>
                        {hasValue && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-[11px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Quick Presets Grid */}
                    <div className="mb-3">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-wider">
                            Quick Presets
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                            {presets.map((preset) => {
                                const range = preset.getRange();
                                const isCurrent =
                                    draftStart === range.start && draftEnd === range.end;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className={`h-7 px-2 rounded-md text-[11px] font-medium transition-colors text-center truncate ${
                                            isCurrent
                                                ? 'bg-brand text-white'
                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-300'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Range Inputs */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block uppercase tracking-wider">
                            Custom Dates
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={draftStart}
                                    onChange={(e) => setDraftStart(e.target.value)}
                                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-brand focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={draftEnd}
                                    min={draftStart || undefined}
                                    onChange={(e) => setDraftEnd(e.target.value)}
                                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-brand focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="h-7 px-2.5 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="h-7 px-3.5 rounded-md bg-brand text-xs font-medium text-white hover:bg-brand/90 transition-colors shadow-xs"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
