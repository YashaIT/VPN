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

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "[deploy] docker compose is not available" >&2
  exit 1
fi

if [ -n "${DEPLOY_ENV_B64:-}" ]; then
  echo "[deploy] writing .env from GitHub secret"
  printf '%s' "${DEPLOY_ENV_B64}" | base64 -d > .env
fi

if [ ! -f .env ]; then
  echo "[deploy] .env file is missing in ${APP_DIR} and DEPLOY_ENV_B64 was not provided" >&2
  exit 1
fi

echo "[deploy] fetching latest changes"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[deploy] rebuilding and starting containers"
${COMPOSE_CMD} -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo "[deploy] waiting for healthcheck"
sleep 5
${COMPOSE_CMD} ps

echo "[deploy] done"
