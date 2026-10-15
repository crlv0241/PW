<?php

declare(strict_types=1);

namespace App\Http\Requests\Procurement;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class StoreSupplierPaymentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'amount_cents' => ['required', 'integer', 'min:1'],
            'payment_method' => ['required', 'string', 'in:CASH,CHEQUE,BANK_TRANSFER'],
            'payment_date' => ['required', 'date'],
            'cheque_number' => ['nullable', 'required_if:payment_method,CHEQUE', 'string', 'max:64'],
            'bank_name' => ['nullable', 'required_if:payment_method,CHEQUE', 'required_if:payment_method,BANK_TRANSFER', 'string', 'max:100'],
            'cheque_date' => ['nullable', 'date'],
            'clearing_date' => ['nullable', 'date'],
            'payee_name' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'required_if:payment_method,BANK_TRANSFER', 'string', 'max:100'],
            'voucher_number' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'string', 'in:COMPLETED,PENDING_CLEARING,BOUNCED,VOID'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
