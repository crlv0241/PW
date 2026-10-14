<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

final class RbacSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. System Roles
        $roles = [
            [
                'name' => 'super_admin',
                'display_name' => 'Super Administrator',
                'description' => 'Full administrative access across all system modules, configurations, and user management.',
            ],
            [
                'name' => 'warehouse_manager',
                'display_name' => 'Warehouse Manager',
                'description' => 'Supervises warehouse inventory, approves stock adjustments, purchase receipts, and location transfers.',
            ],
            [
                'name' => 'warehouse_scanner',
                'display_name' => 'Warehouse Scanner / Picker',
                'description' => 'Handles physical scanning, goods receiving, bin-to-bin transfers, and picking verification.',
            ],
            [
                'name' => 'route_agent',
                'display_name' => 'DSD Route Sales Agent',
                'description' => 'Field sales agent conducting direct store deliveries, issuing invoices, and managing truck inventory.',
            ],
            [
                'name' => 'backoffice_encoder',
                'display_name' => 'Backoffice Encoder',
                'description' => 'Responsible for maintaining product catalogs, supplier profiles, customer accounts, and purchase orders.',
            ],
            [
                'name' => 'accountant',
                'display_name' => 'Accountant / Auditor',
                'description' => 'Oversees accounts receivable, payment collections, cash reconciliations, and immutable ledger audits.',
            ],
        ];

        $roleModels = [];
        foreach ($roles as $roleData) {
            $roleModels[$roleData['name']] = Role::firstOrCreate(
                ['name' => $roleData['name']],
                $roleData
            );
        }

        // 2. Granular Permissions
        $permissions = [
            ['name' => 'users.manage', 'display_name' => 'Manage Users and Roles', 'group' => 'Administration'],
            ['name' => 'catalog.view', 'display_name' => 'View Catalog and UOMs', 'group' => 'Catalog'],
            ['name' => 'catalog.manage', 'display_name' => 'Create and Edit Products', 'group' => 'Catalog'],
            ['name' => 'inventory.view', 'display_name' => 'View Stock Balances', 'group' => 'Inventory'],
            ['name' => 'inventory.transfer', 'display_name' => 'Execute Stock Transfers', 'group' => 'Inventory'],
            ['name' => 'inventory.adjust', 'display_name' => 'Perform Inventory Adjustments', 'group' => 'Inventory'],
            ['name' => 'inventory.audit', 'display_name' => 'Inspect Stock Ledger Audit Trail', 'group' => 'Inventory'],
            ['name' => 'pos.transact', 'display_name' => 'Execute POS Deliveries and Orders', 'group' => 'POS & DSD'],
            ['name' => 'financial.view', 'display_name' => 'View Financial and AR Balances', 'group' => 'Financials'],
            ['name' => 'financial.reconcile', 'display_name' => 'Reconcile Shifts and Cash Drawers', 'group' => 'Financials'],
        ];

        $permModels = [];
        foreach ($permissions as $permData) {
            $permModels[$permData['name']] = Permission::firstOrCreate(
                ['name' => $permData['name']],
                $permData
            );
        }

        // 3. Assign Permissions to Roles
        $rolePermissions = [
            'warehouse_manager' => [
                'catalog.view',
                'catalog.manage',
                'inventory.view',
                'inventory.transfer',
                'inventory.adjust',
                'inventory.audit',
            ],
            'warehouse_scanner' => [
                'catalog.view',
                'inventory.view',
                'inventory.transfer',
            ],
            'route_agent' => [
                'catalog.view',
                'inventory.view',
                'pos.transact',
            ],
            'backoffice_encoder' => [
                'catalog.view',
                'catalog.manage',
                'inventory.view',
            ],
            'accountant' => [
                'catalog.view',
                'inventory.view',
                'inventory.audit',
                'financial.view',
                'financial.reconcile',
            ],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $permIds = array_map(fn ($p) => $permModels[$p]->id, $perms);
            $roleModels[$roleName]->permissions()->syncWithoutDetaching($permIds);
        }

        // 4. Default Super Admin User
        $superAdmin = User::firstOrCreate(
            ['email' => 'admin@poswms.test'],
            [
                'name' => 'System Administrator',
                'password' => Hash::make('Password123!'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $superAdmin->roles()->syncWithoutDetaching([$roleModels['super_admin']->id]);

        // 5. Default Demonstration Users for Other Roles
        $demoUsers = [
            [
                'name' => 'Marcus Vance',
                'email' => 'manager@poswms.test',
                'role' => 'warehouse_manager',
            ],
            [
                'name' => 'Sam Scanner',
                'email' => 'scanner@poswms.test',
                'role' => 'warehouse_scanner',
            ],
            [
                'name' => 'Rachel Route',
                'email' => 'agent@poswms.test',
                'role' => 'route_agent',
            ],
            [
                'name' => 'Arthur Vance',
                'email' => 'accountant@poswms.test',
                'role' => 'accountant',
            ],
        ];

        foreach ($demoUsers as $demoData) {
            $user = User::firstOrCreate(
                ['email' => $demoData['email']],
                [
                    'name' => $demoData['name'],
                    'password' => Hash::make('Password123!'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );
            $user->roles()->syncWithoutDetaching([$roleModels[$demoData['role']]->id]);
        }
    }
}
