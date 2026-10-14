<?php

declare(strict_types=1);

namespace App\Actions\Product;

use App\Models\Product;
use App\Models\ProductUom;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpdateProductAction
{
    /**
     * Update an existing product and synchronize its packaging units of measure.
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
     *         id?: int|null,
     *         name: string,
     *         conversion_factor: int,
     *         barcode?: string|null,
     *         is_base_unit: bool,
     *         price_cents?: int|null
     *     }>
     * }  $data
     */
    public function execute(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $baseUoms = array_filter($data['uoms'], fn (array $uom) => ! empty($uom['is_base_unit']));

            if (count($baseUoms) !== 1) {
                throw ValidationException::withMessages([
                    'uoms' => 'A product must have exactly one base packaging unit.',
                ]);
            }

            // Update product master attributes
            $product->update([
                'sku' => trim($data['sku']),
                'name' => trim($data['name']),
                'category' => trim($data['category']),
                'status' => $data['status'] ?? $product->status,
                'tax_category' => $data['tax_category'],
                'tax_rate' => $data['tax_rate'],
                'description' => ! empty($data['description']) ? trim($data['description']) : null,
            ]);

            // Reconcile UOMs
            /** @var Collection<int, ProductUom> $currentUoms */
            $currentUoms = $product->uoms()->get()->keyBy('id');

            $submittedIds = collect($data['uoms'])
                ->pluck('id')
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->all();

            $uomsToDelete = $currentUoms->except($submittedIds);

            foreach ($uomsToDelete as $uom) {
                if ($uom->is_base_unit) {
                    throw ValidationException::withMessages([
                        'uoms' => 'The base packaging unit cannot be deleted.',
                    ]);
                }

                // Referential integrity checks
                $isReferencedInPo = DB::table('purchase_order_lines')
                    ->where('product_uom_id', $uom->id)
                    ->exists();

                if ($isReferencedInPo) {
                    throw ValidationException::withMessages([
                        'uoms' => "Cannot remove packaging tier '{$uom->name}' because it is referenced in purchase orders.",
                    ]);
                }

                $isReferencedInGr = DB::table('goods_receipt_lines')
                    ->where('product_uom_id', $uom->id)
                    ->exists();

                if ($isReferencedInGr) {
                    throw ValidationException::withMessages([
                        'uoms' => "Cannot remove packaging tier '{$uom->name}' because it is referenced in receiving records.",
                    ]);
                }

                $uom->delete();
            }

            // Upsert submitted UOMs
            foreach ($data['uoms'] as $uomData) {
                $isBase = ! empty($uomData['is_base_unit']);
                $factor = $isBase ? 1 : (int) $uomData['conversion_factor'];
                $barcode = ! empty($uomData['barcode']) ? trim((string) $uomData['barcode']) : null;
                $priceCents = isset($uomData['price_cents'])
                    ? (int) $uomData['price_cents']
                    : null;

                $uomId = isset($uomData['id']) && $uomData['id'] ? (int) $uomData['id'] : null;

                if ($uomId !== null && $currentUoms->has($uomId)) {
                    /** @var ProductUom $existingUom */
                    $existingUom = $currentUoms->get($uomId);
                    $existingUom->update([
                        'name' => trim($uomData['name']),
                        'conversion_factor' => $factor,
                        'barcode' => $barcode,
                        'is_base_unit' => $isBase,
                        'price_cents' => $priceCents,
                    ]);
                } else {
                    ProductUom::create([
                        'product_id' => $product->id,
                        'name' => trim($uomData['name']),
                        'conversion_factor' => $factor,
                        'barcode' => $barcode,
                        'is_base_unit' => $isBase,
                        'price_cents' => $priceCents,
                    ]);
                }
            }

            return $product->fresh(['uoms' => fn ($query) => $query->orderBy('conversion_factor', 'asc')]);
        });
    }
}
