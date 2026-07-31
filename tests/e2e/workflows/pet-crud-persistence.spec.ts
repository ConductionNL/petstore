/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * DEEP, data-dependent CRUD-with-persistence layer for petstore (the
 * canonical Conduction sample app). Primary entity: `pet` in OpenRegister
 * register `petstore`.
 *
 * This suite has two parts:
 *
 *  A. DATA-LAYER CRUD ROUND-TRIP (real, green) — proves the sample app's
 *     data actually persists end-to-end through the OpenRegister object API
 *     the app is built on: create -> read-back -> search -> update (persist)
 *     -> delete (gone). This is the canonical "the sample CRUD works" proof.
 *     A unique `e2e-<runId>` prefix isolates the run; afterAll cleans up.
 *
 *  B. UI MANIFEST-SHELL CRUD (now GREEN — bug fixed) — drives the petstore
 *     Examples page that the manifest shell renders and checks whether the UI
 *     can perform CRUD against real data. Live probing (2026-06-10) found the
 *     shipped manifest was the UNMODIFIED template scaffold: its
 *     Examples/detail pages targeted register `app-template` / schema
 *     `example`, which DOES NOT EXIST in OpenRegister. FIXED (2026-06-10,
 *     wave-3): src/manifest.json now points the index + detail (+ dashboard
 *     stats, settings endpoint, app naming) at the real petstore domain —
 *     register `petstore`, schema `pet` (plus category/order pages). The
 *     object-table now fetches and renders real seeded petstore rows, and
 *     CnIndexPage's built-in Add affordance + form dialog let the create FORM
 *     commit a new pet end-to-end.
 *
 * @e2e openspec/specs/item-management/spec.md
 */

import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import * as path from 'path'
import {
	makeRunId, createPet, getPet, searchPets, updatePet, deletePet, cleanupRun,
	createCategory, deleteCategory, makeShortLabel,
} from './_fixtures'
import {
	go, attachConsoleGuard, dismissOverlays, appMounted, APP_ROOT,
} from '../spec-coverage/_helpers'
import { BASE_URL } from '../_base-url'

const STORAGE_STATE = path.resolve(__dirname, '../.auth/admin.json')

// ---------------------------------------------------------------------------
// Part A — data-layer CRUD round-trip (real persistence proof)
// ---------------------------------------------------------------------------

test.describe('petstore pet — CRUD persistence (data layer)', () => {
	const runId = makeRunId()
	let api: APIRequestContext
	/** UUID of this run's own `category` object — `pet.category` is a typed relation. */
	let categoryId: string

	test.beforeAll(async () => {
		api = await pwRequest.newContext({
			baseURL: BASE_URL,
			storageState: STORAGE_STATE,
		})
		const category = await createCategory(api, `${runId}-dogs`)
		categoryId = category.id
	})

	test.afterAll(async () => {
		const removed = await cleanupRun(api, runId)
		// best-effort log; not an assertion (the per-test deletes already ran)
		console.log(`[cleanup] removed ${removed} leftover ${runId}* pet(s)`) // eslint-disable-line no-console
		if (categoryId) await deleteCategory(api, categoryId)
		await api.dispose()
	})

	test('create persists and is readable back by id and by search', async () => {
		const name = `${runId}-rex`
		const created = await createPet(api, {
			name, category: categoryId, status: 'available', price: 42, notes: 'good boy',
		})
		expect(created.id).toBeTruthy()
		expect(created.name).toBe(name)
		expect(created.status).toBe('available')

		// read-back by id — must be the SAME persisted values
		const fetched = await getPet(api, created.id)
		expect(fetched, 'created pet not found by id after create').not.toBeNull()
		expect(fetched!.name).toBe(name)
		// the RELATION persisted as the category uuid, not as a display string
		expect(fetched!.category).toBe(categoryId)
		expect(fetched!.price).toBe(42)

		// findable via search (the index/object-table query path)
		const hits = await searchPets(api, runId)
		expect(hits.some((p) => p.id === created.id), 'created pet not in search results').toBe(true)

		await deletePet(api, created.id)
	})

	test('update persists the changed fields', async () => {
		const created = await createPet(api, { name: `${runId}-milo`, category: categoryId, status: 'available' })

		const editedName = `${runId}-milo-edited`
		await updatePet(api, created.id, { name: editedName, category: categoryId, status: 'sold' })

		// re-fetch from the store: the edit must have PERSISTED, not just echoed
		const after = await getPet(api, created.id)
		expect(after, 'pet vanished after update').not.toBeNull()
		expect(after!.name).toBe(editedName)
		expect(after!.status).toBe('sold')

		await deletePet(api, created.id)
	})

	test('delete removes the object (gone on read-back)', async () => {
		const created = await createPet(api, { name: `${runId}-buddy`, category: categoryId, status: 'pending' })
		expect(await getPet(api, created.id)).not.toBeNull()

		await deletePet(api, created.id)

		// gone: read-back returns null (404) and it leaves search results
		expect(await getPet(api, created.id), 'pet still present after delete').toBeNull()
		const hits = await searchPets(api, created.name)
		expect(hits.some((p) => p.id === created.id), 'deleted pet still in search').toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Part B — UI manifest-shell CRUD (documents the template-scaffold bug)
// ---------------------------------------------------------------------------

test.describe('petstore Examples — UI manifest-shell surface', () => {
	// The object-table renders an EMPTY-STATE, not an empty <table>, when the
	// register holds no pets — so asserting `table` is visible is a
	// data-dependent assertion and it failed on every clean instance. Seed a
	// pet first, then assert the table really is the surface being rendered.
	test('Examples index mounts and renders an object-table surface', async ({ page }) => {
		const guard = attachConsoleGuard(page)
		const runId = makeRunId()
		const api = await pwRequest.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE })
		const category = await createCategory(api, `${runId}-cats`)
		const created = await createPet(api, {
			name: `${runId}-surface`, category: category.id, status: 'available',
		})
		try {
			await go(page, 'examples')
			await dismissOverlays(page)
			expect(await appMounted(page)).toBe(true)
			await expect(page.locator(`${APP_ROOT} table`).first()).toBeVisible()
			expect(guard.bootstrapCrash, 'bootstrap crash regressed').toEqual([])
		} finally {
			await deletePet(api, created.id)
			await deleteCategory(api, category.id)
			await api.dispose()
		}
	})

	// FIXED (2026-06-10, wave-3): the manifest Examples/detail pages now target
	// register `petstore` / schema `pet` (was the template-scaffold
	// `app-template`/`example`, which does not exist in OpenRegister). The
	// object-table now fetches and renders real seeded petstore data.
	test('seeded pet appears as a row in the Examples object-table', async ({ page }) => {
		const runId = makeRunId()
		const api = await pwRequest.newContext({
			baseURL: BASE_URL,
			storageState: STORAGE_STATE,
		})
		const category = await createCategory(api, `${runId}-dogs`)
		const created = await createPet(api, {
			name: `${runId}-table-rex`, category: category.id, status: 'available',
		})
		try {
			await go(page, 'examples')
			await dismissOverlays(page)
			// EXPECTED once manifest -> petstore/pet: the seeded pet renders as a
			// real table row (NOT the empty-state).
			const root = page.locator(APP_ROOT)
			await expect(root.locator('table')).not.toContainText('No items found')
			await expect(root.locator(`table tbody tr:has-text("${created.name}")`)).toBeVisible()
		} finally {
			await deletePet(api, created.id)
			await deleteCategory(api, category.id)
			await api.dispose()
		}
	})

	// CROSS-CUTTING FORM-SUBMISSION CHECK.
	// FIXED (2026-06-10, wave-3): with the manifest pointed at register
	// `petstore`/`pet`, CnIndexPage renders its built-in Add affordance
	// (showAdd defaults true) plus the built-in form dialog (showFormDialog
	// defaults true). The nc-vue form-submit fix has landed, so the create
	// form now commits a new pet that shows up as a real persisted row.
	test('create FORM in the UI submits and persists a new pet', async ({ page }) => {
		const runId = makeRunId()
		const api = await pwRequest.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE })
		// `category` is a REQUIRED typed relation, so the form's Category control
		// is a relation combobox that can only offer categories that exist. The
		// old spec typed 'Dogs' into a textbox that has never been rendered for
		// this property, and failed on every instance.
		//
		// The label must be SHORT — see makeShortLabel() for the wrapped-option
		// trap that a runId-derived name walks straight into.
		const categoryName = makeShortLabel()
		const category = await createCategory(api, categoryName)

		try {
			await go(page, 'examples')
			await dismissOverlays(page)
			const root = page.locator(APP_ROOT)

			const addBtn = root.locator(
				'button:has-text("Add"), button:has-text("Create"), '
				+ '[aria-label*="Add" i], [aria-label*="Create" i], [aria-label*="New" i]',
			).first()
			await expect(addBtn, 'no create affordance on the Examples index').toBeVisible()
			await addBtn.click()

			// CnFormDialog renders schema fields via NcTextField / NcSelect, so
			// the controls are accessible textboxes/comboboxes labelled by the
			// schema property (required ones carry a trailing " *"). Fill the
			// three required pet fields (name, category, status) so the Create
			// button enables, then submit.
			const name = `${runId}-form-pet`
			const dialog = page.getByRole('dialog', { name: /create pet/i })
			await dialog.getByRole('textbox', { name: /^name/i }).fill(name)

			// category is a RELATION combobox listing existing `category` objects.
			await dialog.getByRole('combobox', { name: /^category/i }).click()
			await page.getByRole('option', { name: categoryName, exact: true }).first().click()

			// status is an NcSelect (enum available/pending/sold) — open and pick.
			await dialog.getByRole('combobox', { name: /^status/i }).click()
			await page.getByRole('option', { name: 'available', exact: true }).first().click()

			const createBtn = dialog.getByRole('button', { name: /^create$/i })
			await expect(createBtn).toBeEnabled()
			await createBtn.click()

			// The committed pet must show up as a real persisted row.
			await expect(root.locator(`table tbody tr:has-text("${name}")`)).toBeVisible()
		} finally {
			// cleanup whatever the form created — must run even when the test
			// fails before the form is submitted, or every failed run leaks a
			// category into the register.
			const hits = await searchPets(api, runId)
			for (const p of hits) await deletePet(api, p.id)
			await deleteCategory(api, category.id)
			await api.dispose()
		}
	})
})
