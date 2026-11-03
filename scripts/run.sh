#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Change directory to the repository root
cd "$(dirname "$0")/.."

echo "=================================================="
echo "🚀 Starting Quill (Full Stack + Observability)"
echo "=================================================="

# 1. Start Docker dependencies (PostgreSQL, Redis, Prometheus, Grafana)
echo "📦 Starting background infrastructure with Docker Compose…"
docker compose up -d postgres redis prometheus grafana

# Trap to terminate all child background processes upon script exit
cleanup() {
  echo ""
  echo "🛑 Stopping Quill processes…"
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Start local development processes in the background
echo "⚡ Starting API server, worker, and frontend client…"
bun run dev:server &
bun run dev:worker &
bun run dev:client &

echo ""
echo "=================================================="
echo "✨ Quill is running! Access the services below:"
echo "=================================================="
echo "🌐 Frontend Client:       http://localhost:5173"
echo "🔌 Express API:           http://localhost:3000"
echo "📊 Metrics Endpoint:      http://localhost:3000/metrics"
echo "🩺 Health Check:          http://localhost:3000/health"
echo "🔥 Prometheus Server:     http://localhost:9090"
echo "📈 Grafana Dashboard:     http://localhost:3001/d/quill-overview/quill-system-overview"
echo "   ↳ Grafana Credentials: admin / admin"
echo "=================================================="
echo "Press Ctrl+C to stop all local processes."
echo ""

# Wait for background jobs to keep the script running
wait
