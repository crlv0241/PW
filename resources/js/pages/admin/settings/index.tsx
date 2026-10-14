import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import {
    SettingsIcon,
    PaletteIcon,
    ImageIcon,
    SparklesIcon,
    CheckIcon,
    SpinnerIcon,
    LayersIcon,
    UsersIcon,
} from '../../../components/ui/icons';
import { FileDropzone } from '../../../components/ui/file-dropzone';

interface PaletteOption {
    id: string;
    name: string;
    primary: string;
    accent: string;
    description: string;
}

interface SettingsData {
    id: number;
    company_name: string;
    tagline: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    accent_color: string;
    theme_palette: string;
    dark_mode_default: boolean;
}

interface Props {
    settings: SettingsData;
    palettes: PaletteOption[];
}

export default function SystemSettings({ settings, palettes }: Props) {
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [faviconFile, setFaviconFile] = useState<File | null>(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [removeFavicon, setRemoveFavicon] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        company_name: settings.company_name,
        tagline: settings.tagline,
        primary_color: settings.primary_color,
        accent_color: settings.accent_color,
        theme_palette: settings.theme_palette,
        dark_mode_default: settings.dark_mode_default,
    });

    // Select a preset palette
    const handleSelectPalette = (palette: PaletteOption) => {
        setData((prev) => ({
            ...prev,
            theme_palette: palette.id,
            primary_color: palette.primary,
            accent_color: palette.accent,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Use Inertia router with FormData for multipart uploads
        const formData = new FormData();
        formData.append('company_name', data.company_name);
        formData.append('tagline', data.tagline);
        formData.append('primary_color', data.primary_color);
        formData.append('accent_color', data.accent_color);
        formData.append('theme_palette', data.theme_palette);
        formData.append('dark_mode_default', data.dark_mode_default ? '1' : '0');

        if (logoFile) {
            formData.append('logo', logoFile);
        }
        if (removeLogo) {
            formData.append('remove_logo', '1');
        }

        if (faviconFile) {
            formData.append('favicon', faviconFile);
        }
        if (removeFavicon) {
            formData.append('remove_favicon', '1');
        }

        router.post('/admin/settings', formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setLogoFile(null);
                setFaviconFile(null);
                setRemoveLogo(false);
                setRemoveFavicon(false);
            },
        });
    };

    return (
        <AppLayout
            title="System Settings & Visual Identity"
            breadcrumbs={[
                { label: 'Admin Console', href: '/admin/users' },
                { label: 'Branding & Theme Settings' },
            ]}
        >
            <Head title="System Settings - Super Admin" />

            <div className="space-y-6 max-w-5xl">
                {/* Admin Sub-navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                    >
                        <UsersIcon className="h-3.5 w-3.5" />
                        <span>Users & RBAC Access</span>
                    </Link>
                    <Link
                        href="/admin/settings"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm"
                    >
                        <PaletteIcon className="h-3.5 w-3.5" />
                        <span>Branding, Logo & Colors</span>
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Live Interactive Branding Preview Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <SparklesIcon className="h-4 w-4 text-indigo-500" />
                            <span>Live Branding & Theme Preview</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            Real-time simulation of interface styling
                        </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60 flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Simulated Brand */}
                        <div className="flex items-center gap-3.5">
                            {logoFile ? (
                                <img
                                    src={URL.createObjectURL(logoFile)}
                                    alt="Logo Preview"
                                    className="h-10 w-10 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shadow-sm"
                                />
                            ) : settings.logo_url && !removeLogo ? (
                                <img
                                    src={settings.logo_url}
                                    alt="Current Logo"
                                    className="h-10 w-10 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shadow-sm"
                                />
                            ) : (
                                <div
                                    style={{ backgroundColor: data.primary_color }}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-md transition-colors"
                                >
                                    <LayersIcon className="h-5 w-5" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                    {data.company_name || 'APEX POS & WMS'}
                                </h3>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {data.tagline || 'Enterprise Core v1.0'}
                                </p>
                            </div>
                        </div>

                        {/* Interactive Sample Elements */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                style={{
                                    borderColor: `${data.accent_color}40`,
                                    backgroundColor: `${data.accent_color}15`,
                                    color: data.accent_color,
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all"
                            >
                                <span
                                    style={{ backgroundColor: data.accent_color }}
                                    className="h-1.5 w-1.5 rounded-full"
                                />
                                <span>Accent Badge</span>
                            </span>

                            <button
                                type="button"
                                style={{ backgroundColor: data.primary_color }}
                                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                            >
                                Primary Action
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Corporate Details */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <SettingsIcon className="h-4 w-4 text-indigo-500" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Corporate Identity & System Titles
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Organization / Company Name
                            </label>
                            <input
                                type="text"
                                required
                                value={data.company_name}
                                onChange={(e) => setData('company_name', e.target.value)}
                                placeholder="e.g. APEX Logistics & Retail Corp"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {errors.company_name && (
                                <p className="mt-1 text-xs text-rose-500">{errors.company_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                System Tagline / Subtitle
                            </label>
                            <input
                                type="text"
                                required
                                value={data.tagline}
                                onChange={(e) => setData('tagline', e.target.value)}
                                placeholder="e.g. Enterprise Core v1.0"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {errors.tagline && (
                                <p className="mt-1 text-xs text-rose-500">{errors.tagline}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Drag & Drop Visual Assets Uploaders */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <ImageIcon className="h-4 w-4 text-indigo-500" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Branding Assets (Drag & Drop)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Logo Upload Zone */}
                        <FileDropzone
                            label="System Logo"
                            description="Drag & drop PNG, JPG, WebP, or SVG"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            currentUrl={settings.logo_url}
                            file={logoFile}
                            onFileSelect={(f) => {
                                setLogoFile(f);
                                setRemoveLogo(false);
                            }}
                            onRemoveCurrent={() => setRemoveLogo(true)}
                            isRemoved={removeLogo}
                            maxSizeMb={2}
                            dimensionsHint="Recommended: 512x512px or SVG"
                        />

                        {/* Favicon Upload Zone */}
                        <FileDropzone
                            label="Browser Favicon"
                            description="Drag & drop .ico, .png, or .svg"
                            accept=".ico,image/x-icon,image/png,image/svg+xml"
                            currentUrl={settings.favicon_url}
                            file={faviconFile}
                            onFileSelect={(f) => {
                                setFaviconFile(f);
                                setRemoveFavicon(false);
                            }}
                            onRemoveCurrent={() => setRemoveFavicon(true)}
                            isRemoved={removeFavicon}
                            maxSizeMb={1}
                            dimensionsHint="Recommended: 32x32px or 64x64px"
                        />
                    </div>
                </div>

                {/* 4. Enterprise Theme Color Schemes */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <PaletteIcon className="h-4 w-4 text-indigo-500" />
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Enterprise Color Scheme & Palettes
                            </h2>
                        </div>
                        <span className="text-xs text-slate-500">
                            Select a curated corporate palette or fine-tune custom hex values
                        </span>
                    </div>

                    {/* Preset Palettes Grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {palettes.map((palette) => {
                            const isSelected = data.theme_palette === palette.id;
                            return (
                                <button
                                    key={palette.id}
                                    type="button"
                                    onClick={() => handleSelectPalette(palette)}
                                    className={`relative flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-950/40'
                                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex w-full items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                            {palette.name}
                                        </span>
                                        {isSelected && (
                                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                                                <CheckIcon className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Swatch bars */}
                                    <div className="flex items-center gap-2 w-full mb-2">
                                        <div
                                            style={{ backgroundColor: palette.primary }}
                                            className="h-5 flex-1 rounded-md shadow-sm"
                                        />
                                        <div
                                            style={{ backgroundColor: palette.accent }}
                                            className="h-5 w-8 rounded-md shadow-sm"
                                        />
                                    </div>

                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {palette.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Hex Color Fine-Tuning */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Custom Primary Color
                            </label>
                            <div className="flex items-center gap-2.5">
                                <input
                                    type="color"
                                    value={data.primary_color}
                                    onChange={(e) => {
                                        setData('primary_color', e.target.value);
                                        setData('theme_palette', 'custom');
                                    }}
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                                />
                                <input
                                    type="text"
                                    value={data.primary_color}
                                    onChange={(e) => {
                                        setData('primary_color', e.target.value);
                                        setData('theme_palette', 'custom');
                                    }}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 uppercase focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                            {errors.primary_color && (
                                <p className="mt-1 text-xs text-rose-500">{errors.primary_color}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Custom Accent Color
                            </label>
                            <div className="flex items-center gap-2.5">
                                <input
                                    type="color"
                                    value={data.accent_color}
                                    onChange={(e) => {
                                        setData('accent_color', e.target.value);
                                        setData('theme_palette', 'custom');
                                    }}
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                                />
                                <input
                                    type="text"
                                    value={data.accent_color}
                                    onChange={(e) => {
                                        setData('accent_color', e.target.value);
                                        setData('theme_palette', 'custom');
                                    }}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 uppercase focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                            {errors.accent_color && (
                                <p className="mt-1 text-xs text-rose-500">{errors.accent_color}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Form Submit Bar */}
                <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        {processing ? (
                            <>
                                <SpinnerIcon className="h-4 w-4 animate-spin" />
                                <span>Applying Changes...</span>
                            </>
                        ) : (
                            <>
                                <CheckIcon className="h-4 w-4" />
                                <span>Save System Settings</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
);
}
