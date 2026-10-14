import type { Product, ProductUom } from '../../../types/pos';
import type {
    DiscountComputationResult,
    OrderDiscountStep,
    ParsedPunch,
    PipelineComputationResult,
} from './order-types';

export const COMMON_UOM_TOKENS = new Set([
    'CS', 'CASE', 'CASES', 'CTN', 'CARTON', 'CARTONS',
    'BX', 'BOX', 'BOXES',
    'PK', 'PKG', 'PACK', 'PACKS', 'PACKAGE', 'PACKAGES',
    'PC', 'PCS', 'PIECE', 'PIECES', 'EACH', 'EA',
    'PL', 'PLT', 'PALLET', 'PALLETS',
    'BAG', 'BAGS', 'SACK', 'SACKS',
    'BTL', 'BOTTLE', 'BOTTLES',
    'CAN', 'CANS', 'TIN', 'TINS', 'JAR', 'JARS', 'TUB', 'TUBS',
    'ROLL', 'ROLLS', 'SET', 'SETS', 'PAIR', 'PAIRS',
    'KG', 'KILO', 'KILOS', 'G', 'GRAM', 'GRAMS',
    'L', 'LTR', 'LITER', 'LITERS', 'ML',
]);

/**
 * Calculates unit discount and effective percentage for a line item.
 */
export function computeDiscount(
    grossUnitCost: number,
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND',
    percentFormula: string,
    fixedAmountStr: string
): DiscountComputationResult {
    if (grossUnitCost <= 0) {
        return { unitDiscount: 0, effectivePct: 0 };
    }

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

        if (tokens.length === 0) {
            return { unitDiscount: 0, effectivePct: 0 };
        }

        let remaining = grossUnitCost;
        for (const pct of tokens) {
            const factor = Math.min(100, Math.max(0, pct)) / 100;
            remaining = remaining * (1 - factor);
        }
        const unitDiscount = Math.max(0, grossUnitCost - remaining);
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

        let remaining = grossUnitCost;
        for (const pct of tokens) {
            const factor = Math.min(100, Math.max(0, pct)) / 100;
            remaining = remaining * (1 - factor);
        }

        const fixed = parseFloat(fixedAmountStr) || 0;
        remaining = Math.max(0, remaining - fixed);

        const unitDiscount = Math.max(0, grossUnitCost - remaining);
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
export function computeDiscountPipeline(
    grossSubtotal: number,
    steps: OrderDiscountStep[]
): PipelineComputationResult {
    let currentAmount = grossSubtotal;
    let totalDiscount = 0;
    const stepBreakdown: PipelineComputationResult['stepBreakdown'] = [];
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
                const startAmount = currentAmount;
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
 * Extracts UOM hint and search query from a raw input string.
 */
export function extractUomAndQuery(raw: string): { query: string; uomHint?: string } {
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

    // Check if the query ends with a known UOM word separated by whitespace
    const lastSpaceIdx = trimmed.lastIndexOf(' ');
    if (lastSpaceIdx !== -1) {
        const potentialUom = trimmed.slice(lastSpaceIdx + 1).trim().toUpperCase();
        const preceding = trimmed.slice(0, lastSpaceIdx).trim();
        if (preceding && COMMON_UOM_TOKENS.has(potentialUom)) {
            return {
                query: preceding,
                uomHint: potentialUom,
            };
        }
    }

    return { query: trimmed };
}

/**
 * High-speed multiplier & UOM shortcut parser:
 * - "*3" or "3*" -> sets sticky multiplier to 3
 * - "*5bx" or "5bx*" -> sets sticky multiplier to 5 with UOM hint BX
 * - "5bx*cola" or "5pc*cola" -> punches 5 in Box/Piece UOM of cola
 * - "3*BEV" -> punches 3 of item matching "BEV"
 * - "3*BEV/CS" or "10*BEV:CASE" -> punches 3 of item in Case UOM
 * - "BEV/BOX*5" or "BEV*5bx" -> punches 5 Boxes of BEV
 * - "5bx cola" or "10cs coke" -> punches 5 Boxes of cola / 10 Cases of coke
 * - "BEV" -> punches 1 of item matching "BEV"
 */
export function parsePunchQuery(rawInput: string): ParsedPunch {
    const trimmed = rawInput.trim();
    if (!trimmed) {
        return { query: '', qty: 1, isOnlyMultiplier: false };
    }

    // 1. Standalone multiplier with optional attached UOM: e.g. "*3", "3*", "*5bx", "5bx*"
    const standaloneMatch = trimmed.match(/^(\*(\d+)([a-zA-Z]+)?|(\d+)([a-zA-Z]+)?\*)$/);
    if (standaloneMatch) {
        const qtyStr = standaloneMatch[2] || standaloneMatch[4];
        const uomStr = standaloneMatch[3] || standaloneMatch[5];
        const uomRaw = uomStr?.toUpperCase();
        if (!uomRaw || COMMON_UOM_TOKENS.has(uomRaw)) {
            const qty = parseInt(qtyStr, 10);
            return {
                query: '',
                qty: Math.max(1, qty),
                uomHint: uomRaw,
                isOnlyMultiplier: true,
            };
        }
    }

    // 2. Prefix multiplier with optional attached UOM: e.g. "5bx*cola", "5pc*cola", "10cs*san mig", "3*BEV"
    const prefixMatch = trimmed.match(/^(\d+)([a-zA-Z]+)?\*(.+)$/);
    if (prefixMatch) {
        const uomRaw = prefixMatch[2]?.toUpperCase();
        if (!uomRaw || COMMON_UOM_TOKENS.has(uomRaw)) {
            const qty = parseInt(prefixMatch[1], 10);
            const validAttachedUom = uomRaw && COMMON_UOM_TOKENS.has(uomRaw) ? uomRaw : undefined;
            const { query, uomHint } = extractUomAndQuery(prefixMatch[3]);
            return {
                query,
                qty: Math.max(1, qty),
                uomHint: uomHint || validAttachedUom,
                isOnlyMultiplier: false,
            };
        }
    }

    // 3. Suffix multiplier with optional attached UOM: e.g. "cola*5bx", "cola*10cs", "BEV*3"
    const suffixMatch = trimmed.match(/^(.+)\*(\d+)([a-zA-Z]+)?$/);
    if (suffixMatch) {
        const uomRaw = suffixMatch[3]?.toUpperCase();
        if (!uomRaw || COMMON_UOM_TOKENS.has(uomRaw)) {
            const qty = parseInt(suffixMatch[2], 10);
            const validAttachedUom = uomRaw && COMMON_UOM_TOKENS.has(uomRaw) ? uomRaw : undefined;
            const { query, uomHint } = extractUomAndQuery(suffixMatch[1]);
            return {
                query,
                qty: Math.max(1, qty),
                uomHint: uomHint || validAttachedUom,
                isOnlyMultiplier: false,
            };
        }
    }

    // 4. Space-separated quantity with attached UOM: e.g. "5bx cola", "10cs coke", "2pc soap"
    const spacePrefixMatch = trimmed.match(/^(\d+)([a-zA-Z]+)\s+(.+)$/);
    if (spacePrefixMatch) {
        const uomRaw = spacePrefixMatch[2].toUpperCase();
        if (COMMON_UOM_TOKENS.has(uomRaw)) {
            const qty = parseInt(spacePrefixMatch[1], 10);
            const { query, uomHint } = extractUomAndQuery(spacePrefixMatch[3]);
            return {
                query,
                qty: Math.max(1, qty),
                uomHint: uomHint || uomRaw,
                isOnlyMultiplier: false,
            };
        }
    }

    // 5. Standard query with optional UOM extraction (e.g. "cola/box", "cola:cs", "cola box", "cola")
    const { query, uomHint } = extractUomAndQuery(trimmed);
    return {
        query,
        qty: 1,
        uomHint,
        isOnlyMultiplier: false,
    };
}

/**
 * Finds the best matching UOM for a product.
 * In Procurement orders, defaults to largest packaging tier (largest conversion_factor) if no hint.
 */
export function findMatchingUom(product: Product, uomHint?: string): ProductUom | undefined {
    if (!product.uoms || product.uoms.length === 0) return undefined;
    if (!uomHint) {
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

/**
 * Helper: Stock on Hand for product at destination warehouse.
 */
export function getProductSoh(prod: Product, locId: number): number {
    if (!prod.balances) return 0;
    const bal = prod.balances.find((b) => b.location_id === locId);
    return bal ? bal.current_qty : 0;
}

/**
 * Dynamically computes formatted unit cost string for a UOM.
 */
export function computeUomPrice(product: Product, uom?: ProductUom): string {
    if (!uom) return '0.00';
    if (uom.price_cents !== null && uom.price_cents !== undefined) {
        return (uom.price_cents / 100).toFixed(2);
    }
    const baseUom = product.uoms?.find((u) => u.is_base_unit || u.conversion_factor === 1);
    if (baseUom?.price_cents) {
        return ((baseUom.price_cents * (uom.conversion_factor || 1)) / 100).toFixed(2);
    }
    return '100.00';
}
