/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Gate-19 behavioural spec-coverage — Examples (index) page.
 *
 * Covers UI-observable scenarios from openspec/specs/item-management/spec.md.
 * The manifest declares an `Examples` page of type `index` at `/examples`
 * with an `object-table` widget over register `app-template` / schema
 * `example`, columns title/status/updatedAt, plus a detail route
 * `/examples/:id`.
 *
 * The historical bootstrap crash (l10n detectLanguage version skew) is fixed,
 * so the in-app content assertions run for real against `#content-vue`.
 */

// @e2e openspec/specs/item-management/spec.md

import { test, expect, request as pwRequest } from '@playwright/test'
import * as path from 'path'
import {
	go, attachConsoleGuard, assertCleanChrome, appMounted, navClick, APP_ROOT,
} from './_helpers'
import { BASE_URL } from '../_base-url'
import {
	makeRunId, createCategory, deleteCategory, createPet, deletePet,
} from '../workflows/_fixtures'

const STORAGE_STATE = path.resolve(__dirname, '../.auth/admin.json')

test.describe('examples — reachable & clean', () => {
	test('examples index route loads cleanly (history-mode deep link)', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page, 'examples')
		// History-mode router keeps the deep-link path rather than collapsing.
		await expect(page).toHaveURL(/\/apps\/petstore\/examples/)
		await assertCleanChrome(page, guard)
	})

	test('example detail deep link (/examples/:id) is reachable without 5xx', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		await go(page, 'examples/demo-id-1')
		await expect(page).toHaveURL(/\/apps\/petstore\/examples\/demo-id-1/)
		await assertCleanChrome(page, guard)
	})
})

test.describe('examples — in-app content', () => {
	test('shows the examples index surface (object-table or empty-state)', async ({ page }) => {
		// @e2e openspec/specs/item-management/spec.md
		await go(page, 'examples')
		expect(await appMounted(page)).toBe(true)
		const content = page.locator(APP_ROOT)
		// Either a populated table OR a clean empty-state — data-independent.
		const hasTable = await content.locator('table').count() > 0
		const hasEmpty = await content.locator('.empty-content, .emptycontent').count() > 0
		expect(hasTable || hasEmpty, 'index should render a table or an empty-state').toBe(true)
	})

	test('renders the object-table rows for the example schema', async ({ page }) => {
		// @e2e openspec/specs/item-management/spec.md
		//
		// This assertion is inherently DATA-DEPENDENT: the object-table renders
		// an empty-state rather than an empty `<table>` when the register holds
		// no pets, so on a clean instance the test failed with
		// "locator('#content-vue table') not found" and looked like an app bug.
		// Seed one pet of our own so the assertion has something to be true of.
		const runId = makeRunId()
		const api = await pwRequest.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE })
		const category = await createCategory(api, `${runId}-cats`)
		const pet = await createPet(api, {
			name: `${runId}-row`, category: category.id, status: 'available',
		})
		try {
			await go(page, 'examples')
			expect(await appMounted(page)).toBe(true)
			// The object-table widget renders a header row plus the example items.
			await expect(page.locator(`${APP_ROOT} table`).first()).toBeVisible()
			await expect(
				page.locator(`${APP_ROOT} table tbody tr:has-text("${pet.name}")`),
			).toBeVisible()
		} finally {
			await deletePet(api, pet.id)
			await deleteCategory(api, category.id)
			await api.dispose()
		}
	})

	test('reaches Examples via the in-app left navigation', async ({ page }) => {
		// @e2e openspec/specs/deep-linking/spec.md
		await go(page)
		await navClick(page, 'Examples')
		await expect(page).toHaveURL(/\/apps\/petstore\/examples/)
		expect(await appMounted(page)).toBe(true)
	})
})
