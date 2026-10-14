import React, { useState, useEffect, useRef } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
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
    TrashIcon,
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

interface ParsedPunch {
    query: string;
    qty: number;
    isOnlyMultiplier: boolean;
}

function parsePunchQuery(rawInput: string): ParsedPunch {
    const trimmed = rawInput.trim();
    if (!trimmed) {
        return { query: '', qty: 1, isOnlyMultiplier: false };
    }

    // 1. Only multiplier: "*3", "3*", "x5", "5x"
    const onlyMultMatch = trimmed.match(/^[*xX](\d+)$/) || trimmed.match(/^(\d+)[*xX]$/);
    if (onlyMultMatch) {
        const parsedQty = parseInt(onlyMultMatch[1], 10);
        return {
            query: '',
            qty: parsedQty > 0 ? parsedQty : 1,
            isOnlyMultiplier: true,
        };
    }

    // 2. Prefix multiplier: "3*BEV-COLA", "3x BEV-COLA", "12*880123"
    const prefixMatch = trimmed.match(/^(\d+)\s*[*xX]\s*(.+)$/);
    if (prefixMatch) {
        const parsedQty = parseInt(prefixMatch[1], 10);
        return {
            query: prefixMatch[2].trim(),
            qty: parsedQty > 0 ? parsedQty : 1,
            isOnlyMultiplier: false,
        };
    }

    // 3. Suffix multiplier: "BEV-COLA*3", "880123*12", "Juice*5"
    const suffixMatch = trimmed.match(/^(.+?)\s*[*xX]\s*(\d+)$/);
    if (suffixMatch) {
        const parsedQty = parseInt(suffixMatch[2], 10);
        return {
            query: suffixMatch[1].trim(),
            qty: parsedQty > 0 ? parsedQty : 1,
            isOnlyMultiplier: false,
        };
    }

    // 4. Question mark search prefix e.g. "?1.5" or "?COLA"
    if (trimmed.startsWith('?')) {
        return {
            query: trimmed.slice(1).trim(),
            qty: 1,
            isOnlyMultiplier: false,
        };
    }

    return {
        query: trimmed,
        qty: 1,
        isOnlyMultiplier: false,
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

    // Rapid Punch Console & Product Catalog State
    const [scannerInput, setScannerInput] = useState<string>('');
    const [scannerFeedback, setScannerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [pendingMultiplier, setPendingMultiplier] = useState<number>(1);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [catalogActiveIndex, setCatalogActiveIndex] = useState<number>(-1);
    const scannerInputRef = useRef<HTMLInputElement>(null);

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
            setPendingMultiplier(1);
            setSelectedCategory('ALL');
            setCatalogActiveIndex(-1);
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

    // Available Categories for catalog filter
    const availableCategories = [
        'ALL',
        ...Array.from(new Set(products.map((p) => p.category || 'General'))).sort(),
    ];

    // Parsed punch query for real-time catalog filtering
    const parsedPunch = parsePunchQuery(scannerInput);
    const activeSearchQuery = parsedPunch.query.toLowerCase();

    // Filtered products for catalog browsing & punch matching
    const catalogFilteredProducts = products.filter((p) => {
        const matchesCategory =
            selectedCategory === 'ALL' ||
            (p.category || 'General').toLowerCase() === selectedCategory.toLowerCase();

        if (!matchesCategory) return false;
        if (!activeSearchQuery) return true;

        return (
            p.sku.toLowerCase().includes(activeSearchQuery) ||
            p.name.toLowerCase().includes(activeSearchQuery) ||
            (p.category && p.category.toLowerCase().includes(activeSearchQuery)) ||
            (p.uoms && p.uoms.some((u) => u.barcode && u.barcode.toLowerCase().includes(activeSearchQuery)))
        );
    });

    // Automatically add a product & UOM to the order (called on barcode punch or catalog click)
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
                message: `Added ${product.name} (${targetUom.name}) • ${qty} pkg(s)`,
            });

            return [newLine, ...prev];
        });

        setScannerInput('');
        scannerInputRef.current?.focus();
        setTimeout(() => setScannerFeedback(null), 3000);
    };

    // Handle barcode punch, multiplier, or Enter key submit in the scanner input
    const handleScannerSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const parsed = parsePunchQuery(scannerInput);

        // Case A: User typed only multiplier, e.g. "*3" or "3*"
        if (parsed.isOnlyMultiplier) {
            setPendingMultiplier(parsed.qty);
            setScannerInput('');
            setScannerFeedback({
                type: 'success',
                message: `Active Multiplier set to x${parsed.qty} for next scan/click`,
            });
            setTimeout(() => setScannerFeedback(null), 3000);
            return;
        }

        const query = parsed.query;
        if (!query) return;

        const effectiveQty = parsed.qty * (pendingMultiplier > 1 ? pendingMultiplier : 1);

        // 1. Exact barcode match in product_uoms
        for (const p of products) {
            const u = p.uoms?.find(
                (uom) => uom.barcode && uom.barcode.trim().toLowerCase() === query.toLowerCase()
            );
            if (u) {
                addProductToOrder(p, u, effectiveQty);
                setPendingMultiplier(1);
                setScannerInput('');
                return;
            }
        }

        // 2. Exact SKU match
        const exactSku = products.find(
            (p) => p.sku.trim().toLowerCase() === query.toLowerCase()
        );
        if (exactSku) {
            addProductToOrder(exactSku, undefined, effectiveQty);
            setPendingMultiplier(1);
            setScannerInput('');
            return;
        }

        // 3. Search filtered matches (auto-add active keyboard selection or top hit)
        if (catalogFilteredProducts.length > 0) {
            const target =
                catalogActiveIndex >= 0 && catalogActiveIndex < catalogFilteredProducts.length
                    ? catalogFilteredProducts[catalogActiveIndex]
                    : catalogFilteredProducts[0];
            addProductToOrder(target, undefined, effectiveQty);
            setPendingMultiplier(1);
            setScannerInput('');
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
            setCatalogActiveIndex((prev) =>
                prev < catalogFilteredProducts.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCatalogActiveIndex((prev) =>
                prev > 0 ? prev - 1 : catalogFilteredProducts.length - 1
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleScannerSubmit();
        } else if (e.key === 'Escape') {
            setScannerInput('');
            setCatalogActiveIndex(-1);
            setPendingMultiplier(1);
        }
    };

    const handleCatalogRowClick = (prod: Product) => {
        const parsed = parsePunchQuery(scannerInput);
        const effectiveQty = parsed.qty * (pendingMultiplier > 1 ? pendingMultiplier : 1);
        addProductToOrder(prod, undefined, effectiveQty);
        setPendingMultiplier(1);
        setScannerInput('');
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
                <Link
                    href="/procurement/orders/create"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-xs hover:bg-brand/90 transition-all focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create Purchase Order</span>
                </Link>
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
