import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Modal } from '../../../../components/ui/modal';
import { Combobox } from '../../../../components/ui/combobox';
import {
    ReceiptIcon,
    AlertTriangleIcon,
    CalendarIcon,
} from '../../../../components/ui/icons';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    supplierId: number;
    supplierName: string;
    preSelectedPoId?: number | null;
    openPurchaseOrders?: Array<{
        id: number;
        po_number: string;
        supplier_reference?: string | null;
        total_cents: number;
        paid_amount_cents?: number;
        balance_cents?: number;
    }>;
}

export function RecordPaymentModal({
    isOpen,
    onClose,
    supplierId,
    supplierName,
    preSelectedPoId,
    openPurchaseOrders = [],
}: Props) {
    const [selectedPoId, setSelectedPoId] = useState<string>(preSelectedPoId ? String(preSelectedPoId) : '');
    const [amountInput, setAmountInput] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('CHEQUE');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Cheque Specifics
    const [chequeNumber, setChequeNumber] = useState<string>('');
    const [bankName, setBankName] = useState<string>('');
    const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [clearingDate, setClearingDate] = useState<string>('');
    const [payeeName, setPayeeName] = useState<string>(supplierName);

    // Bank Transfer / Cash Specifics
    const [referenceNumber, setReferenceNumber] = useState<string>('');
    const [voucherNumber, setVoucherNumber] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

    // Selected PO helper
    const activePo = openPurchaseOrders.find((p) => String(p.id) === selectedPoId);
    const poRemainingCents = activePo
        ? (activePo.balance_cents !== undefined ? activePo.balance_cents : Math.max(0, activePo.total_cents - (activePo.paid_amount_cents || 0)))
        : 0;

    useEffect(() => {
        if (!isOpen) return;

        setClientErrors({});
        setServerErrors({});
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setChequeDate(new Date().toISOString().split('T')[0]);
        setPayeeName(supplierName);

        if (preSelectedPoId) {
            setSelectedPoId(String(preSelectedPoId));
            const targetPo = openPurchaseOrders.find((p) => p.id === preSelectedPoId);
            if (targetPo) {
                const bal = targetPo.balance_cents !== undefined
                    ? targetPo.balance_cents
                    : Math.max(0, targetPo.total_cents - (targetPo.paid_amount_cents || 0));
                setAmountInput((bal / 100).toFixed(2));
            }
        } else if (openPurchaseOrders.length > 0) {
            const firstPo = openPurchaseOrders[0];
            setSelectedPoId(String(firstPo.id));
            const bal = firstPo.balance_cents !== undefined
                ? firstPo.balance_cents
                : Math.max(0, firstPo.total_cents - (firstPo.paid_amount_cents || 0));
            setAmountInput((bal / 100).toFixed(2));
        } else {
            setSelectedPoId('');
            setAmountInput('');
        }
    }, [isOpen, preSelectedPoId, openPurchaseOrders, supplierName]);

    // Handle PO selection change to update suggested balance
    const handlePoChange = (poIdStr: string) => {
        setSelectedPoId(poIdStr);
        const targetPo = openPurchaseOrders.find((p) => String(p.id) === poIdStr);
        if (targetPo) {
            const bal = targetPo.balance_cents !== undefined
                ? targetPo.balance_cents
                : Math.max(0, targetPo.total_cents - (targetPo.paid_amount_cents || 0));
            setAmountInput((bal / 100).toFixed(2));
        }
    };

    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        const parsedAmount = parseFloat(amountInput);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.amount = 'Please enter a valid positive payment amount.';
        } else if (activePo && Math.round(parsedAmount * 100) > poRemainingCents && poRemainingCents > 0) {
            errors.amount = `Payment amount (₱${parsedAmount.toFixed(2)}) cannot exceed remaining PO balance (₱${(poRemainingCents / 100).toFixed(2)}).`;
        }

        if (!paymentDate) {
            errors.payment_date = 'Payment date is required.';
        }

        if (paymentMethod === 'CHEQUE') {
            if (!chequeNumber.trim()) {
                errors.cheque_number = 'Cheque number is required.';
            }
            if (!bankName.trim()) {
                errors.bank_name = 'Bank name is required.';
            }
        }

        if (paymentMethod === 'BANK_TRANSFER') {
            if (!bankName.trim()) {
                errors.bank_name = 'Bank name is required.';
            }
            if (!referenceNumber.trim()) {
                errors.reference_number = 'Bank transfer reference / confirmation number is required.';
            }
        }

        setClientErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setServerErrors({});

        const amountCents = Math.round(parseFloat(amountInput) * 100);

        const payload = {
            supplier_id: supplierId,
            purchase_order_id: selectedPoId ? parseInt(selectedPoId, 10) : null,
            amount_cents: amountCents,
            payment_method: paymentMethod,
            payment_date: paymentDate,
            cheque_number: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : null,
            bank_name: paymentMethod === 'CHEQUE' || paymentMethod === 'BANK_TRANSFER' ? bankName.trim() : null,
            cheque_date: paymentMethod === 'CHEQUE' ? chequeDate : null,
            clearing_date: paymentMethod === 'CHEQUE' && clearingDate ? clearingDate : null,
            payee_name: paymentMethod === 'CHEQUE' ? payeeName.trim() : null,
            reference_number: paymentMethod === 'BANK_TRANSFER' ? referenceNumber.trim() : null,
            voucher_number: paymentMethod === 'CASH' && voucherNumber ? voucherNumber.trim() : null,
            notes: notes.trim() || null,
        };

        router.post('/procurement/payables/payments', payload, {
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
    };

    const poOptions = [
        ...openPurchaseOrders.map((p) => {
            const bal = p.balance_cents !== undefined ? p.balance_cents : Math.max(0, p.total_cents - (p.paid_amount_cents || 0));
            return {
                value: String(p.id),
                label: `${p.po_number} ${p.supplier_reference ? `(${p.supplier_reference})` : ''} - Bal: ₱${(bal / 100).toFixed(2)}`,
            };
        }),
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Record Payment: ${supplierName}`}
            description="Encode Accounts Payable disbursements via Cheque, Cash, or Bank Transfer."
            confirmText="Post Payment"
            onConfirm={handleSubmit}
            isLoading={isSubmitting}
            maxWidth="2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                {/* Server Error Alert */}
                {Object.keys(serverErrors).length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        <div className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100 mb-1">
                            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>Payment validation error:</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5">
                            {Object.entries(serverErrors).map(([key, msg]) => (
                                <li key={key}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Purchase Order Allocation */}
                {openPurchaseOrders.length > 0 && (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Allocate to Purchase Order
                        </label>
                        <select
                            value={selectedPoId}
                            onChange={(e) => handlePoChange(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                        >
                            <option value="">General Supplier Account / Unallocated</option>
                            {openPurchaseOrders.map((po) => {
                                const bal = po.balance_cents !== undefined ? po.balance_cents : Math.max(0, po.total_cents - (po.paid_amount_cents || 0));
                                return (
                                    <option key={po.id} value={po.id}>
                                        {po.po_number} {po.supplier_reference ? `[${po.supplier_reference}]` : ''} — Total: ₱{(po.total_cents / 100).toFixed(2)} (Remaining: ₱{(bal / 100).toFixed(2)})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* Amount and Payment Date */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Payment Amount (₱) *
                            </label>
                            {activePo && poRemainingCents > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setAmountInput((poRemainingCents / 100).toFixed(2))}
                                    className="text-[11px] font-medium text-brand hover:underline"
                                >
                                    Pay Full (₱{(poRemainingCents / 100).toFixed(2)})
                                </button>
                            )}
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={amountInput}
                            onChange={(e) => setAmountInput(e.target.value)}
                            placeholder="0.00"
                            className={`h-9 w-full rounded-lg border bg-white px-3 text-sm font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:bg-slate-800 dark:text-slate-100 ${
                                clientErrors.amount ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700'
                            }`}
                        />
                        {clientErrors.amount && <p className="mt-1 text-xs text-rose-500">{clientErrors.amount}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Payment Date *
                        </label>
                        <input
                            type="date"
                            required
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                </div>

                {/* Payment Method Selector Tabs */}
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Payment Method (Tender) *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['CHEQUE', 'BANK_TRANSFER', 'CASH'] as const).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`h-9 rounded-lg border text-xs font-semibold transition ${
                                    paymentMethod === method
                                        ? 'border-brand bg-brand-subtle text-brand shadow-xs'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                            >
                                {method === 'CHEQUE' && 'Cheque / Check'}
                                {method === 'BANK_TRANSFER' && 'Bank Transfer / EFT'}
                                {method === 'CASH' && 'Cash Voucher'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tender Specific Fields */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 space-y-3">
                    {paymentMethod === 'CHEQUE' && (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                Cheque Instrument Details
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Cheque Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                        placeholder="e.g. 000184729"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    {clientErrors.cheque_number && (
                                        <p className="mt-1 text-[11px] text-rose-500">{clientErrors.cheque_number}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Issuing Bank Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        placeholder="e.g. BDO, BPI, Metrobank"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    {clientErrors.bank_name && (
                                        <p className="mt-1 text-[11px] text-rose-500">{clientErrors.bank_name}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Cheque Date
                                    </label>
                                    <input
                                        type="date"
                                        value={chequeDate}
                                        onChange={(e) => setChequeDate(e.target.value)}
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Clearing / Maturity Date
                                    </label>
                                    <input
                                        type="date"
                                        value={clearingDate}
                                        onChange={(e) => setClearingDate(e.target.value)}
                                        placeholder="Post-dated maturity"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Payee Name
                                    </label>
                                    <input
                                        type="text"
                                        value={payeeName}
                                        onChange={(e) => setPayeeName(e.target.value)}
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'BANK_TRANSFER' && (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                Bank Transfer / Wire Details
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Originating / Destination Bank *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        placeholder="e.g. BPI Online / Metrobank Direct"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    {clientErrors.bank_name && (
                                        <p className="mt-1 text-[11px] text-rose-500">{clientErrors.bank_name}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Transaction Reference / Trace # *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={referenceNumber}
                                        onChange={(e) => setReferenceNumber(e.target.value)}
                                        placeholder="e.g. FT261015982741"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    {clientErrors.reference_number && (
                                        <p className="mt-1 text-[11px] text-rose-500">{clientErrors.reference_number}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'CASH' && (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                Cash Voucher Details
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Petty Cash Voucher Number
                                </label>
                                <input
                                    type="text"
                                    value={voucherNumber}
                                    onChange={(e) => setVoucherNumber(e.target.value)}
                                    placeholder="e.g. PCV-2026-0045"
                                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Payment Notes / Remarks
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional check release details or approval reference"
                            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
}
