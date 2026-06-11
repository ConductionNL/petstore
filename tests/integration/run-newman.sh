#!/usr/bin/env bash
#
# Petstore API-contract test runner (Newman / Postman).
#
# Runs tests/integration/app-template.postman_collection.json against a live
# Nextcloud instance serving the petstore app. Petstore is the canonical app
# TEMPLATE, so the collection is a minimal, self-contained health/contract
# baseline (it asserts the instance is reachable and serving). Collection
# variables are parameterised (base_url / admin_user / admin_password) so the
# suite is portable across environments.
#
# Usage:
#   ./run-newman.sh                                  # defaults to localhost:8080, admin:admin
#   BASE_URL=http://localhost:8080 ./run-newman.sh
#   ADMIN_USER=admin ADMIN_PASS=admin ./run-newman.sh
#
# Uses a globally-installed `newman` if present, otherwise falls back to
# `npx newman`. Runs are serialised via flock (when available) so concurrent
# CI agents do not trip the Nextcloud brute-force protection.
#
# SPDX-License-Identifier: EUPL-1.2
# SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>

set -euo pipefail

# Re-exec under an exclusive flock so parallel agents serialise.
LOCK_FILE="/tmp/uiaudit-petstore.lock"
if [ "${PETSTORE_NEWMAN_LOCKED:-}" != "1" ] && command -v flock >/dev/null 2>&1; then
  export PETSTORE_NEWMAN_LOCKED=1
  exec flock "${LOCK_FILE}" "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTION="${SCRIPT_DIR}/app-template.postman_collection.json"

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"

if command -v newman >/dev/null 2>&1; then
  NEWMAN=(newman)
else
  NEWMAN=(npx --yes newman)
fi

"${NEWMAN[@]}" run "${COLLECTION}" \
  --env-var "base_url=${BASE_URL}" \
  --env-var "admin_user=${ADMIN_USER}" \
  --env-var "admin_password=${ADMIN_PASS}" \
  --reporters cli \
  --color on \
  "$@"
