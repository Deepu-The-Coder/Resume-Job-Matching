# Load-test results

These measurements were taken on 2026-11-01 against the local Docker Compose
gateway with three `app` replicas. The test target was the seeded
`tenant-acme` resume `6ae77454fd0f4db4845cef41`, using k6 2.3.0 in the
`grafana/k6:latest` container.

The matching workload used `explain=true`, `explainTop=3`, `k=10`, two
iterations per second for 10 seconds, and a distinct `X-User-Id` per virtual
user except Scenario C. The cold run started after `redis-cli FLUSHALL`.

| Scenario | Requests/sec | p50 latency | p95 latency | Error rate | Cache hit rate | Result |
|---|---:|---:|---:|---:|---:|---|
| A. Cold cache | 2.0860 | 60.05 ms | 1042.32 ms | 0% | 0% | 100% matching success; LLM calls fell back |
| B. Warm cache | 2.0914 | 45.74 ms | 887.37 ms | 0% | 0% | 100% matching success; no cache entries were created because LLM calls fell back |
| C. One-user burst | 30.0 | 6.89 ms | 11.01 ms | 96.67% | 0% | 10 requests allowed by the AI bucket; remaining requests returned 429 |
| D. Forced LLM failure | 2.0896 | 63.34 ms | 172.19 ms | 0% | 0% | 100% matching success; fallback explanations served |

The warm-cache value is an honest measurement of this run, not a claim that
the cache was warm. The configured Gemini call did not produce successful LLM
responses during Scenarios A and B, so the fallback path was used and fallback
explanations are intentionally not cached. To measure a true warm-cache
comparison, run Scenario A with a working LLM configuration, confirm the
responses contain `explanationSource: "llm"`, then run Scenario B without
flushing Redis.

## Reproduce

Use the same IDs or supply IDs from your own tenant:

```powershell
$env:TENANT_ID = "tenant-acme"
$env:RESUME_ID = "your-resume-object-id"
docker compose up -d --scale app=3
docker compose exec -T redis redis-cli FLUSHALL
docker run --rm -i -v "${PWD}\loadtest:/scripts" grafana/k6:latest run `
  -e BASE_URL=http://host.docker.internal `
  -e TENANT_ID=$env:TENANT_ID -e RESUME_ID=$env:RESUME_ID `
  /scripts/scenario-a-cold.js
docker run --rm -i -v "${PWD}\loadtest:/scripts" grafana/k6:latest run `
  -e BASE_URL=http://host.docker.internal `
  -e TENANT_ID=$env:TENANT_ID -e RESUME_ID=$env:RESUME_ID `
  /scripts/scenario-b-warm.js
```

Scenario C uses one fixed user identity to trigger the AI token bucket:

```powershell
docker run --rm -i -v "${PWD}\loadtest:/scripts" grafana/k6:latest run `
  -e TENANT_ID=$env:TENANT_ID -e RESUME_ID=$env:RESUME_ID `
  -e RATE=30 -e DURATION=10s /scripts/scenario-c-rate-limit.js
```

Scenario D requires recreating the app replicas with the development/demo
failure switch, then restoring normal mode afterward:

```powershell
$env:LLM_FORCE_FAILURE = "true"
docker compose up -d --force-recreate --scale app=3 app nginx
docker run --rm -i -v "${PWD}\loadtest:/scripts" grafana/k6:latest run `
  -e TENANT_ID=$env:TENANT_ID -e RESUME_ID=$env:RESUME_ID `
  /scripts/scenario-d-llm-failure.js
$env:LLM_FORCE_FAILURE = "false"
docker compose up -d --force-recreate --scale app=3 app nginx
Remove-Item Env:LLM_FORCE_FAILURE
```
