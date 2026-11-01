# Backend — AI Resume-to-Job Matching Engine

Node.js 20 + Express API server (ES modules). Embeddings run locally through
Ollama, so resume/job ingestion does not require paid API credits.

## Structure

```
src/
  config.js          # Env-var validation — all config lives here
  server.js          # Entry point: start DB connection, HTTP listener, graceful shutdown
  app.js             # Express app setup (for testing and mounting middleware)
  routes/            # Route declarations only — no logic
  controllers/       # Parse request → call service → return response
  services/          # All business logic
  models/            # Mongoose schemas
  lib/               # External-call wrappers: llm.js, embeddings.js, redis.js, queue.js
  middleware/        # Auth, rate-limit, error-handler, request-id
  __tests__/         # Integration tests (Vitest + Supertest)
```

## Getting started

```bash
cp ../.env.example ../.env   # fill in your values
npm install
npm run dev
```

Install [Ollama for Windows](https://ollama.com/download/windows), then download
the embedding model before starting ingestion:

```powershell
ollama pull embeddinggemma
```

Ollama must be running at `http://localhost:11434` (the default).

Match explanations use the Gemini API. Create a Gemini API key at
https://aistudio.google.com/apikey and set it in `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-2.5-flash-lite
```

The Gemini integration uses the official `generateContent` REST endpoint,
enforces a 15-second timeout, retries transient failures twice, and records
input/output token usage. An `opossum` circuit breaker protects the call:
`LLM_BREAKER_FAILURE_THRESHOLD`, `LLM_BREAKER_ROLLING_WINDOW_MS`, and
`LLM_BREAKER_RESET_TIMEOUT_MS` configure its failure threshold, rolling window,
and reset timeout. Set `LLM_FORCE_FAILURE=true` in development to demonstrate
fallback explanations without calling Gemini. `GET /health` reports the
breaker state and the number of fallbacks served.

## Testing

```bash
npm test
```

## Resume ingestion

Upload a text-based PDF with the multipart field `resume` and the required
`userId` and `tenantId` fields:

```bash
curl -X POST http://localhost:3000/api/resumes `
  -F "userId=64b7f5d2f3c4a5b6c7d8e9f0" `
  -F "tenantId=tenant-001" `
  -F "resume=@resume.pdf;type=application/pdf"
```

Uploads are held in memory, limited to 5 MB, and parsed before keyword-based
skill extraction. A tenant-scoped SHA-256 hash prevents duplicate embedding
calls. The upload and `GET /api/resumes/:id` responses omit the stored
embedding vector.

Jobs use the same tenant-scoped deduplication and embedding flow:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Backend Engineer","description":"Build Node.js APIs","requiredSkills":["node.js","mongodb"],"tenantId":"tenant-001","postedBy":"64b7f5d2f3c4a5b6c7d8e9f0"}'
```

Use `GET /api/jobs?tenantId=tenant-001`, `GET /api/resumes/:id/matches?tenantId=tenant-001&k=5`,
or `GET /api/jobs/:id/matches?tenantId=tenant-001&k=5` for embedding-based ranking.

Add `explain=true&explainTop=3` to either matches endpoint to generate
explanations only for the top three results. Explanations use the configured
LLM model and are persisted in the tenant-scoped `Match` collection.

## Bulk background jobs

Run the API and the worker as separate processes. Redis must be running for
BullMQ:

```powershell
npm run dev
npm run worker
```

Bulk embedding accepts resume or job IDs and skips documents that already use
the current embedding model:

```powershell
curl -X POST http://localhost:3000/api/admin/bulk-embed `
  -H "Content-Type: application/json" `
  -d '{"tenantId":"tenant-001","type":"resume","ids":["64b7f5d2f3c4a5b6c7d8e9f0"]}'
```

Bulk matching accepts an already embedded job and stores tenant-scoped top
results without making LLM calls:

```powershell
curl -X POST http://localhost:3000/api/admin/bulk-match `
  -H "Content-Type: application/json" `
  -d '{"tenantId":"tenant-001","jobId":"64b7f5d2f3c4a5b6c7d8e9f0","k":10}'
```

Both endpoints return `202` with a queue `jobId`. Poll
`GET /api/admin/jobs/:jobId` for `status`, `progress`, and `failures`.
After three configurable attempts, failed jobs remain available from
`GET /api/admin/failed-jobs`.

## Usage and cost dashboard

AI usage is persisted in `UsageLog` and match-request timing is persisted in
`RequestLog`. Configure prices and the average LLM token profile in
`backend/.env`; zero prices are valid for local Ollama/Gemini development and
will correctly show zero estimated spend:

```env
EMBEDDING_INPUT_PRICE_PER_1K_TOKENS=0
LLM_INPUT_PRICE_PER_1K_TOKENS=0
LLM_OUTPUT_PRICE_PER_1K_TOKENS=0
LLM_AVERAGE_INPUT_TOKENS=1000
LLM_AVERAGE_OUTPUT_TOKENS=200
```

Tenant-scoped statistics are available from:

```text
GET /api/stats?tenantId=tenant-001&range=24h
GET /api/stats?tenantId=tenant-001&range=7d
```

The frontend dashboard is available at `/dashboard`. Cache savings use the
configured average LLM cost per call, while actual AI spend uses the recorded
input/output token usage; no dashboard values are hardcoded.
