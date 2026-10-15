import React, { useState, useEffect, useRef } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import { Combobox } from '../../../components/ui/combobox';
import { Modal } from '../../../components/ui/modal';
import { TableSkeleton } from '../../../components/ui/skeleton';
import {
    SearchIcon,
    PlusIcon,
    TruckIcon,
    BarcodeIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    FileTextIcon,
    XIcon,
    LayersIcon,
} from '../../../components/ui/icons';
import type {
    GoodsReceipt,
    PurchaseOrder,
    Supplier,
    Location,
    Product,
    PaginatedData,
} from '../../../types/pos';

interface Props {
    receipts: PaginatedData<GoodsReceipt>;
    openPurchaseOrders: PurchaseOrder[];
    locations: Location[];
    suppliers: Supplier[];
    products: Product[];
    filters: {
        search: string;
        match_status: string;
    };
}

interface ScannedItemLine {
    purchase_order_line_id?: number | null;
    product_id: number;
    product_sku: string;
    product_name: string;
    product_uom_id: number;
    uom_name: string;
    conversion_factor: number;
    scanned_qty: number;
    rejected_qty: number;
    batch_number: string;
    expiry_date: string;
    remarks: string;
}

interface MatchAuditData {
    match_status: string;
    ordered_base_qty: number;
    received_base_qty: number;
    qty_variance_base: number;
    expected_cost_cents: number;
    invoice_amount_cents: number | null;
    cost_variance_cents: number;
    suggested_debit_memo_cents: number;
}

export default function GoodsReceivingIndex({
    receipts,
    openPurchaseOrders,
    locations,
    suppliers,
    products,
    filters,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [matchStatusFilter, setMatchStatusFilter] = useState(filters.match_status || '');
    const [isLoading, setIsLoading] = useState(false);

    // Blind intake workspace modal / view state
    const [isIntakeOpen, setIsIntakeOpen] = useState(false);
    const [selectedReceiptForAudit, setSelectedReceiptForAudit] = useState<GoodsReceipt | null>(null);
    const [auditData, setAuditData] = useState<MatchAuditData | null>(null);
    const [isAuditLoading, setIsAuditLoading] = useState(false);

    // Unlinked Delivery Linking State
    const [receiptToLink, setReceiptToLink] = useState<GoodsReceipt | null>(null);
    const [linkPoId, setLinkPoId] = useState<string>('');
    const [isLinking, setIsLinking] = useState(false);

    // Blind intake form state
    const [selectedPoId, setSelectedPoId] = useState<string>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
        suppliers.length > 0 ? String(suppliers[0].id) : ''
    );
    const [selectedLocationId, setSelectedLocationId] = useState<string>(
        locations.length > 0 ? String(locations[0].id) : ''
    );
    const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
    const [supplierDeliveryNote, setSupplierDeliveryNote] = useState('');
    const [supplierInvoiceAmount, setSupplierInvoiceAmount] = useState('');
    const [receivingNotes, setReceivingNotes] = useState('');
    const [scannedLines, setScannedLines] = useState<ScannedItemLine[]>([]);
    const [manualBarcodeInput, setManualBarcodeInput] = useState('');
    const [scanFeedbackMsg, setScanFeedbackMsg] = useState<string | null>(null);

    // Hardware barcode wedge timing buffer (< 50ms keystrokes)
    const barcodeBuffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);

    // Audio confirmation synth (Web Audio API)
    const playScanBeep = (isSuccess = true) => {
        try {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = isSuccess ? 'sine' : 'sawtooth';
            osc.frequency.setValueAtTime(isSuccess ? 880 : 300, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch {
            // Ignore audio context autoplay policy restrictions
        }
    };

    // Global listener for fast hardware wedge barcode scanners (< 50ms)
    useEffect(() => {
        if (!isIntakeOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime.current;
            lastKeyTime.current = now;

            // Barcode scanners type fast (< 50ms per key)
            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length >= 3 && timeDiff < 60) {
                    processScannedBarcode(barcodeBuffer.current.trim());
                    barcodeBuffer.current = '';
                    e.preventDefault();
                } else {
                    barcodeBuffer.current = '';
                }
            } else if (e.key.length === 1) {
                if (timeDiff > 100) {
                    // Reset if keystroke took longer than 100ms
                    barcodeBuffer.current = e.key;
                } else {
                    barcodeBuffer.current += e.key;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isIntakeOpen, scannedLines, selectedPoId]);

    // Handle PO selection auto-fill
    const handlePoSelect = (poIdStr: string) => {
        setSelectedPoId(poIdStr);
        if (!poIdStr) return;

        const po = openPurchaseOrders.find((p) => p.id === Number(poIdStr));
        if (po) {
            setSelectedSupplierId(String(po.supplier_id));
            setSelectedLocationId(String(po.destination_location_id));
            if (po.supplier_reference && !supplierInvoiceNumber) {
                setSupplierInvoiceNumber(po.supplier_reference);
            }
        }
    };

    // Process a scanned or entered barcode / SKU
    const processScannedBarcode = (code: string) => {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return;

        // Try finding product by SKU or packaging UOM barcode
        let matchedProduct: Product | undefined;
        let matchedUom = null;

        for (const p of products) {
            if (p.sku.toUpperCase() === cleanCode) {
                matchedProduct = p;
                matchedUom = p.uoms?.[0];
                break;
            }
            if (p.uoms) {
                const u = p.uoms.find((uom) => uom.barcode && uom.barcode.toUpperCase() === cleanCode);
                if (u) {
                    matchedProduct = p;
                    matchedUom = u;
                    break;
                }
            }
        }

        if (!matchedProduct || !matchedUom) {
            playScanBeep(false);
            setScanFeedbackMsg(`Unrecognized Barcode or SKU: "${cleanCode}". Item not in catalog.`);
            return;
        }

        playScanBeep(true);

        // Check if item already exists in current scanned lines
        const existingIdx = scannedLines.findIndex(
            (l) => l.product_id === matchedProduct?.id && l.product_uom_id === matchedUom?.id
        );

        if (existingIdx !== -1) {
            const next = [...scannedLines];
            next[existingIdx].scanned_qty += 1;
            setScannedLines(next);
            setScanFeedbackMsg(`Count incremented for ${matchedProduct.name} (+1 ${matchedUom.name})`);
        } else {
            // Find linked PO line if PO is selected
            let linkedPoLineId: number | null = null;
            if (selectedPoId) {
                const po = openPurchaseOrders.find((p) => p.id === Number(selectedPoId));
                const poLine = po?.lines?.find((l) => l.product_id === matchedProduct?.id);
                if (poLine) {
                    linkedPoLineId = poLine.id;
                }
            }

            const newLine: ScannedItemLine = {
                purchase_order_line_id: linkedPoLineId,
                product_id: matchedProduct.id,
                product_sku: matchedProduct.sku,
                product_name: matchedProduct.name,
                product_uom_id: matchedUom.id,
                uom_name: matchedUom.name,
                conversion_factor: matchedUom.conversion_factor,
                scanned_qty: 1,
                rejected_qty: 0,
                batch_number: '',
                expiry_date: '',
                remarks: '',
            };

            setScannedLines([newLine, ...scannedLines]);
            setScanFeedbackMsg(`Scanned: ${matchedProduct.name} (Pack: ${matchedUom.name})`);
        }

        setManualBarcodeInput('');
    };

    // Filter URL synchronization
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== filters.search || matchStatusFilter !== filters.match_status) {
                setIsLoading(true);
                router.get(
                    '/procurement/receiving',
                    {
                        ...(search ? { search } : {}),
                        ...(matchStatusFilter ? { match_status: matchStatusFilter } : {}),
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
    }, [search, matchStatusFilter, filters.search, filters.match_status]);

    const handleIntakeSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (scannedLines.length === 0) {
            alert('Please scan at least one physical item before posting.');
            return;
        }

        const invoiceCents = supplierInvoiceAmount
            ? Math.round(parseFloat(supplierInvoiceAmount) * 100)
            : null;

        const payload = {
            purchase_order_id: selectedPoId ? Number(selectedPoId) : null,
            supplier_id: Number(selectedSupplierId),
            location_id: Number(selectedLocationId),
            supplier_invoice_number: supplierInvoiceNumber || null,
            supplier_delivery_note: supplierDeliveryNote || null,
            supplier_invoice_amount_cents: invoiceCents,
            notes: receivingNotes || null,
            lines: scannedLines.map((l) => ({
                purchase_order_line_id: l.purchase_order_line_id || null,
                product_id: l.product_id,
                product_uom_id: l.product_uom_id,
                scanned_qty: l.scanned_qty,
                rejected_qty: l.rejected_qty,
                batch_number: l.batch_number || null,
                expiry_date: l.expiry_date || null,
                remarks: l.remarks || null,
            })),
        };

        router.post('/procurement/receiving', payload, {
            onSuccess: () => {
                setIsIntakeOpen(false);
                setScannedLines([]);
                setSelectedPoId('');
                setSupplierInvoiceNumber('');
                setSupplierInvoiceAmount('');
                setSupplierDeliveryNote('');
                setReceivingNotes('');
            },
        });
    };

    const inspectAudit = async (receipt: GoodsReceipt) => {
        setSelectedReceiptForAudit(receipt);
        setIsAuditLoading(true);

        try {
            const res = await fetch(`/procurement/receiving/${receipt.id}/reconcile`);
            const data = await res.json();
            setAuditData(data.audit);
        } catch {
            // Error handling
        } finally {
            setIsAuditLoading(false);
        }
    };

    const handleLinkPoSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!receiptToLink || !linkPoId) return;

        setIsLinking(true);
        router.post(
            `/procurement/receiving/${receiptToLink.id}/link-po`,
            {
                purchase_order_id: parseInt(linkPoId, 10),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsLinking(false);
                    setReceiptToLink(null);
                    setLinkPoId('');
                },
                onError: () => {
                    setIsLinking(false);
                },
            }
        );
    };

    const formatMoney = (cents: number | null | undefined) => {
        if (cents === null || cents === undefined) return '-';
        return (cents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'PHP',
        });
    };

    const matchBadge = (status: string) => {
        switch (status) {
            case 'PERFECT_MATCH':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Perfect Match
                    </span>
                );
            case 'SHORT_DELIVERY':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Short Delivery
                    </span>
                );
            case 'OVER_DELIVERY':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Over Delivery
                    </span>
                );
            case 'PRICE_VARIANCE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Price Variance
                    </span>
                );
            case 'UNLINKED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Unlinked Direct
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Pending Audit
                    </span>
                );
        }
    };

    return (
        <AppLayout
            eyebrow="Warehouse Management System"
            title="Goods Receiving & Blind Intake"
            description="Perform blind physical goods receiving with hardware barcode wedge scanning and 3-way match audit."
            breadcrumbs={[
                { label: 'Operations', href: '/procurement/orders' },
                { label: 'Goods Receiving' },
            ]}
            actions={
                <button
                    type="button"
                    onClick={() => setIsIntakeOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-xs hover:bg-brand/90 transition-all focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                >
                    <TruckIcon className="h-4 w-4" />
                    <span>New Receiving Intake</span>
                </button>
            }
        >
            <Head title="Goods Receiving & 3-Way Match | APEX POS & WMS" />

            <div className="space-y-4">
                {/* Search & Filter Controls */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                    <div className="flex flex-1 items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search GR #, PO #, invoice #, supplier..."
                                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
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

                        <div className="w-52">
                            <Combobox
                                value={matchStatusFilter}
                                onChange={setMatchStatusFilter}
                                options={[
                                    { value: '', label: 'All Match Statuses' },
                                    { value: 'PERFECT_MATCH', label: 'Perfect Match' },
                                    { value: 'SHORT_DELIVERY', label: 'Short Delivery' },
                                    { value: 'OVER_DELIVERY', label: 'Over Delivery' },
                                    { value: 'PRICE_VARIANCE', label: 'Price Variance' },
                                    { value: 'UNLINKED', label: 'Unlinked Direct' },
                                ]}
                                placeholder="Filter 3-way match..."
                            />
                        </div>
                    </div>

                    <div className="text-xs font-medium text-slate-500">
                        {receipts.total} {receipts.total === 1 ? 'receipt' : 'receipts'} processed
                    </div>
                </div>

                {/* Receipts Data Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">GR Number</th>
                                    <th className="px-4 py-3">Linked PO</th>
                                    <th className="px-4 py-3">Supplier & Invoice</th>
                                    <th className="px-4 py-3">Warehouse</th>
                                    <th className="px-4 py-3">Received At</th>
                                    <th className="px-4 py-3 text-center">3-Way Match</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            {isLoading ? (
                                <TableSkeleton rows={8} columns={7} />
                            ) : (
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {receipts.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <TruckIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                                    <p className="text-sm font-medium">No goods receipts found</p>
                                                    <p className="text-xs text-slate-400">
                                                        Scan and post inbound deliveries using the button above.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        receipts.data.map((gr) => (
                                        <tr
                                            key={gr.id}
                                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                        {gr.gr_number}
                                                    </span>
                                                    {gr.lines && (
                                                        <span className="text-[11px] text-slate-400">
                                                            ({gr.lines.length} items)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {gr.purchaseOrder ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs font-medium text-brand">
                                                            {gr.purchaseOrder.po_number}
                                                        </span>
                                                        {gr.purchaseOrder.supplier_reference && (
                                                            <span className="font-mono text-[10px] text-slate-500">
                                                                Ref: {gr.purchaseOrder.supplier_reference}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">None (Direct)</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {gr.supplier?.name || '-'}
                                                </div>
                                                {gr.supplier_invoice_number && (
                                                    <div className="font-mono text-[11px] text-slate-500">
                                                        Inv: {gr.supplier_invoice_number} (
                                                        {formatMoney(gr.supplier_invoice_amount_cents)})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                {gr.location?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                <div>{gr.received_at?.split('T')[0] || '-'}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    By: {gr.receiver?.name || 'Clerk'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {matchBadge(gr.match_status)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1.5 justify-end">
                                                    {gr.match_status === 'UNLINKED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setReceiptToLink(gr);
                                                                setLinkPoId('');
                                                            }}
                                                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 text-white px-2.5 text-xs font-medium hover:bg-amber-600 shadow-xs transition"
                                                        >
                                                            <span>Link to PO</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => inspectAudit(gr)}
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        <FileTextIcon className="h-3.5 w-3.5" />
                                                        <span>3-Way Match</span>
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

                    {/* Pagination */}
                    {receipts.links && receipts.links.length > 3 && (
                        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                            <span className="text-xs text-slate-500">
                                Showing {receipts.from || 0} to {receipts.to || 0} of {receipts.total} results
                            </span>
                            <div className="flex items-center gap-1">
                                {receipts.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url)}
                                        className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors ${
                                            link.active
                                                ? 'bg-brand text-white'
                                                : link.url
                                                  ? 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                                                  : 'opacity-40 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Blind Physical Intake & Barcode Scanning Workspace */}
            <Modal
                isOpen={isIntakeOpen}
                onClose={() => setIsIntakeOpen(false)}
                title="Blind Receiving Intake Workspace"
                description="Scan inbound physical items with hardware barcode reader (< 50ms) without seeing expected quantities."
                maxWidth="2xl"
            >
                <form onSubmit={handleIntakeSubmit} className="space-y-4">
                    {/* Header Controls: Linked PO & Inbound Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Link Purchase Order (Optional)
                            </label>
                            <Combobox
                                value={selectedPoId}
                                onChange={handlePoSelect}
                                options={[
                                    { value: '', label: 'None (Direct Inbound)' },
                                    ...openPurchaseOrders.map((po) => ({
                                        value: String(po.id),
                                        label: `${po.po_number}${po.supplier_reference ? ` [Ref: ${po.supplier_reference}]` : ''} - ${po.supplier?.name}`,
                                        description: po.supplier_reference
                                            ? `Supplier Ref/Invoice: ${po.supplier_reference} • ${po.supplier?.name}`
                                            : po.supplier?.name,
                                    })),
                                ]}
                                placeholder="Search by PO# or Supplier Ref/Inv..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier
                            </label>
                            <Combobox
                                value={selectedSupplierId}
                                onChange={setSelectedSupplierId}
                                options={suppliers.map((s) => ({
                                    value: String(s.id),
                                    label: `${s.supplier_code} - ${s.name}`,
                                }))}
                                placeholder="Select supplier..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Target Warehouse
                            </label>
                            <Combobox
                                value={selectedLocationId}
                                onChange={setSelectedLocationId}
                                options={locations.map((loc) => ({
                                    value: String(loc.id),
                                    label: `${loc.code} - ${loc.name}`,
                                }))}
                                placeholder="Select warehouse..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier Invoice #
                            </label>
                            <input
                                type="text"
                                value={supplierInvoiceNumber}
                                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                                placeholder="e.g. INV-90442"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Invoice Amount Billed (₱)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={supplierInvoiceAmount}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setSupplierInvoiceAmount(e.target.value)}
                                placeholder="0.00"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Delivery Note / Carrier Waybill #
                            </label>
                            <input
                                type="text"
                                value={supplierDeliveryNote}
                                onChange={(e) => setSupplierDeliveryNote(e.target.value)}
                                placeholder="e.g. DN-2026-0881"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    {/* Barcode Scanner Intake Input */}
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarcodeIcon className="h-4 w-4 text-brand" />
                                <span className="text-xs font-semibold tracking-wide">
                                    HARDWARE SCANNER LISTENER ACTIVE
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                                Wedge buffer &lt; 50ms keystrokes enabled
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={manualBarcodeInput}
                                    onChange={(e) => setManualBarcodeInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            processScannedBarcode(manualBarcodeInput);
                                        }
                                    }}
                                    placeholder="Scan barcode or type SKU (e.g. BEV-COLA-330) and press Enter..."
                                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white placeholder-slate-500 focus:border-brand focus:outline-hidden"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => processScannedBarcode(manualBarcodeInput)}
                                className="h-9 px-3.5 rounded-lg bg-brand text-xs font-medium text-white hover:bg-brand/90"
                            >
                                Enter
                            </button>
                        </div>

                        {scanFeedbackMsg && (
                            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-0.5">
                                <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>{scanFeedbackMsg}</span>
                            </div>
                        )}
                    </div>

                    {/* Blind Scanned Items List */}
                    <div>
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Scanned Physical Items ({scannedLines.length})
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Accepted count posts to destination warehouse, damaged count to DMG-BAY.
                            </span>
                        </div>

                        {scannedLines.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
                                No physical items scanned yet. Point scanner at incoming cartons or pallets.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {scannedLines.map((line, idx) => {
                                    const acceptedPkgs = Math.max(0, line.scanned_qty - line.rejected_qty);
                                    const totalBasePcs = line.scanned_qty * line.conversion_factor;

                                    return (
                                        <div
                                            key={idx}
                                            className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs"
                                        >
                                            <div className="col-span-3">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {line.product_name}
                                                </div>
                                                <div className="font-mono text-[10px] text-slate-400">
                                                    {line.product_sku} • {line.uom_name} (x{line.conversion_factor})
                                                </div>
                                            </div>

                                            <div className="col-span-2">
                                                <label className="text-[10px] text-slate-500 block">Scanned Pkgs</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={line.scanned_qty === 0 ? '' : line.scanned_qty}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const next = [...scannedLines];
                                                        next[idx].scanned_qty = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                                        setScannedLines(next);
                                                    }}
                                                    onBlur={() => {
                                                        if (!line.scanned_qty || line.scanned_qty < 1) {
                                                            const next = [...scannedLines];
                                                            next[idx].scanned_qty = 1;
                                                            setScannedLines(next);
                                                        }
                                                    }}
                                                    placeholder="1"
                                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <label className="text-[10px] text-rose-600 block">Damaged Pkgs</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={line.scanned_qty}
                                                    value={line.rejected_qty === 0 ? '' : line.rejected_qty}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const next = [...scannedLines];
                                                        next[idx].rejected_qty = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                                        setScannedLines(next);
                                                    }}
                                                    placeholder="0"
                                                    className="h-8 w-full rounded border border-rose-200 bg-rose-50/40 px-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <label className="text-[10px] text-slate-500 block">Batch #</label>
                                                <input
                                                    type="text"
                                                    value={line.batch_number}
                                                    onChange={(e) => {
                                                        const next = [...scannedLines];
                                                        next[idx].batch_number = e.target.value;
                                                        setScannedLines(next);
                                                    }}
                                                    placeholder="LOT-..."
                                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <label className="text-[10px] text-slate-500 block">Expiry Date</label>
                                                <input
                                                    type="date"
                                                    value={line.expiry_date}
                                                    onChange={(e) => {
                                                        const next = [...scannedLines];
                                                        next[idx].expiry_date = e.target.value;
                                                        setScannedLines(next);
                                                    }}
                                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                                />
                                            </div>

                                            <div className="col-span-1 flex justify-center pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setScannedLines(scannedLines.filter((_, i) => i !== idx))
                                                    }
                                                    className="p-1 text-slate-400 hover:text-rose-600"
                                                >
                                                    <XIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setIsIntakeOpen(false)}
                            className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={scannedLines.length === 0}
                            className="h-9 px-4 rounded-lg bg-brand text-sm font-medium text-white shadow-xs hover:bg-brand/90 transition-all disabled:opacity-50"
                        >
                            Post Goods Receipt & Update Ledgers
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: 3-Way Match Reconciliation Inspection */}
            {selectedReceiptForAudit && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setSelectedReceiptForAudit(null);
                        setAuditData(null);
                    }}
                    title={`3-Way Match Audit: ${selectedReceiptForAudit.gr_number}`}
                    description="Cross-reconciliation of Purchase Order vs Scanned Physical vs Supplier Invoice."
                    maxWidth="xl"
                >
                    {isAuditLoading ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                            Computing 3-way match variance analysis...
                        </div>
                    ) : auditData ? (
                        <div className="space-y-4 text-xs">
                            {/* Summary Match Banner */}
                            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Reconciliation Status</span>
                                    <div className="mt-1">{matchBadge(auditData.match_status)}</div>
                                </div>

                                {auditData.suggested_debit_memo_cents > 0 && (
                                    <div className="text-right">
                                        <span className="text-[11px] text-rose-500 font-medium block">
                                            Suggested Debit Memo Claim
                                        </span>
                                        <span className="font-mono text-sm font-bold text-rose-600">
                                            {formatMoney(auditData.suggested_debit_memo_cents)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 3 Pillars Comparison Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Pillar 1: Contractual PO */}
                                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase">
                                        <FileTextIcon className="h-3.5 w-3.5" />
                                        <span>1. Purchase Order</span>
                                    </div>
                                    <div className="font-mono text-xs text-slate-500">
                                        <div>{selectedReceiptForAudit.purchaseOrder?.po_number || 'Direct Inbound'}</div>
                                        {selectedReceiptForAudit.purchaseOrder?.supplier_reference && (
                                            <div className="text-[10px] text-slate-400">
                                                Ref: {selectedReceiptForAudit.purchaseOrder.supplier_reference}
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-1">
                                        <div className="text-[11px] text-slate-400">Ordered Base Units:</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {auditData.ordered_base_qty} pcs
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Expected Net Cost:</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {formatMoney(auditData.expected_cost_cents)}
                                        </div>
                                    </div>
                                </div>

                                {/* Pillar 2: Physical Intake */}
                                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase">
                                        <TruckIcon className="h-3.5 w-3.5" />
                                        <span>2. Physical Intake</span>
                                    </div>
                                    <div className="font-mono text-xs text-slate-500">
                                        {selectedReceiptForAudit.gr_number}
                                    </div>
                                    <div className="pt-1">
                                        <div className="text-[11px] text-slate-400">Counted Base Units:</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {auditData.received_base_qty} pcs
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Physical Variance:</div>
                                        <div
                                            className={`text-sm font-bold font-mono ${
                                                auditData.qty_variance_base === 0
                                                    ? 'text-emerald-600'
                                                    : auditData.qty_variance_base < 0
                                                      ? 'text-rose-600'
                                                      : 'text-amber-600'
                                            }`}
                                        >
                                            {auditData.qty_variance_base > 0 ? '+' : ''}
                                            {auditData.qty_variance_base} pcs
                                        </div>
                                    </div>
                                </div>

                                {/* Pillar 3: Supplier Invoice */}
                                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase">
                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                        <span>3. Supplier Invoice</span>
                                    </div>
                                    <div className="font-mono text-xs text-slate-500">
                                        {selectedReceiptForAudit.supplier_invoice_number || 'No Invoice Entered'}
                                    </div>
                                    <div className="pt-1">
                                        <div className="text-[11px] text-slate-400">Billed Total:</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {formatMoney(auditData.invoice_amount_cents)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Financial Variance:</div>
                                        <div
                                            className={`text-sm font-bold font-mono ${
                                                auditData.cost_variance_cents === 0
                                                    ? 'text-emerald-600'
                                                    : 'text-rose-600'
                                            }`}
                                        >
                                            {auditData.cost_variance_cents > 0 ? '+' : ''}
                                            {formatMoney(auditData.cost_variance_cents)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scanned Breakdown Lines Table */}
                            <div>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                                    Physically Received Lines
                                </span>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-3 py-2">Product / SKU</th>
                                                <th className="px-3 py-2">Pack UOM</th>
                                                <th className="px-3 py-2 text-center">Scanned Units</th>
                                                <th className="px-3 py-2 text-center">Accepted Base</th>
                                                <th className="px-3 py-2 text-center">Damaged Base</th>
                                                <th className="px-3 py-2">Batch / Lot</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {selectedReceiptForAudit.lines?.map((line) => (
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
                                                        {line.scanned_qty} pkgs
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-semibold text-emerald-600 font-mono">
                                                        {line.received_base_qty - line.rejected_base_qty} pcs
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-mono">
                                                        {line.rejected_base_qty > 0 ? (
                                                            <span className="text-rose-600 font-medium">
                                                                {line.rejected_base_qty} pcs (DMG-BAY)
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">0</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                                        {line.batch_number || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedReceiptForAudit(null);
                                        setAuditData(null);
                                    }}
                                    className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-medium dark:bg-slate-800"
                                >
                                    Close Audit
                                </button>
                            </div>
                        </div>
                    ) : null}
                </Modal>
            )}

            {/* Retroactive Link to Purchase Order Modal */}
            {receiptToLink && (
                <Modal
                    isOpen={!!receiptToLink}
                    onClose={() => setReceiptToLink(null)}
                    title={`Link Goods Receipt ${receiptToLink.gr_number} to PO`}
                    description={`Select an approved/sent Purchase Order for ${receiptToLink.supplier?.name} to associate with this intake.`}
                    confirmText={isLinking ? 'Linking...' : 'Confirm Link to PO'}
                    onConfirm={handleLinkPoSubmit}
                    isLoading={isLinking}
                    maxWidth="md"
                >
                    <div className="space-y-4">
                        <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                            <strong>Retroactive 3-Way Reconciliation:</strong> Once linked, physical received lines will be matched against the purchase order items, and quantity / price variances will be automatically audited.
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Select Purchase Order <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={linkPoId}
                                onChange={(e) => setLinkPoId(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">-- Choose Purchase Order --</option>
                                {openPurchaseOrders
                                    .filter((po) => po.supplier_id === receiptToLink.supplier_id)
                                    .map((po) => (
                                        <option key={po.id} value={po.id}>
                                            {po.po_number} - {(po.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'PHP' })} ({po.status})
                                        </option>
                                    ))}
                            </select>
                            {openPurchaseOrders.filter((po) => po.supplier_id === receiptToLink.supplier_id).length === 0 && (
                                <p className="mt-1 text-xs text-rose-500">
                                    No open purchase orders found for {receiptToLink.supplier?.name}. Create or send a PO first.
                                </p>
                            )}
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs space-y-1">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Supplier:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{receiptToLink.supplier?.name}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Delivery Note:</span>
                                <span className="font-mono text-slate-900 dark:text-slate-100">{receiptToLink.supplier_delivery_note || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Supplier Invoice:</span>
                                <span className="font-mono text-slate-900 dark:text-slate-100">{receiptToLink.supplier_invoice_number || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Invoice Total:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{formatMoney(receiptToLink.supplier_invoice_amount_cents)}</span>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </AppLayout>
    );
}
