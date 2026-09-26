#!/bin/bash

set -e

mkdir -p apps/server/src apps/client packages/shared/src

cat > packages/shared/package.json <<'EOF'
{ "name": "@quill/shared", "version": "0.0.1", "main": "src/index.ts", "types": "src/index.ts" }
EOF

cat > apps/server/package.json <<'EOF'
{
  "name": "quill-server",
  "scripts": { "dev": "bun --watch src/index.ts" },
  "dependencies": { "express": "^4.19.0", "@quill/shared": "workspace:*" }
}
EOF

touch packages/shared/src/index.ts apps/server/src/index.ts

bun create vite apps/client --template react-ts

bun install
echo "Quill monorepo scaffolded."