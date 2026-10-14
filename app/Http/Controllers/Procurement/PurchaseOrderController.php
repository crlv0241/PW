<?php

declare(strict_types=1);

namespace App\Http\Controllers\Procurement;

use App\Actions\Procurement\CreatePurchaseOrderAction;
use App\Actions\Procurement\UpdatePurchaseOrderAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Procurement\StorePurchaseOrderRequest;
use App\Http\Requests\Procurement\UpdatePurchaseOrderRequest;
use App\Models\Location;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class PurchaseOrderController extends Controller
{
    /**
     * Display a listing of purchase orders with status filtering and pagination.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value() ?: null;
        $status = $request->string('status')->trim()->value() ?: null;
        $supplierId = $request->integer('supplier_id') ?: null;
        $dateFrom = $request->string('date_from')->trim()->value() ?: null;
        $dateTo = $request->string('date_to')->trim()->value() ?: null;
        $perPage = min(100, max(10, $request->integer('per_page', 15)));

        $orders = PurchaseOrder::query()
            ->with([
                'supplier:id,supplier_code,name',
                'destinationLocation:id,code,name',
                'creator:id,name',
                'lines:id,purchase_order_id,product_id,product_uom_id,ordered_qty,ordered_base_qty,received_base_qty,unit_cost_cents,discount_type,discount_formula,discount_percent,net_base_cost_cents,line_total_cents',
                'lines.product:id,sku,name',
                'lines.uom:id,name,conversion_factor',
            ])
            ->when($search, function ($query, string $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('po_number', 'like', "%{$search}%")
                        ->orWhere('supplier_reference', 'like', "%{$search}%")
                        ->orWhereHas('supplier', function ($sq) use ($search) {
                            $sq->where('name', 'like', "%{$search}%")
                                ->orWhere('supplier_code', 'like', "%{$search}%");
                        });
                });
            })
            ->when($status, fn ($query, string $s) => $query->where('status', $s))
            ->when($supplierId, fn ($query, int $sId) => $query->where('supplier_id', $sId))
            ->when($dateFrom, fn ($query, string $df) => $query->whereDate('order_date', '>=', $df))
            ->when($dateTo, fn ($query, string $dt) => $query->whereDate('order_date', '<=', $dt))
            ->latest('id')
            ->paginate($perPage)
            ->withQueryString();

        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->select('id', 'supplier_code', 'name')
            ->orderBy('name')
            ->get();

        $locations = Location::query()
            ->where('is_active', true)
            ->whereIn('type', ['warehouse', 'damage'])
            ->select('id', 'code', 'name', 'type')
            ->orderBy('name')
            ->get();

        return Inertia::render('procurement/orders/index', [
            'orders' => $orders,
            'suppliers' => $suppliers,
            'locations' => $locations,
            'products' => [],
            'filters' => [
                'search' => $search ?? '',
                'status' => $status ?? '',
                'supplier_id' => $supplierId ? (string) $supplierId : '',
                'date_from' => $dateFrom ?? '',
                'date_to' => $dateTo ?? '',
                'per_page' => $perPage,
            ],
        ]);
    }

    /**
     * Show the dedicated high-throughput purchase order creation workspace.
     */
    public function create(): Response
    {
        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->select('id', 'supplier_code', 'name')
            ->orderBy('name')
            ->get();

        $locations = Location::query()
            ->where('is_active', true)
            ->whereIn('type', ['warehouse', 'damage'])
            ->select('id', 'code', 'name', 'type')
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->where('status', 'ACTIVE')
            ->with([
                'uoms:id,product_id,name,conversion_factor,is_base_unit,barcode,price_cents',
                'balances:id,product_id,location_id,current_qty',
            ])
            ->select('id', 'sku', 'name', 'category')
            ->orderBy('name')
            ->get();

        return Inertia::render('procurement/orders/create', [
            'suppliers' => $suppliers,
            'locations' => $locations,
            'products' => $products,
        ]);
    }

    /**
     * Store a newly created purchase order with Fowler-allocated line item amounts.
     */
    public function store(StorePurchaseOrderRequest $request, CreatePurchaseOrderAction $createPo): RedirectResponse
    {
        $validated = $request->validated();
        $validated['created_by'] = $request->user()?->id;

        /** @var array{
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
         *     created_by?: int|null,
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
         * } $validated
         */
        $po = $createPo->execute($validated);

        return redirect()->route('procurement.orders.index')->with('success', sprintf('Purchase Order %s generated successfully.', $po->po_number));
    }

    /**
     * Return purchase order details with lines and product barcode details for receiving.
     */
    public function show(PurchaseOrder $order): JsonResponse
    {
        $order->load([
            'supplier:id,supplier_code,name',
            'destinationLocation:id,code,name',
            'lines.product:id,sku,name',
            'lines.uom:id,name,conversion_factor,barcode',
        ]);

        return response()->json([
            'order' => $order,
        ]);
    }

    /**
     * Show the dedicated purchase order edit/adjustment workspace.
     */
    public function edit(PurchaseOrder $order): Response
    {
        $order->load([
            'supplier:id,supplier_code,name',
            'destinationLocation:id,code,name',
            'lines.product:id,sku,name,category',
            'lines.uom:id,name,conversion_factor,price_cents',
        ]);

        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->select('id', 'supplier_code', 'name')
            ->orderBy('name')
            ->get();

        $locations = Location::query()
            ->where('is_active', true)
            ->whereIn('type', ['warehouse', 'damage'])
            ->select('id', 'code', 'name', 'type')
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->where('status', 'ACTIVE')
            ->with([
                'uoms:id,product_id,name,conversion_factor,is_base_unit,barcode,price_cents',
                'balances:id,product_id,location_id,current_qty',
            ])
            ->select('id', 'sku', 'name', 'category')
            ->orderBy('name')
            ->get();

        return Inertia::render('procurement/orders/edit', [
            'order' => $order,
            'suppliers' => $suppliers,
            'locations' => $locations,
            'products' => $products,
        ]);
    }

    /**
     * Update an existing purchase order with recalculated line items and trade discount pipeline.
     */
    public function update(
        UpdatePurchaseOrderRequest $request,
        PurchaseOrder $order,
        UpdatePurchaseOrderAction $updatePo
    ): RedirectResponse {
        $validated = $request->validated();

        /** @var array{
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
         * } $validated
         */
        $po = $updatePo->execute($order, $validated);

        return redirect()->route('procurement.orders.index')->with('success', sprintf('Purchase Order %s updated successfully.', $po->po_number));
    }
}
