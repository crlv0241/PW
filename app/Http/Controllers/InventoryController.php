<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Inventory\AdjustStockAction;
use App\Actions\Inventory\TransferStockAction;
use App\Http\Requests\AdjustStockRequest;
use App\Http\Requests\TransferStockRequest;
use App\Models\InventoryBalance;
use App\Models\InventoryLedger;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class InventoryController extends Controller
{
    /**
     * Display the active stock balances cache dashboard.
     */
    public function index(Request $request): Response
    {
        $locationId = $request->integer('location_id') ?: null;
        $productId = $request->integer('product_id') ?: null;

        $balances = InventoryBalance::query()
            ->with([
                'location:id,code,name,type',
                'product:id,sku,name,category',
                'product.uoms:id,product_id,name,conversion_factor,is_base_unit',
            ])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($productId, fn ($q) => $q->where('product_id', $productId))
            ->orderBy('location_id')
            ->orderBy('product_id')
            ->paginate(15)
            ->withQueryString();

        $locations = Location::query()
            ->where('is_active', true)
            ->select('id', 'code', 'name', 'type')
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->where('status', 'ACTIVE')
            ->select('id', 'sku', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('inventory/index', [
            'balances' => $balances,
            'locations' => $locations,
            'products' => $products,
            'filters' => [
                'location_id' => $locationId ? (string) $locationId : '',
                'product_id' => $productId ? (string) $productId : '',
            ],
        ]);
    }

    /**
     * Display the immutable write-ahead movement ledger audit log.
     */
    public function ledger(Request $request): Response
    {
        $locationId = $request->integer('location_id') ?: null;
        $productId = $request->integer('product_id') ?: null;
        $type = $request->string('transaction_type')->trim()->value() ?: null;

        $ledgers = InventoryLedger::query()
            ->with([
                'location:id,code,name,type',
                'product:id,sku,name,category',
            ])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($productId, fn ($q) => $q->where('product_id', $productId))
            ->when($type, fn ($q) => $q->where('transaction_type', $type))
            ->orderBy('id', 'desc')
            ->paginate(20)
            ->withQueryString();

        $locations = Location::query()
            ->select('id', 'code', 'name')
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->select('id', 'sku', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('inventory/ledger', [
            'ledgers' => $ledgers,
            'locations' => $locations,
            'products' => $products,
            'filters' => [
                'location_id' => $locationId ? (string) $locationId : '',
                'product_id' => $productId ? (string) $productId : '',
                'transaction_type' => $type ?? '',
            ],
        ]);
    }

    /**
     * Execute an atomic transfer between two locations.
     */
    public function transfer(TransferStockRequest $request, TransferStockAction $action): RedirectResponse
    {
        $action->execute(
            clientUuid: $request->validated('client_uuid'),
            sourceLocationId: (int) $request->validated('source_location_id'),
            destinationLocationId: (int) $request->validated('destination_location_id'),
            productId: (int) $request->validated('product_id'),
            quantity: (int) $request->validated('quantity'),
            batchNumber: $request->validated('batch_number'),
            notes: $request->validated('notes')
        );

        return redirect()->back();
    }

    /**
     * Execute a manager-approved physical stock adjustment.
     */
    public function adjust(AdjustStockRequest $request, AdjustStockAction $action): RedirectResponse
    {
        $action->execute(
            clientUuid: $request->validated('client_uuid'),
            locationId: (int) $request->validated('location_id'),
            productId: (int) $request->validated('product_id'),
            newCountInBaseUnits: (int) $request->validated('new_count'),
            reasonCode: $request->validated('reason_code'),
            notes: $request->validated('notes')
        );

        return redirect()->back();
    }
}
