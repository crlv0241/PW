<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\SystemSettingController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\Procurement\GoodsReceiptController;
use App\Http\Controllers\Procurement\PurchaseOrderController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

// Guest Authentication Routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->name('login.store');
});

// Authenticated Application Routes
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::get('/', function () {
        return redirect()->route('products.index');
    })->name('home');

    // Catalog & Products
    Route::get('/products', [ProductController::class, 'index'])->name('products.index');
    Route::post('/products', [ProductController::class, 'store'])->name('products.store');

    // Inventory & Ledger Management
    Route::prefix('inventory')->name('inventory.')->group(function () {
        Route::get('/', [InventoryController::class, 'index'])->name('index');
        Route::get('/ledger', [InventoryController::class, 'ledger'])->name('ledger');
        Route::post('/transfer', [InventoryController::class, 'transfer'])->name('transfer');
        Route::post('/adjust', [InventoryController::class, 'adjust'])->name('adjust');
    });

    // Procurement & Inbound Receiving (WMS)
    Route::prefix('procurement')->name('procurement.')->group(function () {
        Route::get('/orders', [PurchaseOrderController::class, 'index'])->name('orders.index');
        Route::get('/orders/create', [PurchaseOrderController::class, 'create'])->name('orders.create');
        Route::post('/orders', [PurchaseOrderController::class, 'store'])->name('orders.store');
        Route::get('/orders/{order}', [PurchaseOrderController::class, 'show'])->name('orders.show');
        Route::get('/orders/{order}/edit', [PurchaseOrderController::class, 'edit'])->name('orders.edit');
        Route::put('/orders/{order}', [PurchaseOrderController::class, 'update'])->name('orders.update');

        Route::get('/receiving', [GoodsReceiptController::class, 'index'])->name('receiving.index');
        Route::post('/receiving', [GoodsReceiptController::class, 'store'])->name('receiving.store');
        Route::get('/receiving/{receipt}/reconcile', [GoodsReceiptController::class, 'reconcile'])->name('receiving.reconcile');
    });

    // Super Admin Web Console
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('/users/{user}/toggle-active', [UserController::class, 'toggleActive'])->name('users.toggle-active');

        Route::get('/settings', [SystemSettingController::class, 'index'])->name('settings.index');
        Route::post('/settings', [SystemSettingController::class, 'update'])->name('settings.update');
    });
});
