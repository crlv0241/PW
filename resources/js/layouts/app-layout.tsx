import React from 'react';
import { Link } from '@inertiajs/react';
import { PackageIcon, WarehouseIcon, TruckIcon, LayersIcon } from '../components/ui/icons';

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
    breadcrumbs?: { label: string; href?: string }[];
}

export function AppLayout({ children, title, breadcrumbs }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
                    {/* Brand */}
                    <div className="flex items-center gap-6">
                        <Link href="/products" className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-slate-900 text-white shadow-sm">
                                <LayersIcon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                    APEX POS & WMS
                                </span>
                                <span className="text-[10px] font-medium tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
                                    Enterprise Core v1.0
                                </span>
                            </div>
                        </Link>

                        {/* Navigation links */}
                        <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-slate-800">
                            <Link
                                href="/products"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <PackageIcon className="h-3.5 w-3.5" />
                                <span>Catalog & UOM</span>
                            </Link>
                            <Link
                                href="/inventory"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <WarehouseIcon className="h-3.5 w-3.5" />
                                <span>Stock Balances</span>
                            </Link>
                            <Link
                                href="/inventory/ledger"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <LayersIcon className="h-3.5 w-3.5" />
                                <span>Ledger Audit</span>
                            </Link>
                        </nav>
                    </div>

                    {/* System Indicators */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Ledger Synchronized</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Page Header */}
            {title && (
                <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
                        {breadcrumbs && (
                            <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
                                {breadcrumbs.map((b, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <span>/</span>}
                                        {b.href ? (
                                            <Link href={b.href} className="hover:text-slate-600 dark:hover:text-slate-200">
                                                {b.label}
                                            </Link>
                                        ) : (
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                {b.label}
                                            </span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </nav>
                        )}
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
