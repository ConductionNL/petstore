/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Seeded-fixture helper for the DEEP, data-dependent petstore e2e layer.
 *
 * The petstore app is the canonical Conduction sample app. Its real data
 * domain lives in the OpenRegister register slug `petstore` (id 212) with
 * schemas `pet`, `category` and `order` (see lib/Settings/petstore_register.json).
 * The primary entity is `pet`.
 *
 * This helper drives the REAL OpenRegister object REST API — the same API
 * the app's backend and the manifest-shell widgets are meant to consume —
 * to create and tear down fixtures. It uses only verbs that exist on that
 * API (probed live 2026-06-10):
 *
 *   - CREATE  POST   /apps/openregister/api/objects/{register}/{schema}
 *   - READ    GET    /apps/openregister/api/objects/{register}/{schema}/{id}
 *   - SEARCH  GET    /apps/openregister/api/objects/{register}/{schema}?_search=
 *   - UPDATE  PUT    /apps/openregister/api/objects/{register}/{schema}/{id}
 *   - DELETE  DELETE /apps/openregister/api/objects/{register}/{schema}/{id}
 *
 * It does NOT invent OpenRegister methods (no createFromArray / deleteFromId /
 * findObject — those do not exist; the canonical verbs are
 * find/findAll/searchObjects/saveObject/createObject/updateObject/deleteObject
 * on the service, exposed over REST as the routes above).
 *
 * Every fixture name carries a unique `e2e-<runId>` prefix so a run only ever
 * touches its own rows; `cleanupRun()` (call from afterAll) deletes everything
 * with that prefix, leaving the shared register clean.
 */

import { type APIRequestContext, expect } from '@playwright/test'

/** Real OpenRegister register slug + schema slug for the primary entity. */
export const REGISTER = 'petstore'
export const SCHEMA_PET = 'pet'
/**
 * `pet.category` is a TYPED RELATION, not free text.
 *
 * lib/Settings/petstore_register.json declares it
 * `{ type: 'string', format: 'uuid', $ref: 'category' }` — ADR-062 rule 7
 * ("relations are typed $ref + format:uuid fields, never free-text"). Every
 * fixture in this file used to post the literal string `'Dogs'`, which
 * OpenRegister rejects with
 *   400 Property 'category' should match format 'uuid' but 'Dogs' does not
 * so the entire data-layer suite failed on any instance whose register matched
 * the shipped schema. Fixtures now create a real `category` object and pass its
 * uuid.
 */
export const SCHEMA_CATEGORY = 'category'

const BASE = (register: string, schema: string) =>
	`/index.php/apps/openregister/api/objects/${register}/${schema}`

/** A short, collision-resistant id for this test run. */
export function makeRunId(): string {
	return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface PetInput {
	name: string
	/** UUID of a `category` object — NOT a display name. See SCHEMA_CATEGORY. */
	category?: string
	status?: string
	price?: number
	notes?: string
}

export interface CategoryObject {
	id: string
	name: string
	[k: string]: unknown
}

export interface PetObject {
	id: string
	name: string
	category?: string
	status?: string
	price?: number
	notes?: string
	[k: string]: unknown
}

const headers = { 'OCS-APIRequest': 'true', 'Content-Type': 'application/json' }

/**
 * CREATE a `category` object and return it (its `id` is the uuid every
 * `pet.category` must carry).
 *
 * @param api  Authenticated request context.
 * @param name Display name for the category.
 * @return The persisted category, including its uuid in `id`.
 */
export async function createCategory(api: APIRequestContext, name: string): Promise<CategoryObject> {
	const res = await api.post(BASE(REGISTER, SCHEMA_CATEGORY), {
		headers,
		data: { name, description: 'e2e fixture category' },
	})
	expect(res.ok(), `createCategory failed: ${res.status()} ${await res.text()}`).toBeTruthy()
	const body = await res.json()
	const id = body.id ?? body['@self']?.id
	expect(id, 'created category has no id').toBeTruthy()
	return { ...body, id } as CategoryObject
}

/** DELETE a `category` object. Tolerates an already-gone (404) row. */
export async function deleteCategory(api: APIRequestContext, id: string): Promise<void> {
	const res = await api.delete(`${BASE(REGISTER, SCHEMA_CATEGORY)}/${id}`, { headers })
	expect([204, 200, 404]).toContain(res.status())
}

/** CREATE — POST a pet, return the persisted object (incl. its OpenRegister id). */
export async function createPet(api: APIRequestContext, input: PetInput): Promise<PetObject> {
	const res = await api.post(BASE(REGISTER, SCHEMA_PET), { headers, data: input })
	expect(res.ok(), `createPet failed: ${res.status()} ${await res.text()}`).toBeTruthy()
	const body = await res.json()
	const id = body.id ?? body['@self']?.id
	expect(id, 'created pet has no id').toBeTruthy()
	return { ...body, id } as PetObject
}

/** READ single — GET /{id}. Returns null on 404. */
export async function getPet(api: APIRequestContext, id: string): Promise<PetObject | null> {
	const res = await api.get(`${BASE(REGISTER, SCHEMA_PET)}/${id}`, { headers })
	if (res.status() === 404) return null
	expect(res.ok(), `getPet failed: ${res.status()}`).toBeTruthy()
	const body = await res.json()
	return { ...body, id: body.id ?? body['@self']?.id } as PetObject
}

/** SEARCH — GET ?_search=. Returns the result list (objects). */
export async function searchPets(api: APIRequestContext, term: string): Promise<PetObject[]> {
	const res = await api.get(`${BASE(REGISTER, SCHEMA_PET)}?_search=${encodeURIComponent(term)}`, { headers })
	expect(res.ok(), `searchPets failed: ${res.status()}`).toBeTruthy()
	const body = await res.json()
	return (body.results ?? []) as PetObject[]
}

/** UPDATE — PUT /{id} with the full object. Returns the persisted result. */
export async function updatePet(api: APIRequestContext, id: string, input: PetInput): Promise<PetObject> {
	const res = await api.put(`${BASE(REGISTER, SCHEMA_PET)}/${id}`, { headers, data: input })
	expect(res.ok(), `updatePet failed: ${res.status()} ${await res.text()}`).toBeTruthy()
	const body = await res.json()
	return { ...body, id: body.id ?? body['@self']?.id } as PetObject
}

/** DELETE — DELETE /{id}. Tolerates an already-gone (404) row. */
export async function deletePet(api: APIRequestContext, id: string): Promise<void> {
	const res = await api.delete(`${BASE(REGISTER, SCHEMA_PET)}/${id}`, { headers })
	expect([204, 200, 404]).toContain(res.status())
}

/**
 * Tear down every pet whose name starts with the given run prefix. Safe to
 * call from afterAll even if individual creates failed.
 */
export async function cleanupRun(api: APIRequestContext, runId: string): Promise<number> {
	const rows = await searchPets(api, runId)
	let removed = 0
	for (const row of rows) {
		if (typeof row.name === 'string' && row.name.startsWith(runId)) {
			await deletePet(api, row.id)
			removed++
		}
	}
	return removed
}
