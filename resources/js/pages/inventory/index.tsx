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
            eyebrow="Warehouse Inventory"
            title="Stock Balances."
            description="On-hand inventory balances across warehouse and vehicle locations."
            breadcrumbs={[
                { label: 'Back Office', href: '/products' },
                { label: 'Inventory' },
                { label: 'Stock Balances' },
            ]}
            actions={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            transferForm.setData('client_uuid', crypto.randomUUID());
                            setIsTransferOpen(true);
                        }}
                        className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm inline-flex items-center gap-2 transition-colors"
                    >
                        <TruckIcon className="h-4 w-4 text-slate-500" />
                        <span>Transfer Stock</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            adjustForm.setData('client_uuid', crypto.randomUUID());
                            setIsAdjustOpen(true);
                        }}
                        className="h-9 px-3.5 rounded-lg bg-brand text-white font-medium text-sm hover:opacity-90 shadow-sm inline-flex items-center gap-2 transition-all"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>Adjust Stock</span>
                    </button>
                </div>
            }
        >
            <Head title="Stock Balances - POS & WMS" />

            {/* Filter Toolbar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Location Filter */}
                <div className="w-full sm:w-64">
                    <Combobox
                        options={locationOptions}
                        value={locationId}
                        onChange={(val) => handleFilterChange(val, productId)}
                        placeholder="All Locations"
                    />
                </div>

                {/* Product Filter */}
                <div className="w-full sm:w-64">
                    <Combobox
                        options={productOptions}
                        value={productId}
                        onChange={(val) => handleFilterChange(locationId, val)}
                        placeholder="All Products"
                    />
                </div>

                {(locationId || productId) && (
                    <button
                        type="button"
                        onClick={() => handleFilterChange('', '')}
                        className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        <FilterIcon className="h-3.5 w-3.5" />
                        <span>Clear</span>
                    </button>
                )}
            </div>

            {/* Balances Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                    <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-400">
                        <tr>
                            <th scope="col" className="px-5 py-3 font-medium">
                                Location
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                                Product
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium text-right">
                                On-Hand (Pieces)
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                                Packaging Breakdown
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium text-right">
                                Status
                            </th>
                        </tr>
                    </thead>

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} />
                    ) : (
                        <tbody className="divide-y divide-slate-100 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
                            {balances.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <WarehouseIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                            <span className="font-medium text-sm">No stock balances found</span>
                                            <span className="text-xs text-slate-400">Receive or transfer products to allocate stock.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                balances.data.map((bal) => (
                                    <tr
                                        key={bal.id}
                                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                    >
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {bal.location?.type === 'truck' ? (
                                                        <TruckIcon className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <WarehouseIcon className="h-3.5 w-3.5" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-slate-100">
                                                        {bal.location?.name}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-500">
                                                        {bal.location?.code}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                                    {bal.product?.name}
                                                </span>
                                                <span className="mt-0.5">
                                                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                                        {bal.product?.sku}
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {bal.current_qty.toLocaleString()} pcs
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {bal.product?.uoms?.map((uom) => {
                                                    const packaged = Math.floor(bal.current_qty / uom.conversion_factor);
                                                    return (
                                                        <span
                                                            key={uom.id}
                                                            className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                                                        >
                                                            {packaged} {uom.name}s
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                        bal.current_qty > 50
                                                            ? 'bg-emerald-500'
                                                            : bal.current_qty > 0
                                                            ? 'bg-amber-500'
                                                            : 'bg-rose-500'
                                                    }`}
                                                />
                                                <span
                                                    className={
                                                        bal.current_qty > 50
                                                            ? 'text-emerald-700 dark:text-emerald-400'
                                                            : bal.current_qty > 0
                                                            ? 'text-amber-700 dark:text-amber-400'
                                                            : 'text-rose-700 dark:text-rose-400'
                                                    }
                                                >
                                                    {bal.current_qty > 50
                                                        ? 'In Stock'
                                                        : bal.current_qty > 0
                                                        ? 'Low Stock'
                                                        : 'Out of Stock'}
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

            {/* Transfer Stock Modal */}
            <Modal
                isOpen={isTransferOpen}
                onClose={() => setIsTransferOpen(false)}
                title="Transfer Stock"
                description="Move inventory between warehouse and vehicle locations."
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
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Quantity (Pieces) *
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={transferForm.data.quantity === 0 ? '' : transferForm.data.quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    transferForm.setData('quantity', val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                                }}
                                onBlur={() => {
                                    if (!transferForm.data.quantity || transferForm.data.quantity < 1) {
                                        transferForm.setData('quantity', 1);
                                    }
                                }}
                                placeholder="1"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                            />
                            {transferForm.errors.quantity && (
                                <p className="mt-1 text-xs text-rose-600">{transferForm.errors.quantity}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Batch / Lot #
                            </label>
                            <input
                                type="text"
                                value={transferForm.data.batch_number}
                                onChange={(e) => transferForm.setData('batch_number', e.target.value)}
                                placeholder="Optional batch ID"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Notes / Reference
                        </label>
                        <textarea
                            rows={2}
                            value={transferForm.data.notes}
                            onChange={(e) => transferForm.setData('notes', e.target.value)}
                            placeholder="Optional reference notes..."
                            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                    </div>
                </form>
            </Modal>

            {/* Adjust Stock Modal */}
            <Modal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                title="Adjust Stock"
                description="Update physical count balance with reason code."
                confirmText="Save Adjustment"
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
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                New Physical Count (Pieces) *
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={adjustForm.data.new_count === 0 && !adjustForm.isDirty ? '' : adjustForm.data.new_count}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    adjustForm.setData('new_count', val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                                }}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-mono"
                            />
                            {adjustForm.errors.new_count && (
                                <p className="mt-1 text-xs text-rose-600">{adjustForm.errors.new_count}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Reason Code *
                            </label>
                            <select
                                value={adjustForm.data.reason_code}
                                onChange={(e) => adjustForm.setData('reason_code', e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Audit Notes
                        </label>
                        <textarea
                            rows={2}
                            value={adjustForm.data.notes}
                            onChange={(e) => adjustForm.setData('notes', e.target.value)}
                            placeholder="Reason for adjustment..."
                            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
