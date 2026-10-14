import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import { Combobox } from '../../../components/ui/combobox';
import { Modal } from '../../../components/ui/modal';
import { TableSkeleton } from '../../../components/ui/skeleton';
import { DateRangePicker } from '../../../components/ui/date-range-picker';
import {
    SearchIcon,
    PlusIcon,
    FileTextIcon,
    TruckIcon,
    XIcon,
    EditIcon,
} from '../../../components/ui/icons';
import type {
    PurchaseOrder,
    Supplier,
    Location,
    PaginatedData,
} from '../../../types/pos';

interface Props {
    orders: PaginatedData<PurchaseOrder>;
    suppliers: Supplier[];
    locations: Location[];
    products?: unknown[];
    filters: {
        search: string;
        status: string;
        supplier_id: string;
        date_from?: string;
        date_to?: string;
        per_page?: number;
    };
}

export default function PurchaseOrdersIndex({
    orders,
    suppliers,
    locations,
    filters,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [supplierId, setSupplierId] = useState(filters.supplier_id || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [perPage, setPerPage] = useState<number>(filters.per_page || 15);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    const formatDate = (dateStr?: string | null): string => {
        if (!dateStr) return '-';
        const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
        const parts = clean.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            }
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Debounced filter URL synchronization with Inertia partial reloads
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (
                search !== filters.search ||
                status !== filters.status ||
                supplierId !== filters.supplier_id ||
                dateFrom !== (filters.date_from || '') ||
                dateTo !== (filters.date_to || '') ||
                perPage !== (filters.per_page || 15)
            ) {
                setIsLoading(true);
                router.get(
                    '/procurement/orders',
                    {
                        ...(search ? { search } : {}),
                        ...(status ? { status } : {}),
                        ...(supplierId ? { supplier_id: supplierId } : {}),
                        ...(dateFrom ? { date_from: dateFrom } : {}),
                        ...(dateTo ? { date_to: dateTo } : {}),
                        ...(perPage !== 15 ? { per_page: perPage } : {}),
                    },
                    {
                        only: ['orders', 'filters'],
                        preserveState: true,
                        replace: true,
                        preserveScroll: true,
                        onFinish: () => setIsLoading(false),
                    }
                );
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [search, status, supplierId, dateFrom, dateTo, perPage, filters.search, filters.status, filters.supplier_id, filters.date_from, filters.date_to, filters.per_page]);

    const formatMoney = (cents: number) => {
        return (cents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'PHP',
        });
    };

    const statusBadge = (st: string) => {
        switch (st) {
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Completed
                    </span>
                );
            case 'PARTIALLY_RECEIVED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Partially Received
                    </span>
                );
            case 'APPROVED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Approved
                    </span>
                );
            case 'CANCELLED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Cancelled
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Draft
                    </span>
                );
        }
    };

    return (
        <AppLayout
            eyebrow="Procurement & Inbound"
            title="Purchase Orders"
            description="Manage vendor purchase orders, UOM pack conversions, and contractual pricing."
            breadcrumbs={[
                { label: 'Operations', href: '/products' },
                { label: 'Purchase Orders' },
            ]}
            actions={
                <Link
                    href="/procurement/orders/create"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-xs hover:bg-brand/90 focus:outline-hidden focus:ring-2 focus:ring-brand/20 transition-all"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>New Inbound PO</span>
                </Link>
            }
        >
            <Head title="Purchase Orders | Procurement" />

            <div className="space-y-4">
                {/* Filters & Search Toolbar */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                            {/* Search PO Number, Supplier Name, or Supplier Ref */}
                            <div className="relative min-w-[220px] max-w-sm flex-1">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search PO #, supplier, or ref..."
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter */}
                            <div className="w-40 shrink-0">
                                <Combobox
                                    value={status}
                                    onChange={setStatus}
                                    options={[
                                        { value: '', label: 'All Statuses' },
                                        { value: 'DRAFT', label: 'Draft' },
                                        { value: 'APPROVED', label: 'Approved' },
                                        { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
                                        { value: 'COMPLETED', label: 'Completed' },
                                        { value: 'CANCELLED', label: 'Cancelled' },
                                    ]}
                                    placeholder="Filter status..."
                                />
                            </div>

                            {/* Supplier Filter */}
                            <div className="w-48 shrink-0">
                                <Combobox
                                    value={supplierId}
                                    onChange={setSupplierId}
                                    options={[
                                        { value: '', label: 'All Suppliers' },
                                        ...suppliers.map((s) => ({
                                            value: String(s.id),
                                            label: `${s.supplier_code} - ${s.name}`,
                                        })),
                                    ]}
                                    placeholder="Filter supplier..."
                                />
                            </div>

                            {/* Modern Date Range Picker */}
                            <div className="w-60 shrink-0">
                                <DateRangePicker
                                    startDate={dateFrom}
                                    endDate={dateTo}
                                    onChange={(start, end) => {
                                        setDateFrom(start);
                                        setDateTo(end);
                                    }}
                                    placeholder="Filter order date..."
                                />
                            </div>
                        </div>

                        <div className="text-xs font-medium text-slate-500 shrink-0">
                            {orders.total} {orders.total === 1 ? 'order' : 'orders'} found
                        </div>
                    </div>

                    {/* Active Filter Badges */}
                    {(search || status || supplierId || dateFrom || dateTo) && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                            <span className="text-slate-400 text-[11px] font-medium">Active Filters:</span>
                            {search && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                                    Keyword: "{search}"
                                    <button type="button" onClick={() => setSearch('')}>
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {status && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                                    Status: {status}
                                    <button type="button" onClick={() => setStatus('')}>
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {supplierId && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                                    Supplier: {suppliers.find((s) => String(s.id) === String(supplierId))?.name || supplierId}
                                    <button type="button" onClick={() => setSupplierId('')}>
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {(dateFrom || dateTo) && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                                    Dates: {dateFrom ? formatDate(dateFrom) : 'Start'} → {dateTo ? formatDate(dateTo) : 'Latest'}
                                    <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setStatus('');
                                    setSupplierId('');
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                                className="text-[11px] text-brand hover:underline font-medium ml-1"
                            >
                                Reset all
                            </button>
                        </div>
                    )}
                </div>

                {/* Orders Data Table with Sticky Header and Large List Optimization */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">PO Number</th>
                                    <th className="px-4 py-3">Supplier</th>
                                    <th className="px-4 py-3">Supplier Ref</th>
                                    <th className="px-4 py-3">Destination</th>
                                    <th className="px-4 py-3">Order Date</th>
                                    <th className="px-4 py-3 text-right">Order Value</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            {isLoading ? (
                                <TableSkeleton rows={8} columns={8} />
                            ) : (
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {orders.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <FileTextIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                                    <p className="text-sm font-medium">No purchase orders found</p>
                                                    <p className="text-xs text-slate-400">
                                                        Create your first inbound order using the button above.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.data.map((po) => (
                                            <tr
                                                key={po.id}
                                                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                                            >
                                                {/* PO Number */}
                                                <td className="px-4 py-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                            {po.po_number}
                                                        </span>
                                                        {po.lines && (
                                                            <span className="text-[11px] text-slate-400">
                                                                ({po.lines.length} lines)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Supplier */}
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {po.supplier?.name || suppliers.find((s) => s.id === po.supplier_id)?.name || '-'}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-slate-400">
                                                        {po.supplier?.supplier_code || suppliers.find((s) => s.id === po.supplier_id)?.supplier_code}
                                                    </div>
                                                </td>

                                                {/* Supplier Reference */}
                                                <td className="px-4 py-3">
                                                    {po.supplier_reference ? (
                                                        <span className="inline-flex items-center font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                            {po.supplier_reference}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">-</span>
                                                    )}
                                                </td>

                                                {/* Destination Warehouse */}
                                                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                                        {po.destination_location?.name || po.destinationLocation?.name || locations.find((l) => l.id === po.destination_location_id)?.name || '-'}
                                                    </div>
                                                    {(po.destination_location?.code || po.destinationLocation?.code || locations.find((l) => l.id === po.destination_location_id)?.code) && (
                                                        <div className="font-mono text-[10px] text-slate-400">
                                                            {po.destination_location?.code || po.destinationLocation?.code || locations.find((l) => l.id === po.destination_location_id)?.code}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Order Date */}
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {formatDate(po.order_date)}
                                                    </div>
                                                    {po.expected_delivery_date && (
                                                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                            Exp: {formatDate(po.expected_delivery_date)}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Financial Order Value */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1.5">
                                                        <span className="font-mono tabular-nums">{formatMoney(po.total_cents)}</span>
                                                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border font-normal text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                                            {po.tax_type === 'VAT_INCLUSIVE' ? 'VAT-Inc' : po.tax_type === 'NON_VAT' ? 'Non-VAT' : 'VAT-Ex'}
                                                        </span>
                                                    </div>
                                                    {po.discount_cents > 0 && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] text-emerald-600 font-medium font-mono tabular-nums">
                                                                -{formatMoney(po.discount_cents)} disc
                                                            </span>
                                                            {po.order_discount_formula && (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                                                    PO: {po.order_discount_formula}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-3 text-center">
                                                    {statusBadge(po.status)}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedOrder(po)}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                        >
                                                            Details
                                                        </button>
                                                        {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && (
                                                            <Link
                                                                href={`/procurement/orders/${po.id}/edit`}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                            >
                                                                <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                                                                <span>Edit</span>
                                                            </Link>
                                                        )}
                                                        {po.status !== 'COMPLETED' && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    router.get('/procurement/receiving', {
                                                                        search: po.po_number,
                                                                    })
                                                                }
                                                                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand px-2.5 text-xs font-medium text-white hover:bg-brand/90"
                                                            >
                                                                <TruckIcon className="h-3.5 w-3.5" />
                                                                <span>Receive</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            )}
                        </table>
                    </div>

                    {/* Pagination & Per-Page Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-500">
                                Showing {orders.from || 0} to {orders.to || 0} of {orders.total} results
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Show:</span>
                                <select
                                    value={perPage}
                                    onChange={(e) => setPerPage(Number(e.target.value))}
                                    className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-brand"
                                >
                                    <option value={15}>15</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {orders.links && orders.links.length > 3 && (
                            <div className="flex items-center gap-1">
                                {orders.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={!link.url}
                                        onClick={() =>
                                            link.url &&
                                            router.get(
                                                link.url,
                                                {},
                                                {
                                                    only: ['orders', 'filters'],
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                }
                                            )
                                        }
                                        className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors ${
                                            link.active
                                                ? 'bg-brand text-white'
                                                : link.url
                                                  ? 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                  : 'opacity-40 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Purchase Order Details Inspection */}
            {selectedOrder && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedOrder(null)}
                    title={`Purchase Order: ${selectedOrder.po_number}`}
                    description="Detailed view of ordered line items, applied sequential discounts, and VAT treatment."
                    maxWidth="2xl"
                >
                    <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Supplier</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate" title={selectedOrder.supplier?.name || suppliers.find((s) => s.id === selectedOrder.supplier_id)?.name}>
                                    {selectedOrder.supplier?.name || suppliers.find((s) => s.id === selectedOrder.supplier_id)?.name || '-'}
                                </span>
                                {(selectedOrder.supplier?.supplier_code || suppliers.find((s) => s.id === selectedOrder.supplier_id)?.supplier_code) && (
                                    <span className="font-mono text-[10px] text-slate-400">
                                        {selectedOrder.supplier?.supplier_code || suppliers.find((s) => s.id === selectedOrder.supplier_id)?.supplier_code}
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Supplier Reference</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                    {selectedOrder.supplier_reference || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Destination</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {selectedOrder.destination_location?.name || selectedOrder.destinationLocation?.name || locations.find((l) => l.id === selectedOrder.destination_location_id)?.name || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Tax Treatment</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {selectedOrder.tax_type === 'VAT_INCLUSIVE'
                                        ? 'VAT-Inclusive (12%)'
                                        : selectedOrder.tax_type === 'NON_VAT'
                                          ? 'Non-VAT (0%)'
                                          : 'VAT-Exclusive (+12%)'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Order Date</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {formatDate(selectedOrder.order_date)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Expected Delivery</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {formatDate(selectedOrder.expected_delivery_date)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                                Ordered Line Items
                            </span>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Product / SKU</th>
                                            <th className="px-3 py-2">Pack UOM</th>
                                            <th className="px-3 py-2 text-center">Ordered</th>
                                            <th className="px-3 py-2 text-center">Received (Base)</th>
                                            <th className="px-3 py-2 text-right">Discount Formula</th>
                                            <th className="px-3 py-2 text-right">Net Base Cost</th>
                                            <th className="px-3 py-2 text-right">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selectedOrder.lines?.map((line) => (
                                            <tr key={line.id}>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                                        {line.product?.name}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-slate-400">
                                                        {line.product?.sku}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {line.uom?.name} (x{line.conversion_factor})
                                                </td>
                                                <td className="px-3 py-2 text-center font-medium">
                                                    {line.ordered_qty} pkgs ({line.ordered_base_qty} pcs)
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span
                                                        className={
                                                            line.received_base_qty >= line.ordered_base_qty
                                                                ? 'text-emerald-600 font-medium'
                                                                : 'text-amber-600 font-medium'
                                                        }
                                                    >
                                                        {line.received_base_qty} / {line.ordered_base_qty} pcs
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {line.discount_formula
                                                        ? line.discount_type === 'COMPOUND' && line.discount_formula.includes('|')
                                                            ? `${line.discount_formula.split('|')[0]}% - ₱${parseFloat(line.discount_formula.split('|')[1] || '0').toFixed(2)}`
                                                            : `${line.discount_type === 'FIXED_AMOUNT' ? '₱' : ''}${line.discount_formula}${line.discount_type === 'PERCENTAGE' ? '%' : ''}`
                                                        : line.discount_percent && parseFloat(line.discount_percent) > 0
                                                          ? `${(parseFloat(line.discount_percent) * 100).toFixed(1)}%`
                                                          : '0%'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {formatMoney(line.net_base_cost_cents)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold font-mono text-slate-900 dark:text-slate-100">
                                                    {formatMoney(line.line_total_cents)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Financial Totals Summary in Details Modal */}
                        <div className="flex justify-end pt-1">
                            <div className="w-full md:w-72 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Gross Subtotal:</span>
                                    <span className="font-mono">{formatMoney(selectedOrder.subtotal_cents)}</span>
                                </div>
                                {selectedOrder.line_discount_cents && selectedOrder.line_discount_cents > 0 ? (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>Line Trade Discounts:</span>
                                        <span className="font-mono">-{formatMoney(selectedOrder.line_discount_cents)}</span>
                                    </div>
                                ) : null}
                                {selectedOrder.order_discount_cents && selectedOrder.order_discount_cents > 0 ? (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <div>
                                            <span>Overall PO Discount:</span>
                                            {selectedOrder.order_discount_formula && (
                                                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                                    {selectedOrder.order_discount_formula}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-mono">-{formatMoney(selectedOrder.order_discount_cents)}</span>
                                    </div>
                                ) : null}
                                {selectedOrder.discount_cents > 0 && (!selectedOrder.line_discount_cents && !selectedOrder.order_discount_cents) && (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>Total Discounts:</span>
                                        <span className="font-mono">-{formatMoney(selectedOrder.discount_cents)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>{selectedOrder.tax_type === 'VAT_INCLUSIVE' ? 'VAT Included (12%):' : selectedOrder.tax_type === 'NON_VAT' ? 'Tax (0%):' : 'VAT (12%):'}</span>
                                    <span className="font-mono">{formatMoney(selectedOrder.tax_cents)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                                    <span>Grand Total:</span>
                                    <span className="font-mono text-brand">
                                        {formatMoney(selectedOrder.total_cents)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED' ? (
                                <Link
                                    href={`/procurement/orders/${selectedOrder.id}/edit`}
                                    className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Adjust Order</span>
                                </Link>
                            ) : <div />}
                            <button
                                type="button"
                                onClick={() => setSelectedOrder(null)}
                                className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-medium dark:bg-slate-800 hover:bg-slate-800 transition-colors"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AppLayout>
    );
}
