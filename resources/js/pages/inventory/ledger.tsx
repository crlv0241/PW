import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { AppLayout } from '../../layouts/app-layout';
import { Combobox } from '../../components/ui/combobox';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
    LayersIcon,
    FilterIcon,
    WarehouseIcon,
    TruckIcon,
} from '../../components/ui/icons';
import type { InventoryLedger, Location, Product, PaginatedData } from '../../types/pos';

interface Props {
    ledgers: PaginatedData<InventoryLedger>;
    locations: Location[];
    products: Product[];
    filters: {
        location_id: string;
        product_id: string;
        transaction_type: string;
    };
}

export default function InventoryLedgerPage({ ledgers, locations, products, filters }: Props) {
    const [locationId, setLocationId] = useState(filters.location_id || '');
    const [productId, setProductId] = useState(filters.product_id || '');
    const [type, setType] = useState(filters.transaction_type || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleFilterChange = (newLoc: string, newProd: string, newType: string) => {
        setLocationId(newLoc);
        setProductId(newProd);
        setType(newType);
        setIsLoading(true);

        router.get(
            '/inventory/ledger',
            {
                ...(newLoc ? { location_id: newLoc } : {}),
                ...(newProd ? { product_id: newProd } : {}),
                ...(newType ? { transaction_type: newType } : {}),
            },
            {
                preserveState: true,
                replace: true,
                onFinish: () => setIsLoading(false),
            }
        );
    };

    const locationOptions = [
        { value: '', label: 'All Locations' },
        ...locations.map((loc) => ({
            value: String(loc.id),
            label: `${loc.code} - ${loc.name}`,
        })),
    ];

    const productOptions = [
        { value: '', label: 'All Products' },
        ...products.map((p) => ({
            value: String(p.id),
            label: `${p.sku} - ${p.name}`,
        })),
    ];

    const typeOptions = [
        { value: '', label: 'All Movement Types' },
        { value: 'STOCK_IN', label: 'STOCK_IN (Intake)' },
        { value: 'TRANSFER_OUT', label: 'TRANSFER_OUT (Dispatched)' },
        { value: 'TRANSFER_IN', label: 'TRANSFER_IN (Received)' },
        { value: 'SALE', label: 'SALE (POS/DSD Sold)' },
        { value: 'ADJUSTMENT', label: 'ADJUSTMENT (Audited Variance)' },
        { value: 'RETURN', label: 'RETURN (Restocked)' },
    ];

    return (
        <AppLayout
            title="Write-Ahead Inventory Movement Ledger"
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Inventory', href: '/inventory' },
                { label: 'Ledger Audit Log' },
            ]}
        >
            <Head title="Ledger Audit Log - POS & WMS" />

            {/* Top Toolbar */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Location Filter */}
                <div className="w-full sm:w-60">
                    <Combobox
                        options={locationOptions}
                        value={locationId}
                        onChange={(val) => handleFilterChange(val, productId, type)}
                        placeholder="Filter by Location..."
                    />
                </div>

                {/* Product Filter */}
                <div className="w-full sm:w-60">
                    <Combobox
                        options={productOptions}
                        value={productId}
                        onChange={(val) => handleFilterChange(locationId, val, type)}
                        placeholder="Filter by Product..."
                    />
                </div>

                {/* Type Filter */}
                <div className="w-full sm:w-56">
                    <Combobox
                        options={typeOptions}
                        value={type}
                        onChange={(val) => handleFilterChange(locationId, productId, val)}
                        placeholder="Movement Type..."
                    />
                </div>

                {(locationId || productId || type) && (
                    <button
                        type="button"
                        onClick={() => handleFilterChange('', '', '')}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        <FilterIcon className="h-3 w-3" />
                        <span>Clear Filters</span>
                    </button>
                )}
            </div>

            {/* Ledger Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                    <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/75 dark:text-slate-400">
                        <tr>
                            <th scope="col" className="px-5 py-3.5">
                                Timestamp & UUID
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Location
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Product
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Movement Type
                            </th>
                            <th scope="col" className="px-5 py-3.5 text-right">
                                Delta Qty
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Context / Notes
                            </th>
                        </tr>
                    </thead>

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={6} />
                    ) : (
                        <tbody className="divide-y divide-slate-100 bg-white text-xs dark:divide-slate-800 dark:bg-slate-900">
                            {ledgers.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <LayersIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                            <span className="font-medium">No ledger movements recorded</span>
                                            <span className="text-[11px] text-slate-400">
                                                All physical receipts, transfers, and sales will appear here immutably.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                ledgers.data.map((entry) => {
                                    const isPositive = entry.qty_change > 0;

                                    return (
                                        <tr
                                            key={entry.id}
                                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                        >
                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-slate-100">
                                                        {new Date(entry.created_at).toLocaleString()}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                                                        {entry.client_uuid}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {entry.location?.type === 'truck' ? (
                                                        <TruckIcon className="h-3.5 w-3.5 text-indigo-500" />
                                                    ) : (
                                                        <WarehouseIcon className="h-3.5 w-3.5 text-slate-500" />
                                                    )}
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {entry.location?.code}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                        {entry.product?.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400">
                                                        {entry.product?.sku}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                                        entry.transaction_type === 'STOCK_IN'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : entry.transaction_type.startsWith('TRANSFER')
                                                            ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                                                            : entry.transaction_type === 'ADJUSTMENT'
                                                            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    {entry.transaction_type}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-right font-mono font-bold">
                                                <span
                                                    className={
                                                        isPositive
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }
                                                >
                                                    {isPositive ? `+${entry.qty_change}` : entry.qty_change} pcs
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-[11px] text-slate-500 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    {entry.notes && <span>{entry.notes}</span>}
                                                    {entry.batch_number && (
                                                        <span className="text-[10px] text-slate-400">
                                                            Batch: {entry.batch_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    )}
                </table>

                {/* Pagination Controls */}
                {ledgers.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{ledgers.from}</span> to{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{ledgers.to}</span> of{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{ledgers.total}</span> entries
                        </div>
                        <div className="flex items-center gap-1.5">
                            {ledgers.links.map((link, i) => (
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
        </AppLayout>
    );
}
