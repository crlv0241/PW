import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import type {
    PoLineItem,
    OrderDiscountStep,
    ScannerFeedback,
    OrderTaxType,
} from './order-types';
import {
    computeDiscount,
    computeDiscountPipeline,
    parsePunchQuery,
    findMatchingUom,
    getProductSoh,
    computeUomPrice,
} from './order-math';
import { UomSelectionModal } from './components/uom-selection-modal';
import { update, index } from '@/actions/App/Http/Controllers/Procurement/PurchaseOrderController';

interface Props {
    order: PurchaseOrder;
    suppliers: Supplier[];
    locations: Location[];
    products: Product[];
}

export default function EditPurchaseOrderPage({ order, suppliers, locations, products }: Props) {
    // Fast O(1) indexed lookup for products catalog
    const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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
    const [taxType, setTaxType] = useState<OrderTaxType>(order.tax_type ?? 'NON_VAT');
    const [orderNotes, setOrderNotes] = useState<string>(order.notes ?? '');

    // Initialize lines from existing order
    const [lines, setLines] = useState<PoLineItem[]>(() => {
        if (!order.lines || order.lines.length === 0) return [];
        return order.lines.map((l) => {
            const catalogProd = productsById.get(l.product_id);
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

    // Rapid Punch Console & Catalog State
    const [scannerInput, setScannerInput] = useState<string>('');
    const [scannerFeedback, setScannerFeedback] = useState<ScannerFeedback | null>(null);
    const [pendingMultiplier, setPendingMultiplier] = useState<number>(1);
    const [pendingUomHint, setPendingUomHint] = useState<string | undefined>(undefined);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [catalogActiveIndex, setCatalogActiveIndex] = useState<number>(-1);
    const [catalogSelectedUoms, setCatalogSelectedUoms] = useState<Record<number, number>>({});
    const [uomPromptProduct, setUomPromptProduct] = useState<{ product: Product; qty: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const scannerInputRef = useRef<HTMLInputElement>(null);
    const catalogTableContainerRef = useRef<HTMLDivElement>(null);

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
                    const prod = productsById.get(l.product_id);
                    return {
                        ...l,
                        stock_on_hand: prod ? getProductSoh(prod, orderLocationId) : 0,
                    };
                })
            );
        }
    }, [orderLocationId, productsById]);

    // Categories for filter tabs memoized
    const availableCategories = useMemo(
        () => ['ALL', ...Array.from(new Set(products.map((p) => p.category || 'General'))).sort()],
        [products]
    );

    // Filtered products for catalog browsing & punch matching memoized
    const parsedPunch = useMemo(() => parsePunchQuery(scannerInput), [scannerInput]);
    const activeSearchQuery = parsedPunch.query.toLowerCase();

    const catalogFilteredProducts = useMemo(() => {
        return products.filter((p) => {
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
    }, [products, selectedCategory, activeSearchQuery]);

    // Add product & UOM to active order lines
    const addProductToOrder = (product: Product, specificUom?: ProductUom, qty: number = 1, uomHint?: string) => {
        if (qty <= 0) return;
        const targetUom = specificUom || findMatchingUom(product, uomHint);
        if (!targetUom) {
            setScannerFeedback({
                type: 'error',
                message: `Product ${product.name} has no packaging units defined.`,
            });
            setTimeout(() => setScannerFeedback(null), 3500);
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

            const initialCost = computeUomPrice(product, targetUom);

            const newLine: PoLineItem = {
                product_id: product.id,
                product_sku: product.sku,
                product_name: product.name,
                product_category: product.category || 'General',
                product_uom_id: targetUom.id,
                conversion_factor: targetUom.conversion_factor,
                ordered_qty: qty,
                unit_cost: initialCost,
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
        setTimeout(() => setScannerFeedback(null), 3500);
    };

    // Punch submit (Barcode, Multiplier, Enter)
    const handleScannerSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const parsed = parsePunchQuery(scannerInput);

        if (parsed.isOnlyMultiplier) {
            setPendingMultiplier(parsed.qty);
            setPendingUomHint(parsed.uomHint);
            setScannerInput('');
            setScannerFeedback({
                type: 'success',
                message: parsed.uomHint
                    ? `Active Multiplier set to ${parsed.qty} ${parsed.uomHint} for next scan/click`
                    : `Active Multiplier set to x${parsed.qty} for next scan/click`,
            });
            setTimeout(() => setScannerFeedback(null), 3500);
            scannerInputRef.current?.focus();
            return;
        }

        const query = parsed.query.trim();
        const effectiveQty = parsed.qty * (pendingMultiplier > 1 ? pendingMultiplier : 1);
        const effectiveUomHint = parsed.uomHint || pendingUomHint;

        if (!query) {
            if (catalogFilteredProducts.length > 0) {
                const target =
                    catalogActiveIndex >= 0 && catalogActiveIndex < catalogFilteredProducts.length
                        ? catalogFilteredProducts[catalogActiveIndex]
                        : catalogFilteredProducts[0];

                const chosenCatalogUom = catalogSelectedUoms[target.id]
                    ? target.uoms?.find((u) => u.id === catalogSelectedUoms[target.id])
                    : undefined;

                if (chosenCatalogUom) {
                    addProductToOrder(target, chosenCatalogUom, effectiveQty);
                    setPendingMultiplier(1);
                    setPendingUomHint(undefined);
                    setScannerInput('');
                    return;
                }

                if (target.uoms && target.uoms.length > 1 && !effectiveUomHint) {
                    setUomPromptProduct({ product: target, qty: effectiveQty });
                    setPendingMultiplier(1);
                    setPendingUomHint(undefined);
                    setScannerInput('');
                    return;
                }

                addProductToOrder(target, undefined, effectiveQty, effectiveUomHint);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
            }
            return;
        }

        // 1. Exact barcode match
        for (const p of products) {
            const u = p.uoms?.find(
                (uom) => uom.barcode && uom.barcode.trim().toLowerCase() === query.toLowerCase()
            );
            if (u) {
                addProductToOrder(p, u, effectiveQty);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }
        }

        // 2. Exact SKU match
        const exactSku = products.find(
            (p) => p.sku.trim().toLowerCase() === query.toLowerCase()
        );
        if (exactSku) {
            if (effectiveUomHint) {
                addProductToOrder(exactSku, undefined, effectiveQty, effectiveUomHint);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }
            const chosenCatalogUom = catalogSelectedUoms[exactSku.id]
                ? exactSku.uoms?.find((u) => u.id === catalogSelectedUoms[exactSku.id])
                : undefined;
            if (chosenCatalogUom) {
                addProductToOrder(exactSku, chosenCatalogUom, effectiveQty);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }
            if (exactSku.uoms && exactSku.uoms.length > 1) {
                setUomPromptProduct({ product: exactSku, qty: effectiveQty });
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }
            addProductToOrder(exactSku, undefined, effectiveQty);
            setPendingMultiplier(1);
            setPendingUomHint(undefined);
            setScannerInput('');
            return;
        }

        // 3. Search filtered matches
        if (catalogFilteredProducts.length > 0) {
            const target =
                catalogActiveIndex >= 0 && catalogActiveIndex < catalogFilteredProducts.length
                    ? catalogFilteredProducts[catalogActiveIndex]
                    : catalogFilteredProducts[0];

            if (effectiveUomHint) {
                addProductToOrder(target, undefined, effectiveQty, effectiveUomHint);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }

            const chosenCatalogUom = catalogSelectedUoms[target.id]
                ? target.uoms?.find((u) => u.id === catalogSelectedUoms[target.id])
                : undefined;

            if (chosenCatalogUom) {
                addProductToOrder(target, chosenCatalogUom, effectiveQty);
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }

            if (target.uoms && target.uoms.length > 1) {
                setUomPromptProduct({ product: target, qty: effectiveQty });
                setPendingMultiplier(1);
                setPendingUomHint(undefined);
                setScannerInput('');
                return;
            }

            addProductToOrder(target, undefined, effectiveQty);
            setPendingMultiplier(1);
            setPendingUomHint(undefined);
            setScannerInput('');
        } else {
            setScannerFeedback({
                type: 'error',
                message: `No product or barcode matching "${query}"`,
            });
            setTimeout(() => setScannerFeedback(null), 3500);
        }
    };

    const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCatalogActiveIndex((prev) => {
                const next = prev < catalogFilteredProducts.length - 1 ? prev + 1 : 0;
                scrollActiveRowIntoView(next);
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCatalogActiveIndex((prev) => {
                const next = prev > 0 ? prev - 1 : catalogFilteredProducts.length - 1;
                scrollActiveRowIntoView(next);
                return next;
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleScannerSubmit();
        } else if (e.key === 'Escape') {
            setScannerInput('');
            setCatalogActiveIndex(-1);
            setPendingMultiplier(1);
            setPendingUomHint(undefined);
            setScannerFeedback(null);
        }
    };

    const handleCatalogRowClick = (product: Product, specificUom?: ProductUom) => {
        const parsed = parsePunchQuery(scannerInput);
        const effectiveQty = parsed.qty * (pendingMultiplier > 1 ? pendingMultiplier : 1);
        const effectiveUomHint = parsed.uomHint || pendingUomHint;
        addProductToOrder(product, specificUom, effectiveQty, effectiveUomHint);
        setPendingMultiplier(1);
        setPendingUomHint(undefined);
        setScannerInput('');
    };

    // Hardware Barcode Scanner Keystroke Buffer (window listener)
    useEffect(() => {
        let buffer = '';
        let lastKeyTime = 0;

        const handleWindowKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            const activeType = (document.activeElement as HTMLInputElement)?.type || '';
            const isEditingAnotherField =
                document.activeElement !== scannerInputRef.current &&
                (activeTag === 'textarea' || (activeTag === 'input' && activeType !== 'button' && activeType !== 'submit'));

            const now = Date.now();
            const timeDiff = now - lastKeyTime;
            lastKeyTime = now;

            // Barcode scanners type very rapidly (inter-keystroke interval < 50ms)
            if (e.key === 'Enter') {
                if (buffer.length >= 3 && timeDiff < 100) {
                    e.preventDefault();
                    e.stopPropagation();
                    const scannedBarcode = buffer.trim();
                    buffer = '';

                    // 1. Lookup scanned barcode directly
                    for (const p of products) {
                        const u = p.uoms?.find(
                            (uom) => uom.barcode && uom.barcode.trim().toLowerCase() === scannedBarcode.toLowerCase()
                        );
                        if (u) {
                            addProductToOrder(p, u, pendingMultiplier, pendingUomHint);
                            setPendingMultiplier(1);
                            setPendingUomHint(undefined);
                            return;
                        }
                    }

                    // 2. Check exact SKU
                    const exactSku = products.find(
                        (p) => p.sku.trim().toLowerCase() === scannedBarcode.toLowerCase()
                    );
                    if (exactSku) {
                        addProductToOrder(exactSku, undefined, pendingMultiplier, pendingUomHint);
                        setPendingMultiplier(1);
                        setPendingUomHint(undefined);
                        return;
                    }

                    setScannerFeedback({
                        type: 'error',
                        message: `Hardware Scanner: No product found for barcode "${scannedBarcode}"`,
                    });
                    setTimeout(() => setScannerFeedback(null), 3500);
                    return;
                }
                buffer = '';
                return;
            }

            if (!isEditingAnotherField && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (timeDiff > 70) {
                    buffer = e.key;
                } else {
                    buffer += e.key;
                }
            }
        };

        window.addEventListener('keydown', handleWindowKeyDown, true);
        return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
    }, [products, pendingMultiplier, orderLocationId]);

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
        fieldOrUpdates: keyof PoLineItem | Partial<PoLineItem>,
        val?: unknown
    ) => {
        setLines((prev) => {
            const next = [...prev];
            const current = next[index];
            if (!current) return prev;

            const partial: Partial<PoLineItem> =
                typeof fieldOrUpdates === 'string'
                    ? { [fieldOrUpdates]: val }
                    : fieldOrUpdates;

            if ('product_uom_id' in partial && partial.product_uom_id !== undefined) {
                const targetUomId = Number(partial.product_uom_id);
                // Check if another line in this order already has this product with the newly selected UOM
                const existingSameUomIdx = prev.findIndex(
                    (l, i) => i !== index && l.product_id === current.product_id && l.product_uom_id === targetUomId
                );

                if (existingSameUomIdx !== -1) {
                    const existingLine = next[existingSameUomIdx];
                    const mergedQty = existingLine.ordered_qty + current.ordered_qty;
                    next[existingSameUomIdx] = {
                        ...existingLine,
                        ordered_qty: mergedQty,
                    };
                    next.splice(index, 1);

                    const prod = productsById.get(current.product_id);
                    const uom = prod?.uoms?.find((u) => u.id === targetUomId);
                    setScannerFeedback({
                        type: 'success',
                        message: `Merged into existing ${current.product_name} (${uom?.name || 'Unit'}) line (total: ${mergedQty} pkgs)`,
                    });
                    setTimeout(() => setScannerFeedback(null), 3500);
                    return next;
                }

                const prod = productsById.get(current.product_id);
                const uom = prod?.uoms?.find((u) => u.id === targetUomId);
                const updated = { ...current, ...partial };
                if (uom && prod) {
                    updated.product_uom_id = targetUomId;
                    updated.conversion_factor = uom.conversion_factor;
                    updated.unit_cost = computeUomPrice(prod, uom);
                }
                next[index] = updated;
                return next;
            }

            next[index] = { ...current, ...partial };
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

        router.put(update.url(order.id), payload, {
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
                                href={index.url()}
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
                            <div
                                ref={catalogTableContainerRef}
                                className="h-[calc(100vh-420px)] min-h-[420px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs"
                            >
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
                                                const selectedUomId = catalogSelectedUoms[p.id];
                                                const activeUom = (selectedUomId ? p.uoms?.find((u) => u.id === selectedUomId) : undefined) || defaultUom;
                                                const unitCost = computeUomPrice(p, activeUom);
                                                const isHighlighted = idx === catalogActiveIndex;

                                                return (
                                                    <tr
                                                        key={p.id}
                                                        data-index={idx}
                                                        onClick={() => handleCatalogRowClick(p, activeUom)}
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

                                                        {/* Packaging UOM with Interactive Selector */}
                                                        <td className="px-3 py-2 align-middle">
                                                            {p.uoms && p.uoms.length > 1 ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <select
                                                                        value={activeUom?.id}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            const newId = Number(e.target.value);
                                                                            setCatalogSelectedUoms((prev) => ({ ...prev, [p.id]: newId }));
                                                                        }}
                                                                        className="h-7 w-fit min-w-[100px] max-w-[130px] rounded border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-800 shadow-2xs focus:border-brand focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                                                                        title="Choose packaging unit to punch"
                                                                    >
                                                                        {p.uoms.map((u) => (
                                                                            <option key={u.id} value={u.id}>
                                                                                {u.name} (x{u.conversion_factor})
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {p.uoms.length} pkgs available
                                                                    </span>
                                                                </div>
                                                            ) : activeUom ? (
                                                                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                                                    {activeUom.name}{' '}
                                                                    <span className="text-slate-400">
                                                                        (x{activeUom.conversion_factor})
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
                                                                    handleCatalogRowClick(p, activeUom);
                                                                }}
                                                                className="inline-flex h-7 items-center gap-1 rounded-md bg-brand/10 hover:bg-brand px-2 text-[11px] font-medium text-brand hover:text-white transition-colors"
                                                            >
                                                                <PlusIcon className="h-3 w-3" />
                                                                <span>{pendingMultiplier > 1 || pendingUomHint ? `x${pendingMultiplier}${pendingUomHint ? ` ${pendingUomHint}` : ''}` : 'Add'}</span>
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
                                    {(pendingMultiplier > 1 || pendingUomHint) && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                                            <span>Multiplier: x{pendingMultiplier}{pendingUomHint ? ` (${pendingUomHint})` : ''}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPendingMultiplier(1);
                                                    setPendingUomHint(undefined);
                                                }}
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
                                    placeholder="Scan barcode, punch SKU, or set quantity (e.g. 5bx*SKU, 5pc*SKU, 3*SKU, *3, or filter)..."
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
                                        scannerFeedback.type === 'success'
                                            ? 'text-emerald-400'
                                            : scannerFeedback.type === 'warning'
                                              ? 'text-amber-400'
                                              : 'text-rose-400'
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
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">5bx*SKU</kbd>
                                    <span>or</span>
                                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">3*SKU</kbd>
                                    <span>Punch with UOM</span>
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
                                                            {(() => {
                                                                const unused = uoms.filter(
                                                                    (u) => !lines.some((l) => l.product_id === line.product_id && l.product_uom_id === u.id)
                                                                );
                                                                if (unused.length === 0) return null;
                                                                return (
                                                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                        <span className="text-[10px] text-slate-400">Also add:</span>
                                                                        {unused.map((extraUom) => (
                                                                            <button
                                                                                key={extraUom.id}
                                                                                type="button"
                                                                                onClick={() => prod && addProductToOrder(prod, extraUom, 1)}
                                                                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-brand/10 text-brand hover:bg-brand hover:text-white transition-colors"
                                                                                title={`Add ${extraUom.name} (x${extraUom.conversion_factor}) line to order`}
                                                                            >
                                                                                <PlusIcon className="h-2.5 w-2.5" />
                                                                                <span>{extraUom.name}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-2 py-2 align-middle">
                                                            <select
                                                                value={line.product_uom_id}
                                                                onChange={(e) => updateLine(idx, 'product_uom_id', Number(e.target.value))}
                                                                className="h-8 w-full min-w-[100px] max-w-[130px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-2xs focus:border-brand focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                                                                title="Select packaging unit"
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
                                    href={index.url()}
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

            {/* Packaging Unit Selection Modal for Multiple UOMs */}
            <UomSelectionModal
                prompt={uomPromptProduct}
                lines={lines}
                onSelect={(product, uom, qty) => {
                    addProductToOrder(product, uom, qty);
                    setUomPromptProduct(null);
                }}
                onClose={() => setUomPromptProduct(null)}
            />
        </AppLayout>
    );
}
