import { defineStore } from 'pinia'
import { generateUrl } from '@nextcloud/router'

export const useSettingsStore = defineStore('settings', {
	state: () => ({
		settings: {},
		loading: false,
		hasOpenRegisters: false,
		isAdmin: false,
	}),

	getters: {
		getSettings: (state) => state.settings,
		getIsAdmin: (state) => state.isAdmin,
	},

	actions: {
		/**
		 * Read the app's settings from the backend `GET /api/settings`.
		 *
		 * @spec openspec/specs/frontend-data-stores/spec.md#REQ-STORE-004
		 * @return {Promise<object|null>} The settings object, or null on failure.
		 */
		async fetchSettings() {
			this.loading = true
			try {
				const response = await fetch(generateUrl('/apps/petstore/api/settings'), {
					headers: { requesttoken: OC.requestToken },
				})
				if (response.ok) {
					const data = await response.json()
					this.settings = data
					this.hasOpenRegisters = !!data?.openregisters
					this.isAdmin = !!data?.isAdmin
					return data
				}
			} catch (error) {
				console.error('Failed to fetch settings:', error)
			} finally {
				this.loading = false
			}
			return null
		},

		/**
		 * Persist a partial settings payload via `POST /api/settings`.
		 *
		 * @spec openspec/specs/frontend-data-stores/spec.md#REQ-STORE-004
		 * @param {object} settings Partial settings payload.
		 * @return {Promise<object|null>} The freshly-read config, or null on failure.
		 */
		async saveSettings(settings) {
			this.loading = true
			try {
				const response = await fetch(generateUrl('/apps/petstore/api/settings'), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						requesttoken: OC.requestToken,
					},
					body: JSON.stringify(settings),
				})
				if (response.ok) {
					const data = await response.json()
					this.settings = data
					return data
				}
			} catch (error) {
				console.error('Failed to save settings:', error)
			} finally {
				this.loading = false
			}
			return null
		},
	},
})
