<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('APEX POS & WMS');
            $table->string('tagline')->default('Enterprise Core v1.0');
            $table->string('logo_path')->nullable();
            $table->string('favicon_path')->nullable();
            $table->string('primary_color', 10)->default('#4f46e5'); // Hex color code
            $table->string('accent_color', 10)->default('#06b6d4'); // Hex color code
            $table->string('theme_palette', 30)->default('indigo'); // indigo, violet, blue, emerald, amber, rose, slate
            $table->boolean('dark_mode_default')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
