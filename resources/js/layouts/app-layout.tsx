import React, { useState, useEffect } from 'react';
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
    MenuIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
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
    const page = usePage<SharedProps>();
    const { auth, branding, flash } = page.props;
    const currentUrl = page.url;
    const user = auth?.user;

    // Sidebar collapsed state (persisted in localStorage)
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('apex_sidebar_collapsed');
        if (saved !== null) {
            setIsCollapsed(saved === 'true');
        }
    }, []);

    const toggleCollapse = () => {
        setIsCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('apex_sidebar_collapsed', String(next));
            return next;
        });
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const companyName = branding?.company_name || 'APEX POS & WMS';
    const tagline = branding?.tagline || 'Enterprise Core v1.0';
    const primaryColor = branding?.primary_color || '#4f46e5';

    // Route active check
    const isCurrent = (path: string) => {
        if (path === '/inventory') {
            return currentUrl === '/inventory';
        }
        return currentUrl.startsWith(path);
    };

    const navItemClasses = (active: boolean) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
            active
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
        }`;

    return (
        <div className="min-h-screen bg-slate-50/60 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 flex">
            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
                />
            )}

            {/* Left Vertical Navigation Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95 transition-all duration-300 ease-in-out lg:static ${
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                } ${isCollapsed ? 'w-20' : 'w-64'}`}
            >
                {/* Brand Header */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800/80">
                    <Link href="/products" className="flex items-center gap-3 overflow-hidden">
                        {branding?.logo_url ? (
                            <img
                                src={branding.logo_url}
                                alt={companyName}
                                className="h-9 w-9 shrink-0 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-sm"
                            />
                        ) : (
                            <div
                                style={{ backgroundColor: primaryColor }}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-500/10"
                            >
                                <LayersIcon className="h-5 w-5" />
                            </div>
                        )}

                        {!isCollapsed && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                                    {companyName}
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                                    {tagline}
                                </span>
                            </div>
                        )}
                    </Link>

                    {/* Desktop Collapse Toggle */}
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                        {isCollapsed ? (
                            <PanelLeftOpenIcon className="h-4 w-4" />
                        ) : (
                            <PanelLeftCloseIcon className="h-4 w-4" />
                        )}
                    </button>
                </div>

                {/* Sidebar Navigation Items */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                    {/* Category: OPERATIONS */}
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                Operations & Stock
                            </h2>
                        )}

                        <Link
                            href="/products"
                            title="Catalog & Multi-UOM"
                            className={navItemClasses(isCurrent('/products'))}
                        >
                            <PackageIcon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>Catalog & UOMs</span>}
                        </Link>

                        <Link
                            href="/inventory"
                            title="Stock Balances"
                            className={navItemClasses(isCurrent('/inventory'))}
                        >
                            <WarehouseIcon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>Stock Balances</span>}
                        </Link>

                        <Link
                            href="/inventory/ledger"
                            title="Ledger Movement Audit"
                            className={navItemClasses(isCurrent('/inventory/ledger'))}
                        >
                            <LayersIcon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>Movement Ledger</span>}
                        </Link>
                    </div>

                    {/* Category: GOVERNANCE & ADMIN (Super Admin) */}
                    {user?.is_super_admin && (
                        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            {!isCollapsed && (
                                <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                    Administration
                                </h2>
                            )}

                            <Link
                                href="/admin/users"
                                title="Users & RBAC Access"
                                className={navItemClasses(isCurrent('/admin/users'))}
                            >
                                <UsersIcon className="h-4 w-4 shrink-0" />
                                {!isCollapsed && <span>User Accounts</span>}
                            </Link>

                            <Link
                                href="/admin/settings"
                                title="Branding & System Colors"
                                className={navItemClasses(isCurrent('/admin/settings'))}
                            >
                                <PaletteIcon className="h-4 w-4 shrink-0" />
                                {!isCollapsed && <span>Branding & Theme</span>}
                            </Link>
                        </div>
                    )}
                </div>

                {/* Sidebar Bottom User & Status Profile */}
                <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
                    {user ? (
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white shadow-inner dark:bg-slate-800">
                                    {user.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join('')}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                            {user.name}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            {user.primary_role}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                title="Sign Out"
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-400 transition-colors shrink-0"
                            >
                                <LogOutIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                        >
                            <span>Sign In</span>
                        </Link>
                    )}
                </div>
            </aside>

            {/* Main Application Area */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                {/* Top Control Bar */}
                <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/75 backdrop-blur-xl px-4 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-900/75">
                    {/* Left: Mobile Toggle & Breadcrumbs */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileOpen(true)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
                        >
                            <MenuIcon className="h-5 w-5" />
                        </button>

                        {breadcrumbs && (
                            <nav className="flex items-center gap-1.5 text-xs text-slate-400">
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
                    </div>

                    {/* Right: Status Indicators & Quick Actions */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Ledger Synchronized</span>
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

                {/* Page Title Header */}
                {title && (
                    <div className="border-b border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-5">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
