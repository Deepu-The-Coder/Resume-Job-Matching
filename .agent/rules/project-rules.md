# Project Rules — AI Resume-to-Job Matching Engine

These rules apply to every task performed on this codebase. Read them before writing any code.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Runtime | Node 20 (LTS) |
| HTTP server | Express |
| Database | MongoDB via **Mongoose** |
| Cache / queue store | Redis via **ioredis** |
| Job queue | **BullMQ** |
| Frontend | **React + Vite** |

Never introduce a dependency outside this stack without first noting it explicitly in a plan and getting confirmation.

---

## 2. Module style & file size

- **ES modules only** (`"type": "module"` in every `package.json`). No `require()`.
- **async/await** for all async code. No raw Promise chains or callbacks.
- Keep files **small and single-purpose**. If a file grows beyond ~150 lines, split it.

---

## 3. Backend layering

```
routes  →  controllers  →  services  →  models
```

- **Routes**: declare endpoints and call the appropriate controller. Zero business logic.
- **Controllers**: parse/validate the request, call a service, return the HTTP response.
- **Services**: all business logic lives here. Services call models or lib wrappers.
- **Models**: Mongoose schema definitions only.

---

## 4. External-call wrappers (testability rule)

Every call to an external system **must** go through a dedicated wrapper module:

| System | Wrapper location |
|---|---|
| LLM (chat/completion) | `backend/src/lib/llm.js` |
| Embeddings API | `backend/src/lib/embeddings.js` |
| Redis | `backend/src/lib/redis.js` |
| BullMQ queues | `backend/src/lib/queue.js` |

Wrappers export simple async functions. In tests, mock the wrapper module — never the underlying SDK directly.

---

## 5. Configuration & secrets

- All config comes from **environment variables**.
- Validate every required variable at startup (throw if missing). Use a single `backend/src/config.js` file for this.
- **Never** hardcode secrets, model names, URLs, or numeric limits in source code.
- All frontend env vars must use the `VITE_` prefix.

---

## 6. Testing

- Every new backend feature needs **at least one test**.
- Test runner: **Vitest**. HTTP integration tests: **Supertest**.
- Test files live next to the source file they test (`*.test.js`) or in `backend/src/__tests__/`.
- Mock all external wrappers (rule 4) in tests — no live AI or Redis calls in CI.

---

## 7. Logging

- Use **pino** for all server-side logging.
- **`console.log` is forbidden.** Linting should catch this.
- Log levels: `error`, `warn`, `info`, `debug`. Default to `info` in production.
- Every log line must include at minimum: `level`, `msg`, `tenantId` (when in a request context), and `requestId`.

---

## 8. Multi-tenancy

- Every MongoDB document (resume, job, match, usage log) **must** include a `tenantId` field.
- All queries must filter by `tenantId`. Never return cross-tenant data.
- The tenant is extracted from the authenticated request context, never from user-supplied request body fields.

---

## 9. Task completion

After finishing any implementation task, produce a short walkthrough covering:
1. **What changed** — files created/modified and why.
2. **How to run it** — exact commands to start the server, run tests, or hit the new endpoint.
3. **How to verify** — a sample `curl` / test assertion showing the feature works.
