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
            eyebrow="Inventory Catalog"
            title="Products."
            description="Manage catalog items, packaging units, and tax categories."
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Products' },
            ]}
            actions={
                <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="h-9 px-3.5 rounded-lg bg-brand text-white font-medium text-sm hover:opacity-90 shadow-sm inline-flex items-center gap-2 transition-all"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add Product</span>
                </button>
            }
        >
            <Head title="Products - POS & WMS" />

            {/* Filter Toolbar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search SKU, name..."
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                    <div className="w-full sm:w-52">
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
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                        <thead className="bg-slate-50/75 dark:bg-slate-900/75">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    SKU
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Product
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Packaging & UOM
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Tax
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Status
                                </th>
                            </tr>
                        </thead>

                        {isLoading ? (
                            <TableSkeleton rows={5} columns={5} />
                        ) : (
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                                {products.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <PackageIcon className="h-6 w-6 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">No products found</span>
                                                <span className="text-xs text-slate-500">Try adjusting your search terms or filter.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    products.data.map((product) => (
                                        <tr
                                            key={product.id}
                                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                                    {product.sku}
                                                </span>
                                            </td>

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
                                                            <span className="truncate max-w-sm text-slate-400">
                                                                {product.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

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
                                                            <span className="text-slate-500 font-normal">{uom.conversion_factor}x</span>
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

                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {product.tax_category}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {(parseFloat(product.tax_rate) * 100).toFixed(0)}% Tax
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${product.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    <span className={product.status === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                                                        {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </span>
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
                                            router.get(link.url, {}, { preserveState: true, onFinish: () => setIsLoading(false) });
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

            {/* Create Product Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Add Product"
                description="Create a product catalog item and its base packaging unit."
                confirmText="Save Product"
                onConfirm={handleCreateSubmit}
                isLoading={processing}
                maxWidth="lg"
            >
                <form onSubmit={handleCreateSubmit} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                SKU Code *
                            </label>
                            <input
                                type="text"
                                required
                                value={data.sku}
                                onChange={(e) => setData('sku', e.target.value)}
                                placeholder="e.g. BEV-COLA-500"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                            />
                            {errors.sku && <p className="mt-1 text-xs text-rose-500">{errors.sku}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Product Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="e.g. Sparkling Cola 500ml"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Combobox
                                label="Category *"
                                options={newProductCategoryOptions}
                                value={data.category}
                                onChange={(val) => setData('category', val)}
                                placeholder="Select category"
                                error={errors.category}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tax Category *
                            </label>
                            <select
                                value={data.tax_category}
                                onChange={(e) => setData('tax_category', e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="STANDARD">Standard (12% VAT)</option>
                                <option value="ZERO_RATED">Zero Rated (0%)</option>
                                <option value="EXEMPT">VAT Exempt</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Optional product description"
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            Base Packaging Unit
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Base Unit *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.base_uom_name}
                                    onChange={(e) => setData('base_uom_name', e.target.value)}
                                    placeholder="e.g. Piece"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                                {errors.base_uom_name && <p className="mt-1 text-xs text-rose-500">{errors.base_uom_name}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Barcode
                                </label>
                                <input
                                    type="text"
                                    value={data.base_uom_barcode}
                                    onChange={(e) => setData('base_uom_barcode', e.target.value)}
                                    placeholder="Optional barcode"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Price (₱)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={(data.base_uom_price_cents / 100).toFixed(2)}
                                    onChange={(e) => setData('base_uom_price_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                                    placeholder="0.00"
                                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
