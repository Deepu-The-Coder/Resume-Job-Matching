# nginx

Nginx configuration for load balancing across multiple backend instances.

## Files

- `nginx.conf` — API gateway and frontend reverse-proxy configuration
- `Dockerfile` — Nginx gateway image

## What it does

- Listens on port 80
- Uses the Docker-DNS `app:3000` upstream with `least_conn`
- Proxies `/api` and `/health` to the backend and all other paths to the frontend
- Passes `X-Request-Id` and `X-Forwarded-For` for tracing
- Disables response buffering for API requests so long-running/SSE-compatible
  paths are not held in Nginx buffers
- Skips failed upstream connections with `proxy_next_upstream`
