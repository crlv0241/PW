# Expressive Naming & Guard Clauses Guide

## 1. Intention-Revealing Naming
- Bad: `$p`, `$amt`, `$data`, `doCheck()`, `process()`
- Good: `$product`, `$totalNetPrice`, `$stockDeductionPayload`, `isEligibleForPromotionalPricing()`, `executeOrderFinalization()`
- In boolean methods, always prefix with `is`, `has`, `can`, or `should`.

## 2. Guard Clauses & Early Returns
- Invert conditionals to fail fast at the top of the function:
  ```php
  // Bad: Arrow antipattern
  if ($order->isPending()) {
      if ($inventory->hasSufficientStock()) {
          if ($customer->isCreditApproved()) {
              // Action logic
          }
      }
  }

  // Good: Guard clauses
  if (! $order->isPending()) {
      throw new InvalidOrderStateException('Order is not in pending state.');
  }

  if (! $inventory->hasSufficientStock()) {
      throw new InsufficientStockException('Insufficient stock available.');
  }

  if (! $customer->isCreditApproved()) {
      throw new CreditLimitExceededException('Customer credit limit exceeded.');
  }

  // Pure business logic executed cleanly
  ```
