<?php

declare(strict_types=1);

namespace App\Http\Controllers\Procurement;

use App\Actions\Procurement\CreatePurchaseOrderAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Procurement\StorePurchaseOrderRequest;
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

        $orders = PurchaseOrder::query()
            ->with([
                'supplier:id,supplier_code,name',
                'destinationLocation:id,code,name',
                'creator:id,name',
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
            ->latest('id')
            ->paginate(15)
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

        $products = Product::query()
            ->where('status', 'ACTIVE')
            ->with([
                'uoms:id,product_id,name,conversion_factor,is_base_unit,barcode,price_cents',
                'balances:id,product_id,location_id,current_qty',
            ])
            ->select('id', 'sku', 'name', 'category')
            ->orderBy('name')
            ->get();

        return Inertia::render('procurement/orders/index', [
            'orders' => $orders,
            'suppliers' => $suppliers,
            'locations' => $locations,
            'products' => $products,
            'filters' => [
                'search' => $search ?? '',
                'status' => $status ?? '',
                'supplier_id' => $supplierId ? (string) $supplierId : '',
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
         *     notes?: string|null,
         *     created_by?: int|null,
         *     lines: list<array{
         *         product_id: int,
         *         product_uom_id: int,
         *         ordered_qty: int,
         *         unit_cost_cents: int,
         *         discount_percent?: float|string|null,
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
}
