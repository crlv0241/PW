import React from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    LayersIcon,
    MailIcon,
    LockIcon,
    ShieldCheckIcon,
    SpinnerIcon,
    ArrowRightIcon,
    XIcon,
} from '../../components/ui/icons';

interface BrandingProps {
    company_name?: string;
    tagline?: string;
    logo_url?: string | null;
    primary_color?: string;
    accent_color?: string;
}

export default function Login() {
    const pageProps = usePage().props as { branding?: BrandingProps };
    const branding = pageProps.branding;
    const companyName = branding?.company_name || 'APEX POS & WMS';
    const tagline = branding?.tagline || 'Distribution & Retail Management';
    const primaryColor = branding?.primary_color || '#4f46e5';

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    const handleSelectDemoUser = (email: string) => {
        setData((prev) => ({
            ...prev,
            email,
            password: 'Password123!',
        }));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <Head title={`Sign In - ${companyName}`} />

            {/* Dynamic Subtle Gradient Glow in Background */}
            <div
                style={{ backgroundColor: `${primaryColor}15` }}
                className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full blur-3xl pointer-events-none transition-colors"
            />

            <div className="w-full max-w-md space-y-6 relative z-10">
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    {branding?.logo_url ? (
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 p-2 shadow-xl ring-1 ring-white/10">
                            <img
                                src={branding.logo_url}
                                alt={companyName}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div
                            style={{ backgroundColor: primaryColor }}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg ring-1 ring-white/10 transition-colors"
                        >
                            <LayersIcon className="h-5 w-5" />
                        </div>
                    )}
                    <h2 className="text-xl font-semibold tracking-tight text-white">
                        {companyName}
                    </h2>
                    <p className="text-xs text-slate-400">
                        {tagline}
                    </p>
                </div>

                {/* Login Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl backdrop-blur-xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error Banner */}
                        {errors.email && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                                <XIcon className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                                <div>{errors.email}</div>
                            </div>
                        )}

                        {/* Email Field */}
                        <div className="space-y-1">
                            <label
                                htmlFor="email"
                                className="block text-xs font-medium text-slate-300"
                            >
                                Email
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                                    <MailIcon className="h-4 w-4" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    required
                                    autoComplete="username"
                                    placeholder="operator@poswms.test"
                                    className="block h-9 w-full rounded-lg border border-slate-700 bg-slate-950/60 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1">
                            <label
                                htmlFor="password"
                                className="block text-xs font-medium text-slate-300"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                                    <LockIcon className="h-4 w-4" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    placeholder="••••••••••••"
                                    className="block h-9 w-full rounded-lg border border-slate-700 bg-slate-950/60 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                                />
                            </div>
                            {errors.password && (
                                <p className="text-xs text-rose-400 mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between text-xs pt-1">
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-800 text-slate-100 focus:ring-slate-500"
                                />
                                <span>Remember me</span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            style={{ backgroundColor: primaryColor }}
                            className="w-full h-9 flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 focus:outline-none disabled:opacity-50 transition-opacity"
                        >
                            {processing ? (
                                <>
                                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRightIcon className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Quick Demo Credentials */}
                    <div className="mt-5 border-t border-slate-800 pt-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                            <ShieldCheckIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>Demo Accounts</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => handleSelectDemoUser('admin@poswms.test')}
                                className="flex flex-col items-start p-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700 transition-colors text-left"
                            >
                                <span className="font-medium text-slate-200">Super Admin</span>
                                <span className="text-[11px] text-slate-400">admin@poswms.test</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectDemoUser('manager@poswms.test')}
                                className="flex flex-col items-start p-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700 transition-colors text-left"
                            >
                                <span className="font-medium text-slate-200">Warehouse Mgr</span>
                                <span className="text-[11px] text-slate-400">manager@poswms.test</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectDemoUser('scanner@poswms.test')}
                                className="flex flex-col items-start p-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700 transition-colors text-left"
                            >
                                <span className="font-medium text-slate-200">Scanner / Picker</span>
                                <span className="text-[11px] text-slate-400">scanner@poswms.test</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectDemoUser('agent@poswms.test')}
                                className="flex flex-col items-start p-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700 transition-colors text-left"
                            >
                                <span className="font-medium text-slate-200">Route Sales Agent</span>
                                <span className="text-[11px] text-slate-400">agent@poswms.test</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
