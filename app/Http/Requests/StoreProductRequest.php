<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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
     * Prepare inputs for validation.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('sku') && is_string($this->input('sku'))) {
            $this->merge(['sku' => strtoupper(trim($this->input('sku')))]);
        }

        // Backward compatibility for single base UOM payload
        if (! $this->has('uoms') && $this->filled('base_uom_name')) {
            $this->merge([
                'uoms' => [
                    [
                        'name' => $this->input('base_uom_name'),
                        'conversion_factor' => 1,
                        'barcode' => $this->input('base_uom_barcode'),
                        'is_base_unit' => true,
                        'price_cents' => $this->input('base_uom_price_cents'),
                    ],
                ],
            ]);
        }
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
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE'],
            'tax_category' => ['required', 'string', 'in:STANDARD,ZERO_RATED,EXEMPT'],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:1'],
            'description' => ['nullable', 'string', 'max:1000'],

            'uoms' => ['required', 'array', 'min:1'],
            'uoms.*.name' => ['required', 'string', 'max:50'],
            'uoms.*.conversion_factor' => ['required', 'integer', 'min:1'],
            'uoms.*.barcode' => ['nullable', 'string', 'max:100', 'distinct', 'unique:product_uoms,barcode'],
            'uoms.*.is_base_unit' => ['required', 'boolean'],
            'uoms.*.price_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $uoms = $this->input('uoms');
            if (! is_array($uoms)) {
                return;
            }

            $baseUnits = array_filter($uoms, fn ($uom) => is_array($uom) && ! empty($uom['is_base_unit']));

            if (count($baseUnits) === 0) {
                $validator->errors()->add('uoms', 'At least one packaging unit must be designated as the base unit.');
            } elseif (count($baseUnits) > 1) {
                $validator->errors()->add('uoms', 'Only one packaging unit can be designated as the base unit.');
            } else {
                $baseUnit = reset($baseUnits);
                if (isset($baseUnit['conversion_factor']) && (int) $baseUnit['conversion_factor'] !== 1) {
                    $validator->errors()->add('uoms', 'The base packaging unit must have a conversion factor of 1.');
                }
            }

            // Check duplicate UOM names (case-insensitive)
            $names = [];
            foreach ($uoms as $index => $uom) {
                if (is_array($uom) && isset($uom['name']) && is_string($uom['name'])) {
                    $normalized = strtolower(trim($uom['name']));
                    if (isset($names[$normalized])) {
                        $validator->errors()->add("uoms.{$index}.name", "Duplicate packaging unit name '{$uom['name']}'. Each unit name must be unique.");
                    } else {
                        $names[$normalized] = true;
                    }

                    if (empty($uom['is_base_unit']) && isset($uom['conversion_factor']) && (int) $uom['conversion_factor'] < 2) {
                        $validator->errors()->add("uoms.{$index}.conversion_factor", 'Secondary packaging tiers must have a conversion factor greater than 1.');
                    }
                }
            }
        });
    }
}
