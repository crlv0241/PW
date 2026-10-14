<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Inventory\RecordStockMovementAction;
use App\Actions\Inventory\TransferStockAction;
use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUom;
use App\Models\Supplier;
use Illuminate\Database\Seeder;

final class MasterDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Physical & Virtual Locations
        $locations = [
            ['code' => 'WH-MAIN', 'name' => 'Main Central Warehouse', 'type' => 'warehouse', 'address' => '100 Logistics Blvd, Zone 1'],
            ['code' => 'WH-COLD', 'name' => 'Cold Storage Facility', 'type' => 'warehouse', 'address' => '102 Logistics Blvd, Zone 2'],
            ['code' => 'TRK-ALPHA', 'name' => 'Delivery Truck Alpha (Isuzu 4T)', 'type' => 'truck', 'address' => 'Assigned Route 1'],
            ['code' => 'TRK-BETA', 'name' => 'Delivery Truck Beta (Hino 6T)', 'type' => 'truck', 'address' => 'Assigned Route 2'],
            ['code' => 'DMG-BAY', 'name' => 'Damage & Return Inspection Bay', 'type' => 'damage', 'address' => 'Warehouse Bay D'],
            ['code' => 'STG-BAY', 'name' => 'Outbound Staging Bay', 'type' => 'staging', 'address' => 'Warehouse Bay S'],
        ];

        foreach ($locations as $loc) {
            Location::firstOrCreate(['code' => $loc['code']], $loc);
        }

        // 2. Suppliers
        $suppliers = [
            ['supplier_code' => 'SUPP-BEV-01', 'name' => 'Apex Beverage Distributing Corp', 'contact_name' => 'Carlos Reyes', 'email' => 'orders@apexbev.test', 'phone' => '+63 2 8100 2000', 'payment_terms_days' => 30],
            ['supplier_code' => 'SUPP-FOD-02', 'name' => 'Universal Food Manufacturers Inc', 'contact_name' => 'Elena Santos', 'email' => 'sales@universalfoods.test', 'phone' => '+63 2 8200 3000', 'payment_terms_days' => 45],
            ['supplier_code' => 'SUPP-DRY-03', 'name' => 'Metro Dairy & Cold Goods Ltd', 'contact_name' => 'Mark Cruz', 'email' => 'accounts@metrodairy.test', 'phone' => '+63 2 8300 4000', 'payment_terms_days' => 15],
        ];

        foreach ($suppliers as $supp) {
            Supplier::firstOrCreate(['supplier_code' => $supp['supplier_code']], $supp);
        }

        // 3. Customers
        $customers = [
            ['account_code' => 'CUST-001', 'company_name' => 'Metro Supermart - Downtown', 'contact_person' => 'Grace Lim', 'email' => 'grace@metrosupermart.test', 'phone' => '+63 917 111 2222', 'delivery_address' => '45 Rizal Ave, Downtown Commercial Center', 'credit_limit_cents' => 50000000, 'payment_terms_days' => 30], // 500,000.00
            ['account_code' => 'CUST-002', 'company_name' => 'Sunshine Convenience Stores Inc', 'contact_person' => 'Danilo Tan', 'email' => 'danilo@sunshineconv.test', 'phone' => '+63 917 222 3333', 'delivery_address' => '12 Makati Ave, Corner Buendia', 'credit_limit_cents' => 20000000, 'payment_terms_days' => 15], // 200,000.00
            ['account_code' => 'CUST-003', 'company_name' => 'Evergreen Grocers - North Branch', 'contact_person' => 'Susan Yap', 'email' => 'susan@evergreengrocers.test', 'phone' => '+63 917 333 4444', 'delivery_address' => '88 North Expressway Market', 'credit_limit_cents' => 10000000, 'payment_terms_days' => 30], // 100,000.00
            ['account_code' => 'CUST-004', 'company_name' => 'Aling Maria Sari-Sari Store', 'contact_person' => 'Maria Santos', 'email' => 'maria@gmail.test', 'phone' => '+63 917 444 5555', 'delivery_address' => 'Block 4 Lot 9, Barangay San Jose', 'credit_limit_cents' => 500000, 'payment_terms_days' => 7], // 5,000.00
        ];

        foreach ($customers as $cust) {
            Customer::firstOrCreate(['account_code' => $cust['account_code']], $cust);
        }

        // 4. Products & Multi-UOM Hierarchy
        $catalog = [
            [
                'product' => [
                    'sku' => 'BEV-COLA-330',
                    'name' => 'Sparkling Cola 330ml Can',
                    'category' => 'Beverages',
                    'tax_category' => 'STANDARD',
                    'tax_rate' => '0.1200',
                    'description' => 'Refreshing carbonated cola beverage in 330ml aluminum can.',
                ],
                'uoms' => [
                    ['name' => 'Piece', 'conversion_factor' => 1, 'barcode' => '4800010010011', 'is_base_unit' => true, 'price_cents' => 3500], // 35.00
                    ['name' => 'Pack-6', 'conversion_factor' => 6, 'barcode' => '4800010010066', 'is_base_unit' => false, 'price_cents' => 20000], // 200.00
                    ['name' => 'Case-24', 'conversion_factor' => 24, 'barcode' => '4800010010240', 'is_base_unit' => false, 'price_cents' => 78000], // 780.00
                ],
            ],
            [
                'product' => [
                    'sku' => 'BEV-ORNG-500',
                    'name' => 'Pure Squeezed Orange Juice 500ml',
                    'category' => 'Beverages',
                    'tax_category' => 'STANDARD',
                    'tax_rate' => '0.1200',
                    'description' => 'Chilled 100% pure orange juice bottle.',
                ],
                'uoms' => [
                    ['name' => 'Piece', 'conversion_factor' => 1, 'barcode' => '4800010020010', 'is_base_unit' => true, 'price_cents' => 6500], // 65.00
                    ['name' => 'Case-12', 'conversion_factor' => 12, 'barcode' => '4800010020126', 'is_base_unit' => false, 'price_cents' => 74000], // 740.00
                ],
            ],
            [
                'product' => [
                    'sku' => 'SNK-CHIP-100',
                    'name' => 'Sea Salt Kettle Potato Chips 100g',
                    'category' => 'Snacks',
                    'tax_category' => 'STANDARD',
                    'tax_rate' => '0.1200',
                    'description' => 'Artisanal kettle-cooked potato chips seasoned with natural sea salt.',
                ],
                'uoms' => [
                    ['name' => 'Piece', 'conversion_factor' => 1, 'barcode' => '4800020010018', 'is_base_unit' => true, 'price_cents' => 5000], // 50.00
                    ['name' => 'Box-20', 'conversion_factor' => 20, 'barcode' => '4800020010209', 'is_base_unit' => false, 'price_cents' => 95000], // 950.00
                ],
            ],
            [
                'product' => [
                    'sku' => 'CAN-TUNA-180',
                    'name' => 'Flaked Tuna in Vegetable Oil 180g',
                    'category' => 'Canned Goods',
                    'tax_category' => 'STANDARD',
                    'tax_rate' => '0.1200',
                    'description' => 'Premium canned tuna flakes in refined vegetable oil.',
                ],
                'uoms' => [
                    ['name' => 'Piece', 'conversion_factor' => 1, 'barcode' => '4800030010015', 'is_base_unit' => true, 'price_cents' => 4200], // 42.00
                    ['name' => 'Case-48', 'conversion_factor' => 48, 'barcode' => '4800030010480', 'is_base_unit' => false, 'price_cents' => 192000], // 1,920.00
                ],
            ],
            [
                'product' => [
                    'sku' => 'CND-SOY-1000',
                    'name' => 'Traditional Brewed Soy Sauce 1 Liter',
                    'category' => 'Condiments',
                    'tax_category' => 'STANDARD',
                    'tax_rate' => '0.1200',
                    'description' => 'Naturally fermented premium culinary soy sauce.',
                ],
                'uoms' => [
                    ['name' => 'Piece', 'conversion_factor' => 1, 'barcode' => '4800040010012', 'is_base_unit' => true, 'price_cents' => 7500], // 75.00
                    ['name' => 'Case-12', 'conversion_factor' => 12, 'barcode' => '4800040010128', 'is_base_unit' => false, 'price_cents' => 84000], // 840.00
                ],
            ],
        ];

        foreach ($catalog as $item) {
            $product = Product::firstOrCreate(
                ['sku' => $item['product']['sku']],
                $item['product']
            );

            foreach ($item['uoms'] as $uomData) {
                ProductUom::firstOrCreate(
                    [
                        'product_id' => $product->id,
                        'name' => $uomData['name'],
                    ],
                    array_merge($uomData, ['product_id' => $product->id])
                );
            }
        }

        // 5. Initial Inventory Balances & Ledgers via RecordStockMovementAction
        $whMain = Location::where('code', 'WH-MAIN')->first();
        $trkAlpha = Location::where('code', 'TRK-ALPHA')->first();
        $action = app(RecordStockMovementAction::class);

        if ($whMain) {
            $initialStocks = [
                'BEV-COLA-330' => 1200,
                'BEV-ORNG-500' => 600,
                'SNK-CHIP-100' => 800,
                'CAN-TUNA-180' => 1440,
                'CND-SOY-1000' => 360,
            ];

            foreach ($initialStocks as $sku => $qty) {
                $p = Product::where('sku', $sku)->first();
                if ($p) {
                    $action->execute(
                        clientUuid: "SEED-INIT-WH-{$sku}",
                        locationId: $whMain->id,
                        productId: $p->id,
                        qtyChange: $qty,
                        transactionType: 'STOCK_IN',
                        notes: 'Initial warehouse opening stock intake'
                    );
                }
            }
        }

        if ($trkAlpha && $whMain) {
            $transferAction = app(TransferStockAction::class);
            $trkStocks = [
                'BEV-COLA-330' => 120,
                'BEV-ORNG-500' => 60,
                'SNK-CHIP-100' => 40,
            ];

            foreach ($trkStocks as $sku => $qty) {
                $p = Product::where('sku', $sku)->first();
                if ($p) {
                    $transferAction->execute(
                        clientUuid: "SEED-TRANSFER-TRK-{$sku}",
                        sourceLocationId: $whMain->id,
                        destinationLocationId: $trkAlpha->id,
                        productId: $p->id,
                        quantity: $qty,
                        notes: 'Morning route loading transfer'
                    );
                }
            }
        }
    }
}
