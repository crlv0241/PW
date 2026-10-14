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
