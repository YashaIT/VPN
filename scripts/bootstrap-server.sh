#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vpn-invite-service}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"

if [ -z "${REPO_URL}" ]; then
  echo "REPO_URL is required" >&2
  exit 1
fi

sudo mkdir -p "${APP_DIR}"
sudo chown -R "$USER":"$USER" "${APP_DIR}"

if [ ! -d "${APP_DIR}/.git" ]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
chmod +x scripts/deploy.sh

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created ${APP_DIR}/.env. Fill it before first deploy."
fi

echo "Bootstrap completed."
echo "Next:"
echo "1. Edit ${APP_DIR}/.env"
echo "2. Run: APP_DIR=${APP_DIR} BRANCH=${BRANCH} ${APP_DIR}/scripts/deploy.sh"
