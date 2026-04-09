#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vpn-invite-service}"
BRANCH="${BRANCH:-main}"

echo "[deploy] app dir: ${APP_DIR}"
cd "${APP_DIR}"

if [ ! -d .git ]; then
  echo "[deploy] git repository not found in ${APP_DIR}" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "[deploy] .env file is missing in ${APP_DIR}" >&2
  exit 1
fi

echo "[deploy] fetching latest changes"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[deploy] rebuilding and starting containers"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo "[deploy] waiting for healthcheck"
sleep 5
docker compose ps

echo "[deploy] done"
