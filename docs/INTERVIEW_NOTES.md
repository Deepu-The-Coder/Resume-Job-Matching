# Interview notes

## How does the rate limiter work?

`backend/src/middleware/rateLimiter.js` uses a Redis Lua script implementing a
token bucket. The script reads and updates tokens, calculates refill, and sets
the expiry atomically, avoiding an `INCR`/`EXPIRE` race. Cheap requests and
`explain=true` requests use separate capacities and refill rates. The key is
per user when available, otherwise the request IP. A rejected request returns
429, `Retry-After`, and `X-RateLimit-Remaining`. Cheap traffic fails open if
Redis is unavailable; AI traffic fails closed with 503 to protect spend.

## Why are there two cache levels?

The exact cache uses tenant, resume content hash, and job content hash, so
changed source text cannot serve stale explanations. The semantic level is
used only after an exact miss: it scans up to 200 recent jobs for the same
resume and accepts a job embedding only when cosine similarity reaches the
configured threshold. This improves reuse for near-duplicate job postings
without making the cache an unbounded vector database.

## Why Redis?

Redis provides shared state across scaled stateless app replicas. It stores
explanation cache entries, token buckets, cache counters, and BullMQ queue
state. MongoDB remains the durable source for resumes, jobs, matches, and
usage records. Redis is not treated as the source of truth for tenant data.

## What happens when the LLM is down?

Ranking happens before explanation generation and uses cosine similarity only.
The opossum breaker records failures, opens after its configured threshold, and
later probes in half-open state. While open, or when a call times out/fails,
the request still returns ranked results with a deterministic fallback such as
the strongest matched skills, missing skills, and similarity score. The match
source is marked `fallback`, and `/health` exposes breaker/fallback diagnostics.

## How is tenant isolation enforced?

The request middleware resolves `X-Tenant-Id` once and attaches `req.tenantId`.
Controllers no longer trust tenant IDs from request bodies or query strings.
Tenant-bearing Mongoose schemas use a plugin requiring `.forTenant(tenantId)`;
unscoped find, update, and delete queries fail loudly. Services also pass
tenant IDs explicitly, cache keys include tenant namespaces, queue status is
filtered by tenant, and cross-tenant integration tests cover reads, matching,
cache-backed results, stats, and admin jobs.

The current header is a demo identity selector, not authentication. A
production deployment must derive the tenant from a verified identity claim.

## How would this scale to 1 million users?

1. Replace the demo tenant header with an identity provider and authorization
   service.
2. Move embedding search from in-process scans to a vector index/service, with
   tenant filters at the index layer.
3. Keep app replicas stateless behind Nginx or a managed load balancer and
   scale workers independently by queue depth.
4. Partition MongoDB by tenant or shard key after measuring tenant skew; add
   indexes for tenant/content hash and tenant/document IDs.
5. Use Redis Cluster or a managed Redis service for cache/rate-limit
   availability, with bounded keys and eviction policy monitoring.
6. Put LLM and embedding calls behind provider-specific budgets, queues, and
   observability. Batch embeddings and precompute popular matches.
7. Aggregate request, cost, breaker, and cache metrics centrally instead of
   relying on each process's local breaker diagnostic.
8. Add load-shedding, regional deployment, and durable audit logging before
   exposing the system to untrusted large-scale traffic.

The current implementation is deliberately smaller: it demonstrates the
correct boundaries and failure behavior, but it does not claim million-user
capacity.
