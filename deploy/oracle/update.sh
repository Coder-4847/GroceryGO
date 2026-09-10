#!/usr/bin/env bash
# Pull the latest code and restart the backend on the VM.
set -euo pipefail
cd "$(dirname "$0")/../.."
git pull --ff-only
cd deploy/oracle
docker compose up -d --build
docker compose ps
