// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.
//
// Webpack entry-point for the Nextcloud admin app-settings panel
// (Admin > Administration settings > App Template). This is DISTINCT
// from the manifest's `type: "settings"` page, which lives inside
// the SPA at `/settings` and is rendered by CnSettingsPage.
//
// Nextcloud's admin app-settings is a tiny standalone Vue mount into
// `#petstore-settings` (see `templates/settings/admin.php`). Most
// new apps drive the entire settings story from the manifest's
// CnSettingsPage with `version-info` / `register-mapping` widgets and
// can simplify or remove this entry-point. It stays in the template
// because the Nextcloud admin section is the canonical place for
// "before the app boots" config (e.g. an app's OR register binding).

// MUST be first: sets __webpack_public_path__ before any async chunk loads.
import './publicPath.js'
import { createApp, h } from 'vue'
import { translate as t, translatePlural as n, loadTranslations } from '@nextcloud/l10n'
import pinia from './pinia.js'
import AdminRoot from './views/AdminRoot.vue'

let mounted = false

/**
 * Mount the admin panel exactly once. Vue 3 applies mixins and plugins per app
 * INSTANCE, so both must happen after `createApp` — a module-level `Vue.mixin`
 * / `Vue.use` has no Vue 3 equivalent and would silently affect nothing.
 */
function mountAdminRoot() {
	if (mounted === true) {
		return
	}
	mounted = true
	const app = createApp({ render: () => h(AdminRoot) })
	app.mixin({ methods: { t, n } })
	app.use(pinia)
	app.mount('#petstore-settings')
}

// The mount used to sit INSIDE the `loadTranslations` callback. That callback
// never fires when the l10n JSON 404s — which it does on every install that
// only allowlists JS/CSS through Apache and rewrites everything else to
// index.php (main.js documents the same hazard for the SPA entry). The admin
// panel then rendered as an empty div with no error. Mount unconditionally;
// untranslated strings fall back to their English source.
try {
	const result = loadTranslations('petstore', mountAdminRoot)
	if (result && typeof result.then === 'function') {
		result.then(mountAdminRoot, mountAdminRoot)
	} else {
		mountAdminRoot()
	}
} catch {
	mountAdminRoot()
}
