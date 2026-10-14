import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { AppLayout } from '../../layouts/app-layout';
import { Combobox } from '../../components/ui/combobox';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
    SearchIcon,
    PlusIcon,
    PackageIcon,
    FilterIcon,
    XIcon,
    EditIcon,
    PowerIcon,
    BarcodeIcon,
} from '../../components/ui/icons';
import { ProductFormModal } from './product-form-modal';
import type { Product, PaginatedData } from '../../types/pos';
import { toggleStatus } from '../../actions/App/Http/Controllers/ProductController';

interface Props {
    products: PaginatedData<Product>;
    categories: string[];
    filters: {
        search: string;
        category: string;
    };
}

export default function ProductsIndex({ products, categories, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || '');
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Debounced filter URL synchronization
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== filters.search || category !== filters.category) {
                setIsLoading(true);
                router.get(
                    '/products',
                    {
                        ...(search ? { search } : {}),
                        ...(category ? { category } : {}),
                    },
                    {
                        preserveState: true,
                        replace: true,
                        onFinish: () => setIsLoading(false),
                    }
                );
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [search, category, filters.search, filters.category]);

    const handleOpenCreate = () => {
        setSelectedProduct(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setSelectedProduct(product);
        setIsFormModalOpen(true);
    };

    const handleToggleStatus = (product: Product) => {
        router.patch(toggleStatus.url(product.id), {}, { preserveScroll: true });
    };

    const categoryOptions = [
        { value: '', label: 'All Categories' },
        ...categories.map((c) => ({ value: c, label: c })),
    ];

    // Helper: calculate multi-UOM stock breakdown
    const renderStockDisplay = (product: Product) => {
        const total = typeof product.total_stock === 'number'
            ? product.total_stock
            : typeof product.total_stock === 'string'
            ? parseInt(product.total_stock, 10)
            : 0;

        const baseUom = product.uoms.find((u) => u.is_base_unit) || product.uoms[0];
        const baseName = baseUom ? baseUom.name : 'pcs';

        // Find largest tier with factor > 1
        const higherTiers = product.uoms.filter((u) => u.conversion_factor > 1);
        const largestTier = higherTiers.length > 0
            ? [...higherTiers].sort((a, b) => b.conversion_factor - a.conversion_factor)[0]
            : null;

        if (total === 0) {
            return (
                <div className="text-xs text-slate-400">
                    <span className="font-mono">0</span> {baseName}
                </div>
            );
        }

        if (!largestTier || total < largestTier.conversion_factor) {
            return (
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="font-mono">{total.toLocaleString()}</span> {baseName}
                </div>
            );
        }

        const tierCount = Math.floor(total / largestTier.conversion_factor);
        const remainder = total % largestTier.conversion_factor;

        return (
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 font-mono">
                    {total.toLocaleString()} {baseName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tierCount} {largestTier.name}{tierCount > 1 ? 's' : ''}
                    {remainder > 0 ? `, ${remainder} ${baseName}` : ''}
                </span>
            </div>
        );
    };

    return (
        <AppLayout
            eyebrow="Inventory Catalog"
            title="Products & Packaging Units"
            description="Manage master catalog items, multi-tier packaging conversions, barcodes, and pricing."
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Products' },
            ]}
            actions={
                <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="h-9 px-3.5 rounded-lg bg-brand text-white font-medium text-sm hover:opacity-90 shadow-xs inline-flex items-center gap-2 transition-all"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add Product</span>
                </button>
            }
        >
            <Head title="Products & Packaging Units - POS & WMS" />

            {/* Filter Toolbar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-80">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search SKU, name, barcode..."
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Category Combobox Filter */}
                    <div className="w-full sm:w-56">
                        <Combobox
                            options={categoryOptions}
                            value={category}
                            onChange={(val) => setCategory(val)}
                            placeholder="All Categories"
                        />
                    </div>

                    {(search || category) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setCategory('');
                            }}
                            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        >
                            <FilterIcon className="h-3.5 w-3.5" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Products Table Card */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                        <thead className="bg-slate-50/75 dark:bg-slate-900/75">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    SKU
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Product Name
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Packaging & UOM Tiers
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Stock on Hand
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Tax
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Status
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        {isLoading ? (
                            <TableSkeleton rows={5} columns={7} />
                        ) : (
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                                {products.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <PackageIcon className="h-6 w-6 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    No products found
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Try adjusting your search terms or filter.
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    products.data.map((product) => (
                                        <tr
                                            key={product.id}
                                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                        >
                                            {/* SKU */}
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                                    {product.sku}
                                                </span>
                                            </td>

                                            {/* Product Name & Category */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {product.name}
                                                    </span>
                                                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {product.category}
                                                        </span>
                                                        {product.description && (
                                                            <span className="truncate max-w-xs text-slate-400">
                                                                {product.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Packaging & UOMs */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {product.uoms.map((uom) => (
                                                        <span
                                                            key={uom.id}
                                                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border ${
                                                                uom.is_base_unit
                                                                    ? 'border-brand-subtle bg-brand-subtle text-brand'
                                                                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <span>{uom.name}</span>
                                                            <span className="text-slate-400">·</span>
                                                            <span className="text-slate-500 font-normal">
                                                                {uom.conversion_factor}x
                                                            </span>
                                                            {uom.barcode && (
                                                                <span title={`Barcode: ${uom.barcode}`}>
                                                                    <BarcodeIcon className="h-3 w-3 text-slate-400" />
                                                                </span>
                                                            )}
                                                            {uom.price_cents !== null && (
                                                                <>
                                                                    <span className="text-slate-400">·</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                        ₱{(uom.price_cents / 100).toFixed(2)}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Stock on Hand */}
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                {renderStockDisplay(product)}
                                            </td>

                                            {/* Tax */}
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {product.tax_category}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {(parseFloat(product.tax_rate) * 100).toFixed(0)}% Tax
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            product.status === 'ACTIVE'
                                                                ? 'bg-emerald-500'
                                                                : 'bg-slate-400'
                                                        }`}
                                                    />
                                                    <span
                                                        className={
                                                            product.status === 'ACTIVE'
                                                                ? 'text-emerald-700 dark:text-emerald-400'
                                                                : 'text-slate-500 dark:text-slate-400'
                                                        }
                                                    >
                                                        {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(product)}
                                                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition inline-flex items-center justify-center"
                                                        title="Edit Product & Packaging UOMs"
                                                    >
                                                        <EditIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleStatus(product)}
                                                        className={`h-8 w-8 rounded-lg transition inline-flex items-center justify-center ${
                                                            product.status === 'ACTIVE'
                                                                ? 'text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-400'
                                                                : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 dark:hover:text-emerald-400'
                                                        }`}
                                                        title={
                                                            product.status === 'ACTIVE'
                                                                ? 'Deactivate Product'
                                                                : 'Activate Product'
                                                        }
                                                    >
                                                        <PowerIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        )}
                    </table>
                </div>

                {/* Pagination Controls */}
                {products.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-900 dark:text-slate-100">{products.from}</span> to{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">{products.to}</span> of{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">{products.total}</span> products
                        </div>
                        <div className="flex items-center gap-1">
                            {products.links.map((link, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={!link.url}
                                    onClick={() => {
                                        if (link.url) {
                                            setIsLoading(true);
                                            router.get(
                                                link.url,
                                                {},
                                                { preserveState: true, onFinish: () => setIsLoading(false) }
                                            );
                                        }
                                    }}
                                    className={`h-7 px-2.5 rounded-md text-xs font-medium transition ${
                                        link.active
                                            ? 'bg-brand text-white shadow-xs'
                                            : link.url
                                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            : 'cursor-not-allowed opacity-40 text-slate-400'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Unified Add / Edit Product Modal */}
            <ProductFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                product={selectedProduct}
                categories={categories}
            />
        </AppLayout>
    );
}
