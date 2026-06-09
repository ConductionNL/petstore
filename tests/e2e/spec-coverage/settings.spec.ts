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
 * BLOCKER: the petstore Vue app does not mount (see _helpers.ts
 * BOOTSTRAP_CRASH_SIGNATURE). The version-info content assertion is
 * test.fixme until the bootstrap crash is fixed.
 */

// @e2e openspec/specs/settings-management/spec.md

import { test, expect } from '@playwright/test'
import {
	go, attachConsoleGuard, assertCleanChrome, appMounted,
} from './_helpers'

test.describe('settings — reachable & clean', () => {
	test('settings route loads cleanly (history-mode deep link)', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page, 'settings')
		await expect(page).toHaveURL(/\/apps\/petstore\/settings/)
		await assertCleanChrome(page, guard)
	})
})

test.describe('settings — in-app content (blocked by bootstrap crash)', () => {
	test.fixme('renders the Version Information settings section', async ({ page }) => {
		// @e2e openspec/specs/settings-management/spec.md
		await go(page, 'settings')
		expect(await appMounted(page)).toBe(true)
		await expect(
			page.locator('#content').getByText(/Version Information/i).first(),
		).toBeVisible()
	})
})
