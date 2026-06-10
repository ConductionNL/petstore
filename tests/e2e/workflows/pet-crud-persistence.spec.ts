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
	REGISTER, SCHEMA_PET, makeRunId, createPet, getPet, searchPets, updatePet, deletePet, cleanupRun,
} from './_fixtures'
import {
	go, attachConsoleGuard, dismissOverlays, appMounted, APP_ROOT,
} from '../spec-coverage/_helpers'

const STORAGE_STATE = path.resolve(__dirname, '../.auth/admin.json')

// ---------------------------------------------------------------------------
// Part A — data-layer CRUD round-trip (real persistence proof)
// ---------------------------------------------------------------------------

test.describe('petstore pet — CRUD persistence (data layer)', () => {
	const runId = makeRunId()
	let api: APIRequestContext

	test.beforeAll(async () => {
		api = await pwRequest.newContext({
			baseURL: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
			storageState: STORAGE_STATE,
		})
	})

	test.afterAll(async () => {
		const removed = await cleanupRun(api, runId)
		// best-effort log; not an assertion (the per-test deletes already ran)
		console.log(`[cleanup] removed ${removed} leftover ${runId}* pet(s)`) // eslint-disable-line no-console
		await api.dispose()
	})

	test('create persists and is readable back by id and by search', async () => {
		const name = `${runId}-rex`
		const created = await createPet(api, {
			name, category: 'Dogs', status: 'available', price: 42, notes: 'good boy',
		})
		expect(created.id).toBeTruthy()
		expect(created.name).toBe(name)
		expect(created.status).toBe('available')

		// read-back by id — must be the SAME persisted values
		const fetched = await getPet(api, created.id)
		expect(fetched, 'created pet not found by id after create').not.toBeNull()
		expect(fetched!.name).toBe(name)
		expect(fetched!.category).toBe('Dogs')
		expect(fetched!.price).toBe(42)

		// findable via search (the index/object-table query path)
		const hits = await searchPets(api, runId)
		expect(hits.some((p) => p.id === created.id), 'created pet not in search results').toBe(true)

		await deletePet(api, created.id)
	})

	test('update persists the changed fields', async () => {
		const created = await createPet(api, { name: `${runId}-milo`, category: 'Cats', status: 'available' })

		const editedName = `${runId}-milo-edited`
		await updatePet(api, created.id, { name: editedName, category: 'Cats', status: 'sold' })

		// re-fetch from the store: the edit must have PERSISTED, not just echoed
		const after = await getPet(api, created.id)
		expect(after, 'pet vanished after update').not.toBeNull()
		expect(after!.name).toBe(editedName)
		expect(after!.status).toBe('sold')

		await deletePet(api, created.id)
	})

	test('delete removes the object (gone on read-back)', async () => {
		const created = await createPet(api, { name: `${runId}-buddy`, category: 'Fish', status: 'pending' })
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
	test('Examples index mounts and renders an object-table surface', async ({ page }) => {
		// This much is true today: the manifest shell mounts and the index
		// page renders a table (currently the "No items found" empty-state).
		const guard = attachConsoleGuard(page)
		await go(page, 'examples')
		await dismissOverlays(page)
		expect(await appMounted(page)).toBe(true)
		await expect(page.locator(`${APP_ROOT} table`).first()).toBeVisible()
		expect(guard.bootstrapCrash, 'bootstrap crash regressed').toEqual([])
	})

	// FIXED (2026-06-10, wave-3): the manifest Examples/detail pages now target
	// register `petstore` / schema `pet` (was the template-scaffold
	// `app-template`/`example`, which does not exist in OpenRegister). The
	// object-table now fetches and renders real seeded petstore data.
	test('seeded pet appears as a row in the Examples object-table', async ({ page }) => {
		const runId = makeRunId()
		const api = await pwRequest.newContext({
			baseURL: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
			storageState: STORAGE_STATE,
		})
		const created = await createPet(api, { name: `${runId}-table-rex`, category: 'Dogs', status: 'available' })
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
		await go(page, 'examples')
		await dismissOverlays(page)
		const root = page.locator(APP_ROOT)

		// EXPECTED once a create affordance exists: open it, fill, submit.
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
		await dialog.getByRole('textbox', { name: /^category/i }).fill('Dogs')

		// status is an NcSelect (enum available/pending/sold) — open and pick.
		await dialog.getByRole('combobox', { name: /^status/i }).click()
		await page.getByRole('option', { name: 'available', exact: true }).first().click()

		const createBtn = dialog.getByRole('button', { name: /^create$/i })
		await expect(createBtn).toBeEnabled()
		await createBtn.click()

		// The committed pet must show up as a real persisted row.
		await expect(root.locator(`table tbody tr:has-text("${name}")`)).toBeVisible()

		// cleanup whatever the form created
		const api = await pwRequest.newContext({
			baseURL: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
			storageState: STORAGE_STATE,
		})
		const hits = await searchPets(api, runId)
		for (const p of hits) await deletePet(api, p.id)
		await api.dispose()
	})
})
