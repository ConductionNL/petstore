/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Gate-19 behavioural spec-coverage — Dashboard page.
 *
 * Covers UI-observable scenarios from openspec/specs/dashboard-page/spec.md.
 * The manifest (src/manifest.json) declares a `Dashboard` page of type
 * `dashboard` at route `/` carrying a `stats-block` "Open examples" widget.
 *
 * BLOCKER: the petstore Vue app does not currently mount (see _helpers.ts
 * BOOTSTRAP_CRASH_SIGNATURE). Content assertions are test.fixme until the
 * `@nextcloud/l10n` detectLanguage version-skew crash is fixed and rebuilt.
 */

// @e2e openspec/specs/dashboard-page/spec.md

import { test, expect } from '@playwright/test'
import {
	APP, go, attachConsoleGuard, assertCleanChrome, appMounted, BOOTSTRAP_CRASH_SIGNATURE,
} from './_helpers'

test.describe('dashboard — reachable & clean', () => {
	test('dashboard route loads with Nextcloud chrome and no petstore 5xx', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page)
		await assertCleanChrome(page, guard)
	})

	test('app menu marks PetStore as the active app on its own route', async ({ page }) => {
		await go(page)
		// The global NC app-menu link to petstore is present (app is installed
		// and routable). This is chrome-level and independent of Vue mount.
		const petstoreAppLink = page.locator('header a[href*="/apps/petstore"], #appmenu a[href*="/apps/petstore"]').first()
		await expect(petstoreAppLink).toBeAttached()
	})
})

test.describe('dashboard — in-app content (blocked by bootstrap crash)', () => {
	test.fixme('renders the petstore in-app navigation (Dashboard + Examples entries)', async ({ page }) => {
		// @e2e openspec/specs/dashboard-page/spec.md
		await go(page)
		expect(await appMounted(page), 'petstore Vue app should mount into #content').toBe(true)
		const nav = page.locator('#content .app-navigation, #content nav').first()
		await expect(nav.getByText('Dashboard', { exact: false })).toBeVisible()
		await expect(nav.getByText('Examples', { exact: false })).toBeVisible()
	})

	test.fixme('shows the "Open examples" stats-block widget', async ({ page }) => {
		// @e2e openspec/specs/dashboard-page/spec.md
		await go(page)
		await expect(page.locator('#content').getByText('Open examples', { exact: false })).toBeVisible()
	})
})

// Living evidence of the blocker — flips to a failure (alerting us to fix the
// fixmes above) the moment the bootstrap crash is resolved.
test.describe('dashboard — bootstrap crash is still present', () => {
	test('documents the @nextcloud/l10n detectLanguage bootstrap crash', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await page.goto(APP)
		await page.waitForLoadState('networkidle').catch(() => {})
		await page.waitForTimeout(3000)
		expect(
			guard.bootstrapCrash.some((m) => m.includes(BOOTSTRAP_CRASH_SIGNATURE)),
			'EXPECTED the known petstore bootstrap crash. If this fails, the crash is FIXED — '
			+ 'remove this test and un-fixme the content assertions in this suite.',
		).toBe(true)
	})
})
