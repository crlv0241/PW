import React, { useState, useEffect } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../../layouts/app-layout';
import { Combobox } from '../../components/ui/combobox';
import { Modal } from '../../components/ui/modal';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
    SearchIcon,
    PlusIcon,
    PackageIcon,
    BarcodeIcon,
    FilterIcon,
    XIcon,
} from '../../components/ui/icons';
import type { Product, PaginatedData } from '../../types/pos';

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
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form handling for creating new product
    const { data, setData, post, processing, errors, reset } = useForm({
        sku: '',
        name: '',
        category: '',
        tax_category: 'STANDARD',
        tax_rate: '0.1200',
        description: '',
        base_uom_name: 'Piece',
        base_uom_barcode: '',
        base_uom_price_cents: 0,
    });

    // 300ms debounced search syncing with Inertia URL query
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

    const handleCreateSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        post('/products', {
            onSuccess: () => {
                setIsCreateOpen(false);
                reset();
            },
        });
    };

    const categoryOptions = [
        { value: '', label: 'All Categories' },
        ...categories.map((c) => ({ value: c, label: c })),
    ];

    const newProductCategoryOptions = [
        ...categories.map((c) => ({ value: c, label: c })),
        { value: 'Beverages', label: 'Beverages' },
        { value: 'Snacks', label: 'Snacks' },
        { value: 'Dairy', label: 'Dairy' },
        { value: 'Canned Goods', label: 'Canned Goods' },
        { value: 'Condiments', label: 'Condiments' },
    ];

    return (
        <AppLayout
            title="Master Product Catalog & Multi-UOM"
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Products & Multi-UOM' },
            ]}
        >
            <Head title="Product Catalog - POS & WMS" />

            {/* Filter and Action Bar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search SKU, barcode, name..."
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
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
                            placeholder="Filter by Category"
                        />
                    </div>

                    {(search || category) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setCategory('');
                            }}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <FilterIcon className="h-3 w-3" />
                            <span>Clear Filters</span>
                        </button>
                    )}
                </div>

                {/* Add Product Button */}
                <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create Product</span>
                </button>
            </div>

            {/* Products Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                    <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/75 dark:text-slate-400">
                        <tr>
                            <th scope="col" className="px-5 py-3.5">
                                SKU / Code
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Product Details
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Multi-UOM Tiers
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Tax Classification
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Status
                            </th>
                        </tr>
                    </thead>

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} />
                    ) : (
                        <tbody className="divide-y divide-slate-100 bg-white text-xs dark:divide-slate-800 dark:bg-slate-900">
                            {products.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <PackageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                            <span className="font-medium">No products found matching criteria</span>
                                            <span className="text-[11px] text-slate-400">Try adjusting your search terms or filter.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.data.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                    >
                                        <td className="whitespace-nowrap px-5 py-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                            {product.sku}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {product.name}
                                                </span>
                                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 font-medium">
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
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {product.uoms.map((uom) => (
                                                    <div
                                                        key={uom.id}
                                                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border ${
                                                            uom.is_base_unit
                                                                ? 'border-indigo-200 bg-indigo-50/50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                                                                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <span>{uom.name}</span>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                            (x{uom.conversion_factor})
                                                        </span>
                                                        {uom.barcode && (
                                                            <BarcodeIcon className="h-3 w-3 text-slate-400" />
                                                        )}
                                                        {uom.price_cents !== null && (
                                                            <span className="ml-1 font-semibold text-slate-900 dark:text-slate-100">
                                                                ₱{(uom.price_cents / 100).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {product.tax_category}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    {(parseFloat(product.tax_rate) * 100).toFixed(0)}% Tax
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                    product.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}
                                            >
                                                {product.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    )}
                </table>

                {/* Pagination Controls */}
                {products.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{products.from}</span> to{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{products.to}</span> of{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{products.total}</span> products
                        </div>
                        <div className="flex items-center gap-1.5">
                            {products.links.map((link, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={!link.url}
                                    onClick={() => {
                                        if (link.url) {
                                            setIsLoading(true);
                                            router.get(link.url, {}, { preserveState: true, onFinish: () => setIsLoading(false) });
                                        }
                                    }}
                                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                        link.active
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : link.url
                                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                            : 'cursor-not-allowed opacity-40 text-slate-400'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Product Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create New Product"
                description="Register a new master catalog item with its base indivisible packaging unit."
                confirmText="Save Product"
                onConfirm={handleCreateSubmit}
                isLoading={processing}
                maxWidth="xl"
            >
                <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                SKU Code *
                            </label>
                            <input
                                type="text"
                                value={data.sku}
                                onChange={(e) => setData('sku', e.target.value)}
                                placeholder="e.g. BEV-COLA-500"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku}</p>}
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Product Name *
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="e.g. Sparkling Cola 500ml Bottle"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Combobox
                                label="Category *"
                                options={newProductCategoryOptions}
                                value={data.category}
                                onChange={(val) => setData('category', val)}
                                placeholder="Select category..."
                                error={errors.category}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Tax Category *
                            </label>
                            <select
                                value={data.tax_category}
                                onChange={(e) => setData('tax_category', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="STANDARD">Standard (12% VAT)</option>
                                <option value="ZERO_RATED">Zero Rated (0%)</option>
                                <option value="EXEMPT">VAT Exempt</option>
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2">
                            Base Indivisible Unit of Measure (Conversion Factor = 1)
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                    Base Unit Name *
                                </label>
                                <input
                                    type="text"
                                    value={data.base_uom_name}
                                    onChange={(e) => setData('base_uom_name', e.target.value)}
                                    placeholder="e.g. Piece, Can, Bottle"
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                                {errors.base_uom_name && <p className="mt-1 text-xs text-red-600">{errors.base_uom_name}</p>}
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                    Barcode (UPC / EAN)
                                </label>
                                <input
                                    type="text"
                                    value={data.base_uom_barcode}
                                    onChange={(e) => setData('base_uom_barcode', e.target.value)}
                                    placeholder="Scan or enter barcode"
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                                />
                                {errors.base_uom_barcode && <p className="mt-1 text-xs text-red-600">{errors.base_uom_barcode}</p>}
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                    Base Price (₱)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={(data.base_uom_price_cents / 100).toFixed(2)}
                                    onChange={(e) => setData('base_uom_price_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                                    placeholder="0.00"
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
