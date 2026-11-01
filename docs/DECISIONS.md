# Architecture Decisions

## Two-level explanation cache and Redis failure behavior

The explanation cache uses a tenant-scoped exact key containing both the resume
and job content hashes. This prevents stale explanations when either source
document changes. On an exact miss, a bounded list of up to 200 recent
explanations for that resume is scanned and job embeddings are compared with
cosine similarity. A semantic hit is accepted only at or above
`SEMANTIC_CACHE_THRESHOLD` (default `0.95`). Both levels use the configured
Redis TTL, and hit/miss counters are tenant-scoped for later cost reporting.

The rate limiter is fail-open for cheap endpoints so a Redis outage does not
make basic browsing unavailable. It is fail-closed for AI explanation requests
because allowing traffic through during a Redis outage could remove the budget
guard and unexpectedly increase LLM spend. The Redis health state is exposed by
`GET /health`.

## Asynchronous bulk processing

Bulk embedding and bulk matching run through BullMQ in a separate worker
process. These operations can touch hundreds or thousands of documents and
call the embedding provider, so doing them inside an HTTP request would create
long waits, timeouts, and poor concurrency control. The API acknowledges them
with `202 Accepted` and exposes progress and failures through the job status
endpoint. Single-user matching remains synchronous because it ranks one
tenant-scoped request immediately and must return an interactive result; it
does not invoke the LLM for bulk work.
