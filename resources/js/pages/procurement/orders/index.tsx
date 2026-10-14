import React, { useState, useEffect, useRef } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import { Combobox } from '../../../components/ui/combobox';
import { Modal } from '../../../components/ui/modal';
import { TableSkeleton } from '../../../components/ui/skeleton';
import {
    SearchIcon,
    PlusIcon,
    FileTextIcon,
    TruckIcon,
    LayersIcon,
    XIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    PackageIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    BarcodeIcon,
} from '../../../components/ui/icons';
import type {
    PurchaseOrder,
    PurchaseOrderLine,
    Supplier,
    Location,
    Product,
    ProductUom,
    PaginatedData,
} from '../../../types/pos';

interface Props {
    orders: PaginatedData<PurchaseOrder>;
    suppliers: Supplier[];
    locations: Location[];
    products: Product[];
    filters: {
        search: string;
        status: string;
        supplier_id: string;
    };
}

interface NewPoLineItem {
    product_id: number;
    product_sku: string;
    product_name: string;
    product_category: string;
    product_uom_id: number;
    conversion_factor: number;
    ordered_qty: number;
    unit_cost: string; // Gross unit price in pesos string
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND';
    discount_percent_formula: string; // e.g. "0", "5", "10+5"
    discount_fixed_amount: string; // e.g. "0.00", "25.00"
    stock_on_hand: number;
}

/**
 * Computes exact unit discount and effective rate without float drift.
 */
function computeDiscount(
    grossUnitCost: number,
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND',
    percentFormula: string,
    fixedAmountStr: string
): { unitDiscount: number; effectivePct: number } {
    if (grossUnitCost <= 0) return { unitDiscount: 0, effectivePct: 0 };

    if (type === 'FIXED_AMOUNT') {
        const fixed = parseFloat(fixedAmountStr) || 0;
        const unitDiscount = Math.min(grossUnitCost, Math.max(0, fixed));
        const effectivePct = grossUnitCost > 0 ? unitDiscount / grossUnitCost : 0;
        return { unitDiscount, effectivePct };
    }

    if (type === 'COMPOUND') {
        const parts = (percentFormula || '')
            .split('+')
            .map((p) => parseFloat(p.trim()))
            .filter((p) => !isNaN(p) && p > 0);

        let remaining = grossUnitCost;
        for (const tierPct of parts) {
            const rate = tierPct / 100;
            if (rate > 0 && rate <= 1) {
                remaining = Math.max(0, remaining - remaining * rate);
            }
        }

        const fixedDeduction = Math.max(0, parseFloat(fixedAmountStr) || 0);
        remaining = Math.max(0, remaining - fixedDeduction);

        const unitDiscount = Math.max(0, grossUnitCost - remaining);
        const effectivePct = grossUnitCost > 0 ? unitDiscount / grossUnitCost : 0;
        return { unitDiscount, effectivePct };
    }

    // Default: PERCENTAGE (with optional cascading + notation)
    if (percentFormula.includes('+')) {
        const parts = percentFormula
            .split('+')
            .map((p) => parseFloat(p.trim()))
            .filter((p) => !isNaN(p) && p > 0);

        let remaining = grossUnitCost;
        for (const tierPct of parts) {
            const rate = tierPct / 100;
            if (rate > 0 && rate <= 1) {
                remaining = Math.max(0, remaining - remaining * rate);
            }
        }

        const unitDiscount = Math.max(0, grossUnitCost - remaining);
        const effectivePct = grossUnitCost > 0 ? unitDiscount / grossUnitCost : 0;
        return { unitDiscount, effectivePct };
    }

    const pct = (parseFloat(percentFormula) || 0) / 100;
    const effectivePct = Math.min(1, Math.max(0, pct));
    const unitDiscount = grossUnitCost * effectivePct;
    return { unitDiscount, effectivePct };
}

export interface OrderDiscountStep {
    id: string;
    type: 'PERCENT' | 'FIXED';
    value: string;
}

export interface DiscountPipelineResult {
    totalDiscount: number;
    stepBreakdown: Array<{
        stepIndex: number;
        type: 'PERCENT' | 'FIXED';
        label: string;
        stepDiscount: number;
        remaining: number;
    }>;
    formula: string;
}

/**
 * Computes exact sequential ordered discount pipeline (e.g. % -> ₱ -> %).
 * Each step operates on the remaining balance from the previous step.
 */
function computeDiscountPipeline(
    baseAmount: number,
    steps: OrderDiscountStep[]
): DiscountPipelineResult {
    if (baseAmount <= 0) {
        return { totalDiscount: 0, stepBreakdown: [], formula: '' };
    }

    let remaining = baseAmount;
    let totalDiscount = 0;
    const stepBreakdown: DiscountPipelineResult['stepBreakdown'] = [];
    const formulaParts: string[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const raw = (step.value || '').trim();
        if (!raw) continue;

        let stepDiscount = 0;
        let label = '';

        if (step.type === 'PERCENT') {
            if (raw.includes('+')) {
                const tiers = raw
                    .split('+')
                    .map((p) => parseFloat(p.trim()))
                    .filter((p) => !isNaN(p) && p > 0);
                let current = remaining;
                for (const t of tiers) {
                    const r = t / 100;
                    if (r > 0 && r <= 1) {
                        current = Math.max(0, current - current * r);
                    }
                }
                stepDiscount = Math.max(0, remaining - current);
                label = `${raw}%`;
            } else {
                const pct = parseFloat(raw) || 0;
                const rate = Math.min(1, Math.max(0, pct / 100));
                stepDiscount = remaining * rate;
                label = `${pct}%`;
            }
        } else {
            const fixed = parseFloat(raw) || 0;
            stepDiscount = Math.min(remaining, Math.max(0, fixed));
            label = `₱${fixed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        if (stepDiscount > 0 || (parseFloat(raw) || 0) > 0) {
            remaining = Math.max(0, remaining - stepDiscount);
            totalDiscount += stepDiscount;
            formulaParts.push(label);
            stepBreakdown.push({
                stepIndex: i + 1,
                type: step.type,
                label,
                stepDiscount,
                remaining,
            });
        }
    }

    return {
        totalDiscount,
        stepBreakdown,
        formula: formulaParts.join(' → '),
    };
}

export default function PurchaseOrdersIndex({
    orders,
    suppliers,
    locations,
    products,
    filters,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [supplierId, setSupplierId] = useState(filters.supplier_id || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    // Barcode Scanner & Instant Product Search State
    const [scannerInput, setScannerInput] = useState<string>('');
    const [scannerFeedback, setScannerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [searchActiveIndex, setSearchActiveIndex] = useState<number>(-1);
    const scannerInputRef = useRef<HTMLInputElement>(null);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    // Purchase Order Form State
    const [orderSupplierId, setOrderSupplierId] = useState<number>(
        suppliers.length > 0 ? suppliers[0].id : 0
    );
    const [orderLocationId, setOrderLocationId] = useState<number>(
        locations.length > 0 ? locations[0].id : 0
    );
    const [orderDate, setOrderDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [taxType, setTaxType] = useState<'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT'>('NON_VAT');
    const [orderDiscountSteps, setOrderDiscountSteps] = useState<OrderDiscountStep[]>([
        { id: 'step-1', type: 'PERCENT', value: '' },
    ]);

    const addDiscountStep = () => {
        setOrderDiscountSteps((prev) => [
            ...prev,
            { id: `step-${Date.now()}-${prev.length + 1}`, type: 'PERCENT', value: '' },
        ]);
    };

    const removeDiscountStep = (idx: number) => {
        setOrderDiscountSteps((prev) => {
            if (prev.length <= 1) {
                return [{ id: 'step-1', type: 'PERCENT', value: '' }];
            }
            return prev.filter((_, i) => i !== idx);
        });
    };

    const updateDiscountStep = (idx: number, field: 'type' | 'value', val: 'PERCENT' | 'FIXED' | string) => {
        setOrderDiscountSteps((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: val };
            return next;
        });
    };

    const moveDiscountStep = (fromIdx: number, toIdx: number) => {
        setOrderDiscountSteps((prev) => {
            if (toIdx < 0 || toIdx >= prev.length) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
    };
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
    const [supplierReference, setSupplierReference] = useState<string>('');
    const [orderNotes, setOrderNotes] = useState<string>('');
    const [lines, setLines] = useState<NewPoLineItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Helper: Find current stock on hand for a product at selected destination warehouse
    const getProductSoh = (prod: Product, locId: number): number => {
        if (!prod.balances) return 0;
        const bal = prod.balances.find((b) => b.location_id === locId);
        return bal ? bal.current_qty : 0;
    };

    // Start PO safely with NO line items when modal opens, and auto-focus scanner input
    useEffect(() => {
        if (isCreateOpen) {
            setLines([]);
            setSupplierReference('');
            setScannerInput('');
            setScannerFeedback(null);
            setIsSearchOpen(false);
            setSearchActiveIndex(-1);
            setTimeout(() => {
                scannerInputRef.current?.focus();
            }, 100);
        }
    }, [isCreateOpen]);

    // Update SOH on lines when destination warehouse changes
    useEffect(() => {
        if (lines.length > 0) {
            setLines((prev) =>
                prev.map((l) => {
                    const prod = products.find((p) => p.id === l.product_id);
                    return {
                        ...l,
                        stock_on_hand: prod ? getProductSoh(prod, orderLocationId) : 0,
                    };
                })
            );
        }
    }, [orderLocationId]);

    // Close search dropdown on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                searchDropdownRef.current &&
                !searchDropdownRef.current.contains(e.target as Node) &&
                scannerInputRef.current &&
                !scannerInputRef.current.contains(e.target as Node)
            ) {
                setIsSearchOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered products for instant search autocomplete
    const searchFilteredProducts = scannerInput.trim().length > 0
        ? products.filter((p) => {
              const q = scannerInput.trim().toLowerCase();
              return (
                  p.sku.toLowerCase().includes(q) ||
                  p.name.toLowerCase().includes(q) ||
                  (p.category && p.category.toLowerCase().includes(q)) ||
                  (p.uoms && p.uoms.some((u) => u.barcode && u.barcode.toLowerCase().includes(q)))
              );
          }).slice(0, 8)
        : [];

    // Automatically add a product & UOM to the order (called on barcode punch or search click)
    const addProductToOrder = (product: Product, specificUom?: ProductUom, qty: number = 1) => {
        const targetUom = specificUom || product.uoms?.[0];
        if (!targetUom) {
            setScannerFeedback({
                type: 'error',
                message: `Product ${product.name} has no packaging units defined.`,
            });
            return;
        }

        const soh = getProductSoh(product, orderLocationId);

        setLines((prev) => {
            const existingIdx = prev.findIndex(
                (l) => l.product_id === product.id && l.product_uom_id === targetUom.id
            );

            if (existingIdx !== -1) {
                const next = [...prev];
                const updatedQty = next[existingIdx].ordered_qty + qty;
                next[existingIdx] = {
                    ...next[existingIdx],
                    ordered_qty: updatedQty,
                };
                setScannerFeedback({
                    type: 'success',
                    message: `Increased ${product.name} (${targetUom.name}) to ${updatedQty} pkgs`,
                });
                return next;
            }

            const newLine: NewPoLineItem = {
                product_id: product.id,
                product_sku: product.sku,
                product_name: product.name,
                product_category: product.category || 'General',
                product_uom_id: targetUom.id,
                conversion_factor: targetUom.conversion_factor,
                ordered_qty: qty,
                unit_cost: targetUom.price_cents ? (targetUom.price_cents / 100).toFixed(2) : '100.00',
                discount_type: 'PERCENTAGE',
                discount_percent_formula: '0',
                discount_fixed_amount: '0.00',
                stock_on_hand: soh,
            };

            setScannerFeedback({
                type: 'success',
                message: `Added ${product.name} (${targetUom.name}) to order`,
            });

            return [newLine, ...prev];
        });

        setScannerInput('');
        setIsSearchOpen(false);
        setSearchActiveIndex(-1);
        scannerInputRef.current?.focus();

        setTimeout(() => setScannerFeedback(null), 3000);
    };

    // Handle barcode punch or Enter key submit in the scanner input
    const handleScannerSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const query = scannerInput.trim();
        if (!query) return;

        // 1. Exact barcode match in product_uoms
        for (const p of products) {
            const u = p.uoms?.find(
                (uom) => uom.barcode && uom.barcode.trim().toLowerCase() === query.toLowerCase()
            );
            if (u) {
                addProductToOrder(p, u, 1);
                return;
            }
        }

        // 2. Exact SKU match
        const exactSku = products.find(
            (p) => p.sku.trim().toLowerCase() === query.toLowerCase()
        );
        if (exactSku) {
            addProductToOrder(exactSku, undefined, 1);
            return;
        }

        // 3. Search filtered matches (auto-add top hit)
        if (searchFilteredProducts.length > 0) {
            addProductToOrder(searchFilteredProducts[0], undefined, 1);
        } else {
            setScannerFeedback({
                type: 'error',
                message: `No product or barcode matching "${query}"`,
            });
            setTimeout(() => setScannerFeedback(null), 3000);
        }
    };

    const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsSearchOpen(true);
            setSearchActiveIndex((prev) =>
                prev < searchFilteredProducts.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIsSearchOpen(true);
            setSearchActiveIndex((prev) =>
                prev > 0 ? prev - 1 : searchFilteredProducts.length - 1
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isSearchOpen && searchActiveIndex >= 0 && searchFilteredProducts[searchActiveIndex]) {
                addProductToOrder(searchFilteredProducts[searchActiveIndex]);
            } else {
                handleScannerSubmit();
            }
        } else if (e.key === 'Escape') {
            setIsSearchOpen(false);
            setSearchActiveIndex(-1);
        }
    };

    const removeLine = (index: number) => {
        setLines((prev) => prev.filter((_, i) => i !== index));
    };

    const updateLine = (
        index: number,
        fieldOrUpdates: keyof NewPoLineItem | Partial<NewPoLineItem>,
        val?: unknown
    ) => {
        setLines((prev) => {
            const next = [...prev];
            const current = next[index];
            if (!current) return prev;

            const partial: Partial<NewPoLineItem> =
                typeof fieldOrUpdates === 'string'
                    ? { [fieldOrUpdates]: val }
                    : fieldOrUpdates;

            const updated = { ...current, ...partial };

            if ('product_uom_id' in partial && partial.product_uom_id !== undefined) {
                const prod = products.find((p) => p.id === updated.product_id);
                const uom = prod?.uoms?.find((u) => u.id === Number(partial.product_uom_id));
                if (uom) {
                    updated.conversion_factor = uom.conversion_factor;
                    if (uom.price_cents) {
                        updated.unit_cost = (uom.price_cents / 100).toFixed(2);
                    }
                }
            }

            next[index] = updated;
            return next;
        });
    };

    // Calculate real-time financial totals across all lines
    const financialTotals = lines.reduce(
        (acc, line) => {
            const qty = Math.max(0, line.ordered_qty || 0);
            const grossUnit = Math.max(0, parseFloat(line.unit_cost) || 0);
            const { unitDiscount } = computeDiscount(
                grossUnit,
                line.discount_type,
                line.discount_percent_formula,
                line.discount_fixed_amount
            );
            const netUnit = Math.max(0, grossUnit - unitDiscount);

            const lineGross = qty * grossUnit;
            const lineDiscount = qty * unitDiscount;
            const lineNet = qty * netUnit;

            acc.subtotal += lineGross;
            acc.discount += lineDiscount;
            acc.netTotal += lineNet;
            acc.totalBasePieces += qty * line.conversion_factor;
            acc.totalPackages += qty;

            return acc;
        },
        { subtotal: 0, discount: 0, netTotal: 0, totalBasePieces: 0, totalPackages: 0 }
    );

    // 1. Net Subtotal After Line Trade Discounts
    const netAfterLineDiscounts = Math.max(0, financialTotals.subtotal - financialTotals.discount);

    // 2. Overall PO-Level Ordered Discount Pipeline Computation
    const pipelineResult = computeDiscountPipeline(netAfterLineDiscounts, orderDiscountSteps);
    const orderDiscountAmount = pipelineResult.totalDiscount;

    // 3. Combined Total Discounts & Final Taxable Base
    const totalCombinedDiscounts = financialTotals.discount + orderDiscountAmount;
    const netTaxableBase = Math.max(0, financialTotals.subtotal - totalCombinedDiscounts);

    // 4. Dynamic Tax Calculations (Default: NON_VAT)
    let calculatedVat = 0;
    let calculatedGrandTotal = 0;
    let taxableBaseDisplay = netTaxableBase;

    if (taxType === 'VAT_INCLUSIVE') {
        calculatedGrandTotal = netTaxableBase;
        calculatedVat = (netTaxableBase / 1.12) * 0.12;
        taxableBaseDisplay = netTaxableBase / 1.12;
    } else if (taxType === 'NON_VAT') {
        calculatedGrandTotal = netTaxableBase;
        calculatedVat = 0;
        taxableBaseDisplay = netTaxableBase;
    } else {
        // VAT_EXCLUSIVE (+12% VAT added on top of net taxable base)
        calculatedVat = netTaxableBase * 0.12;
        calculatedGrandTotal = netTaxableBase + calculatedVat;
        taxableBaseDisplay = netTaxableBase;
    }

    // Debounced filter URL synchronization
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (
                search !== filters.search ||
                status !== filters.status ||
                supplierId !== filters.supplier_id
            ) {
                setIsLoading(true);
                router.get(
                    '/procurement/orders',
                    {
                        ...(search ? { search } : {}),
                        ...(status ? { status } : {}),
                        ...(supplierId ? { supplier_id: supplierId } : {}),
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
    }, [search, status, supplierId, filters.search, filters.status, filters.supplier_id]);

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (lines.length === 0) return;

        setIsSubmitting(true);

        const payloadLines = lines.map((l) => {
            const costCents = Math.round((parseFloat(l.unit_cost) || 0) * 100);
            const { unitDiscount, effectivePct } = computeDiscount(
                parseFloat(l.unit_cost) || 0,
                l.discount_type,
                l.discount_percent_formula,
                l.discount_fixed_amount
            );

            const discountFormula =
                l.discount_type === 'COMPOUND'
                    ? `${l.discount_percent_formula || '0'}|${l.discount_fixed_amount || '0'}`
                    : l.discount_type === 'FIXED_AMOUNT'
                      ? l.discount_fixed_amount || '0'
                      : l.discount_percent_formula || '0';

            return {
                product_id: l.product_id,
                product_uom_id: l.product_uom_id,
                ordered_qty: Math.max(1, l.ordered_qty || 1),
                unit_cost_cents: costCents,
                discount_type: l.discount_type,
                discount_formula: discountFormula,
                discount_percent: effectivePct,
                discount_amount_cents: Math.round(unitDiscount * 100),
            };
        });

        const validSteps = orderDiscountSteps
            .filter((s) => (s.value || '').trim() !== '' && (parseFloat(s.value) || 0) > 0)
            .map((s) => ({
                type: s.type,
                value: parseFloat(s.value) || 0,
            }));

        const orderDiscountType = validSteps.length > 0 ? 'PIPELINE' : 'PERCENTAGE';
        const orderDiscountFormula = pipelineResult.formula || '0';
        const orderDiscountCents = Math.round(pipelineResult.totalDiscount * 100);

        router.post(
            '/procurement/orders',
            {
                supplier_id: Number(orderSupplierId),
                destination_location_id: Number(orderLocationId),
                supplier_reference: supplierReference.trim() || null,
                tax_type: taxType,
                order_discount_type: orderDiscountType,
                order_discount_formula: orderDiscountFormula,
                order_discount_steps: validSteps.length > 0 ? validSteps : null,
                order_discount_cents: orderDiscountCents,
                order_date: orderDate,
                expected_delivery_date: expectedDeliveryDate || null,
                notes: orderNotes || null,
                lines: payloadLines,
            },
            {
                onSuccess: () => {
                    setIsCreateOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            }
        );
    };

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
                <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-xs hover:bg-brand/90 transition-all focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create Purchase Order</span>
                </button>
            }
        >
            <Head title="Purchase Orders | APEX POS & WMS" />

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
                                placeholder="Search PO # or supplier..."
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

                        <div className="w-44">
                            <Combobox
                                value={status}
                                onChange={setStatus}
                                options={[
                                    { value: '', label: 'All Statuses' },
                                    { value: 'APPROVED', label: 'Approved' },
                                    { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
                                    { value: 'COMPLETED', label: 'Completed' },
                                    { value: 'DRAFT', label: 'Draft' },
                                    { value: 'CANCELLED', label: 'Cancelled' },
                                ]}
                                placeholder="Filter status..."
                            />
                        </div>

                        <div className="w-52">
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
                    </div>

                    <div className="text-xs font-medium text-slate-500">
                        {orders.total} {orders.total === 1 ? 'order' : 'orders'} found
                    </div>
                </div>

                {/* Orders Data Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">PO Number</th>
                                    <th className="px-4 py-3">Supplier</th>
                                    <th className="px-4 py-3">Destination</th>
                                    <th className="px-4 py-3">Order Date</th>
                                    <th className="px-4 py-3 text-right">Order Value</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            {isLoading ? (
                                <TableSkeleton rows={8} columns={7} />
                            ) : (
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {orders.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
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
                                                <td className="px-4 py-3 font-medium">
                                                    <div className="flex flex-col gap-0.5">
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
                                                        {po.supplier_reference && (
                                                            <span className="font-mono text-[10px] text-slate-500">
                                                                Ref: {po.supplier_reference}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                                        {po.supplier?.name || '-'}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-slate-400">
                                                        {po.supplier?.supplier_code}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                    {po.destinationLocation?.name || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                    <div>{po.order_date}</div>
                                                    {po.expected_delivery_date && (
                                                        <div className="text-[11px] text-slate-400">
                                                            Exp: {po.expected_delivery_date}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-end gap-1.5">
                                                        <span>{formatMoney(po.total_cents)}</span>
                                                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border font-normal text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                                            {po.tax_type === 'VAT_INCLUSIVE' ? 'VAT-Inc' : po.tax_type === 'NON_VAT' ? 'Non-VAT' : 'VAT-Ex'}
                                                        </span>
                                                    </div>
                                                    {po.discount_cents > 0 && (
                                                        <div className="text-[11px] text-emerald-600 font-medium">
                                                            -{formatMoney(po.discount_cents)} disc
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {statusBadge(po.status)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedOrder(po)}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                        >
                                                            Details
                                                        </button>
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

                    {/* Pagination */}
                    {orders.links && orders.links.length > 3 && (
                        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                            <span className="text-xs text-slate-500">
                                Showing {orders.from || 0} to {orders.to || 0} of {orders.total} results
                            </span>
                            <div className="flex items-center gap-1">
                                {orders.links.map((link, idx) => (
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

            {/* Modal: Create Purchase Order (Enterprise Wide Spreadsheet Layout) */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create Purchase Order"
                description="Issue an inbound order with multi-UOM conversions, live stock previews, and cascading trade discounts."
                maxWidth="6xl"
            >
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                    {/* Top Order Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier
                            </label>
                            <Combobox
                                value={String(orderSupplierId)}
                                onChange={(val) => setOrderSupplierId(Number(val))}
                                options={suppliers.map((s) => ({
                                    value: String(s.id),
                                    label: `${s.supplier_code} - ${s.name}`,
                                }))}
                                placeholder="Select supplier..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Destination Warehouse
                            </label>
                            <Combobox
                                value={String(orderLocationId)}
                                onChange={(val) => setOrderLocationId(Number(val))}
                                options={locations.map((loc) => ({
                                    value: String(loc.id),
                                    label: `${loc.code} - ${loc.name}`,
                                }))}
                                placeholder="Select warehouse..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier Ref / Order # (Optional)
                            </label>
                            <input
                                type="text"
                                value={supplierReference}
                                onChange={(e) => setSupplierReference(e.target.value)}
                                placeholder="e.g. SO-8942 / Pre-Invoice"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tax Treatment
                            </label>
                            <Combobox
                                value={taxType}
                                onChange={(val) => setTaxType(val as 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT')}
                                options={[
                                    { value: 'VAT_EXCLUSIVE', label: 'VAT-Exclusive (+12% VAT)' },
                                    { value: 'VAT_INCLUSIVE', label: 'VAT-Inclusive (12% Included)' },
                                    { value: 'NON_VAT', label: 'Non-VAT / Zero-Rated (0%)' },
                                ]}
                                placeholder="Select tax treatment..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Order Date
                            </label>
                            <input
                                type="date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Expected Delivery (Optional)
                            </label>
                            <input
                                type="date"
                                value={expectedDeliveryDate}
                                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    {/* FAST PRODUCT SCAN & AUTO-ADD ENGINE (Barcode Scanner & Instant Search) */}
                    <div className="relative bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarcodeIcon className="h-4 w-4 text-brand" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                    Product Scanner & Instant Auto-Add
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Barcode Scanner & Search Ready • Auto-Adds on Punch/Click
                            </span>
                        </div>

                        {/* Scanner / Search Input Form */}
                        <form onSubmit={handleScannerSubmit} className="relative">
                            <div className="relative flex items-center">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <BarcodeIcon className="h-4 w-4" />
                                </div>
                                <input
                                    ref={scannerInputRef}
                                    type="text"
                                    value={scannerInput}
                                    onChange={(e) => {
                                        setScannerInput(e.target.value);
                                        setIsSearchOpen(true);
                                        setSearchActiveIndex(-1);
                                    }}
                                    onKeyDown={handleScannerKeyDown}
                                    onFocus={() => {
                                        if (scannerInput.trim().length > 0) {
                                            setIsSearchOpen(true);
                                        }
                                    }}
                                    placeholder="Scan barcode with handheld scanner or type SKU / product name to search..."
                                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-28 text-xs text-white placeholder-slate-400 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                                    autoComplete="off"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {scannerInput && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannerInput('');
                                                setIsSearchOpen(false);
                                                scannerInputRef.current?.focus();
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-white"
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                                        ↵ Punch
                                    </kbd>
                                </div>
                            </div>

                            {/* Floating Autocomplete Search Dropdown */}
                            {isSearchOpen && scannerInput.trim().length > 0 && (
                                <div
                                    ref={searchDropdownRef}
                                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden divide-y divide-slate-800"
                                >
                                    <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between">
                                        <span>
                                            {searchFilteredProducts.length > 0
                                                ? `Matched Products (${searchFilteredProducts.length})`
                                                : 'No Exact Matches'}
                                        </span>
                                        <span className="text-[10px] font-normal text-slate-400 lowercase">
                                            click item or press enter to add
                                        </span>
                                    </div>

                                    {searchFilteredProducts.length > 0 ? (
                                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-800">
                                            {searchFilteredProducts.map((p, idx) => {
                                                const soh = getProductSoh(p, orderLocationId);
                                                const defaultUom = p.uoms?.[0];
                                                const isHighlighted = idx === searchActiveIndex;

                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => addProductToOrder(p)}
                                                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                                                            isHighlighted
                                                                ? 'bg-slate-800 text-white border-l-2 border-brand'
                                                                : 'hover:bg-slate-800/70 text-slate-200'
                                                        }`}
                                                    >
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-brand border border-slate-700 shrink-0">
                                                                {p.sku}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-white truncate">
                                                                    {p.name}
                                                                </p>
                                                                <p className="text-[11px] text-slate-400 truncate">
                                                                    {p.category || 'General'}
                                                                    {defaultUom && ` • Default: ${defaultUom.name} (x${defaultUom.conversion_factor})`}
                                                                    {defaultUom?.barcode && ` • Barcode: ${defaultUom.barcode}`}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span
                                                                className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                                                                    soh > 0
                                                                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                                                        : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                                                                }`}
                                                            >
                                                                SOH: {soh}
                                                            </span>
                                                            <span className="text-[11px] font-medium text-brand hover:underline">
                                                                + Auto-Add
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-4 text-xs text-slate-400 text-center">
                                            No products or barcodes match "{scannerInput}". Press Enter to search anyway or scan another item.
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>

                        {/* Scanner Feedback Notification */}
                        {scannerFeedback && (
                            <div
                                className={`text-[11px] flex items-center gap-1.5 pt-0.5 ${
                                    scannerFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                            >
                                {scannerFeedback.type === 'success' ? (
                                    <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{scannerFeedback.message}</span>
                            </div>
                        )}
                    </div>

                    {/* COMPACT SPREADSHEET LINE ITEMS TABLE */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider dark:text-slate-300">
                                Line Items ({lines.length} items • {financialTotals.totalPackages} packages • {financialTotals.totalBasePieces} total pieces)
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Supports %, fixed ₱, and stacked compound discounts (e.g. 10+5+2%)
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[300px] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2.5 w-8 text-center">#</th>
                                        <th className="px-3 py-2.5 min-w-[220px]">Product / SKU & Preview</th>
                                        <th className="px-3 py-2.5 w-36">Packaging UOM</th>
                                        <th className="px-3 py-2.5 w-24 text-center">Ordered Qty</th>
                                        <th className="px-3 py-2.5 w-28 text-right">Unit Cost (₱)</th>
                                        <th className="px-3 py-2.5 min-w-[210px]">Discount Engine</th>
                                        <th className="px-3 py-2.5 w-28 text-right">Line Net</th>
                                        <th className="px-3 py-2.5 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {lines.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                        <BarcodeIcon className="h-5 w-5 text-brand" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                            No Line Items Yet
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            Scan a product barcode or type in the search bar above to automatically punch and add items to this purchase order.
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        lines.map((line, idx) => {
                                        const prod = products.find((p) => p.id === line.product_id);
                                        const availableUoms = prod?.uoms || [];
                                        const grossCost = parseFloat(line.unit_cost) || 0;
                                        const { unitDiscount, effectivePct } = computeDiscount(
                                            grossCost,
                                            line.discount_type,
                                            line.discount_percent_formula,
                                            line.discount_fixed_amount
                                        );
                                        const lineNet = Math.max(0, grossCost - unitDiscount) * line.ordered_qty;
                                        const lineGross = grossCost * line.ordered_qty;

                                        return (
                                            <tr
                                                key={idx}
                                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                {/* Index Number */}
                                                <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                                                    {idx + 1}
                                                </td>

                                                {/* Product Details & SOH Preview */}
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col">
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                                                {line.product_name}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                                    {line.product_sku}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {line.product_category}
                                                                </span>
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                    SOH: {line.stock_on_hand} pcs
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Packaging UOM Select */}
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={line.product_uom_id}
                                                        onChange={(e) =>
                                                            updateLine(idx, 'product_uom_id', Number(e.target.value))
                                                        }
                                                        className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                    >
                                                        {availableUoms.map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.name} (x{u.conversion_factor})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Ordered Quantity */}
                                                <td className="px-3 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={line.ordered_qty === 0 ? '' : line.ordered_qty}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '') {
                                                                updateLine(idx, 'ordered_qty', 0);
                                                            } else {
                                                                const parsed = parseInt(val, 10);
                                                                updateLine(idx, 'ordered_qty', isNaN(parsed) ? 0 : Math.max(0, parsed));
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            if (!line.ordered_qty || line.ordered_qty < 1) {
                                                                updateLine(idx, 'ordered_qty', 1);
                                                            }
                                                        }}
                                                        placeholder="1"
                                                        className="h-8 w-20 text-center rounded border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                    />
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        ={(line.ordered_qty || 0) * line.conversion_factor} pcs
                                                    </div>
                                                </td>

                                                {/* Gross Unit Cost */}
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={line.unit_cost}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)}
                                                        onBlur={() => {
                                                            if (line.unit_cost === '' || isNaN(parseFloat(line.unit_cost))) {
                                                                updateLine(idx, 'unit_cost', '0.00');
                                                            }
                                                        }}
                                                        className="h-8 w-24 text-right rounded border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                    />
                                                </td>

                                                {/* Commercial Configurable Discount Engine */}
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            {/* Type Toggle: % or ₱ or Combo */}
                                                            <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    title="Percentage Discount (e.g. 5% or 10+5%)"
                                                                    onClick={() => updateLine(idx, 'discount_type', 'PERCENTAGE')}
                                                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                                        line.discount_type === 'PERCENTAGE'
                                                                            ? 'bg-brand text-white shadow-2xs'
                                                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                                    }`}
                                                                >
                                                                    %
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Fixed Amount Discount in Pesos (e.g. ₱25.00)"
                                                                    onClick={() => updateLine(idx, 'discount_type', 'FIXED_AMOUNT')}
                                                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                                        line.discount_type === 'FIXED_AMOUNT'
                                                                            ? 'bg-brand text-white shadow-2xs'
                                                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                                    }`}
                                                                >
                                                                    ₱
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Combo: Stacked % + Exact ₱ Allowance"
                                                                    onClick={() => updateLine(idx, 'discount_type', 'COMPOUND')}
                                                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                                        line.discount_type === 'COMPOUND'
                                                                            ? 'bg-brand text-white shadow-2xs'
                                                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                                    }`}
                                                                >
                                                                    Combo
                                                                </button>
                                                            </div>

                                                            {/* Formula / Value Input(s) */}
                                                            {line.discount_type === 'COMPOUND' ? (
                                                                <div className="flex items-center gap-1">
                                                                    {/* Stacked Percentage Input */}
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            value={line.discount_percent_formula}
                                                                            onFocus={(e) => e.target.select()}
                                                                            onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                            placeholder="10+5"
                                                                            title="Stacked Percentages e.g. 10+5"
                                                                            className="h-8 w-16 text-center font-mono text-xs rounded border border-slate-200 bg-white pr-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden"
                                                                        />
                                                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">%</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-400">-</span>
                                                                    {/* Exact Peso Allowance Input */}
                                                                    <div className="relative">
                                                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₱</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={line.discount_fixed_amount}
                                                                            onFocus={(e) => e.target.select()}
                                                                            onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                            placeholder="0.00"
                                                                            title="Fixed ₱ Allowance e.g. 50.00"
                                                                            className="h-8 w-16 text-center font-mono text-xs rounded border border-slate-200 bg-white pl-4 pr-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : line.discount_type === 'FIXED_AMOUNT' ? (
                                                                <div className="relative flex-1">
                                                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₱</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={line.discount_fixed_amount}
                                                                        onFocus={(e) => e.target.select()}
                                                                        onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="h-8 w-24 rounded border border-slate-200 bg-white pl-4 pr-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="relative flex-1">
                                                                    <input
                                                                        type="text"
                                                                        value={line.discount_percent_formula}
                                                                        onFocus={(e) => e.target.select()}
                                                                        onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                        placeholder="0"
                                                                        className="h-8 w-24 rounded border border-slate-200 bg-white pl-2 pr-5 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden"
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">%</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Real-Time Live Discount Preview */}
                                                        {unitDiscount > 0 && (
                                                            <div className="text-[10px] text-emerald-600 font-mono">
                                                                -₱{unitDiscount.toFixed(2)}/u ({(effectivePct * 100).toFixed(1)}% eff)
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Line Net Total */}
                                                <td className="px-3 py-2 text-right">
                                                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        ₱{lineNet.toFixed(2)}
                                                    </div>
                                                    {unitDiscount > 0 && (
                                                        <div className="text-[10px] text-slate-400 line-through font-mono">
                                                            ₱{lineGross.toFixed(2)}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Delete Action */}
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(idx)}
                                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                        title="Remove item from order"
                                                    >
                                                        <XIcon className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* FINANCIAL SUMMARY & NOTES STICKY FOOTER */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        {/* Order Notes & Terms */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Order Notes & Special Handling Instructions
                            </label>
                            <textarea
                                rows={3}
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                placeholder="Add delivery instructions, carrier appointment details, or supplier promotional notes..."
                                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {/* Financial Totals Breakdown */}
                        <div className="space-y-2 pl-2 md:border-l border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Gross Subtotal:</span>
                                <span className="font-mono">₱{financialTotals.subtotal.toFixed(2)}</span>
                            </div>
                            {financialTotals.discount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Line Trade Discounts:</span>
                                    <span className="font-mono">-₱{financialTotals.discount.toFixed(2)}</span>
                                </div>
                            )}

                            {/* Overall PO Discount Pipeline Engine */}
                            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            Overall PO Discount Pipeline
                                        </span>
                                    </div>
                                    {orderDiscountAmount > 0 && (
                                        <span className="font-mono text-emerald-600 font-semibold text-xs">
                                            -₱{orderDiscountAmount.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                {/* Sequential Ordered Steps */}
                                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                                    {orderDiscountSteps.map((step, idx) => {
                                        const breakdown = pipelineResult.stepBreakdown.find((b) => b.stepIndex === idx + 1);
                                        return (
                                            <div
                                                key={step.id}
                                                className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-xs"
                                            >
                                                {/* Step Index Badge */}
                                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                                    #{idx + 1}
                                                </span>

                                                {/* Type Toggle: % or ₱ */}
                                                <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        title="Percentage (%)"
                                                        onClick={() => updateDiscountStep(idx, 'type', 'PERCENT')}
                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                            step.type === 'PERCENT'
                                                                ? 'bg-brand text-white shadow-2xs'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Fixed Amount (₱)"
                                                        onClick={() => updateDiscountStep(idx, 'type', 'FIXED')}
                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                            step.type === 'FIXED'
                                                                ? 'bg-brand text-white shadow-2xs'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                        }`}
                                                    >
                                                        ₱
                                                    </button>
                                                </div>

                                                {/* Value Input */}
                                                <div className="relative flex-1">
                                                    {step.type === 'FIXED' && (
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₱</span>
                                                    )}
                                                    <input
                                                        type={step.type === 'FIXED' ? 'number' : 'text'}
                                                        step="0.01"
                                                        min="0"
                                                        value={step.value}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => updateDiscountStep(idx, 'value', e.target.value)}
                                                        placeholder={step.type === 'PERCENT' ? 'e.g. 10 or 10+5' : '0.00'}
                                                        className={`h-7 w-full rounded border border-slate-200 bg-white text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden ${
                                                            step.type === 'FIXED' ? 'pl-5 pr-2 text-right' : 'pl-2 pr-5 text-center'
                                                        }`}
                                                    />
                                                    {step.type === 'PERCENT' && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">%</span>
                                                    )}
                                                </div>

                                                {/* Step Impact Live Preview */}
                                                {breakdown && breakdown.stepDiscount > 0 && (
                                                    <div className="hidden sm:flex flex-col text-right font-mono text-[10px] leading-tight shrink-0 px-1 text-emerald-600 dark:text-emerald-400">
                                                        <span>-₱{breakdown.stepDiscount.toFixed(2)}</span>
                                                        <span className="text-[9px] text-slate-400">rem: ₱{breakdown.remaining.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                {/* Reorder Arrows: Up / Down */}
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={idx === 0}
                                                        onClick={() => moveDiscountStep(idx, idx - 1)}
                                                        title="Move step earlier in sequence"
                                                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                                    >
                                                        <ChevronUpIcon className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={idx === orderDiscountSteps.length - 1}
                                                        onClick={() => moveDiscountStep(idx, idx + 1)}
                                                        title="Move step later in sequence"
                                                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                                    >
                                                        <ChevronDownIcon className="h-3 w-3" />
                                                    </button>
                                                </div>

                                                {/* Remove Step Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeDiscountStep(idx)}
                                                    title="Remove discount step"
                                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                                                >
                                                    <XIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add Step & Sequence Waterfall Formula */}
                                <div className="flex items-center justify-between pt-0.5">
                                    <button
                                        type="button"
                                        onClick={addDiscountStep}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand/80 transition-colors"
                                    >
                                        <PlusIcon className="h-3 w-3" />
                                        <span>Add Discount Step</span>
                                    </button>

                                    {pipelineResult.formula && (
                                        <div
                                            className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[210px]"
                                            title={`Execution Pipeline: ${pipelineResult.formula}`}
                                        >
                                            {pipelineResult.formula}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {taxType === 'VAT_INCLUSIVE' ? (
                                <>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Net Vatable Sales:</span>
                                        <span className="font-mono">₱{taxableBaseDisplay.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>12% VAT Included:</span>
                                        <span className="font-mono">₱{calculatedVat.toFixed(2)}</span>
                                    </div>
                                </>
                            ) : taxType === 'NON_VAT' ? (
                                <div className="flex justify-between text-slate-500">
                                    <span>Tax (Non-VAT / Zero-Rated):</span>
                                    <span className="font-mono">₱0.00</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Net Taxable Base:</span>
                                        <span className="font-mono">₱{taxableBaseDisplay.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>12% VAT (Added):</span>
                                        <span className="font-mono">+₱{calculatedVat.toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                                <span>Grand Total Payable:</span>
                                <span className="font-mono text-brand text-base">
                                    ₱{calculatedGrandTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Modal Controls */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || lines.length === 0}
                            className="h-9 px-5 rounded-lg bg-brand text-sm font-medium text-white shadow-xs hover:bg-brand/90 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Generating Purchase Order...' : 'Generate Purchase Order'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: View Purchase Order Details */}
            {selectedOrder && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedOrder(null)}
                    title={`Purchase Order: ${selectedOrder.po_number}`}
                    description={`Contract with ${selectedOrder.supplier?.name}`}
                    maxWidth="5xl"
                >
                    <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Supplier Code</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                    {selectedOrder.supplier?.supplier_code}
                                </span>
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
                                    {selectedOrder.destinationLocation?.name}
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
                                    {selectedOrder.order_date}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Status</span>
                                <div>{statusBadge(selectedOrder.status)}</div>
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

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedOrder(null)}
                                className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-medium dark:bg-slate-800"
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
