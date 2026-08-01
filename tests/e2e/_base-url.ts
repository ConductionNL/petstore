/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * THE single source of truth for the Nextcloud instance this suite talks to.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every entry point used to compute its own target with
 *   `process.env.NEXTCLOUD_URL || 'http://localhost:8080'`
 * — playwright.config.ts, tests/e2e/global-setup.ts and three request contexts
 * in tests/e2e/workflows/pet-crud-persistence.spec.ts.
 *
 * Two concrete hazards followed from that:
 *
 *   1. `http://localhost:8080` is the SHARED dev container. It bind-mounts real
 *      host checkouts, and the pet-CRUD suite WRITES (it creates, updates and
 *      deletes OpenRegister `pet` objects). Running `npx playwright test` with
 *      no environment set therefore silently mutated somebody else's instance
 *      while appearing to test this branch. Two other apps in this fleet were
 *      caught doing exactly this.
 *   2. `PLAYWRIGHT_BASE_URL` — the variable the isolated-instance tooling
 *      actually exports — was read by NOTHING, so pointing the suite at a
 *      disposable instance the documented way had no effect at all.
 *
 * There is deliberately NO default. A missing target is a loud failure, never
 * a silent redirect onto a shared box.
 */

const CANDIDATES = [
	'PLAYWRIGHT_BASE_URL',
	'NEXTCLOUD_URL',
	'NC_BASE_URL',
	// The shared ConductionNL `quality.yml` Playwright job exports BASE_URL
	// (not NEXTCLOUD_URL) for its PHP built-in server. Kept last so a local
	// explicit override always wins.
	'BASE_URL',
] as const

/**
 * Resolve the base URL of the Nextcloud instance under test.
 *
 * @throws Error when no target variable is set — never falls back to :8080.
 */
export function resolveBaseURL(): string {
	for (const name of CANDIDATES) {
		const value = process.env[name]
		if (value && value.trim() !== '') return value.trim().replace(/\/+$/, '')
	}
	throw new Error(
		'No Nextcloud target configured for the petstore e2e suite. Set one of '
		+ `${CANDIDATES.join(', ')} — for example:\n`
		+ '  PLAYWRIGHT_BASE_URL=http://localhost:8093 npx playwright test\n'
		+ 'There is no default on purpose: the old default (http://localhost:8080) '
		+ 'is the SHARED dev container and this suite writes real objects.',
	)
}

/** The resolved base URL. Importing this module in a spec is enough to fail fast. */
export const BASE_URL = resolveBaseURL()
