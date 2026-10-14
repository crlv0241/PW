import React, { useState, useEffect, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import { Combobox } from '../../../components/ui/combobox';
import {
    SearchIcon,
    PlusIcon,
    TruckIcon,
    LayersIcon,
    XIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    PackageIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    BarcodeIcon,
    TrashIcon,
    ArrowRightIcon,
    EditIcon,
} from '../../../components/ui/icons';
import type {
    Supplier,
    Location,
    Product,
    ProductUom,
    PurchaseOrder,
} from '../../../types/pos';

interface Props {
    order: PurchaseOrder;
    suppliers: Supplier[];
    locations: Location[];
    products: Product[];
}

interface NewPoLineItem {
    product_id: number;
    product_sku: string;
    product_name: string;
    product_category: string;
    product_uom_id: number;
    conversion_factor: number;
    ordered_qty: number;
    unit_cost: string;
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND';
    discount_percent_formula: string;
    discount_fixed_amount: string;
    stock_on_hand: number;
}

interface OrderDiscountStep {
    id: string;
    type: 'PERCENT' | 'FIXED';
    value: string;
}

interface ParsedPunch {
    query: string;
    qty: number;
    isOnlyMultiplier: boolean;
}

/**
 * Pure deterministic discount calculator for individual packaging units.
 */
function computeDiscount(
    grossCost: number,
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND',
    formula: string,
    fixedAmount: string
): { unitDiscount: number; effectivePct: number } {
    if (grossCost <= 0) return { unitDiscount: 0, effectivePct: 0 };

    if (type === 'FIXED_AMOUNT') {
        const fixed = parseFloat(fixedAmount) || 0;
        const unitDiscount = Math.min(grossCost, Math.max(0, fixed));
        const effectivePct = grossCost > 0 ? unitDiscount / grossCost : 0;
        return { unitDiscount, effectivePct };
    }

    if (type === 'COMPOUND') {
        const tiers = (formula || '')
            .split('+')
            .map((s) => parseFloat(s.trim()))
            .filter((n) => !isNaN(n) && n > 0 && n <= 100);

        let remaining = grossCost;
        for (const ratePct of tiers) {
            const stepDiscount = remaining * (ratePct / 100);
            remaining = Math.max(0, remaining - stepDiscount);
        }

        const fixed = parseFloat(fixedAmount) || 0;
        remaining = Math.max(0, remaining - fixed);

        const unitDiscount = Math.max(0, grossCost - remaining);
        const effectivePct = grossCost > 0 ? unitDiscount / grossCost : 0;
        return { unitDiscount, effectivePct };
    }

    // Standard PERCENTAGE or Stacked formula (e.g. "10+5+2")
    const tiers = (formula || '')
        .split('+')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0 && n <= 100);

    if (tiers.length === 0) {
        return { unitDiscount: 0, effectivePct: 0 };
    }

    let remaining = grossCost;
    for (const ratePct of tiers) {
        const stepDiscount = remaining * (ratePct / 100);
        remaining = Math.max(0, remaining - stepDiscount);
    }

    const unitDiscount = Math.max(0, grossCost - remaining);
    const effectivePct = grossCost > 0 ? unitDiscount / grossCost : 0;
    return { unitDiscount, effectivePct };
}

/**
 * Computes an ordered sequence of discounts (percentage and fixed deductions)
 */
function computeDiscountPipeline(
    grossPayable: number,
    steps: OrderDiscountStep[]
): {
    totalDiscount: number;
    finalNet: number;
    breakdown: Array<{ stepId: string; type: 'PERCENT' | 'FIXED'; value: number; discount: number; resultingRemaining: number }>;
    formula: string;
} {
    let remaining = Math.max(0, grossPayable);
    let totalDiscount = 0;
    const breakdown: Array<{ stepId: string; type: 'PERCENT' | 'FIXED'; value: number; discount: number; resultingRemaining: number }> = [];
    const formulaTokens: string[] = [];

    for (const step of steps) {
        const val = parseFloat(step.value);
        if (isNaN(val) || val <= 0) continue;

        let stepDiscount = 0;
        if (step.type === 'PERCENT') {
            const rate = Math.min(1, Math.max(0, val / 100));
            stepDiscount = remaining * rate;
            formulaTokens.push(`${val}%`);
        } else {
            stepDiscount = Math.min(remaining, Math.max(0, val));
            formulaTokens.push(`₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }

        remaining = Math.max(0, remaining - stepDiscount);
        totalDiscount += stepDiscount;

        breakdown.push({
            stepId: step.id,
            type: step.type,
            value: val,
            discount: stepDiscount,
            resultingRemaining: remaining,
        });
    }

    return {
        totalDiscount,
        finalNet: remaining,
        breakdown,
        formula: formulaTokens.join(' → '),
    };
}

export default function EditPurchaseOrderPage({ order, suppliers, locations, products }: Props) {
    // Top document details
    const [orderSupplierId, setOrderSupplierId] = useState<number>(order.supplier_id || (suppliers[0]?.id ?? 0));
    const [orderLocationId, setOrderLocationId] = useState<number>(order.destination_location_id || (locations[0]?.id ?? 0));
    const [supplierReference, setSupplierReference] = useState<string>(order.supplier_reference ?? '');
    const [orderDate, setOrderDate] = useState<string>(
        order.order_date ? order.order_date.split('T')[0] : new Date().toISOString().split('T')[0]
    );
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(
        order.expected_delivery_date ? order.expected_delivery_date.split('T')[0] : ''
    );
    const [taxType, setTaxType] = useState<'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT'>(order.tax_type ?? 'NON_VAT');
    const [orderNotes, setOrderNotes] = useState<string>(order.notes ?? '');

    // Initialize lines from existing order
    const [lines, setLines] = useState<NewPoLineItem[]>(() => {
        if (!order.lines || order.lines.length === 0) return [];
        return order.lines.map((l) => {
            const catalogProd = products.find((p) => p.id === l.product_id);
            const soh = catalogProd?.balances?.reduce((sum, b) => sum + (b.current_qty || 0), 0) || 0;

            let discType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND' = 'PERCENTAGE';
            if (l.discount_type === 'FIXED_AMOUNT') discType = 'FIXED_AMOUNT';
            else if (l.discount_type === 'COMPOUND') discType = 'COMPOUND';

            let pctFormula = '';
            let fixedAmount = '';
            if (discType === 'COMPOUND' && l.discount_formula) {
                const parts = l.discount_formula.split('|');
                pctFormula = parts[0] || '';
                fixedAmount = parts[1] || '';
            } else if (discType === 'FIXED_AMOUNT') {
                fixedAmount = l.discount_amount_cents
                    ? (l.discount_amount_cents / 100).toFixed(2)
                    : l.discount_formula || '';
            } else {
                pctFormula = l.discount_formula || (l.discount_percent ? String(parseFloat(l.discount_percent) * 100) : '');
            }

            return {
                product_id: l.product_id,
                product_sku: l.product?.sku || catalogProd?.sku || '',
                product_name: l.product?.name || catalogProd?.name || '',
                product_category: l.product?.category || catalogProd?.category || 'General',
                product_uom_id: l.product_uom_id,
                conversion_factor: l.conversion_factor || l.uom?.conversion_factor || 1,
                ordered_qty: l.ordered_qty,
                unit_cost: (l.unit_cost_cents / 100).toFixed(2),
                discount_type: discType,
                discount_percent_formula: pctFormula,
                discount_fixed_amount: fixedAmount,
                stock_on_hand: soh,
            };
        });
    });

    // Initialize overall PO discount pipeline steps from existing order
    const [orderDiscountSteps, setOrderDiscountSteps] = useState<OrderDiscountStep[]>(() => {
        if (order.order_discount_steps && order.order_discount_steps.length > 0) {
            return order.order_discount_steps.map((s, idx) => ({
                id: `step-${idx + 1}`,
                type: s.type,
                value: String(s.value),
            }));
        }
        return [{ id: 'step-1', type: 'PERCENT', value: '' }];
    });

    // Console State
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [catalogSearch, setCatalogSearch] = useState<string>('');
    const [stickyMultiplier, setStickyMultiplier] = useState<number | null>(null);
    const [punchQuery, setPunchQuery] = useState<string>('');
    const [punchMessage, setPunchMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);
    const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const punchInputRef = useRef<HTMLInputElement>(null);
    const catalogTableContainerRef = useRef<HTMLDivElement>(null);

    // Categories
    const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

    // Filtered Products
    const filteredProducts = products.filter((prod) => {
        const matchesCategory = selectedCategory === 'ALL' || prod.category === selectedCategory;
        const matchesSearch =
            !catalogSearch ||
            prod.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            prod.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            prod.uoms?.some((u) => u.barcode && u.barcode.toLowerCase().includes(catalogSearch.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // Auto-focus the punch input console on mount
    useEffect(() => {
        punchInputRef.current?.focus();
    }, []);

    // Clear punch feedback after 3.5s
    useEffect(() => {
        if (!punchMessage) return;
        const t = setTimeout(() => setPunchMessage(null), 3500);
        return () => clearTimeout(t);
    }, [punchMessage]);

    // Parse punch query (e.g. "*3", "3*", "3*CAN-TUNA-180", or "CAN-TUNA-180*3")
    const parsePunchQuery = (raw: string): ParsedPunch => {
        const trimmed = raw.trim();
        if (!trimmed) return { query: '', qty: 1, isOnlyMultiplier: false };

        const prefixMatch = trimmed.match(/^(\d+)\s*\*\s*(.*)$/);
        if (prefixMatch) {
            const mult = parseInt(prefixMatch[1], 10) || 1;
            const query = prefixMatch[2].trim();
            return {
                query,
                qty: mult,
                isOnlyMultiplier: query.length === 0,
            };
        }

        const altPrefixMatch = trimmed.match(/^\*\s*(\d+)\s*(.*)$/);
        if (altPrefixMatch) {
            const mult = parseInt(altPrefixMatch[1], 10) || 1;
            const query = altPrefixMatch[2].trim();
            return {
                query,
                qty: mult,
                isOnlyMultiplier: query.length === 0,
            };
        }

        const suffixMatch = trimmed.match(/^(.*?)\s*\*\s*(\d+)$/);
        if (suffixMatch) {
            const query = suffixMatch[1].trim();
            const mult = parseInt(suffixMatch[2], 10) || 1;
            return {
                query,
                qty: mult,
                isOnlyMultiplier: false,
            };
        }

        return {
            query: trimmed,
            qty: stickyMultiplier ?? 1,
            isOnlyMultiplier: false,
        };
    };

    // Add or increment a product line
    const addProductToOrder = (product: Product, quantityToAdd: number = 1, preferredUomId?: number) => {
        if (quantityToAdd <= 0) return;

        const uom = preferredUomId
            ? product.uoms?.find((u) => u.id === preferredUomId) || product.uoms?.[0]
            : product.uoms?.find((u) => u.is_base_unit) || product.uoms?.[0];

        if (!uom) {
            setPunchMessage({
                text: `Cannot add ${product.sku}: No UOM packaging defined.`,
                type: 'error',
            });
            return;
        }

        const existingIdx = lines.findIndex(
            (l) => l.product_id === product.id && l.product_uom_id === uom.id
        );

        const soh = product.balances?.reduce((sum, b) => sum + (b.current_qty || 0), 0) || 0;
        const initialCost = uom.price_cents ? (uom.price_cents / 100).toFixed(2) : '0.00';

        if (existingIdx !== -1) {
            setLines((prev) => {
                const next = [...prev];
                const cur = next[existingIdx];
                next[existingIdx] = {
                    ...cur,
                    ordered_qty: cur.ordered_qty + quantityToAdd,
                };
                return next;
            });
            setPunchMessage({
                text: `Incremented ${product.sku} by +${quantityToAdd} ${uom.name}.`,
                type: 'success',
            });
        } else {
            const newLine: NewPoLineItem = {
                product_id: product.id,
                product_sku: product.sku,
                product_name: product.name,
                product_category: product.category || 'General',
                product_uom_id: uom.id,
                conversion_factor: uom.conversion_factor,
                ordered_qty: quantityToAdd,
                unit_cost: initialCost,
                discount_type: 'PERCENTAGE',
                discount_percent_formula: '',
                discount_fixed_amount: '',
                stock_on_hand: soh,
            };
            setLines((prev) => [newLine, ...prev]);
            setPunchMessage({
                text: `Added ${product.sku} (${quantityToAdd} ${uom.name}) to active lines.`,
                type: 'success',
            });
        }

        if (stickyMultiplier !== null) {
            setStickyMultiplier(null);
        }
    };

    // Execute punch action from bottom console
    const handlePunchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const parsed = parsePunchQuery(punchQuery);

        if (parsed.isOnlyMultiplier) {
            setStickyMultiplier(parsed.qty);
            setPunchQuery('');
            setPunchMessage({
                text: `Sticky multiplier set: *${parsed.qty}. Next scanned or selected item will punch ${parsed.qty} qty.`,
                type: 'success',
            });
            return;
        }

        if (!parsed.query) {
            if (filteredProducts.length > 0 && activeRowIndex >= 0 && activeRowIndex < filteredProducts.length) {
                const target = filteredProducts[activeRowIndex];
                addProductToOrder(target, parsed.qty);
                setPunchQuery('');
            }
            return;
        }

        const exactBarcodeMatch = products.find((p) =>
            p.uoms?.some((u) => u.barcode && u.barcode.toLowerCase() === parsed.query.toLowerCase())
        );

        if (exactBarcodeMatch) {
            const matchedUom = exactBarcodeMatch.uoms?.find(
                (u) => u.barcode && u.barcode.toLowerCase() === parsed.query.toLowerCase()
            );
            addProductToOrder(exactBarcodeMatch, parsed.qty, matchedUom?.id);
            setPunchQuery('');
            return;
        }

        const exactSkuMatch = products.find(
            (p) => p.sku.toLowerCase() === parsed.query.toLowerCase()
        );

        if (exactSkuMatch) {
            addProductToOrder(exactSkuMatch, parsed.qty);
            setPunchQuery('');
            return;
        }

        const partialMatches = products.filter(
            (p) =>
                p.sku.toLowerCase().includes(parsed.query.toLowerCase()) ||
                p.name.toLowerCase().includes(parsed.query.toLowerCase())
        );

        if (partialMatches.length === 1) {
            addProductToOrder(partialMatches[0], parsed.qty);
            setPunchQuery('');
            return;
        }

        if (partialMatches.length > 1) {
            setCatalogSearch(parsed.query);
            setActiveRowIndex(0);
            setPunchMessage({
                text: `Found ${partialMatches.length} matching products. Use Up/Down arrows and Enter to punch.`,
                type: 'warning',
            });
            return;
        }

        setPunchMessage({
            text: `No matching product or barcode found for "${parsed.query}".`,
            type: 'error',
        });
    };

    // Keyboard navigation in punch input
    const handlePunchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveRowIndex((prev) => Math.min(filteredProducts.length - 1, prev + 1));
            scrollActiveRowIntoView(activeRowIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveRowIndex((prev) => Math.max(0, prev - 1));
            scrollActiveRowIntoView(activeRowIndex - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handlePunchSubmit();
        } else if (e.key === 'Escape') {
            setPunchQuery('');
            setCatalogSearch('');
            setStickyMultiplier(null);
            setPunchMessage(null);
        }
    };

    const scrollActiveRowIntoView = (index: number) => {
        if (!catalogTableContainerRef.current) return;
        const row = catalogTableContainerRef.current.querySelector<HTMLTableRowElement>(`tr[data-index="${index}"]`);
        if (row) {
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        taxableBaseDisplay = netTaxableBase / 1.12;
        calculatedVat = netTaxableBase - taxableBaseDisplay;
        calculatedGrandTotal = netTaxableBase;
    } else if (taxType === 'VAT_EXCLUSIVE') {
        taxableBaseDisplay = netTaxableBase;
        calculatedVat = netTaxableBase * 0.12;
        calculatedGrandTotal = netTaxableBase + calculatedVat;
    } else {
        // NON_VAT / Zero-Rated
        taxableBaseDisplay = netTaxableBase;
        calculatedVat = 0;
        calculatedGrandTotal = netTaxableBase;
    }

    const handleUpdateSubmit = (e: React.FormEvent) => {
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
        const orderDiscountFormula = pipelineResult.formula || null;
        const orderDiscountCents = Math.round(pipelineResult.totalDiscount * 100);

        const payload = {
            supplier_id: Number(orderSupplierId),
            destination_location_id: Number(orderLocationId),
            supplier_reference: supplierReference.trim() || null,
            order_date: orderDate,
            expected_delivery_date: expectedDeliveryDate || null,
            notes: orderNotes.trim() || null,
            tax_type: taxType,
            order_discount_type: orderDiscountType,
            order_discount_formula: orderDiscountFormula,
            order_discount_steps: validSteps.length > 0 ? validSteps : null,
            order_discount_cents: orderDiscountCents,
            lines: payloadLines,
        };

        router.put(`/procurement/orders/${order.id}`, payload, {
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout contentClassName="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
            <Head title={`Adjust Purchase Order ${order.po_number} | APEX POS & WMS`} />

            <form id="edit-po-form" onSubmit={handleUpdateSubmit} className="space-y-4">
                {/* UPPER PART: PURCHASE ORDER DETAILS BANNER */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <EditIcon className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Adjust Purchase Order
                                    </h2>
                                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                                        {order.po_number}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Adjust order lines, UOM quantities, supplier reference, and overall discount pipeline before receiving
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Status: {order.status}
                            </span>
                            <Link
                                href="/procurement/orders"
                                className="inline-flex h-8 items-center px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={isSubmitting || lines.length === 0}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-brand/90 transition-all disabled:opacity-50"
                            >
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                <span>{isSubmitting ? 'Saving Adjustments...' : 'Save Adjustments'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 6-Column Responsive Field Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tax Treatment
                            </label>
                            <Combobox
                                value={taxType}
                                onChange={(val) => setTaxType(val as 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT')}
                                options={[
                                    { value: 'NON_VAT', label: 'Non-VAT (0%)' },
                                    { value: 'VAT_EXCLUSIVE', label: 'VAT-Exclusive (+12%)' },
                                    { value: 'VAT_INCLUSIVE', label: 'VAT-Inclusive (12% in total)' },
                                ]}
                                placeholder="Tax Treatment..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier Ref / Order #
                            </label>
                            <input
                                type="text"
                                value={supplierReference}
                                onChange={(e) => setSupplierReference(e.target.value)}
                                placeholder="e.g. SO-8942 / Invoice"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Order Date
                            </label>
                            <input
                                type="date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Expected Delivery
                            </label>
                            <input
                                type="date"
                                value={expectedDeliveryDate}
                                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                min={orderDate}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </div>
                    </div>
                </div>

                {/* MAIN 2-COLUMN WORKSPACE: LEFT CATALOG + PUNCH (42%), RIGHT ACTIVE ORDER REVIEW (58%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* LEFT COLUMN: PRODUCT SOURCING & FAST PUNCH CONSOLE (5 COLS / ~42%) */}
                    <div className="lg:col-span-5 flex flex-col gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
                            {/* Catalog Header & Category Pills */}
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                            Product Catalog
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            {filteredProducts.length} items
                                        </span>
                                    </div>
                                    <div className="relative w-44">
                                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={catalogSearch}
                                            onChange={(e) => {
                                                setCatalogSearch(e.target.value);
                                                setActiveRowIndex(0);
                                            }}
                                            placeholder="Filter catalog..."
                                            className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs text-slate-900 focus:border-brand focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                        />
                                    </div>
                                </div>

                                {/* Category Pills */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                setActiveRowIndex(0);
                                            }}
                                            className={`h-6 px-2.5 rounded-full text-[11px] font-medium shrink-0 transition-colors ${
                                                selectedCategory === cat
                                                    ? 'bg-brand text-white shadow-2xs'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Catalog Table with Click-to-Punch & Arrow Selection */}
                            <div
                                ref={catalogTableContainerRef}
                                className="overflow-y-auto max-h-[calc(100vh-420px)] min-h-[300px] divide-y divide-slate-100 dark:divide-slate-800/80"
                            >
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-2">SKU / Code</th>
                                            <th className="px-3 py-2">Product Description</th>
                                            <th className="px-3 py-2">Default UOM</th>
                                            <th className="px-2 py-2 text-center">SOH</th>
                                            <th className="px-3 py-2 text-right">Unit Cost</th>
                                            <th className="px-2 py-2 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {filteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                                                    No products match your filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProducts.map((prod, idx) => {
                                                const isRowSelected = idx === activeRowIndex;
                                                const baseUom = prod.uoms?.find((u) => u.is_base_unit) || prod.uoms?.[0];
                                                const soh = prod.balances?.reduce((sum, b) => sum + (b.current_qty || 0), 0) || 0;
                                                const cost = baseUom?.price_cents ? (baseUom.price_cents / 100).toFixed(2) : '0.00';

                                                return (
                                                    <tr
                                                        key={prod.id}
                                                        data-index={idx}
                                                        onClick={() => {
                                                            setActiveRowIndex(idx);
                                                            addProductToOrder(prod, stickyMultiplier ?? 1);
                                                        }}
                                                        className={`cursor-pointer transition-colors ${
                                                            isRowSelected
                                                                ? 'bg-brand/5 dark:bg-brand/10 ring-1 ring-inset ring-brand/30'
                                                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                        }`}
                                                    >
                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                            <div>{prod.sku}</div>
                                                            {baseUom?.barcode && (
                                                                <div className="text-[10px] text-slate-400 font-normal">
                                                                    {baseUom.barcode}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                                                                {prod.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 line-clamp-1">
                                                                {prod.category || 'General'}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
                                                            {baseUom?.name} {baseUom && baseUom.conversion_factor > 1 ? `(x${baseUom.conversion_factor})` : '(x1)'}
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                {soh}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                            ₱{cost}
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    addProductToOrder(prod, stickyMultiplier ?? 1);
                                                                }}
                                                                className="h-6 px-2 rounded bg-slate-100 hover:bg-brand hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors"
                                                            >
                                                                + Add
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

                        {/* HIGH-SPEED PUNCH & SCANNER CONSOLE */}
                        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 font-semibold tracking-wide text-slate-300 uppercase">
                                    <BarcodeIcon className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Punch & Scanner Console</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {stickyMultiplier !== null && (
                                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                                            Multiplier: *{stickyMultiplier}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                        Ready for Multipliers (*3 / 3*SKU)
                                    </span>
                                </div>
                            </div>

                            <div className="relative flex items-center gap-1.5">
                                <div className="relative flex-1">
                                    <input
                                        ref={punchInputRef}
                                        type="text"
                                        value={punchQuery}
                                        onChange={(e) => setPunchQuery(e.target.value)}
                                        onKeyDown={handlePunchKeyDown}
                                        placeholder="Scan barcode, punch SKU, or set quantity (e.g. 3*SKU, *3, or filter)..."
                                        className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand font-mono"
                                    />
                                    <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handlePunchSubmit()}
                                    className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shrink-0 shadow-xs"
                                >
                                    Punch
                                </button>
                            </div>

                            {/* Punch feedback alert toast */}
                            {punchMessage && (
                                <div
                                    className={`px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-2 ${
                                        punchMessage.type === 'success'
                                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                            : punchMessage.type === 'warning'
                                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                    }`}
                                >
                                    {punchMessage.type === 'success' ? (
                                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    )}
                                    <span>{punchMessage.text}</span>
                                </div>
                            )}

                            {/* Shortcut Legend */}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                    *3 or 3*
                                </span>
                                <span>Set multiplier</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                    3*SKU
                                </span>
                                <span>Punch with quantity</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                    Up/Down
                                </span>
                                <span>Browse table</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                    Enter
                                </span>
                                <span>Punch</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: ACTIVE ORDER LINES & FINANCIAL BREAKDOWN (7 COLS / ~58%) */}
                    <div className="lg:col-span-7 flex flex-col gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
                            {/* Lines Header */}
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Active Order Lines
                                    </span>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand">
                                        {lines.length} items • {financialTotals.totalPackages} pkgs • {financialTotals.totalBasePieces} pcs
                                    </span>
                                </div>

                                {lines.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setLines([])}
                                        className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {/* Order Lines Table */}
                            <div className="overflow-x-auto max-h-[calc(100vh-480px)] min-h-[350px]">
                                <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
                                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-2 w-8 text-center">#</th>
                                            <th className="px-3 py-2">Item</th>
                                            <th className="px-2 py-2">UOM</th>
                                            <th className="px-2 py-2 w-20 text-center">Qty</th>
                                            <th className="px-2 py-2 w-24 text-right">Cost (₱)</th>
                                            <th className="px-2 py-2">Discount</th>
                                            <th className="px-3 py-2 text-right">Net (₱)</th>
                                            <th className="px-2 py-2 w-8 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {lines.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <PackageIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                            No items in this purchase order yet
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            Scan a barcode, punch an item on the left console, or browse the product catalog.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            lines.map((line, idx) => {
                                                const prod = products.find((p) => p.id === line.product_id);
                                                const uoms = prod?.uoms || [];
                                                const grossCost = parseFloat(line.unit_cost) || 0;
                                                const { unitDiscount, effectivePct } = computeDiscount(
                                                    grossCost,
                                                    line.discount_type,
                                                    line.discount_percent_formula,
                                                    line.discount_fixed_amount
                                                );
                                                const lineNet = (grossCost - unitDiscount) * line.ordered_qty;

                                                return (
                                                    <tr key={`${line.product_id}-${line.product_uom_id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                        <td className="px-3 py-2 text-center text-slate-400 text-[11px] font-mono">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                                                                {line.product_name}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                                                                <span>{line.product_sku}</span>
                                                                <span>•</span>
                                                                <span>SOH:{line.stock_on_hand}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <select
                                                                value={line.product_uom_id}
                                                                onChange={(e) => updateLine(idx, 'product_uom_id', Number(e.target.value))}
                                                                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                            >
                                                                {uoms.map((u) => (
                                                                    <option key={u.id} value={u.id}>
                                                                        {u.name} (x{u.conversion_factor})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={line.ordered_qty}
                                                                onChange={(e) => updateLine(idx, 'ordered_qty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                                className="h-7 w-16 text-center rounded border border-slate-200 bg-white px-1 text-xs font-mono font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            <input
                                                                type="text"
                                                                value={line.unit_cost}
                                                                onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)}
                                                                className="h-7 w-20 text-right rounded border border-slate-200 bg-white px-1.5 text-xs font-mono font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const nextType =
                                                                            line.discount_type === 'PERCENTAGE'
                                                                                ? 'FIXED_AMOUNT'
                                                                                : line.discount_type === 'FIXED_AMOUNT'
                                                                                  ? 'COMPOUND'
                                                                                  : 'PERCENTAGE';
                                                                        updateLine(idx, 'discount_type', nextType);
                                                                    }}
                                                                    className="h-7 px-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0"
                                                                    title="Cycle discount type: % / ₱ / Compound"
                                                                >
                                                                    {line.discount_type === 'PERCENTAGE'
                                                                        ? '% P'
                                                                        : line.discount_type === 'FIXED_AMOUNT'
                                                                          ? '₱ Fix'
                                                                          : '%+₱'}
                                                                </button>

                                                                {line.discount_type === 'PERCENTAGE' && (
                                                                    <input
                                                                        type="text"
                                                                        placeholder="e.g. 10 or 10+5"
                                                                        value={line.discount_percent_formula}
                                                                        onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                        className="h-7 w-24 rounded border border-slate-200 bg-white px-1.5 text-xs font-mono text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                                    />
                                                                )}

                                                                {line.discount_type === 'FIXED_AMOUNT' && (
                                                                    <input
                                                                        type="text"
                                                                        placeholder="₱ Off / unit"
                                                                        value={line.discount_fixed_amount}
                                                                        onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                        className="h-7 w-24 rounded border border-slate-200 bg-white px-1.5 text-xs font-mono text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                                    />
                                                                )}

                                                                {line.discount_type === 'COMPOUND' && (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="%"
                                                                            value={line.discount_percent_formula}
                                                                            onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                            className="h-7 w-12 rounded border border-slate-200 bg-white px-1 text-xs font-mono"
                                                                        />
                                                                        <span>+</span>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="₱"
                                                                            value={line.discount_fixed_amount}
                                                                            onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                            className="h-7 w-12 rounded border border-slate-200 bg-white px-1 text-xs font-mono"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {effectivePct > 0 && (
                                                                    <span className="text-[10px] text-emerald-600 font-mono font-medium">
                                                                        (-{(effectivePct * 100).toFixed(1)}%)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                            ₱{lineNet.toFixed(2)}
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLine(idx)}
                                                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1"
                                                            >
                                                                <TrashIcon className="h-3.5 w-3.5" />
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

                        {/* OVERALL PO DISCOUNT PIPELINE (Sequential / Cascading Multi-Step Engine) */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        PO Discount Pipeline
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        (Sequential trade terms: evaluated left-to-right on decreasing balance)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderDiscountSteps((prev) => [
                                            ...prev,
                                            {
                                                id: `step-${Date.now()}`,
                                                type: 'PERCENT',
                                                value: '',
                                            },
                                        ]);
                                    }}
                                    className="h-6 px-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-brand hover:text-white text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                                >
                                    <PlusIcon className="h-3 w-3" />
                                    <span>Add Step</span>
                                </button>
                            </div>

                            {/* Sequential Steps List */}
                            <div className="flex flex-wrap items-center gap-2">
                                {orderDiscountSteps.map((step, idx) => {
                                    return (
                                        <div
                                            key={step.id}
                                            className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800"
                                        >
                                            <span className="text-[10px] font-mono font-bold text-slate-400 px-1">
                                                #{idx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextType = step.type === 'PERCENT' ? 'FIXED' : 'PERCENT';
                                                    setOrderDiscountSteps((prev) =>
                                                        prev.map((s, i) => (i === idx ? { ...s, type: nextType } : s))
                                                    );
                                                }}
                                                className={`h-7 px-2 rounded font-mono text-[10px] font-bold transition-colors ${
                                                    step.type === 'PERCENT'
                                                        ? 'bg-brand/10 text-brand'
                                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                }`}
                                                title="Toggle discount step: % or ₱"
                                            >
                                                {step.type === 'PERCENT' ? '%' : '₱'}
                                            </button>
                                            <input
                                                type="text"
                                                value={step.value}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setOrderDiscountSteps((prev) =>
                                                        prev.map((s, i) => (i === idx ? { ...s, value: v } : s))
                                                    );
                                                }}
                                                placeholder={step.type === 'PERCENT' ? '10 or 10+5' : '500.00'}
                                                className="h-7 w-20 rounded border border-slate-200 bg-white px-2 text-xs font-mono font-medium text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                            />
                                            {orderDiscountSteps.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOrderDiscountSteps((prev) => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-rose-500"
                                                >
                                                    <XIcon className="h-3 w-3" />
                                                </button>
                                            )}
                                            {idx < orderDiscountSteps.length - 1 && (
                                                <ArrowRightIcon className="h-3 w-3 text-slate-300 dark:text-slate-600 mx-0.5" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Live Pipeline Waterfall Formula */}
                            {pipelineResult.formula && (
                                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
                                    <span>Applied Sequence: {pipelineResult.formula}</span>
                                    <span className="font-bold">
                                        -₱{orderDiscountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* FINANCIAL TOTALS SUMMARY CARD */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Gross Subtotal:</span>
                                    <span className="font-mono font-semibold">
                                        ₱{financialTotals.subtotal.toFixed(2)}
                                    </span>
                                </div>

                                {financialTotals.discount > 0 && (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>Line Trade Discounts:</span>
                                        <span className="font-mono">
                                            -₱{financialTotals.discount.toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                {orderDiscountAmount > 0 && (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>Overall PO Discount Pipeline:</span>
                                        <span className="font-mono">
                                            -₱{orderDiscountAmount.toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                    <span>Net Taxable Base:</span>
                                    <span className="font-mono font-semibold">
                                        ₱{taxableBaseDisplay.toFixed(2)}
                                    </span>
                                </div>

                                {taxType === 'NON_VAT' ? (
                                    <div className="flex justify-between text-slate-500 text-[11px]">
                                        <span>Tax Treatment (Non-VAT 0%):</span>
                                        <span className="font-mono">₱0.00</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                                            <span>
                                                {taxType === 'VAT_INCLUSIVE' ? 'VAT Portion Included (12%):' : 'VAT Added (12%):'}
                                            </span>
                                            <span className="font-mono">+₱{calculatedVat.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-between items-center text-sm font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span>Grand Total Payable:</span>
                                    <span className="font-mono text-brand text-base">
                                        ₱{calculatedGrandTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ORDER NOTES & BOTTOM ACTION BAR */}
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={orderNotes}
                                    onChange={(e) => setOrderNotes(e.target.value)}
                                    placeholder="Add delivery instructions, appointment notes, or supplier promotional remarks..."
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2 shrink-0">
                                <Link
                                    href="/procurement/orders"
                                    className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || lines.length === 0}
                                    className="h-9 px-5 rounded-lg bg-brand text-xs font-semibold text-white shadow-xs hover:bg-brand/90 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving Adjustments...' : 'Save Adjustments'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
