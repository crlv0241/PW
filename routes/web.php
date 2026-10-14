<?php

declare(strict_types=1);

use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('products.index');
})->name('home');

Route::get('/products', [ProductController::class, 'index'])->name('products.index');
Route::post('/products', [ProductController::class, 'store'])->name('products.store');

Route::prefix('inventory')->name('inventory.')->group(function () {
    Route::get('/', [InventoryController::class, 'index'])->name('index');
    Route::get('/ledger', [InventoryController::class, 'ledger'])->name('ledger');
    Route::post('/transfer', [InventoryController::class, 'transfer'])->name('transfer');
    Route::post('/adjust', [InventoryController::class, 'adjust'])->name('adjust');
});
