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

const BASE = (register: string, schema: string) =>
	`/index.php/apps/openregister/api/objects/${register}/${schema}`

/** A short, collision-resistant id for this test run. */
export function makeRunId(): string {
	return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface PetInput {
	name: string
	category?: string
	status?: string
	price?: number
	notes?: string
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
