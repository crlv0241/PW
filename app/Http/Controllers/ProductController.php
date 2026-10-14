<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Models\Product;
use App\Models\ProductUom;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ->when($search, function ($query, string $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('sku', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%");
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
     * Store a newly created product with its base UOM.
     */
    public function store(StoreProductRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $product = Product::create([
                'sku' => $request->validated('sku'),
                'name' => $request->validated('name'),
                'category' => $request->validated('category'),
                'tax_category' => $request->validated('tax_category'),
                'tax_rate' => $request->validated('tax_rate'),
                'description' => $request->validated('description'),
            ]);

            ProductUom::create([
                'product_id' => $product->id,
                'name' => $request->validated('base_uom_name'),
                'conversion_factor' => 1,
                'barcode' => $request->validated('base_uom_barcode'),
                'is_base_unit' => true,
                'price_cents' => $request->validated('base_uom_price_cents'),
            ]);
        });

        return redirect()->route('products.index');
    }
}
