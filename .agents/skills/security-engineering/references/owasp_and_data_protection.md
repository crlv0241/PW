# OWASP Top 10 & Data Protection Guide

## 1. Injection Prevention
- Always use Eloquent query builder or prepared statements:
  ```php
  // Safe
  DB::select('SELECT * FROM products WHERE sku = ?', [$sku]);
  ```
- Disallow raw string concatenation in SQL expressions.

## 2. Mass Assignment & Data Exposure
- Never use `$guarded = []` on models handling financial or transactional state.
- Use explicit `$fillable` arrays.
- Protect sensitive columns from JSON API serialization:
  ```php
  protected $hidden = [
      'password',
      'remember_token',
      'device_secret',
      'pin_hash',
  ];
  ```

## 3. Sensitive Data Encryption
- For stored payment tokens, bank details, or PII:
  ```php
  protected function casts(): array
  {
      return [
          'tax_id' => 'encrypted',
          'bank_account_number' => 'encrypted',
      ];
  }
  ```
- Secrets (DB credentials, API keys) must only reside in `.env`.
