#!/usr/bin/env bash
#
# SPDX-FileCopyrightText: 2026 Conduction B.V.
# SPDX-License-Identifier: EUPL-1.2
#
# Provision petstore's OpenRegister register + schemas on a freshly installed
# Nextcloud, for the shared `E2E Tests (Playwright)` CI job.
#
# Wired up as the workflow's `playwright-seed-command`. That step runs AFTER
# `php -S` is up, with cwd set to the Nextcloud server root, so it is invoked
# as:
#
#     playwright-seed-command: 'bash apps/petstore/tests/e2e/ci-seed.sh'
#
# WHY THIS IS NEEDED
# ------------------
# `occ app:enable petstore` runs the `InitializeSettings` repair step, which is
# supposed to import `lib/Settings/petstore_register.json` into OpenRegister.
# That is not a reliable fresh-install path, and it fails SILENTLY:
#
#   1. An IRepairStep runs with NO user session. OpenRegister's RBAC evaluates
#      the acting user, so the import can be denied outright.
#   2. `InitializeSettings::run()` catches `\Throwable` and downgrades it to
#      `$output->warning('Could not auto-configure PetStore: ...')`. `occ
#      app:enable` still exits 0.
#
# So the app enables cleanly, the SPA boots, and the register simply is not
# there. In that state the e2e suite fails as a wall of 404s from the object
# API — messages that point at the fixtures rather than at the missing import.
#
# This script therefore does the import EXPLICITLY over the admin HTTP API,
# which has a real session and passes RBAC, and then VERIFIES the register and
# schemas actually exist. A failed provision becomes one loud step failure here
# instead of a pile of misleading spec failures later.
#
# It is idempotent: `settings#load` calls `reloadConfiguration()`, which is
# `importConfiguration(force: true)` — a fresh import regardless of the
# recorded version — and re-running only re-verifies.

set -euo pipefail

# ── Target resolution ────────────────────────────────────────────────────────
# The shared workflow's "Seed test data" step declares no `env:` block, so
# BASE_URL / ADMIN_USER / ADMIN_PASSWORD are NOT exported to it (unlike the
# "Run Playwright tests" step). Accept them if a caller does set them, and fall
# back to the CI runner's own `php -S 0.0.0.0:8080` otherwise.
#
# That fallback is gated on actually being in CI. On a developer box
# `localhost:8080` is the SHARED dev container, and this script performs ADMIN
# WRITES — it must never import a register into somebody else's environment.
# Off CI, an unset target is a hard error. This mirrors the same refusal that
# tests/e2e/_base-url.ts already enforces for the suite itself.
BASE="${PLAYWRIGHT_BASE_URL:-${BASE_URL:-${NEXTCLOUD_URL:-}}}"
if [ -z "$BASE" ]; then
	if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
		BASE="http://localhost:8080"
	else
		echo "ERROR: no base URL set. Export PLAYWRIGHT_BASE_URL or BASE_URL." >&2
		echo "       Refusing to default to http://localhost:8080 outside CI —" >&2
		echo "       that is the SHARED dev container and this script writes to it." >&2
		exit 1
	fi
fi
BASE="${BASE%/}"

USER_NAME="${ADMIN_USER:-${NC_ADMIN_USER:-admin}}"
USER_PASS="${ADMIN_PASSWORD:-${NC_ADMIN_PASS:-admin}}"

echo "[ci-seed] target: ${BASE}"

# ── 1. Import the petstore configuration ─────────────────────────────────────
# `settings#load` (POST /api/settings/load) carries no `@NoAdminRequired`, so
# it is admin-only, and it calls `reloadConfiguration()` -> `importConfiguration
# (force: true)`. Basic auth supplies a real, admin-scoped session, which is
# precisely what the repair-step path lacks.
LOAD_URL="${BASE}/index.php/apps/petstore/api/settings/load"
echo "[ci-seed] POST ${LOAD_URL}"

LOAD_BODY="$(mktemp)"
LOAD_CODE="$(
	curl -sS -o "$LOAD_BODY" -w '%{http_code}' \
		-u "${USER_NAME}:${USER_PASS}" \
		-X POST \
		-H 'Content-Type: application/json' \
		-H 'OCS-APIRequest: true' \
		--data '{}' \
		"$LOAD_URL" || echo 000
)"

echo "[ci-seed] import HTTP ${LOAD_CODE}"
head -c 2000 "$LOAD_BODY"; echo

if [ "$LOAD_CODE" != "200" ]; then
	echo "::error::petstore configuration import failed (HTTP ${LOAD_CODE}). The e2e suite cannot seed pets without it."
	exit 1
fi

# HTTP 200 is not the same as a successful import: `importConfiguration()`
# returns `{"success": false, "message": "..."}` inside a 200 JSONResponse when
# OpenRegister is absent or the config file cannot be read. Check the payload.
python3 - "$LOAD_BODY" <<'PY'
import json, sys
raw = open(sys.argv[1]).read()
try:
    body = json.loads(raw)
except json.JSONDecodeError:
    print('::error::settings/load did not return JSON. First 500 bytes:')
    print(raw[:500])
    sys.exit(1)
if isinstance(body, dict) and body.get('success') is False:
    print(f"::error::petstore import reported failure: {body.get('message')}")
    sys.exit(1)
print('[ci-seed] import payload reports success.')
PY

# ── 2. Verify the register and schemas are actually there ────────────────────
# The import reporting success is not the same as the register existing —
# verify against OpenRegister directly, using the slugs the e2e fixtures
# resolve by.
#
# The required slugs below are read from lib/Settings/petstore_register.json,
# NOT derived by kebab-casing a title: OpenRegister resolves a schema segment
# via LOWER(slug), so a guessed slug is a structural mismatch, not a casing
# one, and it fails as a 404 that looks like missing data.
verify() {
	python3 - "$1" "$2" <<'PY'
import json, sys
path, kind = sys.argv[1], sys.argv[2]
required = {
    'registers': ['petstore'],
    'schemas': ['pet', 'category', 'order'],
}[kind]
raw = open(path).read()
try:
    body = json.loads(raw)
except json.JSONDecodeError:
    print(f'::error::{kind} endpoint did not return JSON. First 500 bytes:')
    print(raw[:500])
    sys.exit(1)
items = body if isinstance(body, list) else body.get('results', [])
slugs = {i.get('slug') for i in items if isinstance(i, dict)}
missing = [s for s in required if s not in slugs]
print(f'[ci-seed] {kind} present: {sorted(s for s in slugs if s)}')
if missing:
    print(f'::error::petstore {kind} missing after import: {missing}')
    sys.exit(1)
print(f'[ci-seed] {kind} OK ({len(required)} required slugs present)')
PY
}

REG_BODY="$(mktemp)"
curl -sS -u "${USER_NAME}:${USER_PASS}" -H 'OCS-APIRequest: true' \
	"${BASE}/index.php/apps/openregister/api/registers?_limit=300" -o "$REG_BODY"
verify "$REG_BODY" registers

SCH_BODY="$(mktemp)"
curl -sS -u "${USER_NAME}:${USER_PASS}" -H 'OCS-APIRequest: true' \
	"${BASE}/index.php/apps/openregister/api/schemas?_limit=1000" -o "$SCH_BODY"
verify "$SCH_BODY" schemas

echo "[ci-seed] petstore register + schemas provisioned."

# ── 3. Warm the SPA so the first spec doesn't pay the cold start ─────────────
# The shared workflow serves Nextcloud with `php -S 0.0.0.0:8080` and does not
# set PHP_CLI_SERVER_WORKERS, so the built-in server runs ONE worker: every
# request the SPA fires on boot is serialised behind the one before it, on top
# of a cold opcache and the first parse of the webpack bundle.
#
# The cost lands entirely on whichever spec happens to run first, which makes
# it look like that spec is flaky. Warming it here puts the fix in the
# environment-preparation step where it belongs. Raising the first spec's
# timeout instead would hide the cold start inside an assertion and keep
# drifting upward.
#
# Failures are ignored on purpose: this is a warm-up, not a gate. The real
# checks are above and below.
for path in \
	"/index.php/apps/petstore/" \
	"/index.php/apps/petstore/api/settings" \
	"/index.php/apps/openregister/api/registers?_limit=1"
do
	code="$(curl -sS -o /dev/null -w '%{http_code}' -u "${USER_NAME}:${USER_PASS}" \
		-H 'OCS-APIRequest: true' "${BASE}${path}" || echo 000)"
	echo "[ci-seed] warm ${path} -> ${code}"
done

# Pull the main webpack bundle once so it is in the page cache.
#
# Do NOT hardcode the URL. Nextcloud serves an app's assets from whichever apps
# directory it was installed into — `/apps/<app>/js/...` on the CI runner,
# `/custom_apps/<app>/js/...` in the docker dev images — and asking for the
# wrong one does not 404. It returns **HTTP 200 with `text/html`**: the NC
# error page, served through index.php. A status-code check therefore reports
# success while fetching a small HTML page instead of the bundle, so the
# warm-up silently warms nothing.
#
# Read the real src out of the rendered app page instead, and verify the
# response is actually JavaScript.
APP_HTML="$(mktemp)"
curl -sS -u "${USER_NAME}:${USER_PASS}" -H 'OCS-APIRequest: true' \
	"${BASE}/index.php/apps/petstore/" -o "$APP_HTML" || true

# `|| true` is load-bearing: grep exits 1 when it matches nothing, and under
# `set -euo pipefail` that would abort the script right here — so the exact
# case the gate below exists to explain (no bundle) would die with a bare
# non-zero exit and none of the diagnosis. Let it fall through to the gate.
BUNDLE_SRC="$(grep -oE 'src="[^"]*petstore-main[^"]*"' "$APP_HTML" \
	| head -1 | sed 's/^src="//; s/"$//' || true)"

if [ -n "$BUNDLE_SRC" ]; then
	BUNDLE_INFO="$(curl -sS -o /dev/null \
		-w '%{http_code} %{content_type} %{size_download}' \
		-u "${USER_NAME}:${USER_PASS}" "${BASE}${BUNDLE_SRC}" || echo '000 - 0')"
	echo "[ci-seed] warm bundle ${BUNDLE_SRC} -> ${BUNDLE_INFO}"
else
	echo "[ci-seed] could not locate the bundle src in the rendered app page."
	BUNDLE_INFO=""
fi

# On CI this is a GATE, not a warm-up.
#
# The single most likely way this job "succeeds" dishonestly is by passing
# without ever loading the app — and the environment hides it well: when the
# bundle is absent, Nextcloud does not 404. It serves its HTML error page with
# **HTTP 200 and Content-Type text/html**, so a build that produced nothing
# looks, to every status-code check in the pipeline, exactly like success.
#
# The specs are the honest signal; this check just makes the cause loud and
# immediate instead of arriving as a wall of selector timeouts naming an
# element.
if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
	case "$BUNDLE_INFO" in
		*javascript*)
			echo "[ci-seed] bundle verified as JavaScript."
			;;
		*)
			echo "::error::The petstore frontend bundle did not serve as JavaScript (got: ${BUNDLE_INFO:-<not found>})."
			echo "::error::The SPA cannot mount, so every UI spec would fail on a selector timeout with a misleading cause."
			echo "::error::Check the 'Build app frontend' step — a missing bundle returns HTTP 200 text/html, not 404."
			exit 1
			;;
	esac
fi

# ---------------------------------------------------------------------------
# TRUNCATION CONTROL — THROWAWAY BRANCH ONLY. NEVER MERGE THIS HUNK.
#
# Proves the green E2E floor is not hollow. A suite that still passes with an
# empty bundle is testing nothing, and this environment hides that well: a
# missing bundle serves HTTP 200 text/html, never 404.
#
# TRUNCATE, never delete — a deleted bundle gets rebuilt by ensureBundleBuilt()
# and the control would silently measure a healthy run.
#
# Runs AFTER the bundle-verified gate above on purpose, so the gate sees the
# real artefact and the specs see an empty one.
# ---------------------------------------------------------------------------
echo "[ci-seed] TRUNCATION CONTROL: emptying petstore JS bundles."
for f in apps/petstore/js/*.js; do
	[ -f "$f" ] && : > "$f" && echo "[ci-seed]   truncated $f -> $(wc -c < "$f") bytes"
done

echo "[ci-seed] done."
