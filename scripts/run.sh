#!/bin/bash

echo "================="
echo "Starting Project"
echo "================="

# Run server in the background
bun run dev:server &

# Run client in the background
bun run dev:client &

# Wait for both background processes to finish
wait

