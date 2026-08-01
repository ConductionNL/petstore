/**
 * SPDX-FileCopyrightText: 2026 Conduction / PetStore Contributors
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Vitest configuration for PetStore frontend unit tests.
 *
 * PetStore is the canonical scaffold app, so its Vitest suite doubles as the
 * fleet's reference COMPONENT-TEST harness — it proves a real Vue 3 single-
 * file component can be mounted, rendered and interacted with offline:
 *   • tests/vitest/settingsStore.spec.js — the settings Pinia store
 *     (fetch envelope-unwrap, openregisters/isAdmin flag derivation, the
 *     loading lifecycle + save round-trip). Pure logic, fetch mocked.
 *   • tests/vitest/components/StatusBadge.spec.js — mounts the leaf
 *     cell-renderer and asserts render + the value → CSS-class computed.
 *   • tests/vitest/components/EmailField.spec.js — mounts the form-field
 *     leaf and asserts render + the `input` emit on a DOM input event.
 *
 * The environment is `jsdom` so @vue/test-utils `mount()` + DOM assertions
 * work without a browser. `@vitejs/plugin-vue` compiles the SFCs (the
 * webpack `vue-loader` pipeline is separate). The two demo components depend
 * on no @nextcloud/vue runtime, so no CSS-noop / inline-deps gymnastics are
 * needed — see tests/vitest/README.md for how to extend the harness to
 * components that DO pull in @nextcloud/vue.
 */

const path = require('path')
const vue = require('@vitejs/plugin-vue')

module.exports = {
	plugins: [
		vue.default ? vue.default() : vue(),
	],
	test: {
		environment: 'jsdom',
		globals: false,
		include: ['tests/vitest/**/*.spec.{js,ts}'],
		exclude: ['tests/e2e/**', 'tests/integration/**', 'node_modules/**'],
	},
	resolve: {
		alias: [
			{ find: '@', replacement: path.resolve(__dirname, 'src') },
			{
				find: /^@nextcloud\/router$/,
				replacement: path.resolve(__dirname, 'tests/vitest/stubs/nextcloud-router.js'),
			},
		],
	},
}
