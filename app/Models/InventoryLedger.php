<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\InventoryLedgerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InventoryLedger extends Model
{
    /** @use HasFactory<InventoryLedgerFactory> */
    use HasFactory;

    public const UPDATED_AT = null; // Immutable append-only log: no updated_at

    /**
     * @var list<string>
     */
    protected $fillable = [
        'client_uuid',
        'location_id',
        'product_id',
        'qty_change',
        'transaction_type',
        'reference_id',
        'batch_number',
        'expiry_date',
        'notes',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty_change' => 'integer',
            'reference_id' => 'integer',
            'expiry_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
