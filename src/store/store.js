import { createObjectStore } from '@conduction/nextcloud-vue'
import { useSettingsStore } from './modules/settings.js'

/**
 * Create the canonical OpenRegister object store for petstore's primary entity.
 *
 * `createObjectStore` from @conduction/nextcloud-vue handles CSRF headers,
 * pagination, single-flight de-duplication, and consistent error surfacing.
 * Replace 'petstore' / 'pet' with your app's register and schema slug.
 *
 * This pointed at schema `example` — a leftover from the app-template scaffold
 * that does NOT exist in the `petstore` register (its schemas are `pet`,
 * `category` and `order`, see lib/Settings/petstore_register.json). Nothing
 * imports this module today, so the wrong slug never surfaced; the first
 * consumer would have got a 404 from OpenRegister.
 *
 * @spec openspec/specs/frontend-data-stores/spec.md#REQ-STORE-001
 */
export const useObjectStore = createObjectStore('pet', {
	register: 'petstore',
	schema: 'pet',
})

/**
 * Boot helper: prime settings store on app startup.
 *
 * @spec openspec/specs/frontend-data-stores/spec.md#REQ-STORE-005
 * @return {Promise<{settingsStore: object, objectStore: object}>} Store handles.
 */
export async function initializeStores() {
	const settingsStore = useSettingsStore()
	const objectStore = useObjectStore()

	await settingsStore.fetchSettings()

	return { settingsStore, objectStore }
}

export { useSettingsStore }
