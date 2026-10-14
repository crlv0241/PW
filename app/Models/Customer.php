<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'account_code',
        'company_name',
        'contact_person',
        'email',
        'phone',
        'delivery_address',
        'credit_limit_cents',
        'current_balance_cents',
        'payment_terms_days',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credit_limit_cents' => 'integer',
            'current_balance_cents' => 'integer',
            'payment_terms_days' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
