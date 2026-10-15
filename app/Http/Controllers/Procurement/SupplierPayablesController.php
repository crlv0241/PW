<?php

declare(strict_types=1);

namespace App\Http\Controllers\Procurement;

use App\Actions\Procurement\RecordSupplierPaymentAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Procurement\StoreSupplierPaymentRequest;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

final class SupplierPayablesController extends Controller
{
    /**
     * Display executive payables dashboard and paginated supplier payables balances.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value() ?: null;
        $statusFilter = $request->string('status')->trim()->value() ?: null; // ALL, OPEN, OVERDUE, SETTLED

        // 1. Executive Aggregate Metrics
        $totalOrderedCents = (int) PurchaseOrder::query()
            ->where('status', '!=', 'CANCELLED')
            ->sum('total_cents');

        $totalPaidCents = (int) PurchaseOrder::query()
            ->where('status', '!=', 'CANCELLED')
            ->sum('paid_amount_cents');

        $totalOutstandingCents = max(0, $totalOrderedCents - $totalPaidCents);

        $pendingChequesCents = (int) SupplierPayment::query()
            ->where('payment_method', 'CHEQUE')
            ->where('status', 'PENDING_CLEARING')
            ->sum('amount_cents');

        // Overdue POs calculation
        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $overdueCondition = $isSqlite
            ? "date(purchase_orders.order_date, '+' || suppliers.payment_terms_days || ' days') < ?"
            : 'DATE_ADD(purchase_orders.order_date, INTERVAL suppliers.payment_terms_days DAY) < ?';

        $overduePayablesCents = (int) (PurchaseOrder::query()
            ->join('suppliers', 'purchase_orders.supplier_id', '=', 'suppliers.id')
            ->where('purchase_orders.status', '!=', 'CANCELLED')
            ->where('purchase_orders.payment_status', '!=', 'PAID')
            ->whereRaw($overdueCondition, [now()->toDateString()])
            ->selectRaw('SUM(purchase_orders.total_cents - purchase_orders.paid_amount_cents) as overdue_sum')
            ->value('overdue_sum') ?: 0);

        // 2. Query Suppliers with Aggregated Payables
        $suppliersQuery = Supplier::query()
            ->select([
                'suppliers.id',
                'suppliers.supplier_code',
                'suppliers.name',
                'suppliers.contact_name',
                'suppliers.phone',
                'suppliers.email',
                'suppliers.payment_terms_days',
                'suppliers.is_active',
            ])
            ->withCount([
                'purchaseOrders as total_pos_count' => fn ($q) => $q->where('status', '!=', 'CANCELLED'),
                'purchaseOrders as open_pos_count' => fn ($q) => $q->where('status', '!=', 'CANCELLED')->where('payment_status', '!=', 'PAID'),
            ])
            ->withSum(['purchaseOrders as total_invoiced_cents' => fn ($q) => $q->where('status', '!=', 'CANCELLED')], 'total_cents')
            ->withSum(['purchaseOrders as total_paid_cents' => fn ($q) => $q->where('status', '!=', 'CANCELLED')], 'paid_amount_cents')
            ->when($search, function ($query, string $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('suppliers.supplier_code', 'like', "%{$search}%")
                        ->orWhere('suppliers.name', 'like', "%{$search}%")
                        ->orWhere('suppliers.contact_name', 'like', "%{$search}%");
                });
            });

        $suppliers = $suppliersQuery
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(
                /**
                 * @return array<string, mixed>
                 */
                function (Supplier $supplier): array {
                    $invoiced = (int) ($supplier->total_invoiced_cents ?? 0);
                    $paid = (int) ($supplier->total_paid_cents ?? 0);
                    $balance = max(0, $invoiced - $paid);

                    return [
                        'id' => $supplier->id,
                        'supplier_code' => $supplier->supplier_code,
                        'name' => $supplier->name,
                        'contact_name' => $supplier->contact_name,
                        'phone' => $supplier->phone,
                        'email' => $supplier->email,
                        'payment_terms_days' => $supplier->payment_terms_days,
                        'total_pos_count' => $supplier->total_pos_count,
                        'open_pos_count' => $supplier->open_pos_count,
                        'total_invoiced_cents' => $invoiced,
                        'total_paid_cents' => $paid,
                        'outstanding_balance_cents' => $balance,
                        'payment_status' => $balance === 0 ? 'SETTLED' : ($paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
                    ];
                }
            );

        return Inertia::render('procurement/payables/index', [
            'metrics' => [
                'total_outstanding_cents' => $totalOutstandingCents,
                'overdue_payables_cents' => $overduePayablesCents,
                'total_paid_cents' => $totalPaidCents,
                'pending_cheques_cents' => $pendingChequesCents,
            ],
            'suppliers' => $suppliers,
            'filters' => [
                'search' => $search ?? '',
                'status' => $statusFilter ?? '',
            ],
        ]);
    }

    /**
     * Dissect individual supplier payables: view all POs, ledger balances, and payment tender audit history.
     */
    public function show(Supplier $supplier, Request $request): Response
    {
        $supplier->loadCount([
            'purchaseOrders as total_pos_count' => fn ($q) => $q->where('status', '!=', 'CANCELLED'),
            'purchaseOrders as open_pos_count' => fn ($q) => $q->where('status', '!=', 'CANCELLED')->where('payment_status', '!=', 'PAID'),
        ]);

        $totalInvoiced = (int) $supplier->purchaseOrders()
            ->where('status', '!=', 'CANCELLED')
            ->sum('total_cents');

        $totalPaid = (int) $supplier->purchaseOrders()
            ->where('status', '!=', 'CANCELLED')
            ->sum('paid_amount_cents');

        $outstandingBalance = max(0, $totalInvoiced - $totalPaid);

        // All Purchase Orders for this supplier
        $orders = $supplier->purchaseOrders()
            ->where('status', '!=', 'CANCELLED')
            ->with(['lines.product:id,sku,name', 'destinationLocation:id,code,name'])
            ->latest('order_date')
            ->get()
            ->map(
                /**
                 * @return array<string, mixed>
                 */
                function (PurchaseOrder $order) use ($supplier): array {
                    $orderDate = $order->order_date ? Carbon::parse($order->order_date) : null;
                    $dueDate = $orderDate?->copy()->addDays($supplier->payment_terms_days);
                    $isOverdue = $order->payment_status !== 'PAID' && $dueDate !== null && $dueDate->isPast();

                    return [
                        'id' => $order->id,
                        'po_number' => $order->po_number,
                        'supplier_reference' => $order->supplier_reference,
                        'order_date' => $orderDate?->toDateString(),
                        'due_date' => $dueDate?->toDateString(),
                        'is_overdue' => $isOverdue,
                        'status' => $order->status,
                        'total_cents' => $order->total_cents,
                        'paid_amount_cents' => $order->paid_amount_cents,
                        'balance_cents' => max(0, $order->total_cents - $order->paid_amount_cents),
                        'payment_status' => $order->payment_status,
                        'destination_location' => $order->destinationLocation,
                        'lines_count' => $order->lines->count(),
                    ];
                }
            );

        // Payment History / Tenders Dissection
        $payments = $supplier->payments()
            ->with(['purchaseOrder:id,po_number,total_cents', 'recorder:id,name'])
            ->latest('payment_date')
            ->latest('id')
            ->get();

        return Inertia::render('procurement/payables/show', [
            'supplier' => [
                'id' => $supplier->id,
                'supplier_code' => $supplier->supplier_code,
                'name' => $supplier->name,
                'contact_name' => $supplier->contact_name,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'payment_terms_days' => $supplier->payment_terms_days,
                'is_active' => $supplier->is_active,
                'total_pos_count' => $supplier->total_pos_count,
                'open_pos_count' => $supplier->open_pos_count,
                'total_invoiced_cents' => $totalInvoiced,
                'total_paid_cents' => $totalPaid,
                'outstanding_balance_cents' => $outstandingBalance,
            ],
            'orders' => $orders,
            'payments' => $payments,
        ]);
    }

    /**
     * Record an Accounts Payable payment installment (Cash, Cheque, Bank Transfer).
     */
    public function storePayment(StoreSupplierPaymentRequest $request, RecordSupplierPaymentAction $action): RedirectResponse
    {
        $validated = $request->validated();
        $validated['recorded_by'] = $request->user()?->id;

        /** @var array{
         *     supplier_id: int,
         *     purchase_order_id?: int|null,
         *     amount_cents: int,
         *     payment_method: string,
         *     payment_date: string,
         *     cheque_number?: string|null,
         *     bank_name?: string|null,
         *     cheque_date?: string|null,
         *     clearing_date?: string|null,
         *     payee_name?: string|null,
         *     reference_number?: string|null,
         *     voucher_number?: string|null,
         *     status?: string,
         *     notes?: string|null,
         *     recorded_by?: int|null,
         * } $validated */
        $payment = $action->execute($validated);

        return back()->with('success', sprintf(
            'Payment %s of ₱%s recorded successfully via %s.',
            $payment->payment_number,
            number_format($payment->amount_cents / 100, 2),
            $payment->payment_method
        ));
    }
}
