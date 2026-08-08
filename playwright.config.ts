/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Playwright config for the Nextcloud App Template.
 *
 * Scaffolded by /journeydoc-init (ADR-030). Two projects:
 *
 *   - `chromium`     — the default regression project. Excludes the
 *                      docs capture spec so PR pipelines don't reshoot
 *                      screenshots on every push. Add regression specs
 *                      under `tests/e2e/` and they run here.
 *   - `docs-capture` — the journeydoc screenshot capture project.
 *                      Opt-in: `npx playwright test --project docs-capture`.
 *                      Output lands in
 *                      `docs/static/screenshots/tutorials/{user,admin}/`.
 *
 * Point at a running Nextcloud with PLAYWRIGHT_BASE_URL (or NEXTCLOUD_URL /
 * NC_BASE_URL / BASE_URL). There is NO default — see tests/e2e/_base-url.ts
 * for why a silent `http://localhost:8080` fallback was removed.
 */

import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import { BASE_URL } from './tests/e2e/_base-url'

/**
 * The `visual` project has always DOCUMENTED itself as "Opt-in / non-gating"
 * with a platform caveat (see its entry below): PNG baselines are host font +
 * GPU specific, so a CI Linux runner cannot byte-match a baseline shot in the
 * dev container. On the shared quality workflow that intent was never actually
 * enforced — the job runs a bare `npx playwright test --config=…`, which runs
 * EVERY project, so `visual` gated the pipeline anyway and contributed a 53%
 * pixel diff on both of its tests.
 *
 * Opting it in explicitly is what the comment always claimed was true. The
 * tests are unchanged and still run in full on demand:
 *
 *   PLAYWRIGHT_VISUAL=1 npx playwright test --project visual
 *   PLAYWRIGHT_VISUAL=1 npx playwright test --project visual --update-snapshots
 *
 * Re-baselining must happen ON a CI runner before this project can gate —
 * tracked as visible debt, not silently dropped.
 */
const RUN_VISUAL = process.env.PLAYWRIGHT_VISUAL === '1'

export default defineConfig({
	testDir: './tests/e2e',
	globalSetup: path.resolve(__dirname, 'tests/e2e/global-setup.ts'),
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	// The shared quality.yml Playwright job is `timeout-minutes: 45`, and a job
	// cancelled by that cap produces NO verdict: Playwright never prints its
	// tally, the `if: failure()` trace upload never fires, and the
	// `if: always()` report upload does not run on a cancelled job either — the
	// run you most need to read is the one that leaves nothing behind, and it
	// still renders as "fail" in `gh pr checks` while carrying no information.
	// Runs cancelled at ~45m16s have been observed in this fleet. Measured
	// overhead before `Run Playwright tests` starts is 2.0-2.4 min and the
	// uploads after it take seconds, so 38m keeps ~7 min of margin while
	// guaranteeing both a tally and the artifacts that explain it.
	globalTimeout: 38 * 60_000,
	reporter: [
		['html', { open: 'never', outputFolder: 'tests/e2e/playwright-report' }],
		['list'],
	],
	outputDir: 'tests/e2e/test-results',

	use: {
		baseURL: BASE_URL,
		storageState: path.resolve(__dirname, 'tests/e2e/.auth/admin.json'),
		// `on-first-retry` writes a trace only when a retry actually happens, so
		// the trace artifact is a function of `retries`. Off CI `retries` is 0
		// above, so a local failure has never produced a trace at all; on CI it
		// traces the SECOND attempt only, which means the failure that does not
		// reproduce — the one actually worth a trace — leaves no record of the
		// attempt that failed. `retain-on-failure` traces every attempt and
		// keeps the ones that failed: strictly more informative, and
		// independent of the retry count.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},

	projects: [
		// Default regression project. Excludes the docs capture spec so
		// PR pipelines don't reshoot screenshots on every push.
		{
			name: 'chromium',
			testIgnore: ['**/docs-screenshots.spec.ts', '**/visual/**'],
			use: { ...devices['Desktop Chrome'] },
		},
		// Documentation capture project (ADR-030 / journeydoc). Opt-in:
		//   npx playwright test --project docs-capture
		// Output lands in `docs/static/screenshots/tutorials/{user,admin}/`.
		{
			name: 'docs-capture',
			testMatch: /docs-screenshots\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1280, height: 800 },
			},
			timeout: 90_000,
		},
		// Visual-regression project (GAP-5). Opt-in / non-gating — set
		// PLAYWRIGHT_VISUAL=1 to include it (see RUN_VISUAL above):
		//   PLAYWRIGHT_VISUAL=1 npx playwright test --project visual
		//   PLAYWRIGHT_VISUAL=1 npx playwright test --project visual --update-snapshots
		// Fixed viewport + authenticated session => deterministic shots.
		// Baselines live in tests/e2e/visual/*-snapshots/ and ARE committed.
		// PLATFORM CAVEAT: PNG baselines are host-font/GPU specific, so a CI
		// Linux runner will not byte-match a dev-container baseline; the visual
		// project must regenerate its baselines in-CI before it can gate.
		...(RUN_VISUAL
			? [{
				name: 'visual',
				testMatch: /visual\/.*\.visual\.spec\.ts$/,
				use: {
					...devices['Desktop Chrome'],
					viewport: { width: 1280, height: 800 },
					storageState: 'tests/e2e/.auth/admin.json',
				},
				timeout: 90_000,
			}]
			: []),
	],
})
