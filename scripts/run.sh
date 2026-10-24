#!/bin/bash

echo "================="
echo "Starting Project"
echo "================="

# Run server in the background
bun run dev:server &

# Run client in the background
bun run dev:client &

# Run worker in the background
bun run dev:worker &

# Wait for all background processes to finish
wait
