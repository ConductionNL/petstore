const {
	defineConfig,
} = require('@eslint/config-helpers')

const js = require('@eslint/js')

const {
	FlatCompat,
} = require('@eslint/eslintrc')

// The shared Vue 3 fix layer, shipped INSIDE @conduction/nextcloud-vue so every
// app arms the same rules. It must be spread LAST (see the bottom of this
// file): it arms the whole `vue/no-deprecated-*` family at `error`, raises
// `ecmaVersion` to `latest` so eslint-plugin-import can parse `?.` / `??` /
// spread, installs vue-eslint-parser's OBJECT-form `parserOptions.parser`, and
// turns OFF the two INVERTED Vue-2 rules (`vue/no-v-model-argument`,
// `vue/no-v-for-template-key`) that forbid syntax Vue 3 requires. Do NOT add
// local copies of those two disables — the preset owns them now.
//
// It registers no plugins, so it layers cleanly on top of the `@nextcloud`
// base without a duplicate-plugin error.
const {
	conductionVue3Fixes,
} = require('@conduction/nextcloud-vue/eslint')

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

module.exports = defineConfig([{
	extends: compat.extends('@nextcloud'),

	settings: {
		'import/resolver': {
			alias: {
				map: [
					['@', './src'],
					['@floating-ui/dom-actual', './node_modules/@floating-ui/dom'],
					['@conduction/nextcloud-vue', '../nextcloud-vue/src'],
				],
				extensions: ['.js', '.ts', '.vue', '.json', '.css'],
			},
		},
	},

	rules: {
		// Allow unused i18n functions (t, n) — imported for future translation wiring
		'no-unused-vars': ['error', { varsIgnorePattern: '^(t|n)$', argsIgnorePattern: '^_' }],
		'jsdoc/require-jsdoc': 'off',
		// @spec (gate-16 spec-coverage) and @e2e (gate-19 e2e traceability)
		// are the hydra traceability tags — valid on any method docblock.
		'jsdoc/check-tag-names': ['warn', { definedTags: ['spec', 'e2e'] }],
		'vue/first-attribute-linebreak': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'n/no-missing-import': 'off',
		'import/namespace': 'off', // disable namespace checking to avoid parser requirement
		'import/default': 'off', // disable default import checking to avoid parser requirement
		'import/no-named-as-default': 'off', // disable named-as-default checking to avoid parser requirement
		'import/no-named-as-default-member': 'off', // disable named-as-default-member checking to avoid parser requirement
	},
}, {
	// Node-side CLI tools (build / validate scripts) legitimately use
	// console + process.exit and ship as plain JS (no shebang).
	files: [
		'tests/validate-manifest.js',
		'tests/validate-register.js',
		'tests/validate-json-strict.js',
		'tests/manifest-v2.spec.js',
		'tests/registry.spec.js',
	],
	rules: {
		'no-console': 'off',
		'n/no-process-exit': 'off',
		'n/shebang': 'off',
	},
}, ...conductionVue3Fixes])
