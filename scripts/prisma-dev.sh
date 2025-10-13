#!/usr/bin/env bash
set -euo pipefail

# Load development env and run Prisma migrate dev/generate using it
if [[ -f ./.env.development ]]; then
  set -a
  source ./.env.development
  set +a
fi

exec npx prisma "$@"

