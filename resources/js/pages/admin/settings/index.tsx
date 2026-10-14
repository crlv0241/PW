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
            title="Branding & Theme"
            description="Configure organization details, logos, and color palette."
            breadcrumbs={[
                { label: 'Admin', href: '/admin/users' },
                { label: 'Branding & Theme' },
            ]}
        >
            <Head title="Branding & Theme - Admin" />

            <div className="space-y-6 max-w-5xl">
                {/* Admin Sub-navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                    >
                        <UsersIcon className="h-3.5 w-3.5" />
                        <span>Users</span>
                    </Link>
                    <Link
                        href="/admin/settings"
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    >
                        <PaletteIcon className="h-3.5 w-3.5" />
                        <span>Branding & Theme</span>
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 1. Live Theme Preview Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Interface Preview
                            </h2>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Live preview of selected colors
                            </span>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Simulated Brand */}
                            <div className="flex items-center gap-3">
                                {logoFile ? (
                                    <img
                                        src={URL.createObjectURL(logoFile)}
                                        alt="Logo Preview"
                                        className="h-9 w-9 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shadow-sm"
                                    />
                                ) : settings.logo_url && !removeLogo ? (
                                    <img
                                        src={settings.logo_url}
                                        alt="Current Logo"
                                        className="h-9 w-9 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shadow-sm"
                                    />
                                ) : (
                                    <div
                                        style={{ backgroundColor: data.primary_color }}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-colors"
                                    >
                                        <LayersIcon className="h-4 w-4" />
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {data.company_name || 'APEX POS & WMS'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {data.tagline || 'Distribution & Retail'}
                                    </p>
                                </div>
                            </div>

                            {/* Sample Elements */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span
                                    style={{
                                        borderColor: `${data.accent_color}40`,
                                        backgroundColor: `${data.accent_color}15`,
                                        color: data.accent_color,
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
                                >
                                    <span
                                        style={{ backgroundColor: data.accent_color }}
                                        className="h-1.5 w-1.5 rounded-full"
                                    />
                                    <span>Sample Badge</span>
                                </span>

                                <button
                                    type="button"
                                    style={{ backgroundColor: data.primary_color }}
                                    className="h-9 px-3.5 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                                >
                                    Sample Button
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Organization Profile */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Organization Profile
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Company / Organization Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.company_name}
                                    onChange={(e) => setData('company_name', e.target.value)}
                                    placeholder="e.g. APEX Logistics"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                                {errors.company_name && (
                                    <p className="mt-1 text-xs text-rose-500">{errors.company_name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    System Tagline / Description
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.tagline}
                                    onChange={(e) => setData('tagline', e.target.value)}
                                    placeholder="e.g. Retail & Distribution"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                                {errors.tagline && (
                                    <p className="mt-1 text-xs text-rose-500">{errors.tagline}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. Drag & Drop Visual Assets */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Brand Assets
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {/* Logo Upload Zone */}
                            <FileDropzone
                                label="System Logo"
                                description="PNG, JPG, WebP, or SVG"
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
                                description=".ico, .png, or .svg"
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

                    {/* 4. Color Palettes */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Color Scheme
                            </h2>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Choose a preset palette or set custom hex colors
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
                                        className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                                            isSelected
                                                ? 'border-slate-900 bg-slate-50/80 shadow-sm ring-1 ring-slate-900 dark:border-slate-200 dark:bg-slate-800 dark:ring-slate-200'
                                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex w-full items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                                {palette.name}
                                            </span>
                                            {isSelected && (
                                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                                                    <CheckIcon className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Swatch bars */}
                                        <div className="flex items-center gap-2 w-full mb-2">
                                            <div
                                                style={{ backgroundColor: palette.primary }}
                                                className="h-4 flex-1 rounded shadow-sm"
                                            />
                                            <div
                                                style={{ backgroundColor: palette.accent }}
                                                className="h-4 w-7 rounded shadow-sm"
                                            />
                                        </div>

                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {palette.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Hex Color Fine-Tuning */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Primary Color
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={data.primary_color}
                                        onChange={(e) => {
                                            setData('primary_color', e.target.value);
                                            setData('theme_palette', 'custom');
                                        }}
                                        className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                    <input
                                        type="text"
                                        value={data.primary_color}
                                        onChange={(e) => {
                                            setData('primary_color', e.target.value);
                                            setData('theme_palette', 'custom');
                                        }}
                                        className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 uppercase shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                {errors.primary_color && (
                                    <p className="mt-1 text-xs text-rose-500">{errors.primary_color}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Accent Color
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={data.accent_color}
                                        onChange={(e) => {
                                            setData('accent_color', e.target.value);
                                            setData('theme_palette', 'custom');
                                        }}
                                        className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                    <input
                                        type="text"
                                        value={data.accent_color}
                                        onChange={(e) => {
                                            setData('accent_color', e.target.value);
                                            setData('theme_palette', 'custom');
                                        }}
                                        className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 uppercase shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                {errors.accent_color && (
                                    <p className="mt-1 text-xs text-rose-500">{errors.accent_color}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Submit Bar */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={processing}
                            className="h-9 px-4 rounded-lg bg-slate-900 text-sm font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                        >
                            {processing ? (
                                <>
                                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="h-4 w-4" />
                                    <span>Save Settings</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
);
}
