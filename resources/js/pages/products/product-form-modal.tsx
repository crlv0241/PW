import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Modal } from '../../components/ui/modal';
import { Combobox } from '../../components/ui/combobox';
import {
    PlusIcon,
    TrashIcon,
    BarcodeIcon,
    PackageIcon,
    LayersIcon,
    AlertTriangleIcon,
    SparklesIcon,
} from '../../components/ui/icons';
import type { Product, ProductUom } from '../../types/pos';
import { store, update } from '../../actions/App/Http/Controllers/ProductController';

interface TierFormItem {
    id?: number;
    name: string;
    conversion_factor: number;
    barcode: string;
    price_input: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    categories: string[];
}

const COMMON_TIER_PRESETS = ['Pack', 'Box', 'Case', 'Carton', 'Bundle', 'Tray', 'Pallet'];

export function ProductFormModal({ isOpen, onClose, product, categories }: Props) {
    const isEdit = Boolean(product);

    // Master Product Fields
    const [sku, setSku] = useState('');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
    const [taxCategory, setTaxCategory] = useState('STANDARD');
    const [taxRate, setTaxRate] = useState('0.1200');
    const [description, setDescription] = useState('');

    // Base Unit State (Strictly conversion_factor = 1)
    const [baseUomId, setBaseUomId] = useState<number | undefined>(undefined);
    const [baseUomName, setBaseUomName] = useState('Piece');
    const [baseUomBarcode, setBaseUomBarcode] = useState('');
    const [baseUomPriceInput, setBaseUomPriceInput] = useState('0.00');

    // Secondary Packaging Tiers (Multi-UOM)
    const [tiers, setTiers] = useState<TierFormItem[]>([]);

    // Submission & Errors
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

    // Reset or populate state when modal opens or product changes
    useEffect(() => {
        if (!isOpen) return;

        setClientErrors({});
        setServerErrors({});

        if (product) {
            // Edit Mode
            setSku(product.sku);
            setName(product.name);
            setCategory(product.category);
            setStatus(product.status);
            setTaxCategory(product.tax_category);
            setTaxRate(product.tax_rate);
            setDescription(product.description || '');

            const baseUom = product.uoms.find((u) => u.is_base_unit) || product.uoms[0];
            if (baseUom) {
                setBaseUomId(baseUom.id);
                setBaseUomName(baseUom.name);
                setBaseUomBarcode(baseUom.barcode || '');
                setBaseUomPriceInput(baseUom.price_cents !== null ? (baseUom.price_cents / 100).toFixed(2) : '0.00');
            } else {
                setBaseUomId(undefined);
                setBaseUomName('Piece');
                setBaseUomBarcode('');
                setBaseUomPriceInput('0.00');
            }

            const secondaryUoms = product.uoms.filter((u) => !u.is_base_unit);
            setTiers(
                secondaryUoms.map((tier) => ({
                    id: tier.id,
                    name: tier.name,
                    conversion_factor: tier.conversion_factor,
                    barcode: tier.barcode || '',
                    price_input: tier.price_cents !== null ? (tier.price_cents / 100).toFixed(2) : '',
                }))
            );
        } else {
            // Create Mode
            setSku('');
            setName('');
            setCategory(categories[0] || 'Beverages');
            setStatus('ACTIVE');
            setTaxCategory('STANDARD');
            setTaxRate('0.1200');
            setDescription('');

            setBaseUomId(undefined);
            setBaseUomName('Piece');
            setBaseUomBarcode('');
            setBaseUomPriceInput('0.00');
            setTiers([]);
        }
    }, [isOpen, product, categories]);

    // Handle Tax Category change and default rate
    const handleTaxCategoryChange = (val: string) => {
        setTaxCategory(val);
        if (val === 'STANDARD') {
            setTaxRate('0.1200');
        } else {
            setTaxRate('0.0000');
        }
    };

    // Add a new secondary packaging tier
    const handleAddTier = (presetName?: string) => {
        const nextFactor = tiers.length === 0 ? 12 : (tiers[tiers.length - 1].conversion_factor || 1) * 2;
        const basePrice = parseFloat(baseUomPriceInput) || 0;
        const autoTierPrice = basePrice > 0 ? (basePrice * nextFactor).toFixed(2) : '';

        setTiers((prev) => [
            ...prev,
            {
                name: presetName || '',
                conversion_factor: nextFactor,
                barcode: '',
                price_input: autoTierPrice,
            },
        ]);
    };

    // Update a tier property
    const handleUpdateTier = (index: number, field: keyof TierFormItem, value: string | number) => {
        setTiers((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };

            // When conversion factor changes and price wasn't manually detached, recalculate
            if (field === 'conversion_factor') {
                const factor = parseInt(String(value), 10);
                const basePrice = parseFloat(baseUomPriceInput) || 0;
                if (!isNaN(factor) && factor > 0 && basePrice > 0) {
                    next[index].price_input = (basePrice * factor).toFixed(2);
                }
            }

            return next;
        });
    };

    // Auto-calculate tier price from base unit
    const handleRecalculateTierPrice = (index: number) => {
        const tier = tiers[index];
        const basePrice = parseFloat(baseUomPriceInput) || 0;
        const factor = parseInt(String(tier.conversion_factor), 10) || 1;
        const calculated = (basePrice * factor).toFixed(2);
        handleUpdateTier(index, 'price_input', calculated);
    };

    // Remove secondary tier
    const handleRemoveTier = (index: number) => {
        setTiers((prev) => prev.filter((_, i) => i !== index));
    };

    // Client-side validation
    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        if (!sku.trim()) {
            errors.sku = 'SKU Code is required.';
        }
        if (!name.trim()) {
            errors.name = 'Product Name is required.';
        }
        if (!category.trim()) {
            errors.category = 'Category is required.';
        }
        if (!baseUomName.trim()) {
            errors.base_uom_name = 'Base packaging unit name is required.';
        }

        const basePrice = parseFloat(baseUomPriceInput);
        if (isNaN(basePrice) || basePrice < 0) {
            errors.base_uom_price = 'Base unit price must be a non-negative number.';
        }

        // Check duplicate names (case-insensitive)
        const namesMap = new Map<string, string>();
        namesMap.set(baseUomName.trim().toLowerCase(), 'Base Unit');

        const barcodesMap = new Set<string>();
        if (baseUomBarcode.trim()) {
            barcodesMap.add(baseUomBarcode.trim());
        }

        tiers.forEach((tier, index) => {
            if (!tier.name.trim()) {
                errors[`tier_${index}_name`] = 'Packaging tier name is required.';
            } else {
                const norm = tier.name.trim().toLowerCase();
                if (namesMap.has(norm)) {
                    errors[`tier_${index}_name`] = `Duplicate packaging tier name '${tier.name}'. Unit names must be unique.`;
                } else {
                    namesMap.set(norm, `Tier ${index + 1}`);
                }
            }

            const factor = parseInt(String(tier.conversion_factor), 10);
            if (isNaN(factor) || factor < 2) {
                errors[`tier_${index}_factor`] = 'Conversion factor must be an integer $\\ge$ 2.';
            }

            if (tier.barcode.trim()) {
                const b = tier.barcode.trim();
                if (barcodesMap.has(b)) {
                    errors[`tier_${index}_barcode`] = `Duplicate barcode '${b}' in form.`;
                } else {
                    barcodesMap.add(b);
                }
            }

            if (tier.price_input.trim()) {
                const tierPrice = parseFloat(tier.price_input);
                if (isNaN(tierPrice) || tierPrice < 0) {
                    errors[`tier_${index}_price`] = 'Tier price must be a valid non-negative number.';
                }
            }
        });

        setClientErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit handler
    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setServerErrors({});

        const basePriceCents = Math.round(parseFloat(baseUomPriceInput || '0') * 100);

        const uomsPayload = [
            {
                id: isEdit && baseUomId ? baseUomId : undefined,
                name: baseUomName.trim(),
                conversion_factor: 1,
                barcode: baseUomBarcode.trim() || null,
                is_base_unit: true,
                price_cents: basePriceCents >= 0 ? basePriceCents : 0,
            },
            ...tiers.map((t) => ({
                id: t.id,
                name: t.name.trim(),
                conversion_factor: parseInt(String(t.conversion_factor), 10) || 2,
                barcode: t.barcode.trim() || null,
                is_base_unit: false,
                price_cents:
                    t.price_input.trim() && parseFloat(t.price_input) >= 0
                        ? Math.round(parseFloat(t.price_input) * 100)
                        : null,
            })),
        ];

        const payload = {
            sku: sku.trim().toUpperCase(),
            name: name.trim(),
            category: category.trim(),
            status,
            tax_category: taxCategory,
            tax_rate: parseFloat(taxRate) || 0.12,
            description: description.trim() || null,
            uoms: uomsPayload,
        };

        if (isEdit && product) {
            router.put(update.url(product.id), payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    setServerErrors(errs);
                },
            });
        } else {
            router.post(store.url(), payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    setServerErrors(errs);
                },
            });
        }
    };

    const categoryOptions = [
        ...categories.map((c) => ({ value: c, label: c })),
        { value: 'Beverages', label: 'Beverages' },
        { value: 'Snacks', label: 'Snacks' },
        { value: 'Dairy', label: 'Dairy' },
        { value: 'Canned Goods', label: 'Canned Goods' },
        { value: 'Condiments', label: 'Condiments' },
        { value: 'Bakery', label: 'Bakery' },
        { value: 'Household', label: 'Household' },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? `Edit Product: ${product?.name}` : 'Add Product'}
            description="Manage catalog item details, barcodes, and multi-tier packaging conversions."
            confirmText={isEdit ? 'Update Product' : 'Create Product'}
            onConfirm={handleSubmit}
            isLoading={isSubmitting}
            maxWidth="4xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6 pt-1">
                {/* Server Error Alert Banner */}
                {Object.keys(serverErrors).length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        <div className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100 mb-1">
                            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>Please resolve the following errors:</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5">
                            {Object.entries(serverErrors).map(([key, msg]) => (
                                <li key={key}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Section 1: Product Master Information */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                        <PackageIcon className="h-4 w-4 text-slate-500" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            General Product Master
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                SKU Code *
                            </label>
                            <input
                                type="text"
                                required
                                value={sku}
                                onChange={(e) => setSku(e.target.value.toUpperCase())}
                                placeholder="e.g. BEV-COLA-500"
                                className={`h-9 w-full rounded-lg border bg-white px-3 text-sm font-mono text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                                    clientErrors.sku || serverErrors.sku
                                        ? 'border-rose-400 dark:border-rose-600'
                                        : 'border-slate-300 dark:border-slate-700'
                                }`}
                            />
                            {(clientErrors.sku || serverErrors.sku) && (
                                <p className="mt-1 text-xs text-rose-500">{clientErrors.sku || serverErrors.sku}</p>
                            )}
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Product Commercial Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Sparkling Cola 500ml Bottle"
                                className={`h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                                    clientErrors.name || serverErrors.name
                                        ? 'border-rose-400 dark:border-rose-600'
                                        : 'border-slate-300 dark:border-slate-700'
                                }`}
                            />
                            {(clientErrors.name || serverErrors.name) && (
                                <p className="mt-1 text-xs text-rose-500">{clientErrors.name || serverErrors.name}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <Combobox
                                label="Category *"
                                options={categoryOptions}
                                value={category}
                                onChange={(val) => setCategory(val)}
                                placeholder="Select category"
                                error={clientErrors.category || serverErrors.category}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tax Category *
                            </label>
                            <select
                                value={taxCategory}
                                onChange={(e) => handleTaxCategoryChange(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="STANDARD">Standard (12% VAT)</option>
                                <option value="ZERO_RATED">Zero Rated (0%)</option>
                                <option value="EXEMPT">VAT Exempt (0%)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Status *
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="ACTIVE">Active (In Catalog)</option>
                                <option value="INACTIVE">Inactive (Archived)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional technical specifications, ingredients, or storage guidelines"
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                </div>

                {/* Section 2: Indivisible Base Unit */}
                <div className="rounded-xl border border-brand-subtle/80 bg-brand-subtle/20 p-4 dark:border-brand-subtle/30 dark:bg-brand-subtle/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                                1
                            </span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                Indivisible Base Unit
                            </h4>
                            <span className="rounded bg-brand-subtle px-2 py-0.5 text-[10px] font-semibold text-brand">
                                Factor: 1x (Lowest Common Denominator)
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        The lowest indivisible inventory unit. All stock transfers, warehouse movements, and physical balances are tracked in this unit.
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Base Unit Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={baseUomName}
                                onChange={(e) => setBaseUomName(e.target.value)}
                                placeholder="e.g. Piece, Bottle, Can"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {clientErrors.base_uom_name && (
                                <p className="mt-1 text-xs text-rose-500">{clientErrors.base_uom_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Base Barcode
                            </label>
                            <div className="relative">
                                <BarcodeIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={baseUomBarcode}
                                    onChange={(e) => setBaseUomBarcode(e.target.value)}
                                    placeholder="e.g. 480001664401"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm font-mono text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Retail Selling Price (₱)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={baseUomPriceInput}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setBaseUomPriceInput(e.target.value)}
                                placeholder="0.00"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Packaging Tiers & Multi-UOM */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <LayersIcon className="h-4 w-4 text-slate-500" />
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Secondary Packaging Tiers (Multi-UOM)
                                </h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 hidden sm:inline">Quick Add:</span>
                            {COMMON_TIER_PRESETS.slice(0, 4).map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleAddTier(preset)}
                                    className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                                >
                                    +{preset}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => handleAddTier()}
                                className="h-7 px-2.5 rounded-md bg-brand text-white text-[11px] font-medium hover:opacity-90 transition inline-flex items-center gap-1 shadow-xs"
                            >
                                <PlusIcon className="h-3.5 w-3.5" />
                                <span>Custom Tier</span>
                            </button>
                        </div>
                    </div>

                    {tiers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                No secondary packaging tiers defined. Product will only be sold and counted in single {baseUomName || 'units'}.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleAddTier('Box')}
                                className="mt-2.5 h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-xs inline-flex items-center gap-1.5"
                            >
                                <PlusIcon className="h-3.5 w-3.5" />
                                <span>Add Packaging Tier (e.g. Box, Case)</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {tiers.map((tier, idx) => {
                                const basePrice = parseFloat(baseUomPriceInput) || 0;
                                const factor = parseInt(String(tier.conversion_factor), 10) || 1;
                                const standardPrice = basePrice * factor;
                                const currentPrice = parseFloat(tier.price_input) || 0;
                                const discountPct =
                                    standardPrice > 0 && currentPrice > 0 && currentPrice < standardPrice
                                        ? (((standardPrice - currentPrice) / standardPrice) * 100).toFixed(1)
                                        : null;

                                return (
                                    <div
                                        key={idx}
                                        className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition hover:border-slate-300"
                                    >
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                                            {/* Tier Name */}
                                            <div className="sm:col-span-3">
                                                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                                    Tier Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={tier.name}
                                                    onChange={(e) => handleUpdateTier(idx, 'name', e.target.value)}
                                                    placeholder="e.g. Box, Case"
                                                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                />
                                                {clientErrors[`tier_${idx}_name`] && (
                                                    <p className="mt-1 text-[11px] text-rose-500">
                                                        {clientErrors[`tier_${idx}_name`]}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Conversion Factor */}
                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                                    Contains ({baseUomName || 'Base'}) *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        required
                                                        min="2"
                                                        step="1"
                                                        value={tier.conversion_factor}
                                                        onChange={(e) =>
                                                            handleUpdateTier(idx, 'conversion_factor', e.target.value)
                                                        }
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                                                        x
                                                    </span>
                                                </div>
                                                {clientErrors[`tier_${idx}_factor`] && (
                                                    <p className="mt-1 text-[11px] text-rose-500">
                                                        {clientErrors[`tier_${idx}_factor`]}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Barcode */}
                                            <div className="sm:col-span-3">
                                                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                                    Tier Barcode
                                                </label>
                                                <div className="relative">
                                                    <BarcodeIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={tier.barcode}
                                                        onChange={(e) => handleUpdateTier(idx, 'barcode', e.target.value)}
                                                        placeholder="Case ITF/EAN barcode"
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white pl-7 pr-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                                {clientErrors[`tier_${idx}_barcode`] && (
                                                    <p className="mt-1 text-[11px] text-rose-500">
                                                        {clientErrors[`tier_${idx}_barcode`]}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Tier Price & Auto Calculate */}
                                            <div className="sm:col-span-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="block text-[11px] font-medium text-slate-500">
                                                        Tier Price (₱)
                                                    </label>
                                                    {standardPrice > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRecalculateTierPrice(idx)}
                                                            className="text-[10px] font-medium text-brand hover:underline inline-flex items-center gap-0.5"
                                                            title={`Set to standard: ₱${standardPrice.toFixed(2)}`}
                                                        >
                                                            <SparklesIcon className="h-3 w-3" />
                                                            <span>Std: ₱{standardPrice.toFixed(2)}</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={tier.price_input}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => handleUpdateTier(idx, 'price_input', e.target.value)}
                                                        placeholder="0.00"
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                    />
                                                    {discountPct && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                            -{discountPct}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="sm:col-span-1 flex items-end justify-center pt-2 sm:pt-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTier(idx)}
                                                    className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition inline-flex items-center justify-center"
                                                    title="Remove Packaging Tier"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </form>
        </Modal>
    );
}
