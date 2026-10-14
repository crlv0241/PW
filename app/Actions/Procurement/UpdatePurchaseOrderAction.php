<?php

declare(strict_types=1);

namespace App\Actions\Procurement;

use App\Models\ProductUom;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpdatePurchaseOrderAction
{
    /**
     * Updates an existing purchase order with validated UOM pricing, integer penny calculations, and trade discount pipeline.
     *
     * @param array{
     *     supplier_id: int,
     *     destination_location_id: int,
     *     supplier_reference?: string|null,
     *     order_date: string,
     *     expected_delivery_date?: string|null,
     *     tax_type?: string|null,
     *     order_discount_type?: string|null,
     *     order_discount_formula?: string|null,
     *     order_discount_steps?: list<array{type: string, value: float|int|string}>|null,
     *     order_discount_cents?: int|null,
     *     notes?: string|null,
     *     lines: list<array{
     *         product_id: int,
     *         product_uom_id: int,
     *         ordered_qty: int,
     *         unit_cost_cents: int,
     *         discount_type?: string|null,
     *         discount_formula?: string|null,
     *         discount_percent?: float|string|null,
     *         discount_amount_cents?: int|null,
     *     }>
     * } $data
     */
    public function execute(PurchaseOrder $order, array $data): PurchaseOrder
    {
        if (in_array($order->status, ['COMPLETED', 'CANCELLED'], true)) {
            throw ValidationException::withMessages([
                'order' => [sprintf('Cannot adjust Purchase Order %s because it is already %s.', $order->po_number, $order->status)],
            ]);
        }

        return DB::transaction(function () use ($order, $data) {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::query()
                ->where('id', $order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedPo->status, ['COMPLETED', 'CANCELLED'], true)) {
                throw ValidationException::withMessages([
                    'order' => [sprintf('Cannot adjust Purchase Order %s because it is already %s.', $lockedPo->po_number, $lockedPo->status)],
                ]);
            }

            // Check if any lines have already been received
            $hasReceipts = $lockedPo->lines()->where('received_base_qty', '>', 0)->exists();

            $subtotalCents = 0;
            $discountCents = 0;
            $totalCents = 0;

            // Pre-fetch all referenced ProductUoms in one single query to eliminate N+1 queries
            $uomIds = array_unique(array_map(fn (array $l) => (int) $l['product_uom_id'], $data['lines']));
            $uoms = ProductUom::query()
                ->whereIn('id', $uomIds)
                ->get()
                ->keyBy('id');

            /** @var list<array<string, mixed>> $computedLines */
            $computedLines = [];

            foreach ($data['lines'] as $lineInput) {
                $uom = $uoms->get($lineInput['product_uom_id']);
                if ($uom === null || $uom->product_id !== (int) $lineInput['product_id']) {
                    throw ValidationException::withMessages([
                        'lines' => [sprintf('Product UOM ID %d does not match Product ID %d.', $lineInput['product_uom_id'], $lineInput['product_id'])],
                    ]);
                }

                $conversionFactor = max(1, $uom->conversion_factor);
                $orderedQty = max(1, $lineInput['ordered_qty']);
                $orderedBaseQty = $orderedQty * $conversionFactor;
                $grossUnitCost = max(0, $lineInput['unit_cost_cents']);

                $discountType = $lineInput['discount_type'] ?? 'PERCENTAGE';
                $discountFormula = isset($lineInput['discount_formula']) ? trim((string) $lineInput['discount_formula']) : null;

                $discountUnit = 0;
                $effectiveDiscountPct = 0.0;

                if ($discountType === 'FIXED_AMOUNT') {
                    $fixedCents = isset($lineInput['discount_amount_cents'])
                        ? (int) $lineInput['discount_amount_cents']
                        : (int) round((float) ($discountFormula ?: 0) * 100);
                    $discountUnit = min($grossUnitCost, max(0, $fixedCents));
                    $effectiveDiscountPct = $grossUnitCost > 0 ? $discountUnit / $grossUnitCost : 0.0;
                } elseif ($discountType === 'STACKED_PERCENT' && ! empty($discountFormula)) {
                    $tiers = array_filter(
                        array_map('trim', explode('+', $discountFormula)),
                        fn (string $part) => is_numeric($part)
                    );

                    $netRemaining = (float) $grossUnitCost;
                    foreach ($tiers as $tierStr) {
                        $rate = ((float) $tierStr) / 100.0;
                        if ($rate > 0 && $rate <= 1.0) {
                            $tierDiscount = $netRemaining * $rate;
                            $netRemaining = max(0.0, $netRemaining - $tierDiscount);
                        }
                    }

                    $netUnitRounded = (int) round($netRemaining);
                    $discountUnit = max(0, $grossUnitCost - $netUnitRounded);
                    $effectiveDiscountPct = $grossUnitCost > 0 ? $discountUnit / $grossUnitCost : 0.0;
                } elseif ($discountType === 'COMPOUND' && ! empty($discountFormula)) {
                    $parts = explode('|', $discountFormula);
                    $percentFormula = $parts[0];
                    $fixedFormula = $parts[1] ?? '0';

                    $tiers = array_filter(
                        array_map('trim', explode('+', $percentFormula)),
                        fn (string $part) => is_numeric($part)
                    );

                    $netRemaining = (float) $grossUnitCost;
                    foreach ($tiers as $tierStr) {
                        $rate = ((float) $tierStr) / 100.0;
                        if ($rate > 0 && $rate <= 1.0) {
                            $tierDiscount = $netRemaining * $rate;
                            $netRemaining = max(0.0, $netRemaining - $tierDiscount);
                        }
                    }

                    $fixedCents = (int) round(((float) $fixedFormula) * 100);
                    $netRemaining = max(0.0, $netRemaining - $fixedCents);

                    $netUnitRounded = (int) round($netRemaining);
                    $discountUnit = max(0, $grossUnitCost - $netUnitRounded);
                    $effectiveDiscountPct = $grossUnitCost > 0 ? $discountUnit / $grossUnitCost : 0.0;
                } else {
                    if ($discountFormula !== null && str_contains($discountFormula, '+')) {
                        $tiers = array_filter(
                            array_map('trim', explode('+', $discountFormula)),
                            fn (string $part) => is_numeric($part)
                        );

                        $netRemaining = (float) $grossUnitCost;
                        foreach ($tiers as $tierStr) {
                            $rate = ((float) $tierStr) / 100.0;
                            if ($rate > 0 && $rate <= 1.0) {
                                $tierDiscount = $netRemaining * $rate;
                                $netRemaining = max(0.0, $netRemaining - $tierDiscount);
                            }
                        }

                        $netUnitRounded = (int) round($netRemaining);
                        $discountUnit = max(0, $grossUnitCost - $netUnitRounded);
                        $effectiveDiscountPct = $grossUnitCost > 0 ? $discountUnit / $grossUnitCost : 0.0;
                    } else {
                        $discountPct = (float) ($lineInput['discount_percent'] ?? ($discountFormula ? ((float) $discountFormula) / 100 : 0));
                        $effectiveDiscountPct = max(0.0, min(1.0, $discountPct));
                        $discountUnit = (int) round($grossUnitCost * $effectiveDiscountPct);
                    }
                }

                $netUnitCost = max(0, $grossUnitCost - $discountUnit);
                $netBaseCost = intdiv($netUnitCost, $conversionFactor);

                $lineGross = $grossUnitCost * $orderedQty;
                $lineDiscount = $discountUnit * $orderedQty;
                $lineTotal = $netUnitCost * $orderedQty;

                $subtotalCents += $lineGross;
                $discountCents += $lineDiscount;
                $totalCents += $lineTotal;

                $computedLines[] = [
                    'purchase_order_id' => $lockedPo->id,
                    'product_id' => $lineInput['product_id'],
                    'product_uom_id' => $lineInput['product_uom_id'],
                    'ordered_qty' => $orderedQty,
                    'conversion_factor' => $conversionFactor,
                    'ordered_base_qty' => $orderedBaseQty,
                    'unit_cost_cents' => $grossUnitCost,
                    'discount_type' => $discountType,
                    'discount_formula' => $discountFormula,
                    'discount_percent' => number_format($effectiveDiscountPct, 4, '.', ''),
                    'discount_amount_cents' => $discountUnit,
                    'net_unit_cost_cents' => $netUnitCost,
                    'net_base_cost_cents' => $netBaseCost,
                    'line_total_cents' => $lineTotal,
                    'received_base_qty' => 0,
                ];
            }

            // 1. Line-level trade discount totals
            $lineDiscountCents = $discountCents;
            $netAfterLineDiscounts = max(0, $subtotalCents - $lineDiscountCents);

            // 2. Overall PO-level discount system (supports %, ₱, Combo, and Ordered Pipeline Steps)
            $orderDiscountType = $data['order_discount_type'] ?? 'PERCENTAGE';
            $orderDiscountFormula = isset($data['order_discount_formula']) ? trim((string) $data['order_discount_formula']) : null;
            $orderDiscountSteps = $data['order_discount_steps'] ?? null;
            $orderDiscountCents = 0;
            $storedDiscountSteps = null;

            if (! empty($orderDiscountSteps)) {
                $orderDiscountType = 'PIPELINE';
                $remaining = (float) $netAfterLineDiscounts;
                $formulaParts = [];
                $validSteps = [];
                $accumulatedDiscount = 0.0;

                foreach ($orderDiscountSteps as $step) {
                    $type = strtoupper((string) $step['type']);
                    $val = (float) $step['value'];
                    if ($val <= 0) {
                        continue;
                    }

                    if ($type === 'PERCENT') {
                        $rate = min(1.0, max(0.0, $val / 100.0));
                        $stepDiscount = $remaining * $rate;
                        $formulaParts[] = rtrim(rtrim(number_format($val, 2, '.', ''), '0'), '.').'%';
                        $validSteps[] = ['type' => 'PERCENT', 'value' => $val];
                    } else {
                        $fixedCents = (float) round($val * 100);
                        $stepDiscount = min($remaining, $fixedCents);
                        $formulaParts[] = '₱'.number_format($val, 2, '.', ',');
                        $validSteps[] = ['type' => 'FIXED', 'value' => $val];
                    }

                    $remaining = max(0.0, $remaining - $stepDiscount);
                    $accumulatedDiscount += $stepDiscount;
                }

                $orderDiscountCents = (int) round($accumulatedDiscount);
                $orderDiscountFormula = implode(' → ', $formulaParts);
                $storedDiscountSteps = $validSteps;
            } elseif ($orderDiscountFormula !== null && (str_contains($orderDiscountFormula, '→') || str_contains($orderDiscountFormula, '->') || str_contains($orderDiscountFormula, '>'))) {
                $orderDiscountType = 'PIPELINE';
                $separator = str_contains($orderDiscountFormula, '→') ? '→' : (str_contains($orderDiscountFormula, '->') ? '->' : '>');
                $rawTiers = array_map('trim', explode($separator, $orderDiscountFormula));
                $remaining = (float) $netAfterLineDiscounts;
                $formulaParts = [];
                $validSteps = [];
                $accumulatedDiscount = 0.0;

                foreach ($rawTiers as $rawTier) {
                    if (empty($rawTier)) {
                        continue;
                    }
                    if (str_ends_with($rawTier, '%')) {
                        $val = (float) trim(str_replace('%', '', $rawTier));
                        if ($val <= 0) {
                            continue;
                        }
                        $rate = min(1.0, max(0.0, $val / 100.0));
                        $stepDiscount = $remaining * $rate;
                        $formulaParts[] = rtrim(rtrim(number_format($val, 2, '.', ''), '0'), '.').'%';
                        $validSteps[] = ['type' => 'PERCENT', 'value' => $val];
                    } else {
                        $val = (float) trim(str_replace(['₱', 'PHP', ','], '', $rawTier));
                        if ($val <= 0) {
                            continue;
                        }
                        $fixedCents = (float) round($val * 100);
                        $stepDiscount = min($remaining, $fixedCents);
                        $formulaParts[] = '₱'.number_format($val, 2, '.', ',');
                        $validSteps[] = ['type' => 'FIXED', 'value' => $val];
                    }
                    $remaining = max(0.0, $remaining - $stepDiscount);
                    $accumulatedDiscount += $stepDiscount;
                }

                $orderDiscountCents = (int) round($accumulatedDiscount);
                $orderDiscountFormula = implode(' → ', $formulaParts);
                $storedDiscountSteps = $validSteps;
            } elseif ($orderDiscountType === 'FIXED_AMOUNT') {
                $fixedCents = isset($data['order_discount_cents'])
                    ? (int) $data['order_discount_cents']
                    : (int) round((float) ($orderDiscountFormula ?: 0) * 100);
                $orderDiscountCents = min($netAfterLineDiscounts, max(0, $fixedCents));
            } elseif ($orderDiscountType === 'STACKED_PERCENT' && ! empty($orderDiscountFormula)) {
                $tiers = array_filter(
                    array_map('trim', explode('+', $orderDiscountFormula)),
                    fn (string $part) => is_numeric($part)
                );
                $remaining = (float) $netAfterLineDiscounts;
                foreach ($tiers as $tierStr) {
                    $rate = ((float) $tierStr) / 100.0;
                    if ($rate > 0 && $rate <= 1.0) {
                        $remaining = max(0.0, $remaining - ($remaining * $rate));
                    }
                }
                $netAfterDiscount = (int) round($remaining);
                $orderDiscountCents = max(0, $netAfterLineDiscounts - $netAfterDiscount);
            } elseif ($orderDiscountType === 'COMPOUND' && ! empty($orderDiscountFormula)) {
                $parts = explode('|', $orderDiscountFormula);
                $percentFormula = $parts[0];
                $fixedFormula = $parts[1] ?? '0';

                $tiers = array_filter(
                    array_map('trim', explode('+', $percentFormula)),
                    fn (string $part) => is_numeric($part)
                );
                $remaining = (float) $netAfterLineDiscounts;
                foreach ($tiers as $tierStr) {
                    $rate = ((float) $tierStr) / 100.0;
                    if ($rate > 0 && $rate <= 1.0) {
                        $remaining = max(0.0, $remaining - ($remaining * $rate));
                    }
                }
                $fixedCents = (int) round(((float) $fixedFormula) * 100);
                $remaining = max(0.0, $remaining - $fixedCents);
                $netAfterDiscount = (int) round($remaining);
                $orderDiscountCents = max(0, $netAfterLineDiscounts - $netAfterDiscount);
            } else {
                if ($orderDiscountFormula !== null && str_contains($orderDiscountFormula, '+')) {
                    $tiers = array_filter(
                        array_map('trim', explode('+', $orderDiscountFormula)),
                        fn (string $part) => is_numeric($part)
                    );
                    $remaining = (float) $netAfterLineDiscounts;
                    foreach ($tiers as $tierStr) {
                        $rate = ((float) $tierStr) / 100.0;
                        if ($rate > 0 && $rate <= 1.0) {
                            $remaining = max(0.0, $remaining - ($remaining * $rate));
                        }
                    }
                    $netAfterDiscount = (int) round($remaining);
                    $orderDiscountCents = max(0, $netAfterLineDiscounts - $netAfterDiscount);
                } else {
                    $pct = (float) ($orderDiscountFormula ?: 0);
                    $rate = max(0.0, min(1.0, $pct / 100.0));
                    $orderDiscountCents = (int) round($netAfterLineDiscounts * $rate);
                }
            }

            // 3. Total Combined Discounts (Line trade + Overall PO discount)
            $totalDiscountCents = $lineDiscountCents + $orderDiscountCents;
            $netTaxableBaseCents = max(0, $subtotalCents - $totalDiscountCents);

            // 4. Tax calculation (Default: NON_VAT)
            $taxType = $data['tax_type'] ?? 'NON_VAT';

            if ($taxType === 'VAT_INCLUSIVE') {
                $taxCents = (int) round(($netTaxableBaseCents / 1.12) * 0.12);
                $finalTotalCents = $netTaxableBaseCents;
            } elseif ($taxType === 'VAT_EXCLUSIVE') {
                $taxCents = (int) round($netTaxableBaseCents * 0.12);
                $finalTotalCents = $netTaxableBaseCents + $taxCents;
            } else {
                $taxType = 'NON_VAT';
                $taxCents = 0;
                $finalTotalCents = $netTaxableBaseCents;
            }

            $lockedPo->update([
                'supplier_id' => $data['supplier_id'],
                'destination_location_id' => $data['destination_location_id'],
                'supplier_reference' => isset($data['supplier_reference']) && trim((string) $data['supplier_reference']) !== ''
                    ? trim((string) $data['supplier_reference'])
                    : null,
                'tax_type' => $taxType,
                'order_date' => $data['order_date'],
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'subtotal_cents' => $subtotalCents,
                'line_discount_cents' => $lineDiscountCents,
                'order_discount_type' => $orderDiscountType,
                'order_discount_formula' => $orderDiscountFormula,
                'order_discount_steps' => $storedDiscountSteps,
                'order_discount_cents' => $orderDiscountCents,
                'discount_cents' => $totalDiscountCents,
                'tax_cents' => $taxCents,
                'total_cents' => $finalTotalCents,
                'notes' => $data['notes'] ?? null,
            ]);

            // Sync lines: if not yet received, replace cleanly
            if (! $hasReceipts) {
                $lockedPo->lines()->delete();
                foreach ($computedLines as $line) {
                    PurchaseOrderLine::create($line);
                }
            } else {
                // For partially received orders, preserve received_base_qty
                $existingLines = $lockedPo->lines()->get()->keyBy(fn ($l) => $l->product_id.'-'.$l->product_uom_id);
                $lockedPo->lines()->delete();

                foreach ($computedLines as $line) {
                    $key = $line['product_id'].'-'.$line['product_uom_id'];
                    $prev = $existingLines->get($key);
                    if ($prev !== null) {
                        $line['received_base_qty'] = $prev->received_base_qty;
                    }
                    PurchaseOrderLine::create($line);
                }
            }

            return $lockedPo->load(['lines.product', 'lines.uom', 'supplier', 'destinationLocation']);
        });
    }
}
