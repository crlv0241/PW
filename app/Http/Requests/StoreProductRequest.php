<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'sku' => ['required', 'string', 'max:50', 'unique:products,sku'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'tax_category' => ['required', 'string', 'in:STANDARD,ZERO_RATED,EXEMPT'],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:1'],
            'description' => ['nullable', 'string', 'max:1000'],
            'base_uom_name' => ['required', 'string', 'max:50'],
            'base_uom_barcode' => ['nullable', 'string', 'max:100', 'unique:product_uoms,barcode'],
            'base_uom_price_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
