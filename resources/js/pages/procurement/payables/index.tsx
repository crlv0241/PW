import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import { TableSkeleton } from '../../../components/ui/skeleton';
import {
    SearchIcon,
    XIcon,
    FilterIcon,
    ReceiptIcon,
    ArrowRightIcon,
    PlusIcon,
    AlertTriangleIcon,
    CheckCircleIcon,
} from '../../../components/ui/icons';
import { RecordPaymentModal } from './components/record-payment-modal';
import type { PaginatedData } from '../../../types/pos';

interface SupplierPayableItem {
    id: number;
    supplier_code: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    payment_terms_days: number;
    total_pos_count: number;
    open_pos_count: number;
    total_invoiced_cents: number;
    total_paid_cents: number;
    outstanding_balance_cents: number;
    payment_status: 'SETTLED' | 'PARTIALLY_PAID' | 'UNPAID';
}

interface Props {
    metrics: {
        total_outstanding_cents: number;
        overdue_payables_cents: number;
        total_paid_cents: number;
        pending_cheques_cents: number;
    };
    suppliers: PaginatedData<SupplierPayableItem>;
    filters: {
        search: string;
        status: string;
    };
}

export default function SupplierPayablesIndex({ metrics, suppliers, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [isLoading, setIsLoading] = useState(false);

    // Record Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierPayableItem | null>(null);

    // Debounced URL query synchronization
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== filters.search) {
                setIsLoading(true);
                router.get(
                    '/procurement/payables',
                    {
                        ...(search ? { search } : {}),
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
    }, [search, filters.search]);

    const handleOpenPayment = (supplier: SupplierPayableItem) => {
        setSelectedSupplier(supplier);
        setIsPaymentModalOpen(true);
    };

    return (
        <AppLayout
            eyebrow="Accounts Payable & Cash Disbursements"
            title="Supplier Payables"
            description="Monitor outstanding vendor obligations, terms, floating cheques, and execute multi-tender settlements."
            breadcrumbs={[
                { label: 'Back Office', href: '/procurement/orders' },
                { label: 'Accounts Payable' },
            ]}
        >
            <Head title="Supplier Payables - Accounts Payable" />

            {/* Executive Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {/* Total Outstanding Payables */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Total Outstanding Payables
                        </span>
                        <ReceiptIcon className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                            ₱{(metrics.total_outstanding_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Total unpaid procurement obligations
                    </p>
                </div>

                {/* Overdue Payables */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Past Due / Overdue
                        </span>
                        <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-2xl font-bold tracking-tight font-mono ${metrics.overdue_payables_cents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            ₱{(metrics.overdue_payables_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Beyond vendor payment terms
                    </p>
                </div>

                {/* Pending Cheques (Floating) */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Floating Cheques
                        </span>
                        <ReceiptIcon className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                            ₱{(metrics.pending_cheques_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Issued cheques pending bank clearing
                    </p>
                </div>

                {/* Total Paid Disbursements */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Settled Disbursements
                        </span>
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                            ₱{(metrics.total_paid_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Cumulative supplier disbursements
                    </p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative w-full sm:w-80">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search supplier, code, contact..."
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

                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        >
                            <FilterIcon className="h-3.5 w-3.5" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Suppliers Payables Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                        <thead className="bg-slate-50/75 dark:bg-slate-900/75">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Supplier
                                </th>
                                <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Terms
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Total Invoiced
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Total Paid
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Outstanding Balance
                                </th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Open POs
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
                            <TableSkeleton rows={6} columns={8} />
                        ) : (
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                                {suppliers.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <ReceiptIcon className="h-6 w-6 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    No supplier payables found
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Try adjusting your search query.
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.data.map((supplier) => (
                                        <tr
                                            key={supplier.id}
                                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                        >
                                            {/* Supplier Code & Name */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                                            {supplier.supplier_code}
                                                        </span>
                                                        <Link
                                                            href={`/procurement/payables/${supplier.id}`}
                                                            className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-brand hover:underline"
                                                        >
                                                            {supplier.name}
                                                        </Link>
                                                    </div>
                                                    {supplier.contact_name && (
                                                        <span className="mt-0.5 text-xs text-slate-400">
                                                            Attn: {supplier.contact_name} {supplier.phone ? `· ${supplier.phone}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Terms */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                                                {supplier.payment_terms_days} Days Net
                                            </td>

                                            {/* Total Invoiced */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                                                ₱{(supplier.total_invoiced_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Total Paid */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                ₱{(supplier.total_paid_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Outstanding Balance */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs font-bold">
                                                {supplier.outstanding_balance_cents > 0 ? (
                                                    <span className="text-rose-600 dark:text-rose-400">
                                                        ₱{(supplier.outstanding_balance_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">₱0.00</span>
                                                )}
                                            </td>

                                            {/* Open POs */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-center">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    supplier.open_pos_count > 0
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {supplier.open_pos_count} / {supplier.total_pos_count}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${
                                                    supplier.payment_status === 'SETTLED'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                        : supplier.payment_status === 'PARTIALLY_PAID'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                                }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${
                                                        supplier.payment_status === 'SETTLED' ? 'bg-emerald-500' : supplier.payment_status === 'PARTIALLY_PAID' ? 'bg-amber-500' : 'bg-rose-500'
                                                    }`} />
                                                    <span>{supplier.payment_status === 'SETTLED' ? 'Settled' : supplier.payment_status === 'PARTIALLY_PAID' ? 'Partially Paid' : 'Unpaid'}</span>
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    {supplier.outstanding_balance_cents > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPayment(supplier)}
                                                            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-xs inline-flex items-center gap-1 transition"
                                                        >
                                                            <PlusIcon className="h-3.5 w-3.5" />
                                                            <span>Pay</span>
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/procurement/payables/${supplier.id}`}
                                                        className="h-8 px-2.5 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-90 shadow-xs inline-flex items-center gap-1 transition"
                                                    >
                                                        <span>Dissect</span>
                                                        <ArrowRightIcon className="h-3 w-3" />
                                                    </Link>
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
                {suppliers.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-900 dark:text-slate-100">{suppliers.from}</span> to{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">{suppliers.to}</span> of{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">{suppliers.total}</span> suppliers
                        </div>
                        <div className="flex items-center gap-1">
                            {suppliers.links.map((link, i) => (
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

            {/* Record Payment Modal */}
            {selectedSupplier && (
                <RecordPaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    supplierId={selectedSupplier.id}
                    supplierName={selectedSupplier.name}
                />
            )}
        </AppLayout>
    );
}
