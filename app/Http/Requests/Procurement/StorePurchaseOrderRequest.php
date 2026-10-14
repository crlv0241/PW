<?php

declare(strict_types=1);

namespace App\Http\Requests\Procurement;

use Illuminate\Foundation\Http\FormRequest;

final class StorePurchaseOrderRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'destination_location_id' => ['required', 'integer', 'exists:locations,id'],
            'supplier_reference' => ['nullable', 'string', 'max:64'],
            'order_date' => ['required', 'date'],
            'expected_delivery_date' => ['nullable', 'date', 'after_or_equal:order_date'],
            'tax_type' => ['nullable', 'string', 'in:VAT_EXCLUSIVE,VAT_INCLUSIVE,NON_VAT'],
            'order_discount_type' => ['nullable', 'string', 'in:PERCENTAGE,FIXED_AMOUNT,STACKED_PERCENT,COMPOUND,PIPELINE'],
            'order_discount_formula' => ['nullable', 'string', 'max:255'],
            'order_discount_cents' => ['nullable', 'integer', 'min:0'],
            'order_discount_steps' => ['nullable', 'array'],
            'order_discount_steps.*.type' => ['required_with:order_discount_steps', 'string', 'in:PERCENT,FIXED'],
            'order_discount_steps.*.value' => ['required_with:order_discount_steps', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'lines.*.product_uom_id' => ['required', 'integer', 'exists:product_uoms,id'],
            'lines.*.ordered_qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_cost_cents' => ['required', 'integer', 'min:0'],
            'lines.*.discount_type' => ['nullable', 'string', 'in:PERCENTAGE,FIXED_AMOUNT,STACKED_PERCENT,COMPOUND'],
            'lines.*.discount_formula' => ['nullable', 'string', 'max:64'],
            'lines.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'lines.*.discount_amount_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
