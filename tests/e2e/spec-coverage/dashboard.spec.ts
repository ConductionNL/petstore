/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Gate-19 behavioural spec-coverage — Dashboard page.
 *
 * Covers UI-observable scenarios from openspec/specs/dashboard-page/spec.md.
 * The manifest (src/manifest.json) declares a `Dashboard` page of type
 * `dashboard` at route `/` carrying built-in `stats-block` KPI widgets
 * (entries[] sources), a built-in `header`, an `object-table`, and the
 * custom chart-by-field widget.
 *
 * The historical `@nextcloud/l10n` detectLanguage version-skew bootstrap crash
 * (which kept the Vue app from mounting on any route) is fixed: petstore now
 * pins `@nextcloud/l10n` to ^3.4.1 to match what `@nextcloud/vue@8.39.0` calls.
 * The content assertions below therefore run for real.
 */

// @e2e openspec/specs/dashboard-page/spec.md

import { test, expect } from '@playwright/test'
import {
	go, attachConsoleGuard, assertCleanChrome, appMounted, APP_ROOT,
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

test.describe('dashboard — in-app content', () => {
	test('renders the petstore in-app navigation (Dashboard + Examples entries)', async ({ page }) => {
		// @e2e openspec/specs/dashboard-page/spec.md
		await go(page)
		expect(await appMounted(page), 'petstore Vue app should mount into #content-vue').toBe(true)
		const nav = page.locator(`${APP_ROOT} nav, ${APP_ROOT} .app-navigation`).first()
		await expect(nav.getByRole('link', { name: 'Dashboard', exact: false })).toBeVisible()
		await expect(nav.getByRole('link', { name: 'Examples', exact: false })).toBeVisible()
	})

	test('mounts the dashboard surface with the in-app content region', async ({ page }) => {
		// @e2e openspec/specs/dashboard-page/spec.md
		// The manifest declares built-in `stats-block` KPI widgets on the
		// dashboard. On this deployment the widget bodies are data-driven (OR
		// register `petstore`) and render empty when unseeded,
		// so we assert the dashboard page mounts its app-content region rather
		// than asserting seed-dependent widget copy. The nav-render assertion
		// above already proves the manifest shell booted.
		await go(page)
		expect(await appMounted(page), 'petstore dashboard should mount into #content-vue').toBe(true)
		await expect(page.locator(`${APP_ROOT} main, ${APP_ROOT} .app-content`).first()).toBeAttached()
	})
})
