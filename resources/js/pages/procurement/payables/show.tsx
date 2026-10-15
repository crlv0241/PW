import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import {
    ReceiptIcon,
    PlusIcon,
    FileTextIcon,
    AlertTriangleIcon,
    CheckCircleIcon,
    ArrowRightIcon,
    CalendarIcon,
    LayersIcon,
} from '../../../components/ui/icons';
import { RecordPaymentModal } from './components/record-payment-modal';
import type { SupplierPayment, Location } from '../../../types/pos';

interface DissectedPoItem {
    id: number;
    po_number: string;
    supplier_reference?: string | null;
    order_date: string | null;
    due_date: string | null;
    is_overdue: boolean;
    status: string;
    total_cents: number;
    paid_amount_cents: number;
    balance_cents: number;
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
    destination_location?: Location;
    lines_count: number;
}

interface Props {
    supplier: {
        id: number;
        supplier_code: string;
        name: string;
        contact_name: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        payment_terms_days: number;
        is_active: boolean;
        total_pos_count: number;
        open_pos_count: number;
        total_invoiced_cents: number;
        total_paid_cents: number;
        outstanding_balance_cents: number;
    };
    orders: DissectedPoItem[];
    payments: SupplierPayment[];
}

export default function SupplierPayablesShow({ supplier, orders, payments }: Props) {
    const [activeTab, setActiveTab] = useState<'ORDERS' | 'PAYMENTS'>('ORDERS');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPoId, setSelectedPoId] = useState<number | null>(null);

    const openPos = orders.filter((o) => o.payment_status !== 'PAID');

    const handlePayPo = (poId: number) => {
        setSelectedPoId(poId);
        setIsPaymentModalOpen(true);
    };

    const handleOpenGeneralPayment = () => {
        setSelectedPoId(null);
        setIsPaymentModalOpen(true);
    };

    return (
        <AppLayout
            eyebrow="Accounts Payable Dissection"
            title={supplier.name}
            description={`Supplier ${supplier.supplier_code} · ${supplier.payment_terms_days} Days Payment Terms`}
            breadcrumbs={[
                { label: 'Back Office', href: '/procurement/orders' },
                { label: 'Supplier Payables', href: '/procurement/payables' },
                { label: supplier.name },
            ]}
            actions={
                <button
                    type="button"
                    onClick={handleOpenGeneralPayment}
                    className="h-9 px-3.5 rounded-lg bg-brand text-white font-medium text-sm hover:opacity-90 shadow-xs inline-flex items-center gap-2 transition"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Record Payment</span>
                </button>
            }
        >
            <Head title={`${supplier.name} - Payables Dissection`} />

            {/* Executive Supplier Summary Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 mb-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                {supplier.supplier_code}
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                {supplier.name}
                            </h2>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {supplier.contact_name && <span>Attn: <strong className="text-slate-700 dark:text-slate-200">{supplier.contact_name}</strong></span>}
                            {supplier.phone && <span>Phone: {supplier.phone}</span>}
                            {supplier.email && <span>Email: {supplier.email}</span>}
                            <span>Payment Terms: <strong className="text-slate-700 dark:text-slate-200">{supplier.payment_terms_days} Days Net</strong></span>
                        </div>
                    </div>

                    {/* Balance Chips */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="text-[11px] font-medium text-slate-500">Total Invoiced</div>
                            <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                                ₱{(supplier.total_invoiced_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="text-[11px] font-medium text-slate-500">Total Paid</div>
                            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                ₱{(supplier.total_paid_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-2 dark:border-rose-900/60 dark:bg-rose-950/40">
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Outstanding Balance</div>
                            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                                ₱{(supplier.outstanding_balance_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('ORDERS')}
                    className={`h-10 px-4 text-xs font-semibold border-b-2 transition inline-flex items-center gap-2 ${
                        activeTab === 'ORDERS'
                            ? 'border-brand text-brand font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                >
                    <FileTextIcon className="h-4 w-4" />
                    <span>Purchase Orders & Deliveries ({orders.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PAYMENTS')}
                    className={`h-10 px-4 text-xs font-semibold border-b-2 transition inline-flex items-center gap-2 ${
                        activeTab === 'PAYMENTS'
                            ? 'border-brand text-brand font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                >
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Payment Tender History ({payments.length})</span>
                </button>
            </div>

            {/* Tab 1: Purchase Orders & Invoices */}
            {activeTab === 'ORDERS' && (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                            <thead className="bg-slate-50/75 dark:bg-slate-900/75">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        PO Number
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Order & Due Date
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Destination
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Order Total
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Paid
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Balance Due
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Delivery
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Payment
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-10 text-center text-xs text-slate-500">
                                            No purchase orders found for this supplier.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((order) => (
                                        <tr key={order.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                            {/* PO Number */}
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <div className="flex flex-col">
                                                    <Link
                                                        href={`/procurement/orders/${order.id}`}
                                                        className="font-mono text-xs font-semibold text-brand hover:underline"
                                                    >
                                                        {order.po_number}
                                                    </Link>
                                                    {order.supplier_reference && (
                                                        <span className="text-[11px] text-slate-400">
                                                            Ref: {order.supplier_reference}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Dates */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                <div>{order.order_date || '-'}</div>
                                                {order.due_date && (
                                                    <div className={`text-[11px] ${order.is_overdue ? 'font-bold text-rose-500' : 'text-slate-400'}`}>
                                                        Due: {order.due_date} {order.is_overdue && '(Overdue)'}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Destination */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                {order.destination_location?.name || '-'}
                                            </td>

                                            {/* Order Total */}
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                                                ₱{(order.total_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Paid */}
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                                ₱{(order.paid_amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Balance Due */}
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-bold">
                                                {order.balance_cents > 0 ? (
                                                    <span className="text-rose-600 dark:text-rose-400">
                                                        ₱{(order.balance_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">₱0.00</span>
                                                )}
                                            </td>

                                            {/* Delivery Status */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs">
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {order.status}
                                                </span>
                                            </td>

                                            {/* Payment Status */}
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${
                                                    order.payment_status === 'PAID'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                        : order.payment_status === 'PARTIALLY_PAID'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                                }`}>
                                                    <span>{order.payment_status === 'PAID' ? 'Paid' : order.payment_status === 'PARTIALLY_PAID' ? 'Partial' : 'Unpaid'}</span>
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                {order.balance_cents > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePayPo(order.id)}
                                                        className="h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-xs inline-flex items-center gap-1"
                                                    >
                                                        <span>Pay PO</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 2: Payment Tender History */}
            {activeTab === 'PAYMENTS' && (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
                            <thead className="bg-slate-50/75 dark:bg-slate-900/75">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Payment Number
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Date
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Method
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Tender Details / Notes
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        PO Allocated
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Amount Paid
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Status
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Recorded By
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                                            No payment records found for this supplier yet.
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((p) => (
                                        <tr key={p.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                            {/* Payment Number */}
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                                                {p.payment_number}
                                            </td>

                                            {/* Date */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                {p.payment_date}
                                            </td>

                                            {/* Method */}
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${
                                                    p.payment_method === 'CHEQUE'
                                                        ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                                                        : p.payment_method === 'BANK_TRANSFER'
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                                }`}>
                                                    {p.payment_method}
                                                </span>
                                            </td>

                                            {/* Tender Specifics */}
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    {p.payment_method === 'CHEQUE' && (
                                                        <span>
                                                            Check #{p.cheque_number} · {p.bank_name} {p.clearing_date ? `(Clears: ${p.clearing_date})` : ''}
                                                        </span>
                                                    )}
                                                    {p.payment_method === 'BANK_TRANSFER' && (
                                                        <span>
                                                            {p.bank_name} · Trace #{p.reference_number}
                                                        </span>
                                                    )}
                                                    {p.payment_method === 'CASH' && (
                                                        <span>Voucher #{p.voucher_number || '-'}</span>
                                                    )}
                                                    {p.notes && <span className="text-[11px] text-slate-400 truncate max-w-xs">{p.notes}</span>}
                                                </div>
                                            </td>

                                            {/* PO Allocated */}
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                                                {p.purchaseOrder ? (
                                                    <Link
                                                        href={`/procurement/orders/${p.purchaseOrder.id}`}
                                                        className="text-brand hover:underline"
                                                    >
                                                        {p.purchaseOrder.po_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-400">General Account</span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                                ₱{(p.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Status */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                    p.status === 'COMPLETED'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : p.status === 'PENDING_CLEARING'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </td>

                                            {/* Recorded By */}
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                                {p.recorder?.name || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Record Payment Modal */}
            <RecordPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                supplierId={supplier.id}
                supplierName={supplier.name}
                preSelectedPoId={selectedPoId}
                openPurchaseOrders={openPos.map((o) => ({
                    id: o.id,
                    po_number: o.po_number,
                    supplier_reference: o.supplier_reference,
                    total_cents: o.total_cents,
                    paid_amount_cents: o.paid_amount_cents,
                    balance_cents: o.balance_cents,
                }))}
            />
        </AppLayout>
    );
}
