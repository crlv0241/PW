<?php

declare(strict_types=1);

namespace App\Actions\Product;

use App\Models\Product;
use App\Models\ProductUom;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CreateProductAction
{
    /**
     * Create a product and its packaging units of measure.
     *
     * @param  array{
     *     sku: string,
     *     name: string,
     *     category: string,
     *     status?: string,
     *     tax_category: string,
     *     tax_rate: float|string,
     *     description?: string|null,
     *     uoms: list<array{
     *         name: string,
     *         conversion_factor: int,
     *         barcode?: string|null,
     *         is_base_unit: bool,
     *         price_cents?: int|null
     *     }>
     * }  $data
     */
    public function execute(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $baseUoms = array_filter($data['uoms'], fn (array $uom) => ! empty($uom['is_base_unit']));

            if (count($baseUoms) !== 1) {
                throw ValidationException::withMessages([
                    'uoms' => 'A product must have exactly one base packaging unit.',
                ]);
            }

            $product = Product::create([
                'sku' => trim($data['sku']),
                'name' => trim($data['name']),
                'category' => trim($data['category']),
                'status' => $data['status'] ?? 'ACTIVE',
                'tax_category' => $data['tax_category'],
                'tax_rate' => $data['tax_rate'],
                'description' => ! empty($data['description']) ? trim($data['description']) : null,
            ]);

            foreach ($data['uoms'] as $uomData) {
                $isBase = ! empty($uomData['is_base_unit']);
                $factor = $isBase ? 1 : (int) $uomData['conversion_factor'];
                $barcode = ! empty($uomData['barcode']) ? trim((string) $uomData['barcode']) : null;
                $priceCents = isset($uomData['price_cents'])
                    ? (int) $uomData['price_cents']
                    : null;

                ProductUom::create([
                    'product_id' => $product->id,
                    'name' => trim($uomData['name']),
                    'conversion_factor' => $factor,
                    'barcode' => $barcode,
                    'is_base_unit' => $isBase,
                    'price_cents' => $priceCents,
                ]);
            }

            return $product->load(['uoms' => fn ($query) => $query->orderBy('conversion_factor', 'asc')]);
        });
    }
}
