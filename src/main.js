// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.

// MUST be first: sets __webpack_public_path__ before any async chunk loads.
import './publicPath.js'
import { createApp, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { translate as t, translatePlural as n, loadTranslations } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import {
	CnPageRenderer,
	defaultPageTypes,
	registerIcons,
	registerTranslations,
} from '@conduction/nextcloud-vue'
import pinia from './pinia.js'
import App from './App.vue'
import bundledManifest from './manifest.json'
import customComponents from './customComponents.js'
// v2 five-kind registry — the replacement for customComponents.
// Both props coexist during the v1 → v2 transition.
// Once fully migrated to v2, remove the customComponents import and prop.
import registry from './registry.js'
// Bespoke view-toggle icons that mirror the docudesk reference exactly
// (MDI has no pixel-identical equivalent for the rounded grid / stacked rows).
import TilesGrid from './icons/TilesGrid.vue'
import ListRows from './icons/ListRows.vue'
import appIcons from './icons.js'

// Library CSS — must be explicit import (webpack tree-shakes side-effect imports from aliased packages)
import '@conduction/nextcloud-vue/css/index.css'

// gridstack is a PEER dependency of @conduction/nextcloud-vue that no consumer
// declares, and CnDashboardPage (the manifest's `type: "dashboard"` page) needs
// BOTH halves. Omitting the stylesheet is the silent case: gridstack v12 sizes
// items with `width: var(--gs-column-width)`, so without it every dashboard item
// renders 0 px wide with no console error at all.
import 'gridstack/dist/gridstack.min.css'

// Global (unscoped) app styles
import './assets/app.css'

// Register library-side icon set + lib translations once at bootstrap.
// TilesGrid / ListRows are LOCAL components, not MDI names, so they stay
// listed explicitly; everything else comes from the generated registry.
registerIcons({ ...appIcons, TilesGrid, ListRows })
try {
	registerTranslations()
} catch (e) {
	// Non-fatal — lib translations fall back to English source.
	// eslint-disable-next-line no-console
	console.warn('[petstore] registerTranslations failed; falling back to English', e)
}

// Fire-and-forget translation load. Some Nextcloud installs (including
// standard dev containers) only allow the JS/CSS allowlist through
// Apache and rewrite everything else to index.php — there's no route
// for /custom_apps/<app>/l10n/<locale>.json so the request 404s.
// `loadTranslations` rejects on 404, so wrapping the Vue mount inside
// its callback would silently fail boot when translations can't load.
// Strings just fall back to their English source on miss; boot MUST
// not depend on this resolving.
function tryLoadTranslations() {
	try {
		const result = loadTranslations('petstore', () => {})
		if (result && typeof result.then === 'function') {
			result.then(() => {}, () => {})
		}
	} catch {
		// no-op
	}
}

// Shallow-clone CnPageRenderer because the lib's barrel exports are
// non-extensible / frozen module records. Vue 3 no longer attaches a `_Ctor`
// cache the way `Vue.extend()` did, but the library still exports these maps
// frozen and the renderer resolves them at render time — cloning keeps the
// consumer side mutable without reaching into the lib's internals.
const RoutePageRenderer = { ...CnPageRenderer }

/**
 * Build the vue-router config from the manifest. Each manifest page becomes
 * one route; the route's `name` IS `page.id` (per the lib's manifest contract).
 * Routes whose path declares a `:` parameter receive `props: true` so the
 * built-in detail / index components can read the route param without each
 * consumer wiring it manually.
 *
 * @param {object} manifest The bundled manifest (with `pages[]`).
 * @return {Array<object>} vue-router 4 routes config.
 */
function routesFromManifest(manifest) {
	const routes = manifest.pages.map((page) => ({
		name: page.id,
		path: page.route,
		component: RoutePageRenderer,
		props: page.route.includes(':'),
	}))
	// Catch-all: redirect unknown paths to the first page (the dashboard).
	// vue-router 4 REMOVED the bare `path: '*'` wildcard — it matches nothing
	// and throws no error, so the shell renders with an empty <main> on every
	// unknown path. The v4 spelling is an explicitly named param matcher.
	routes.push({ path: '/:pathMatch(.*)*', redirect: '/' })
	return routes
}

const router = createRouter({
	history: createWebHistory(generateUrl('/apps/petstore')),
	routes: routesFromManifest(bundledManifest),
})

tryLoadTranslations()

// Pass shallow copies of the registry maps to App.vue. The lib exports
// `defaultPageTypes` (and consumers' `customComponents`) as FROZEN module
// objects in some bundle shapes; anything downstream that writes to them
// throws in strict mode. Cloning here yields extensible objects without
// changing the values the lib resolves at render time.
const pageTypesProp = { ...defaultPageTypes }
const customComponentsProp = { ...customComponents }
// Shallow-clone the v2 registry for the same reason as above.
// Once the app fully migrates to v2, the customComponentsProp and
// customComponents prop can be removed.
const registryProp = { ...registry }

const app = createApp({
	render: () => h(App, {
		manifest: bundledManifest,
		customComponents: customComponentsProp,
		pageTypes: pageTypesProp,
		registry: registryProp,
	}),
})

// Vue 3: plugins and global mixins are applied to the APP INSTANCE, never to a
// global `Vue`. `PiniaVuePlugin` does not exist in pinia for Vue 3 — the store
// instance itself is the plugin.
app.mixin({ methods: { t, n } })
app.use(pinia)
app.use(router)

// The host id changed from `#content` to `#petstore-app`. Nextcloud's
// `layout.user.php` already wraps this app's template output in its OWN
// `<div id="content">`, so the old selector was ambiguous — it matched
// Nextcloud's outer wrapper first. Vue 2's `$mount()` replaced whatever it
// matched and got away with it; Vue 3's `mount()` renders INSIDE the match, so
// the ambiguity would have mattered. See templates/index.php.
app.mount('#petstore-app')
