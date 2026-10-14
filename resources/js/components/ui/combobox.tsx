import React, { useState, useRef, useEffect, useId } from 'react';
import { SearchIcon, ChevronDownIcon, CheckIcon, XIcon } from './icons';

export interface ComboboxOption {
    value: string;
    label: string;
    description?: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    label,
    disabled = false,
    error,
    className = '',
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const id = useId();

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        (opt.description && opt.description.toLowerCase().includes(search.toLowerCase()))
    );

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && filteredOptions[activeIndex]) {
                    handleSelect(filteredOptions[activeIndex].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearch('');
                break;
        }
    };

    return (
        <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label htmlFor={id} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {label}
                </label>
            )}

            <button
                type="button"
                id={id}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                        setTimeout(() => inputRef.current?.focus(), 50);
                    }
                }}
                onKeyDown={handleKeyDown}
                className={`flex h-9 w-full items-center justify-between rounded-lg border px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 ${
                    error
                        ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:ring-rose-400/20 dark:border-rose-500 dark:text-rose-200'
                        : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-900 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-slate-400'
                } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
                <span className={`truncate ${selectedOption ? 'font-normal text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                        <SearchIcon className="h-4 w-4 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setActiveIndex(-1);
                            }}
                            placeholder="Type to search..."
                            className="w-full bg-transparent px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <ul role="listbox" className="max-h-52 overflow-y-auto p-1 text-sm">
                        {filteredOptions.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                                No matching results found
                            </li>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                const isSelected = opt.value === value;
                                const isActive = idx === activeIndex;

                                return (
                                    <li
                                        key={opt.value}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelect(opt.value)}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
                                            isActive || isSelected
                                                ? 'bg-indigo-50 text-indigo-900 font-medium dark:bg-indigo-950/60 dark:text-indigo-200'
                                                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span>{opt.label}</span>
                                            {opt.description && (
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    {opt.description}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && <CheckIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}
