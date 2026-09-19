#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS from https://nodejs.org then run again.'
  exit 1
fi
node -e "if(Number(process.versions.node.split('.')[0])<24) {console.error('Node.js 24+ required'); process.exit(1)}"
if [ ! -d node_modules/express ]; then npm ci --no-audit --no-fund; fi
if [ ! -f dist/index.html ]; then npm run build; fi
printf '\nOpen http://localhost:3000 after the ready message.\n'
exec npm start
