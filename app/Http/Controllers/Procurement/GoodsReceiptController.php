<?php

declare(strict_types=1);

namespace App\Http\Controllers\Procurement;

use App\Actions\Procurement\ReceiveGoodsAction;
use App\Actions\Procurement\ReconcileThreeWayMatchAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Procurement\StoreGoodsReceiptRequest;
use App\Models\GoodsReceipt;
use App\Models\Location;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class GoodsReceiptController extends Controller
{
    /**
     * Display a listing of completed and in-flight goods receipts and open PO intake queues.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value() ?: null;
        $matchStatus = $request->string('match_status')->trim()->value() ?: null;

        $receipts = GoodsReceipt::query()
            ->with([
                'supplier:id,supplier_code,name',
                'location:id,code,name',
                'purchaseOrder:id,po_number,supplier_reference,total_cents,status',
                'receiver:id,name',
                'lines.product:id,sku,name',
                'lines.uom:id,name,conversion_factor,barcode',
            ])
            ->when($search, function ($query, string $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('gr_number', 'like', "%{$search}%")
                        ->orWhere('supplier_invoice_number', 'like', "%{$search}%")
                        ->orWhereHas('purchaseOrder', fn ($pq) => $pq->where('po_number', 'like', "%{$search}%")->orWhere('supplier_reference', 'like', "%{$search}%"))
                        ->orWhereHas('supplier', fn ($sq) => $sq->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($matchStatus, fn ($query, string $ms) => $query->where('match_status', $ms))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $openPurchaseOrders = PurchaseOrder::query()
            ->whereIn('status', ['APPROVED', 'PARTIALLY_RECEIVED', 'PENDING'])
            ->with([
                'supplier:id,supplier_code,name',
                'destinationLocation:id,code,name',
                'lines.product:id,sku,name',
                'lines.uom:id,name,conversion_factor,is_base_unit,barcode',
            ])
            ->latest('id')
            ->get();

        $locations = Location::query()
            ->where('is_active', true)
            ->whereIn('type', ['warehouse', 'damage'])
            ->select('id', 'code', 'name', 'type')
            ->orderBy('name')
            ->get();

        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->select('id', 'supplier_code', 'name')
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->where('status', 'ACTIVE')
            ->with(['uoms:id,product_id,name,conversion_factor,is_base_unit,barcode,price_cents'])
            ->select('id', 'sku', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('procurement/receiving/index', [
            'receipts' => $receipts,
            'openPurchaseOrders' => $openPurchaseOrders,
            'locations' => $locations,
            'suppliers' => $suppliers,
            'products' => $products,
            'filters' => [
                'search' => $search ?? '',
                'match_status' => $matchStatus ?? '',
            ],
        ]);
    }

    /**
     * Store blind intake goods receipt with dual-write into physical ledger and 3-way match.
     */
    public function store(StoreGoodsReceiptRequest $request, ReceiveGoodsAction $receiveGoods): RedirectResponse
    {
        $validated = $request->validated();
        $validated['received_by'] = $request->user()?->id;

        /** @var array{
         *     purchase_order_id?: int|null,
         *     supplier_id: int,
         *     location_id: int,
         *     received_by?: int|null,
         *     supplier_invoice_number?: string|null,
         *     supplier_delivery_note?: string|null,
         *     supplier_invoice_amount_cents?: int|null,
         *     notes?: string|null,
         *     lines: list<array{
         *         purchase_order_line_id?: int|null,
         *         product_id: int,
         *         product_uom_id: int,
         *         scanned_qty: int,
         *         rejected_qty?: int|null,
         *         batch_number?: string|null,
         *         expiry_date?: string|null,
         *         remarks?: string|null,
         *     }>
         * } $validated
         */
        $receipt = $receiveGoods->execute($validated);

        return back()->with('success', sprintf('Goods Receipt %s processed. Stock ledgers and balances updated.', $receipt->gr_number));
    }

    /**
     * Compute and retrieve detailed 3-Way Match audit report for a Goods Receipt.
     */
    public function reconcile(GoodsReceipt $receipt, ReconcileThreeWayMatchAction $reconcileAction): JsonResponse
    {
        $audit = $reconcileAction->execute($receipt);

        return response()->json([
            'audit' => $audit,
            'receipt' => $receipt->fresh(['purchaseOrder.lines.product', 'lines.product', 'lines.uom', 'supplier']),
        ]);
    }
}
