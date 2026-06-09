/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Gate-19 behavioural spec-coverage — Settings page.
 *
 * Covers UI-observable scenarios from openspec/specs/settings-management/spec.md.
 * The manifest declares a `Settings` page of type `settings` at `/settings`
 * with a `version-info` widget ("Version Information" section).
 *
 * The historical bootstrap crash (l10n detectLanguage version skew) is fixed,
 * so the version-info content assertion runs for real against `#content-vue`.
 */

// @e2e openspec/specs/settings-management/spec.md

import { test, expect } from '@playwright/test'
import {
	go, attachConsoleGuard, assertCleanChrome, appMounted, APP_ROOT,
} from './_helpers'

test.describe('settings — reachable & clean', () => {
	test('settings route loads cleanly (history-mode deep link)', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page, 'settings')
		await expect(page).toHaveURL(/\/apps\/petstore\/settings/)
		await assertCleanChrome(page, guard)
	})
})

test.describe('settings — in-app content', () => {
	test('renders the Version Information settings section', async ({ page }) => {
		// @e2e openspec/specs/settings-management/spec.md
		await go(page, 'settings')
		expect(await appMounted(page)).toBe(true)
		await expect(
			page.locator(APP_ROOT).getByText(/Version Information/i).first(),
		).toBeVisible()
	})
})
