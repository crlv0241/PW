import React from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    PackageIcon,
    WarehouseIcon,
    LayersIcon,
    ShieldCheckIcon,
    UsersIcon,
    PaletteIcon,
    LogOutIcon,
    CheckIcon,
    XIcon,
    ChevronRightIcon,
} from '../components/ui/icons';

interface AuthUser {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    is_super_admin: boolean;
    primary_role: string;
    roles: string[];
}

interface BrandingProps {
    company_name: string;
    tagline: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    accent_color: string;
    theme_palette: string;
    dark_mode_default: boolean;
}

interface SharedProps {
    auth?: {
        user?: AuthUser | null;
    };
    branding?: BrandingProps;
    flash?: {
        success?: string | null;
        error?: string | null;
    };
    [key: string]: unknown;
}

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
    breadcrumbs?: { label: string; href?: string }[];
}

export function AppLayout({ children, title, breadcrumbs }: AppLayoutProps) {
    const { auth, branding, flash } = usePage<SharedProps>().props;
    const user = auth?.user;

    const handleLogout = () => {
        router.post('/logout');
    };

    const companyName = branding?.company_name || 'APEX POS & WMS';
    const tagline = branding?.tagline || 'Enterprise Core v1.0';
    const primaryColor = branding?.primary_color || '#4f46e5';

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
            {/* Top Navigation Bar with Glassmorphic Blur */}
            <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/75 transition-colors">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
                    {/* Brand & Main Nav */}
                    <div className="flex items-center gap-6">
                        <Link href="/products" className="flex items-center gap-3 group">
                            {branding?.logo_url ? (
                                <img
                                    src={branding.logo_url}
                                    alt={companyName}
                                    className="h-9 w-9 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div
                                    style={{ backgroundColor: primaryColor }}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-500/10 group-hover:scale-105 transition-transform"
                                >
                                    <LayersIcon className="h-5 w-5" />
                                </div>
                            )}

                            <div className="flex flex-col">
                                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {companyName}
                                </span>
                                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                                    {tagline}
                                </span>
                            </div>
                        </Link>

                        {/* Navigation links */}
                        <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-slate-800">
                            <Link
                                href="/products"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors"
                            >
                                <PackageIcon className="h-3.5 w-3.5" />
                                <span>Catalog & UOM</span>
                            </Link>
                            <Link
                                href="/inventory"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors"
                            >
                                <WarehouseIcon className="h-3.5 w-3.5" />
                                <span>Stock Balances</span>
                            </Link>
                            <Link
                                href="/inventory/ledger"
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors"
                            >
                                <LayersIcon className="h-3.5 w-3.5" />
                                <span>Ledger Audit</span>
                            </Link>

                            {/* Super Admin Console Links */}
                            {user?.is_super_admin && (
                                <div className="flex items-center gap-1 pl-3 ml-2 border-l border-slate-200 dark:border-slate-800">
                                    <Link
                                        href="/admin/users"
                                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40 transition-colors"
                                    >
                                        <UsersIcon className="h-3.5 w-3.5" />
                                        <span>User Access</span>
                                    </Link>
                                    <Link
                                        href="/admin/settings"
                                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40 transition-colors"
                                    >
                                        <PaletteIcon className="h-3.5 w-3.5" />
                                        <span>Branding & Colors</span>
                                    </Link>
                                </div>
                            )}
                        </nav>
                    </div>

                    {/* Right User Bar & System Status */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Ledger Synchronized</span>
                        </div>

                        {user ? (
                            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col text-right">
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                        {user.name}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {user.primary_role}
                                    </span>
                                </div>
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white shadow-inner dark:bg-slate-700 ring-2 ring-slate-100 dark:ring-slate-800">
                                    {user.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join('')}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    title="Sign Out"
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 transition-colors"
                                >
                                    <LogOutIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition-colors"
                            >
                                <span>Sign In</span>
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Flash Messages */}
            {flash?.success && (
                <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 shadow-sm animate-in fade-in duration-200">
                    <div className="mx-auto flex max-w-7xl items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{flash.success}</span>
                    </div>
                </div>
            )}
            {flash?.error && (
                <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-200 shadow-sm animate-in fade-in duration-200">
                    <div className="mx-auto flex max-w-7xl items-center gap-2">
                        <XIcon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{flash.error}</span>
                    </div>
                </div>
            )}

            {/* Modern Page Header */}
            {title && (
                <div className="border-b border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-sm">
                    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
                        {breadcrumbs && (
                            <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
                                {breadcrumbs.map((b, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <ChevronRightIcon className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />}
                                        {b.href ? (
                                            <Link href={b.href} className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-medium">
                                                {b.label}
                                            </Link>
                                        ) : (
                                            <span className="text-slate-700 dark:text-slate-200 font-semibold">
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
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">
                {children}
            </main>
        </div>
    );
}
