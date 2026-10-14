<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'new_count' => ['required', 'integer', 'min:0'],
            'reason_code' => ['required', 'string', 'in:PHYSICAL_COUNT,DAMAGED_GOODS,EXPIRED,SHRINKAGE,FOUND_STOCK'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
