# Quill Observability Guide

This document describes the observability stack implemented in Quill, including **Prometheus**, **Grafana**, **Sentry**, and **Health Checks**.

---

## 1. Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│                        Clients                         │
│   React 19 SPA (with @sentry/react Error Boundary)     │
└───────────────┬────────────────────────┬───────────────┘
                │ HTTP Requests          │ Error Telemetry
                ▼                        ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│     Nginx Reverse Proxy       │   │        Sentry SaaS        │
│          (:80)                │   │  (Issues, Traces, Errors) │
└───────┬───────────────┬───────┘   └─────────────▲─────────────┘
        │ /api, /health │ /metrics                │
        ▼               ▼                         │ Server & Worker
┌───────────────────────────────┐                 │ Errors / Spans
│     Quill Express Server      ├─────────────────┤
│    (prom-client + @sentry)    │                 │
│             (:3000)           │                 │
└───────┬───────────────┬───────┘                 │
        │               │                         │
        ▼               ▼                         │
   PostgreSQL         Redis                       │
     (:5432)         (:6379)                      │
                        ▲                         │
                        │ BullMQ                  │
                ┌───────┴───────┐                 │
                │ BullMQ Worker ├─────────────────┘
                │  (+ @sentry)  │
                └───────────────┘

                ┌───────────────────────────────┐
                │          Prometheus           │
                │   Scrapes :3000/metrics       │
                │             (:9090)           │
                └───────────────┬───────────────┘
                                │ Query
                                ▼
                ┌───────────────────────────────┐
                │            Grafana            │
                │ Pre-provisioned Dashboards    │
                │             (:3001)           │
                └───────────────────────────────┘
```

---

## 2. Metrics (Prometheus)

Quill uses `prom-client` in `apps/server` to collect system, HTTP, database, and background queue metrics.

### Endpoints
- Direct: `GET http://localhost:3000/metrics`
- Via Nginx / API: `GET http://localhost/metrics` or `GET http://localhost:3000/api/metrics`

### Metric Types & Names
| Metric | Type | Labels | Description |
|---|---|---|---|
| `quill_http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests completed |
| `quill_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latency distribution of requests in seconds |
| `quill_http_active_requests` | Gauge | `method` | Current in-flight requests |
| `quill_db_pool_total_connections` | Gauge | — | Total PostgreSQL client connections |
| `quill_db_pool_idle_connections` | Gauge | — | Idle PostgreSQL clients available |
| `quill_db_pool_waiting_requests` | Gauge | — | Queued requests waiting for a DB connection |
| `quill_worker_jobs_total` | Counter | `queue`, `status` | BullMQ worker jobs (`completed`, `failed`) |
| `quill_worker_job_duration_seconds` | Histogram | `queue` | BullMQ worker job execution time |
| `quill_process_*` / `quill_nodejs_*` | Standard | — | Process CPU, memory (RSS, heap), and event loop lag |

### Prometheus Server Configuration
Prometheus runs in Docker Compose (`monitoring/prometheus/prometheus.yml`) and automatically targets `server:3000`.
- Web UI: `http://localhost:9090`

---

## 3. Visualization (Grafana)

Grafana is pre-configured with automatic datasource and dashboard provisioning.

### Access
- URL: `http://localhost:3001`
- Username: `admin` (or `${GRAFANA_ADMIN_USER}`)
- Password: `admin` (or `${GRAFANA_ADMIN_PASSWORD}`)

### Pre-provisioned Dashboard: `Quill System Overview`
- **Health KPIs**: Real-time API uptime, in-flight active requests, total request throughput (req/s), and 5xx server error percentage.
- **Traffic & Latency**: Requests per second broken down by status code (2xx, 3xx, 4xx, 5xx) and percentiles (`p50`, `p90`, `p99`).
- **Runtime Performance**: Process memory (RSS vs Heap Used/Total) and event loop status.
- **Database Connection Pool**: Total, idle, and waiting clients in the PostgreSQL pool.
- **Worker Execution**: BullMQ job processing rates and failure rates by queue.

---

## 4. Error Tracking (Sentry)

Sentry is integrated into both the backend API/worker and frontend React application.

### Backend (`apps/server` and BullMQ Worker)
- Library: `@sentry/node`
- Configuration:
  - `SENTRY_DSN`: Sentry project DSN. If left empty, Sentry operates safely in dry-run/disabled mode.
  - `SENTRY_TRACES_SAMPLE_RATE`: Performance traces sample rate (default `1.0`).
- Features:
  - `setupExpressErrorHandler(app)` captures uncaught route exceptions.
  - Centralized `errorHandler` captures all 500-level internal errors with request context.
  - BullMQ worker captures failed background jobs with queue name, job name, and attempt count.

### Frontend (`apps/client`)
- Library: `@sentry/react`
- Configuration:
  - `VITE_SENTRY_DSN`: Client-side Sentry project DSN.
- Features:
  - `Sentry.ErrorBoundary` wraps the application root with a clean fallback screen.
  - Captures unhandled React rendering errors and browser exceptions.
  - Distributed tracing propagation targets configured for API calls.

---

## 5. Health Checks & Probes

A comprehensive health check endpoint is provided at `/health` and `/api/health`.

### Endpoint Output Example
```json
{
  "status": "ok",
  "timestamp": "2026-11-03T05:10:21.000Z",
  "uptimeSeconds": 142,
  "durationMs": 3,
  "services": {
    "database": {
      "status": "up",
      "latencyMs": 1
    },
    "redis": {
      "status": "up",
      "latencyMs": 1
    }
  }
}
```
If either PostgreSQL or Redis is unreachable, HTTP `503 Service Unavailable` is returned with `status: "degraded"`.

---

## 6. How to Run

### Running with Docker Compose (Full Stack + Observability)
```bash
docker compose up -d
```
Services available:
- Client: `http://localhost`
- API / Health: `http://localhost/health` or `http://localhost:3000/health`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (login: `admin` / `admin`)

### Running in Local Development
```bash
# Start background dependencies (Postgres & Redis)
docker compose up -d postgres redis

# Run API, Worker, and Client
./scripts/run.sh
```
To enable Sentry locally, add your Sentry DSNs into `.env`:
```env
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

---