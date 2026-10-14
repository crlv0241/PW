<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Product\CreateProductAction;
use App\Actions\Product\UpdateProductAction;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ProductController extends Controller
{
    /**
     * Display a paginated, filterable listing of products.
     */
    public function index(Request $request): Response
    {
        $searchString = $request->string('search')->trim()->value();
        $categoryString = $request->string('category')->trim()->value();

        $search = $searchString !== '' ? $searchString : null;
        $category = $categoryString !== '' ? $categoryString : null;

        $products = Product::query()
            ->with(['uoms' => function ($query) {
                $query->orderBy('conversion_factor', 'asc');
            }])
            ->withSum('balances as total_stock', 'current_qty')
            ->when($search, function ($query, string $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('sku', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhereHas('uoms', function ($uomQuery) use ($search) {
                            $uomQuery->where('barcode', 'like', "%{$search}%");
                        });
                });
            })
            ->when($category, function ($query, string $category) {
                $query->where('category', $category);
            })
            ->orderBy('id', 'desc')
            ->paginate(10)
            ->withQueryString();

        $categories = Product::query()
            ->select('category')
            ->distinct()
            ->pluck('category');

        return Inertia::render('products/index', [
            'products' => $products,
            'categories' => $categories,
            'filters' => [
                'search' => $search ?? '',
                'category' => $category ?? '',
            ],
        ]);
    }

    /**
     * Store a newly created product with its packaging units.
     */
    public function store(StoreProductRequest $request, CreateProductAction $action): RedirectResponse
    {
        /** @var array{
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
         * } $data */
        $data = $request->validated();

        $action->execute($data);

        return redirect()->route('products.index');
    }

    /**
     * Update an existing product and its packaging units.
     */
    public function update(UpdateProductRequest $request, Product $product, UpdateProductAction $action): RedirectResponse
    {
        /** @var array{
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
         * } $data */
        $data = $request->validated();

        $action->execute($product, $data);

        return redirect()->route('products.index');
    }

    /**
     * Toggle the active/inactive status of a product.
     */
    public function toggleStatus(Product $product): RedirectResponse
    {
        $newStatus = $product->status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        $product->update(['status' => $newStatus]);

        return redirect()->route('products.index');
    }
}
