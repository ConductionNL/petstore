/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Gate-19 behavioural spec-coverage — Features & roadmap page.
 *
 * Covers the `FeaturesRoadmap` page of type `roadmap` at `/features-roadmap`
 * (manifest src/manifest.json). It is a footer-section menu entry that
 * renders the app's features/roadmap from its documentation source.
 *
 * BLOCKER: the petstore Vue app does not mount (see _helpers.ts
 * BOOTSTRAP_CRASH_SIGNATURE). The roadmap content assertion is test.fixme
 * until the bootstrap crash is fixed.
 */

// @e2e openspec/specs/deep-linking/spec.md

import { test, expect } from '@playwright/test'
import {
	go, attachConsoleGuard, assertCleanChrome, appMounted,
} from './_helpers'

test.describe('features-roadmap — reachable & clean', () => {
	test('features-roadmap route loads cleanly (history-mode deep link)', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page, 'features-roadmap')
		await expect(page).toHaveURL(/\/apps\/petstore\/features-roadmap/)
		await assertCleanChrome(page, guard)
	})

	test('unknown route redirects into the petstore app (catch-all)', async ({ page }) => {
		// Manifest router has a `path: '*' -> redirect: '/'` catch-all.
		const guard = attachConsoleGuard(page)
		await go(page, 'this-route-does-not-exist')
		await expect(page).toHaveURL(/\/apps\/petstore/)
		await assertCleanChrome(page, guard)
	})
})

test.describe('features-roadmap — in-app content (blocked by bootstrap crash)', () => {
	test.fixme('renders the Features & roadmap surface', async ({ page }) => {
		// @e2e openspec/specs/deep-linking/spec.md
		await go(page, 'features-roadmap')
		expect(await appMounted(page)).toBe(true)
		await expect(
			page.locator('#content').getByText(/feature|roadmap/i).first(),
		).toBeVisible()
	})
})
