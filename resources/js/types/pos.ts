export interface ProductUom {
    id: number;
    product_id: number;
    name: string;
    conversion_factor: number;
    barcode: string | null;
    is_base_unit: boolean;
    price_cents: number | null;
    created_at: string;
    updated_at: string;
}

export interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    status: 'ACTIVE' | 'INACTIVE';
    tax_category: string;
    tax_rate: string;
    description: string | null;
    uoms: ProductUom[];
    total_stock?: number | string | null;
    balances?: InventoryBalance[];
    created_at: string;
    updated_at: string;
}

export interface Location {
    id: number;
    code: string;
    name: string;
    type: 'warehouse' | 'truck' | 'damage' | 'staging';
    address: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Customer {
    id: number;
    account_code: string;
    company_name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    delivery_address: string;
    credit_limit_cents: number | null;
    current_balance_cents: number;
    payment_terms_days: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Supplier {
    id: number;
    supplier_code: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    payment_terms_days: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface InventoryBalance {
    id: number;
    location_id: number;
    product_id: number;
    current_qty: number;
    location?: Location;
    product?: Product;
    created_at: string;
    updated_at: string;
}

export interface InventoryLedger {
    id: number;
    client_uuid: string;
    location_id: number;
    product_id: number;
    qty_change: number;
    transaction_type: string;
    reference_id: number | null;
    batch_number: string | null;
    expiry_date: string | null;
    notes: string | null;
    location?: Location;
    product?: Product;
    created_at: string;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

export interface PurchaseOrderLine {
    id: number;
    purchase_order_id: number;
    product_id: number;
    product_uom_id: number;
    ordered_qty: number;
    conversion_factor: number;
    ordered_base_qty: number;
    received_base_qty: number;
    unit_cost_cents: number;
    discount_type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'STACKED_PERCENT' | 'COMPOUND';
    discount_formula?: string | null;
    discount_percent: string;
    discount_amount_cents: number;
    net_unit_cost_cents: number;
    net_base_cost_cents: number;
    line_total_cents: number;
    product?: Product;
    uom?: ProductUom;
    created_at?: string;
    updated_at?: string;
}

export interface PurchaseOrder {
    id: number;
    po_number: string;
    supplier_reference?: string | null;
    supplier_id: number;
    destination_location_id: number;
    status: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';
    tax_type?: 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'NON_VAT';
    order_date: string;
    expected_delivery_date: string | null;
    subtotal_cents: number;
    line_discount_cents?: number;
    order_discount_type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'STACKED_PERCENT' | 'COMPOUND' | 'PIPELINE';
    order_discount_formula?: string | null;
    order_discount_steps?: Array<{ type: 'PERCENT' | 'FIXED'; value: number }> | null;
    order_discount_cents?: number;
    discount_cents: number;
    tax_cents: number;
    total_cents: number;
    notes: string | null;
    created_by: number | null;
    supplier?: Supplier;
    destination_location?: Location;
    destinationLocation?: Location;
    creator?: { id: number; name: string } | null;
    lines?: PurchaseOrderLine[];
    created_at: string;
    updated_at: string;
}

export interface GoodsReceiptLine {
    id: number;
    goods_receipt_id: number;
    purchase_order_line_id: number | null;
    product_id: number;
    product_uom_id: number;
    scanned_qty: number;
    conversion_factor: number;
    received_base_qty: number;
    rejected_base_qty: number;
    batch_number: string | null;
    expiry_date: string | null;
    remarks: string | null;
    product?: Product;
    uom?: ProductUom;
    created_at?: string;
    updated_at?: string;
}

export interface GoodsReceipt {
    id: number;
    gr_number: string;
    purchase_order_id: number | null;
    supplier_id: number;
    location_id: number;
    received_by: number | null;
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    match_status: 'PENDING' | 'PERFECT_MATCH' | 'SHORT_DELIVERY' | 'OVER_DELIVERY' | 'PRICE_VARIANCE' | 'UNLINKED';
    supplier_invoice_number: string | null;
    supplier_delivery_note: string | null;
    supplier_invoice_amount_cents: number | null;
    notes: string | null;
    received_at: string;
    supplier?: Supplier;
    location?: Location;
    purchase_order?: PurchaseOrder;
    purchaseOrder?: PurchaseOrder;
    receiver?: { id: number; name: string } | null;
    lines?: GoodsReceiptLine[];
    created_at: string;
    updated_at: string;
}

