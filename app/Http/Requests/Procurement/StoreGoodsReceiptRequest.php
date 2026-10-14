<?php

declare(strict_types=1);

namespace App\Http\Requests\Procurement;

use Illuminate\Foundation\Http\FormRequest;

final class StoreGoodsReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'supplier_invoice_number' => ['nullable', 'string', 'max:64'],
            'supplier_delivery_note' => ['nullable', 'string', 'max:64'],
            'supplier_invoice_amount_cents' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.purchase_order_line_id' => ['nullable', 'integer', 'exists:purchase_order_lines,id'],
            'lines.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'lines.*.product_uom_id' => ['required', 'integer', 'exists:product_uoms,id'],
            'lines.*.scanned_qty' => ['required', 'integer', 'min:1'],
            'lines.*.rejected_qty' => ['nullable', 'integer', 'min:0'],
            'lines.*.batch_number' => ['nullable', 'string', 'max:64'],
            'lines.*.expiry_date' => ['nullable', 'date'],
            'lines.*.remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
