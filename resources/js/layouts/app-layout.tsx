import React, { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    PackageIcon,
    WarehouseIcon,
    LayersIcon,
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
    eyebrow?: string;
    description?: string;
    breadcrumbs?: { label: string; href?: string }[];
    actions?: React.ReactNode;
}

export function AppLayout({ children, title, eyebrow, description, breadcrumbs, actions }: AppLayoutProps) {
    const page = usePage<SharedProps>();
    const { auth, branding, flash } = page.props;
    const currentUrl = page.url;
    const user = auth?.user;

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('apex_sidebar_collapsed');
        if (saved !== null) {
            setIsCollapsed(saved === 'true');
        }
    }, []);

    // Dynamically synchronize theme custom properties and assets on every Inertia visit
    useEffect(() => {
        if (!branding) return;

        if (branding.primary_color) {
            document.documentElement.style.setProperty('--brand-primary', branding.primary_color);
        }
        if (branding.accent_color) {
            document.documentElement.style.setProperty('--brand-accent', branding.accent_color);
        }

        if (branding.favicon_url) {
            const dynamicFavicon = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
            if (dynamicFavicon) {
                dynamicFavicon.href = branding.favicon_url;
            } else {
                let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
                if (!favicon) {
                    favicon = document.createElement('link');
                    favicon.rel = 'icon';
                    document.head.appendChild(favicon);
                }
                favicon.href = branding.favicon_url;
            }
        }
    }, [branding]);

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

    const isCurrent = (path: string) => {
        if (path === '/inventory') {
            return currentUrl === '/inventory';
        }
        return currentUrl.startsWith(path);
    };

    const navItemClasses = (active: boolean) =>
        `group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all ${
            active
                ? 'bg-brand-subtle text-brand font-semibold shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
        }`;

    return (
        <div className="min-h-screen bg-slate-50/60 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 flex">
            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity"
                />
            )}

            {/* Left Vertical Navigation Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-all duration-200 ease-in-out lg:static ${
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                } ${isCollapsed ? 'w-16' : 'w-60'}`}
            >
                {/* Brand Header */}
                <div className="flex h-14 items-center justify-between px-3.5 border-b border-slate-800">
                    <Link href="/products" className="flex items-center gap-2.5 overflow-hidden">
                        {branding?.logo_url ? (
                            <img
                                src={branding.logo_url}
                                alt={companyName}
                                className="h-7 w-7 shrink-0 rounded-lg object-contain bg-slate-800 border border-slate-700 p-0.5"
                            />
                        ) : (
                            <div
                                style={{ backgroundColor: branding?.primary_color || 'var(--brand-primary)' }}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                            >
                                <LayersIcon className="h-4 w-4" />
                            </div>
                        )}

                        {!isCollapsed && (
                            <span className="text-sm font-semibold tracking-tight text-white truncate">
                                {companyName}
                            </span>
                        )}
                    </Link>

                    {/* Desktop Collapse Toggle */}
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        className="hidden lg:flex p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                        {isCollapsed ? (
                            <PanelLeftOpenIcon className="h-4 w-4" />
                        ) : (
                            <PanelLeftCloseIcon className="h-4 w-4" />
                        )}
                    </button>
                </div>

                {/* Facility / Location Chip (Assetly Workspace Selector Style) */}
                {!isCollapsed && (
                    <div className="mx-2.5 mt-2.5 mb-0.5 flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/70 px-2.5 py-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300">
                                <WarehouseIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-medium text-slate-200 truncate">
                                    Main Distribution Hub
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                    Central Operations
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sidebar Navigation Items */}
                <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
                    {/* Category: OPERATIONS */}
                    <div className="space-y-0.5">
                        {!isCollapsed && (
                            <div className="px-2.5 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Operations
                            </div>
                        )}

                        <Link
                            href="/products"
                            title="Catalog & Multi-UOM"
                            className={navItemClasses(isCurrent('/products'))}
                        >
                            <PackageIcon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>Products & UOM</span>}
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
                            title="Ledger Audit"
                            className={navItemClasses(isCurrent('/inventory/ledger'))}
                        >
                            <LayersIcon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>Movement Ledger</span>}
                        </Link>
                    </div>

                    {/* Category: ADMINISTRATION (Super Admin) */}
                    {user?.is_super_admin && (
                        <div className="space-y-0.5 pt-3 border-t border-slate-800/80">
                            {!isCollapsed && (
                                <div className="px-2.5 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    Administration
                                </div>
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

                {/* Sidebar Bottom User Account */}
                <div className="p-2.5 border-t border-slate-800 bg-slate-950/60">
                    {user ? (
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white border border-slate-700">
                                    {user.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join('')}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-semibold text-slate-200 truncate">
                                            {user.name}
                                        </span>
                                        <span className="text-[11px] text-slate-400 truncate">
                                            {user.primary_role}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                title="Sign Out"
                                className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors shrink-0"
                            >
                                <LogOutIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="flex h-8 w-full items-center justify-center rounded-lg bg-brand text-xs font-medium text-white hover:opacity-90 transition-opacity"
                        >
                            <span>Sign In</span>
                        </Link>
                    )}
                </div>
            </aside>

            {/* Main Application Area */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                {/* Top Control Bar */}
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-900/80">
                    {/* Left: Mobile Toggle & Breadcrumbs */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileOpen(true)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
                        >
                            <MenuIcon className="h-4 w-4" />
                        </button>

                        {breadcrumbs && (
                            <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                                {breadcrumbs.map((b, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <ChevronRightIcon className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />}
                                        {b.href ? (
                                            <Link href={b.href} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-medium">
                                                {b.label}
                                            </Link>
                                        ) : (
                                            <span className="text-slate-900 dark:text-slate-100 font-medium">
                                                {b.label}
                                            </span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </nav>
                        )}
                    </div>
                </header>

                {/* Flash Messages */}
                {flash?.success && (
                    <div className="border-b border-emerald-500/20 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <div className="mx-auto flex max-w-7xl items-center gap-2">
                            <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{flash.success}</span>
                        </div>
                    </div>
                )}
                {flash?.error && (
                    <div className="border-b border-rose-500/20 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        <div className="mx-auto flex max-w-7xl items-center gap-2">
                            <XIcon className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>{flash.error}</span>
                        </div>
                    </div>
                )}

                {/* Page Title & Actions Header (Integrated) */}
                {title && (
                    <div className="border-b border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900 px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                {eyebrow && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-brand mb-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                        <span>{eyebrow}</span>
                                    </div>
                                )}
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    {title}
                                </h1>
                                {description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {description}
                                    </p>
                                )}
                            </div>
                            {actions && <div className="mt-2 sm:mt-0 flex items-center gap-2">{actions}</div>}
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
