export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMPOUND' | 'STACKED_PERCENT';
export type OrderTaxType = 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT';

export interface PoLineItem {
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

export interface OrderDiscountStep {
    id: string;
    type: 'PERCENT' | 'FIXED';
    value: string;
}

export interface ParsedPunch {
    query: string;
    qty: number;
    uomHint?: string;
    isOnlyMultiplier: boolean;
}

export interface DiscountComputationResult {
    unitDiscount: number;
    effectivePct: number;
}

export interface PipelineStepBreakdown {
    stepIndex: number;
    stepDiscount: number;
    remaining: number;
}

export interface PipelineComputationResult {
    totalDiscount: number;
    stepBreakdown: PipelineStepBreakdown[];
    finalPayable: number;
    formula: string;
}

export interface ScannerFeedback {
    type: 'success' | 'warning' | 'error';
    message: string;
}
