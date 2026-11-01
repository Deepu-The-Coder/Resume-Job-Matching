# Security notes

## Threats and mitigations

- **Cross-tenant data leakage**: `x-tenant-id` is resolved once by
  `tenantContextMiddleware`; controllers use `req.tenantId` rather than body or
  query tenant values. Tenant-scoped Mongoose models require `.forTenant()`
  and fail loudly when a query has no scope. Redis cache keys and usage/stats
  queries remain tenant-prefixed or tenant-filtered.
- **Prompt injection in resumes/jobs**: retrieved text is treated as
  untrusted data inside explicit delimiters. The system prompt tells the model
  to ignore instructions inside those delimiters. Suspicious instruction-like
  phrases are logged with tenant/request IDs but are not executed or trusted.
- **Oversized or malformed input**: JSON and URL-encoded bodies are capped at
  1 MB, uploads remain PDF-only and capped at 5 MB, and Zod validates endpoint
  inputs and IDs.
- **Upload path/name attacks**: uploaded filenames are reduced to a basename,
  control characters are removed, and remaining unsafe characters are replaced.
  Files are held in memory and never written using the client filename.
- **Browser/API abuse**: Helmet adds common HTTP security headers and CORS
  allows only origins listed in `CORS_ORIGINS`.
- **Secret and sensitive-text exposure**: responses remove embedding arrays;
  API keys are loaded from environment configuration and are never logged.
  Resume full text is sent only to the embedding/LLM provider and is not
  included in application logs.
- **Cache poisoning/isolation**: explanation cache keys include tenant and
  content hashes; semantic cache entries are scanned only within the same
  tenant/resume namespace.

The current tenant header is a demo identity mechanism, not authentication.
Production deployment must replace it with an authenticated, server-derived
tenant claim and should not allow clients to choose arbitrary tenant IDs.
