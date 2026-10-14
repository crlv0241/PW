import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../../layouts/app-layout';
import { Combobox } from '../../components/ui/combobox';
import { Modal } from '../../components/ui/modal';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
    WarehouseIcon,
    TruckIcon,
    FilterIcon,
    PlusIcon,
    LayersIcon,
} from '../../components/ui/icons';
import type { InventoryBalance, Location, Product, PaginatedData } from '../../types/pos';

interface Props {
    balances: PaginatedData<InventoryBalance>;
    locations: Location[];
    products: Product[];
    filters: {
        location_id: string;
        product_id: string;
    };
}

export default function InventoryIndex({ balances, locations, products, filters }: Props) {
    const [locationId, setLocationId] = useState(filters.location_id || '');
    const [productId, setProductId] = useState(filters.product_id || '');
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);

    // Transfer Form
    const transferForm = useForm({
        client_uuid: '',
        source_location_id: '',
        destination_location_id: '',
        product_id: '',
        quantity: 1,
        batch_number: '',
        notes: '',
    });

    // Adjustment Form
    const adjustForm = useForm({
        client_uuid: '',
        location_id: '',
        product_id: '',
        new_count: 0,
        reason_code: 'PHYSICAL_COUNT',
        notes: '',
    });

    const handleFilterChange = (newLoc: string, newProd: string) => {
        setLocationId(newLoc);
        setProductId(newProd);
        setIsLoading(true);

        router.get(
            '/inventory',
            {
                ...(newLoc ? { location_id: newLoc } : {}),
                ...(newProd ? { product_id: newProd } : {}),
            },
            {
                preserveState: true,
                replace: true,
                onFinish: () => setIsLoading(false),
            }
        );
    };

    const handleTransferSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        transferForm.setData('client_uuid', crypto.randomUUID());
        transferForm.post('/inventory/transfer', {
            onSuccess: () => {
                setIsTransferOpen(false);
                transferForm.reset();
            },
        });
    };

    const handleAdjustSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        adjustForm.setData('client_uuid', crypto.randomUUID());
        adjustForm.post('/inventory/adjust', {
            onSuccess: () => {
                setIsAdjustOpen(false);
                adjustForm.reset();
            },
        });
    };

    const locationOptions = [
        { value: '', label: 'All Locations' },
        ...locations.map((loc) => ({
            value: String(loc.id),
            label: `${loc.code} - ${loc.name}`,
            description: `Type: ${loc.type.toUpperCase()}`,
        })),
    ];

    const productOptions = [
        { value: '', label: 'All Products' },
        ...products.map((p) => ({
            value: String(p.id),
            label: `${p.sku} - ${p.name}`,
        })),
    ];

    return (
        <AppLayout
            title="Real-Time Stock Balances & Locations"
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Inventory' },
                { label: 'Stock Balances' },
            ]}
        >
            <Head title="Stock Balances - POS & WMS" />

            {/* Top Toolbar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Location Filter */}
                    <div className="w-full sm:w-64">
                        <Combobox
                            options={locationOptions}
                            value={locationId}
                            onChange={(val) => handleFilterChange(val, productId)}
                            placeholder="Filter by Location..."
                        />
                    </div>

                    {/* Product Filter */}
                    <div className="w-full sm:w-64">
                        <Combobox
                            options={productOptions}
                            value={productId}
                            onChange={(val) => handleFilterChange(locationId, val)}
                            placeholder="Filter by Product..."
                        />
                    </div>

                    {(locationId || productId) && (
                        <button
                            type="button"
                            onClick={() => handleFilterChange('', '')}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <FilterIcon className="h-3 w-3" />
                            <span>Clear Filters</span>
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            transferForm.setData('client_uuid', crypto.randomUUID());
                            setIsTransferOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        <TruckIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Transfer Stock</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            adjustForm.setData('client_uuid', crypto.randomUUID());
                            setIsAdjustOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>Adjust Stock</span>
                    </button>
                </div>
            </div>

            {/* Balances Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                    <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/75 dark:text-slate-400">
                        <tr>
                            <th scope="col" className="px-5 py-3.5">
                                Location & Type
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Product SKU & Name
                            </th>
                            <th scope="col" className="px-5 py-3.5 text-right">
                                On-Hand Base Units
                            </th>
                            <th scope="col" className="px-5 py-3.5">
                                Packaging Breakdown
                            </th>
                            <th scope="col" className="px-5 py-3.5 text-right">
                                Status
                            </th>
                        </tr>
                    </thead>

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} />
                    ) : (
                        <tbody className="divide-y divide-slate-100 bg-white text-xs dark:divide-slate-800 dark:bg-slate-900">
                            {balances.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <WarehouseIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                            <span className="font-medium">No stock balances found matching criteria</span>
                                            <span className="text-[11px] text-slate-400">Execute an intake or transfer to allocate stock.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                balances.data.map((bal) => (
                                    <tr
                                        key={bal.id}
                                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                    >
                                        <td className="whitespace-nowrap px-5 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {bal.location?.type === 'truck' ? (
                                                        <TruckIcon className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <WarehouseIcon className="h-3.5 w-3.5" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                        {bal.location?.name}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        {bal.location?.code} ({bal.location?.type.toUpperCase()})
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {bal.product?.name}
                                                </span>
                                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                                    {bal.product?.sku}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                                            {bal.current_qty.toLocaleString()} pcs
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {bal.product?.uoms?.map((uom) => {
                                                    const packaged = Math.floor(bal.current_qty / uom.conversion_factor);
                                                    return (
                                                        <span
                                                            key={uom.id}
                                                            className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                        >
                                                            {packaged} {uom.name}s
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4 text-right">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    bal.current_qty > 50
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : bal.current_qty > 0
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                }`}
                                            >
                                                {bal.current_qty > 50
                                                    ? 'Healthy'
                                                    : bal.current_qty > 0
                                                    ? 'Low Stock'
                                                    : 'Depleted'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    )}
                </table>
            </div>

            {/* Transfer Stock Modal */}
            <Modal
                isOpen={isTransferOpen}
                onClose={() => setIsTransferOpen(false)}
                title="Transfer Physical Stock"
                description="Move inventory atomically between warehouse and virtual truck locations."
                confirmText="Execute Transfer"
                onConfirm={handleTransferSubmit}
                isLoading={transferForm.processing}
                maxWidth="lg"
            >
                <form onSubmit={handleTransferSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Combobox
                                label="Source Location *"
                                options={locations.map((loc) => ({
                                    value: String(loc.id),
                                    label: `${loc.code} - ${loc.name}`,
                                }))}
                                value={transferForm.data.source_location_id}
                                onChange={(val) => transferForm.setData('source_location_id', val)}
                                placeholder="Select source..."
                                error={transferForm.errors.source_location_id}
                            />
                        </div>

                        <div>
                            <Combobox
                                label="Destination Location *"
                                options={locations.map((loc) => ({
                                    value: String(loc.id),
                                    label: `${loc.code} - ${loc.name}`,
                                }))}
                                value={transferForm.data.destination_location_id}
                                onChange={(val) => transferForm.setData('destination_location_id', val)}
                                placeholder="Select destination..."
                                error={transferForm.errors.destination_location_id}
                            />
                        </div>
                    </div>

                    <div>
                        <Combobox
                            label="Product to Transfer *"
                            options={products.map((p) => ({
                                value: String(p.id),
                                label: `${p.sku} - ${p.name}`,
                            }))}
                            value={transferForm.data.product_id}
                            onChange={(val) => transferForm.setData('product_id', val)}
                            placeholder="Select product..."
                            error={transferForm.errors.product_id}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Quantity (Base Pieces) *
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={transferForm.data.quantity}
                                onChange={(e) => transferForm.setData('quantity', parseInt(e.target.value) || 1)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                            />
                            {transferForm.errors.quantity && (
                                <p className="mt-1 text-xs text-red-600">{transferForm.errors.quantity}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Batch / Lot #
                            </label>
                            <input
                                type="text"
                                value={transferForm.data.batch_number}
                                onChange={(e) => transferForm.setData('batch_number', e.target.value)}
                                placeholder="Optional batch ID"
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Transfer Notes / Manifest
                        </label>
                        <textarea
                            rows={2}
                            value={transferForm.data.notes}
                            onChange={(e) => transferForm.setData('notes', e.target.value)}
                            placeholder="Reason or dispatch order reference..."
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                    </div>
                </form>
            </Modal>

            {/* Adjust Stock Modal */}
            <Modal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                title="Supervised Stock Adjustment"
                description="Update the physical count balance with an audited reason code and variance log."
                confirmText="Apply Adjustment"
                onConfirm={handleAdjustSubmit}
                isLoading={adjustForm.processing}
                maxWidth="lg"
            >
                <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Combobox
                                label="Target Location *"
                                options={locations.map((loc) => ({
                                    value: String(loc.id),
                                    label: `${loc.code} - ${loc.name}`,
                                }))}
                                value={adjustForm.data.location_id}
                                onChange={(val) => adjustForm.setData('location_id', val)}
                                placeholder="Select location..."
                                error={adjustForm.errors.location_id}
                            />
                        </div>

                        <div>
                            <Combobox
                                label="Target Product *"
                                options={products.map((p) => ({
                                    value: String(p.id),
                                    label: `${p.sku} - ${p.name}`,
                                }))}
                                value={adjustForm.data.product_id}
                                onChange={(val) => adjustForm.setData('product_id', val)}
                                placeholder="Select product..."
                                error={adjustForm.errors.product_id}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                New Physical Count (Base Units) *
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={adjustForm.data.new_count}
                                onChange={(e) => adjustForm.setData('new_count', parseInt(e.target.value) || 0)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                            />
                            {adjustForm.errors.new_count && (
                                <p className="mt-1 text-xs text-red-600">{adjustForm.errors.new_count}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Reason Code *
                            </label>
                            <select
                                value={adjustForm.data.reason_code}
                                onChange={(e) => adjustForm.setData('reason_code', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="PHYSICAL_COUNT">Physical Cycle Count</option>
                                <option value="DAMAGED_GOODS">Damaged / Broken Goods</option>
                                <option value="EXPIRED">Expired Shelf Life</option>
                                <option value="SHRINKAGE">Theft / Unaccounted Shrinkage</option>
                                <option value="FOUND_STOCK">Found / Unregistered Stock</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Supervisor Audit Notes
                        </label>
                        <textarea
                            rows={2}
                            value={adjustForm.data.notes}
                            onChange={(e) => adjustForm.setData('notes', e.target.value)}
                            placeholder="Mandatory notes explaining count variance..."
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
