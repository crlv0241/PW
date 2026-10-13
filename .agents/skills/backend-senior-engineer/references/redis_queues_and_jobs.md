# Redis Queues & Asynchronous Processing Guide

## 1. Asynchronous Ingestion & Offloading
- Heavy workloads—such as bulk offline sync ingestion payloads, end-of-day audit reconciliations, and PDF receipt/invoice generation—must be offloaded to background Redis queues.
- Synchronous endpoints handling large payloads should validate the envelope, store raw input in an intake staging table, dispatch a queued job, and immediately return HTTP 202 Accepted.

## 2. Queue Job Resilience & Failure Lifecycle
- Configure explicit job thresholds on all background jobs:
  - `$tries`: Maximum execution attempts (typically 3).
  - `$backoff`: Exponential or stepped backoff intervals (e.g., `[10, 30, 60]` seconds).
  - `$timeout`: Maximum allowed execution duration before process termination.
- Always implement the `failed(\Throwable $exception)` lifecycle hook to log contextual failure details and alert monitoring systems.

## 3. Redis Caching & Cache Invalidation
- Cache read-heavy matrices (e.g., customer pricing tiers, catalog hierarchies, route schedules) in Redis.
- Use tag-based caching or event-driven cache clearing to guarantee cache invalidation immediately upon entity updates.
