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
} from '../../../components/ui/icons';
import type {
    Supplier,
    Location,
    Product,
    ProductUom,
} from '../../../types/pos';

interface Props {
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
    uomHint?: string;
    isOnlyMultiplier: boolean;
}

/**
 * High-speed discount calculation supporting %, fixed ₱, and stacked compound (e.g. 10+5+2%).
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
        const discount = Math.min(grossUnitCost, Math.max(0, fixed));
        return {
            unitDiscount: discount,
            effectivePct: grossUnitCost > 0 ? discount / grossUnitCost : 0,
        };
    }

    if (type === 'PERCENTAGE') {
        const tokens = (percentFormula || '0')
            .split('+')
            .map((t) => parseFloat(t.trim()))
            .filter((n) => !isNaN(n) && n > 0);

        if (tokens.length === 0) return { unitDiscount: 0, effectivePct: 0 };

        let rem = grossUnitCost;
        for (const pct of tokens) {
            const factor = Math.min(100, Math.max(0, pct)) / 100;
            rem = rem * (1 - factor);
        }
        const unitDiscount = Math.max(0, grossUnitCost - rem);
        return {
            unitDiscount,
            effectivePct: grossUnitCost > 0 ? unitDiscount / grossUnitCost : 0,
        };
    }

    if (type === 'COMPOUND') {
        const tokens = (percentFormula || '0')
            .split('+')
            .map((t) => parseFloat(t.trim()))
            .filter((n) => !isNaN(n) && n > 0);

        let rem = grossUnitCost;
        for (const pct of tokens) {
            const factor = Math.min(100, Math.max(0, pct)) / 100;
            rem = rem * (1 - factor);
        }

        const fixed = parseFloat(fixedAmountStr) || 0;
        rem = Math.max(0, rem - fixed);

        const unitDiscount = Math.max(0, grossUnitCost - rem);
        return {
            unitDiscount,
            effectivePct: grossUnitCost > 0 ? unitDiscount / grossUnitCost : 0,
        };
    }

    return { unitDiscount: 0, effectivePct: 0 };
}

/**
 * Sequential Overall PO-Level Ordered Discount Pipeline Computation.
 */
function computeDiscountPipeline(
    grossSubtotal: number,
    steps: OrderDiscountStep[]
): {
    totalDiscount: number;
    stepBreakdown: { stepIndex: number; stepDiscount: number; remaining: number }[];
    finalPayable: number;
    formula: string;
} {
    let currentAmount = grossSubtotal;
    let totalDiscount = 0;
    const stepBreakdown: { stepIndex: number; stepDiscount: number; remaining: number }[] = [];
    const formulaTokens: string[] = ['Gross'];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step.value || step.value.trim() === '') continue;

        if (step.type === 'PERCENT') {
            const subTokens = step.value
                .split('+')
                .map((t) => parseFloat(t.trim()))
                .filter((n) => !isNaN(n) && n > 0);

            if (subTokens.length > 0) {
                let startAmount = currentAmount;
                for (const pct of subTokens) {
                    const factor = Math.min(100, Math.max(0, pct)) / 100;
                    currentAmount = currentAmount * (1 - factor);
                }
                const stepDisc = Math.max(0, startAmount - currentAmount);
                totalDiscount += stepDisc;
                stepBreakdown.push({
                    stepIndex: i + 1,
                    stepDiscount: stepDisc,
                    remaining: currentAmount,
                });
                formulaTokens.push(`-${step.value}%`);
            }
        } else if (step.type === 'FIXED') {
            const fixedVal = parseFloat(step.value);
            if (!isNaN(fixedVal) && fixedVal > 0) {
                const stepDisc = Math.min(currentAmount, fixedVal);
                currentAmount = Math.max(0, currentAmount - stepDisc);
                totalDiscount += stepDisc;
                stepBreakdown.push({
                    stepIndex: i + 1,
                    stepDiscount: stepDisc,
                    remaining: currentAmount,
                });
                formulaTokens.push(`-₱${fixedVal.toFixed(2)}`);
            }
        }
    }

    return {
        totalDiscount,
        stepBreakdown,
        finalPayable: currentAmount,
        formula: formulaTokens.length > 1 ? formulaTokens.join(' ') : '',
    };
}

/**
 * High-speed multiplier shortcut parser:
 * - "*3" or "3*" -> sets sticky multiplier to 3
 * - "3*BEV" -> punches 3 of item matching "BEV"
 * - "BEV*3" -> punches 3 of item matching "BEV"
 * - "BEV" -> punches 1 of item matching "BEV"
 */
function extractUomAndQuery(raw: string): { query: string; uomHint?: string } {
    const trimmed = raw.trim();
    const slashIdx = trimmed.lastIndexOf('/');
    const colonIdx = trimmed.lastIndexOf(':');
    const sepIdx = Math.max(slashIdx, colonIdx);
    if (sepIdx !== -1 && sepIdx < trimmed.length - 1) {
        return {
            query: trimmed.slice(0, sepIdx).trim(),
            uomHint: trimmed.slice(sepIdx + 1).trim().toUpperCase(),
        };
    }
    return { query: trimmed };
}

/**
 * High-speed multiplier & UOM shortcut parser:
 * - "*3" or "3*" -> sets sticky multiplier to 3
 * - "3*BEV" -> punches 3 of item matching "BEV"
 * - "3*BEV/CS" or "10*BEV:CASE" -> punches 3 of item in Case UOM
 * - "BEV/BOX*5" -> punches 5 Boxes of BEV
 * - "BEV" -> punches 1 of item matching "BEV"
 */
function parsePunchQuery(rawInput: string): ParsedPunch {
    const trimmed = rawInput.trim();
    if (!trimmed) {
        return { query: '', qty: 1, isOnlyMultiplier: false };
    }

    if (/^\*(\d+)$/.test(trimmed)) {
        const qty = parseInt(trimmed.slice(1), 10);
        return { query: '', qty: Math.max(1, qty), isOnlyMultiplier: true };
    }
    if (/^(\d+)\*$/.test(trimmed)) {
        const qty = parseInt(trimmed.slice(0, -1), 10);
        return { query: '', qty: Math.max(1, qty), isOnlyMultiplier: true };
    }

    const prefixMatch = trimmed.match(/^(\d+)\*(.+)$/);
    if (prefixMatch) {
        const qty = parseInt(prefixMatch[1], 10);
        const { query, uomHint } = extractUomAndQuery(prefixMatch[2]);
        return {
            query,
            qty: Math.max(1, qty),
            uomHint,
            isOnlyMultiplier: false,
        };
    }

    const suffixMatch = trimmed.match(/^(.+)\*(\d+)$/);
    if (suffixMatch) {
        const qty = parseInt(suffixMatch[2], 10);
        const { query, uomHint } = extractUomAndQuery(suffixMatch[1]);
        return {
            query,
            qty: Math.max(1, qty),
            uomHint,
            isOnlyMultiplier: false,
        };
    }

    const { query, uomHint } = extractUomAndQuery(trimmed);
    return {
        query,
        qty: 1,
        uomHint,
        isOnlyMultiplier: false,
    };
}

/**
 * Finds best matching UOM for a product.
 * In Procurement / Inbound orders, defaults to largest packaging tier (e.g. Case or Box) rather than Piece.
 */
function findMatchingUom(product: Product, uomHint?: string): ProductUom | undefined {
    if (!product.uoms || product.uoms.length === 0) return undefined;
    if (!uomHint) {
        // Smart Procurement Default: Highest packaging tier (largest conversion_factor)
        return [...product.uoms].sort((a, b) => b.conversion_factor - a.conversion_factor)[0];
    }
    const cleanHint = uomHint.toUpperCase();

    // 1. Exact name match
    const exact = product.uoms.find((u) => u.name.toUpperCase() === cleanHint);
    if (exact) return exact;

    // 2. Common abbreviation aliases
    const aliases: Record<string, string[]> = {
        CS: ['CASE', 'CARTON', 'CTN'],
        CASE: ['CASE', 'CARTON', 'CTN'],
        CTN: ['CARTON', 'CASE'],
        BX: ['BOX'],
        BOX: ['BOX'],
        PK: ['PACK', 'PKG'],
        PACK: ['PACK', 'PKG'],
        PC: ['PIECE', 'PCS', 'EACH', 'EA'],
        PCS: ['PIECE', 'PCS', 'EACH', 'EA'],
        EA: ['PIECE', 'PCS', 'EACH', 'EA'],
        PL: ['PALLET', 'PLT'],
        PALLET: ['PALLET', 'PLT'],
    };

    const targetNames = aliases[cleanHint] || [cleanHint];
    const aliasMatch = product.uoms.find((u) =>
        targetNames.some((alias) => u.name.toUpperCase().includes(alias))
    );
    if (aliasMatch) return aliasMatch;

    const partialMatch = product.uoms.find((u) =>
        u.name.toUpperCase().startsWith(cleanHint)
    );
    if (partialMatch) return partialMatch;

    return [...product.uoms].sort((a, b) => b.conversion_factor - a.conversion_factor)[0];
}

export default function CreatePurchaseOrderPage({
    suppliers,
    locations,
    products,
}: Props) {
    // Rapid Punch Console & Catalog State
    const [scannerInput, setScannerInput] = useState<string>('');
    const [scannerFeedback, setScannerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [pendingMultiplier, setPendingMultiplier] = useState<number>(1);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [catalogActiveIndex, setCatalogActiveIndex] = useState<number>(-1);
    const scannerInputRef = useRef<HTMLInputElement>(null);

    // Purchase Order Details State
    const [orderSupplierId, setOrderSupplierId] = useState<number>(
        suppliers.length > 0 ? suppliers[0].id : 0
    );
    const [orderLocationId, setOrderLocationId] = useState<number>(
        locations.length > 0 ? locations[0].id : 0
    );
    const [orderDate, setOrderDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
    const [supplierReference, setSupplierReference] = useState<string>('');
    const [taxType, setTaxType] = useState<'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT'>('NON_VAT');
    const [orderNotes, setOrderNotes] = useState<string>('');
    const [lines, setLines] = useState<NewPoLineItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sequential Overall PO Discount Pipeline Steps
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

    // Helper: Stock on Hand for product at destination warehouse
    const getProductSoh = (prod: Product, locId: number): number => {
        if (!prod.balances) return 0;
        const bal = prod.balances.find((b) => b.location_id === locId);
        return bal ? bal.current_qty : 0;
    };

    // Auto-focus punch input on mount
    useEffect(() => {
        setTimeout(() => {
            scannerInputRef.current?.focus();
        }, 100);
    }, []);

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

    // Categories for filter tabs
    const availableCategories = [
        'ALL',
        ...Array.from(new Set(products.map((p) => p.category || 'General'))).sort(),
    ];

    // Filtered products for catalog browsing & punch matching
    const parsedPunch = parsePunchQuery(scannerInput);
    const activeSearchQuery = parsedPunch.query.toLowerCase();

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

    // Add product & UOM to active order lines
    const addProductToOrder = (product: Product, specificUom?: ProductUom, qty: number = 1, uomHint?: string) => {
        const targetUom = specificUom || findMatchingUom(product, uomHint);
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
                unit_cost: targetUom.price_cents !== null && targetUom.price_cents !== undefined
                    ? (targetUom.price_cents / 100).toFixed(2)
                    : (() => {
                          const baseUom = product.uoms?.find((u) => u.is_base_unit || u.conversion_factor === 1);
                          return baseUom?.price_cents
                              ? ((baseUom.price_cents * targetUom.conversion_factor) / 100).toFixed(2)
                              : '100.00';
                      })(),
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

    // Punch submit (Barcode, Multiplier, Enter)
    const handleScannerSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const parsed = parsePunchQuery(scannerInput);

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

        // 1. Exact barcode match
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
            addProductToOrder(exactSku, undefined, effectiveQty, parsed.uomHint);
            setPendingMultiplier(1);
            setScannerInput('');
            return;
        }

        // 3. Search filtered matches
        if (catalogFilteredProducts.length > 0) {
            const target =
                catalogActiveIndex >= 0 && catalogActiveIndex < catalogFilteredProducts.length
                    ? catalogFilteredProducts[catalogActiveIndex]
                    : catalogFilteredProducts[0];
            addProductToOrder(target, undefined, effectiveQty, parsed.uomHint);
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
                    if (uom.price_cents !== null && uom.price_cents !== undefined) {
                        updated.unit_cost = (uom.price_cents / 100).toFixed(2);
                    } else {
                        const baseUom = prod?.uoms?.find((u) => u.is_base_unit || u.conversion_factor === 1);
                        if (baseUom?.price_cents) {
                            updated.unit_cost = ((baseUom.price_cents * uom.conversion_factor) / 100).toFixed(2);
                        }
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

        router.post('/procurement/orders', payload, {
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <AppLayout contentClassName="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
            <Head title="Create Purchase Order | APEX POS & WMS" />

            <form id="create-po-form" onSubmit={handleCreateSubmit} className="space-y-4">
                {/* UPPER PART: PURCHASE ORDER DETAILS BANNER (Sitting across the full width where modal title was) */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                                <TruckIcon className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Purchase Order Document Details
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Draft inbound order • Configure supplier, receiving warehouse, and commercial tax treatment
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Status: DRAFT
                            </span>
                            {lines.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setLines([])}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-400 transition-colors"
                                >
                                    <TrashIcon className="h-3 w-3" />
                                    <span>Clear Draft</span>
                                </button>
                            )}
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
                                <span>{isSubmitting ? 'Generating...' : 'Generate Purchase Order'}</span>
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
                                    { value: 'NON_VAT', label: 'Non-VAT / Zero-Rated (0%)' },
                                    { value: 'VAT_EXCLUSIVE', label: 'VAT-Exclusive (+12% VAT)' },
                                    { value: 'VAT_INCLUSIVE', label: 'VAT-Inclusive (12% Included)' },
                                ]}
                                placeholder="Select tax treatment..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier Ref / Order # (Optional)
                            </label>
                            <input
                                type="text"
                                value={supplierReference}
                                onChange={(e) => setSupplierReference(e.target.value)}
                                placeholder="e.g. SO-8942 / Pre-Invoice"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Expected Delivery (Optional)
                            </label>
                            <input
                                type="date"
                                value={expectedDeliveryDate}
                                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            />
                        </div>
                    </div>
                </div>

                {/* MAIN TWO-COLUMN WORKSPACE: LEFT CATALOG & RIGHT ACTIVE LINES */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* LEFT COLUMN: PRODUCT CATALOG & SCANNER CONSOLE (~40-42% / col-span-5) */}
                    <div className="lg:col-span-5 flex flex-col space-y-3">
                        {/* Catalog Header & Category Filter Tabs */}
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Product Catalog
                                    </span>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {catalogFilteredProducts.length} items
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    Click row to punch
                                </span>
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                {availableCategories.map((cat) => {
                                    const isSelected = selectedCategory === cat;
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                setCatalogActiveIndex(-1);
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                                isSelected
                                                    ? 'bg-brand text-white shadow-2xs font-semibold'
                                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Catalog Table Container */}
                            <div className="h-[calc(100vh-420px)] min-h-[420px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 w-24">SKU / Code</th>
                                            <th className="px-3 py-2 min-w-[140px]">Product Description</th>
                                            <th className="px-3 py-2 w-24">Packaging</th>
                                            <th className="px-3 py-2 w-16 text-center">SOH</th>
                                            <th className="px-3 py-2 w-20 text-right">Cost</th>
                                            <th className="px-3 py-2 w-16 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {catalogFilteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-16 text-center">
                                                    <div className="flex flex-col items-center justify-center space-y-1.5 text-slate-400">
                                                        <PackageIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            No products match your query
                                                        </p>
                                                        <p className="text-[11px] text-slate-400">
                                                            Try selecting "ALL" or adjusting your search punch query.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            catalogFilteredProducts.map((p, idx) => {
                                                const soh = getProductSoh(p, orderLocationId);
                                                const defaultUom = findMatchingUom(p);
                                                const unitCost = defaultUom?.price_cents !== null && defaultUom?.price_cents !== undefined
                                                    ? (defaultUom.price_cents / 100).toFixed(2)
                                                    : (() => {
                                                          const baseUom = p.uoms?.find((u) => u.is_base_unit || u.conversion_factor === 1);
                                                          return baseUom?.price_cents
                                                              ? ((baseUom.price_cents * (defaultUom?.conversion_factor || 1)) / 100).toFixed(2)
                                                              : '100.00';
                                                      })();
                                                const isHighlighted = idx === catalogActiveIndex;

                                                return (
                                                    <tr
                                                        key={p.id}
                                                        onClick={() => handleCatalogRowClick(p)}
                                                        className={`cursor-pointer transition-colors ${
                                                            isHighlighted
                                                                ? 'bg-brand/10 dark:bg-brand/20 ring-1 ring-inset ring-brand'
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                                        }`}
                                                    >
                                                        {/* SKU & Barcode */}
                                                        <td className="px-3 py-2 align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 w-fit">
                                                                    {p.sku}
                                                                </span>
                                                                {defaultUom?.barcode && (
                                                                    <span className="font-mono text-[10px] text-slate-400 mt-0.5 truncate max-w-[90px]">
                                                                        {defaultUom.barcode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Product Name & Category */}
                                                        <td className="px-3 py-2 align-middle">
                                                            <div className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate max-w-[170px]">
                                                                {p.name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {p.category || 'General'}
                                                            </div>
                                                        </td>

                                                        {/* Packaging UOM */}
                                                        <td className="px-3 py-2 align-middle">
                                                            {defaultUom ? (
                                                                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                                                    {defaultUom.name}{' '}
                                                                    <span className="text-slate-400">
                                                                        (x{defaultUom.conversion_factor})
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">None</span>
                                                            )}
                                                        </td>

                                                        {/* Stock on Hand (SOH) */}
                                                        <td className="px-3 py-2 align-middle text-center">
                                                            <span
                                                                className={`font-mono text-xs px-2 py-0.5 rounded-full font-semibold border ${
                                                                    soh > 0
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                                                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
                                                                }`}
                                                            >
                                                                {soh}
                                                            </span>
                                                        </td>

                                                        {/* Unit Cost */}
                                                        <td className="px-3 py-2 align-middle text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            ₱{unitCost}
                                                        </td>

                                                        {/* Action / Add button */}
                                                        <td className="px-3 py-2 align-middle text-center">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCatalogRowClick(p);
                                                                }}
                                                                className="inline-flex h-7 items-center gap-1 rounded-md bg-brand/10 hover:bg-brand px-2 text-[11px] font-medium text-brand hover:text-white transition-colors"
                                                            >
                                                                <PlusIcon className="h-3 w-3" />
                                                                <span>{pendingMultiplier > 1 ? `x${pendingMultiplier}` : 'Add'}</span>
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

                        {/* BOTTOM COMMAND CONSOLE & PUNCH BAR */}
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-md space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BarcodeIcon className="h-4 w-4 text-brand" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                                        Punch & Scanner Console
                                    </span>
                                    {pendingMultiplier > 1 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                                            <span>Multiplier: x{pendingMultiplier}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPendingMultiplier(1)}
                                                className="p-0.5 hover:text-white"
                                                title="Reset multiplier to 1"
                                            >
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Scanner Active • Enter or Click to Add
                                </span>
                            </div>

                            {/* Punch Input */}
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
                                        setCatalogActiveIndex(-1);
                                    }}
                                    onKeyDown={handleScannerKeyDown}
                                    placeholder="Scan barcode, punch SKU, or set quantity (e.g. 3*SKU, *3, or filter)..."
                                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-24 text-xs text-white placeholder-slate-400 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                                    autoComplete="off"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {scannerInput && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannerInput('');
                                                setCatalogActiveIndex(-1);
                                                scannerInputRef.current?.focus();
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-white"
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleScannerSubmit()}
                                        className="h-7 px-3 rounded bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-colors shadow-2xs"
                                    >
                                        ↵ Punch
                                    </button>
                                </div>
                            </div>

                            {/* Scanner Status / Feedback */}
                            {scannerFeedback && (
                                <div
                                    className={`text-xs flex items-center gap-1.5 pt-0.5 ${
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

                            {/* Shortcut Cheat Sheet Legend */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">*3</kbd>
                                    <span>or</span>
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">3*</kbd>
                                    <span>Set multiplier</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">3*SKU</kbd>
                                    <span>Punch quantity</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">↑/↓</kbd>
                                    <span>Select table</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">↵ Enter</kbd>
                                    <span>Punch</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: ACTIVE ORDER LINES & COMPREHENSIVE FINANCIAL ENGINE (~58-60% / col-span-7) */}
                    <div className="lg:col-span-7 flex flex-col space-y-3">
                        {/* Active Order Lines Container */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Active Order Lines ({lines.length} items • {financialTotals.totalPackages} pkgs • {financialTotals.totalBasePieces} pcs)
                                    </span>
                                </div>
                                {lines.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setLines([])}
                                        className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
                                    >
                                        Clear All Lines
                                    </button>
                                )}
                            </div>

                            {/* Lines Table with Roomy Height and Dedicated Scrolling */}
                            <div className="h-[calc(100vh-480px)] min-h-[350px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2.5 w-8 text-center">#</th>
                                            <th className="px-3 py-2.5 min-w-[180px]">Product Description & SKU</th>
                                            <th className="px-3 py-2.5 w-32">Packaging UOM</th>
                                            <th className="px-3 py-2.5 w-20 text-center">Qty</th>
                                            <th className="px-3 py-2.5 w-24 text-right">Unit Cost (₱)</th>
                                            <th className="px-3 py-2.5 min-w-[170px]">Trade Discount</th>
                                            <th className="px-3 py-2.5 w-24 text-right">Line Net (₱)</th>
                                            <th className="px-3 py-2.5 w-8 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {lines.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-20 text-center text-slate-400">
                                                    <div className="flex flex-col items-center justify-center space-y-2">
                                                        <BarcodeIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                            No line items in order yet
                                                        </p>
                                                        <p className="text-xs text-slate-400 max-w-sm">
                                                            Scan barcodes, click items from the catalog on the left, or use quantity punch shortcuts (e.g. 3*SKU) to begin adding items.
                                                        </p>
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
                                                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                                                {line.product_name}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 mt-0.5">
                                                                <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                                                    {line.product_sku}
                                                                </span>
                                                                <span>{line.product_category}</span>
                                                                <span>• SOH: {line.stock_on_hand} pcs</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {availableUoms.map((u) => {
                                                                    const isSelected = u.id === line.product_uom_id;
                                                                    return (
                                                                        <button
                                                                            key={u.id}
                                                                            type="button"
                                                                            onClick={() => updateLine(idx, 'product_uom_id', u.id)}
                                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                                                                isSelected
                                                                                    ? 'bg-brand text-white shadow-xs'
                                                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                            }`}
                                                                            title={`Packaging Unit: ${u.name} (Multiplier: x${u.conversion_factor})`}
                                                                        >
                                                                            <span>{u.name}</span>
                                                                            <span className={`text-[10px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                                                (x{u.conversion_factor})
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
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
                                                                className="h-8 w-16 text-center rounded-lg border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                            />
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                {(line.ordered_qty || 0) * line.conversion_factor} pcs
                                                            </div>
                                                        </td>
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
                                                                className="h-8 w-20 text-right rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                            />
                                                            {line.conversion_factor > 1 && (
                                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap text-right">
                                                                    ≈ ₱{((parseFloat(line.unit_cost) || 0) / line.conversion_factor).toFixed(2)}/pc
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1">
                                                                <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        title="Percentage discount"
                                                                        onClick={() => updateLine(idx, 'discount_type', 'PERCENTAGE')}
                                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                                            line.discount_type === 'PERCENTAGE'
                                                                                ? 'bg-brand text-white'
                                                                                : 'text-slate-500'
                                                                        }`}
                                                                    >
                                                                        %
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Fixed amount in pesos"
                                                                        onClick={() => updateLine(idx, 'discount_type', 'FIXED_AMOUNT')}
                                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                                            line.discount_type === 'FIXED_AMOUNT'
                                                                                ? 'bg-brand text-white'
                                                                                : 'text-slate-500'
                                                                        }`}
                                                                    >
                                                                        ₱
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Stacked % + Fixed allowance"
                                                                        onClick={() => updateLine(idx, 'discount_type', 'COMPOUND')}
                                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                                            line.discount_type === 'COMPOUND'
                                                                                ? 'bg-brand text-white'
                                                                                : 'text-slate-500'
                                                                        }`}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                {line.discount_type === 'COMPOUND' ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            value={line.discount_percent_formula}
                                                                            onFocus={(e) => e.target.select()}
                                                                            onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                            placeholder="10+5"
                                                                            className="h-8 w-12 text-center font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={line.discount_fixed_amount}
                                                                            onFocus={(e) => e.target.select()}
                                                                            onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                            placeholder="₱"
                                                                            className="h-8 w-14 text-center font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                        />
                                                                    </div>
                                                                ) : line.discount_type === 'FIXED_AMOUNT' ? (
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={line.discount_fixed_amount}
                                                                        onFocus={(e) => e.target.select()}
                                                                        onChange={(e) => updateLine(idx, 'discount_fixed_amount', e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={line.discount_percent_formula}
                                                                        onFocus={(e) => e.target.select()}
                                                                        onChange={(e) => updateLine(idx, 'discount_percent_formula', e.target.value)}
                                                                        placeholder="0%"
                                                                        className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                    />
                                                                )}
                                                            </div>
                                                            {unitDiscount > 0 && (
                                                                <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                                                                    -₱{unitDiscount.toFixed(2)}/u ({(effectivePct * 100).toFixed(1)}%)
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                                                ₱{lineNet.toFixed(2)}
                                                            </div>
                                                            {unitDiscount > 0 && (
                                                                <div className="text-[10px] text-slate-400 line-through font-mono">
                                                                    ₱{lineGross.toFixed(2)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLine(idx)}
                                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
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

                        {/* LOWER DECK: SEQUENTIAL DISCOUNT PIPELINE & FINANCIAL TOTALS BREAKDOWN */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Sub-card 1: Overall PO Discount Pipeline */}
                            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Overall PO Discount Pipeline
                                    </span>
                                    {orderDiscountAmount > 0 && (
                                        <span className="font-mono text-emerald-600 font-semibold text-xs">
                                            -₱{orderDiscountAmount.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                {/* Sequential Ordered Steps */}
                                <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-0.5">
                                    {orderDiscountSteps.map((step, idx) => {
                                        const breakdown = pipelineResult.stepBreakdown.find((b) => b.stepIndex === idx + 1);
                                        return (
                                            <div
                                                key={step.id}
                                                className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                                            >
                                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                                    #{idx + 1}
                                                </span>

                                                <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateDiscountStep(idx, 'type', 'PERCENT')}
                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                            step.type === 'PERCENT' ? 'bg-brand text-white' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateDiscountStep(idx, 'type', 'FIXED')}
                                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                            step.type === 'FIXED' ? 'bg-brand text-white' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        ₱
                                                    </button>
                                                </div>

                                                <div className="relative flex-1">
                                                    <input
                                                        type={step.type === 'FIXED' ? 'number' : 'text'}
                                                        step="0.01"
                                                        min="0"
                                                        value={step.value}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => updateDiscountStep(idx, 'value', e.target.value)}
                                                        placeholder={step.type === 'PERCENT' ? '10 or 10+5' : '0.00'}
                                                        className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:outline-hidden"
                                                    />
                                                </div>

                                                {breakdown && breakdown.stepDiscount > 0 && (
                                                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                                                        -₱{breakdown.stepDiscount.toFixed(2)}
                                                    </span>
                                                )}

                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={idx === 0}
                                                        onClick={() => moveDiscountStep(idx, idx - 1)}
                                                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                                    >
                                                        <ChevronUpIcon className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={idx === orderDiscountSteps.length - 1}
                                                        onClick={() => moveDiscountStep(idx, idx + 1)}
                                                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                                    >
                                                        <ChevronDownIcon className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDiscountStep(idx)}
                                                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                                                    >
                                                        <XIcon className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <button
                                        type="button"
                                        onClick={addDiscountStep}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                                    >
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        <span>Add Step</span>
                                    </button>

                                    {pipelineResult.formula && (
                                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-[170px]" title={pipelineResult.formula}>
                                            {pipelineResult.formula}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sub-card 2: Financial Totals Breakdown Card */}
                            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5 text-xs">
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
                                {orderDiscountAmount > 0 && (
                                    <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>PO Pipeline Discounts:</span>
                                        <span className="font-mono">-₱{orderDiscountAmount.toFixed(2)}</span>
                                    </div>
                                )}

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
                                            <span>12% VAT (+):</span>
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
                                    {isSubmitting ? 'Generating Purchase Order...' : 'Generate Purchase Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
