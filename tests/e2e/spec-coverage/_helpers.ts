/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Shared helpers for the Gate-19 behavioural spec-coverage suite (petstore).
 *
 * `attachConsoleGuard` records genuine app-level console errors and 5xx
 * responses so individual specs can assert the page rendered cleanly. It
 * deliberately ignores Nextcloud-environment noise that is unrelated to
 * petstore and present fleet-wide on this dev container:
 *   - user_status / heartbeat OCS endpoints (NC core, returning 500 here)
 *   - the bare URL-less "Failed to load resource" console echo the browser
 *     emits for every non-2xx response (the attributable URL-bearing form
 *     is captured separately into `server5xx`)
 *   - favicon
 *
 * FIXED BOOTSTRAP BUG (historical): the petstore Vue app used to CRASH at
 * module-eval time inside the `petstore-shared-nc-vue` chunk with
 *   TypeError: getGettextBuilder(...).detectLanguage is not a function
 * because `@nextcloud/vue@8.39.0`'s gettext init calls `detectLanguage()`,
 * while petstore pinned `@nextcloud/l10n` to ^2.0.1 (resolving 2.2.0, which
 * removed `detectLanguage`). The fix pinned `@nextcloud/l10n` to ^3.4.1 — the
 * version `@nextcloud/vue@8.39.0` itself declares (`^3.4.1`) and which still
 * provides `detectLanguage`. The app now mounts into `#content-vue` on every
 * route. The `bootstrapCrash` bucket below is kept as a defensive sentinel:
 * any regression of this signature is surfaced separately from ordinary
 * console errors.
 */

import { type Page, expect } from '@playwright/test'

export const APP = '/apps/petstore'

const IGNORE = [
	'user_status',
	'/heartbeat',
	'Failed to load user status',
	'favicon',
	'Failed to load resource',
	// The pet-detail deep-link spec intentionally navigates to the
	// synthetic id `demo-id-1`, which does not exist in the OpenRegister
	// `pet` schema. The detail view then surfaces the expected
	// object-not-found ("Error fetching …/demo-id-1") — a 404, not a 5xx,
	// and exactly the behaviour the route should exhibit for a missing id.
	// (Legacy template-scaffold ids kept for back-compat.)
	'Error fetching petstore-pet/demo-id-1',
	'Error fetching pet/demo-id-1',
	'Error fetching app-template-example/demo-id-1',
	'Error fetching example/demo-id-1',
]

/**
 * URL fragments for 5xx responses that are OpenRegister optional-integration
 * adapters (Talk, OpenProject, Collectives, Maps, Analytics, …). The detail
 * view's sidebar probes these per-object sub-resources; in this dev container
 * those backend apps are not installed, so OpenRegister answers 501 Not
 * Implemented / 503 Service Unavailable. They are environment gaps in
 * OpenRegister's integration surface, not petstore 5xx, and are present
 * fleet-wide — ignore them while still catching any genuine petstore 5xx.
 */
const IGNORE_5XX = [
	'/talk',
	'/integrations/',
	'/collectives',
	'/maps',
	'/analytics',
]

/** Signature of the known petstore bootstrap crash (dependency version skew). */
export const BOOTSTRAP_CRASH_SIGNATURE = 'detectLanguage is not a function'

export interface ConsoleGuard {
	errors: string[]
	server5xx: string[]
	bootstrapCrash: string[]
}

export function attachConsoleGuard(page: Page): ConsoleGuard {
	const guard: ConsoleGuard = { errors: [], server5xx: [], bootstrapCrash: [] }
	const record = (text: string) => {
		if (text.includes(BOOTSTRAP_CRASH_SIGNATURE)) {
			guard.bootstrapCrash.push(text.slice(0, 300))
			return
		}
		if (IGNORE.some((s) => text.includes(s))) return
		guard.errors.push(text.slice(0, 300))
	}
	page.on('console', (m) => {
		if (m.type() !== 'error') return
		record(m.text())
	})
	page.on('pageerror', (e) => record(`pageerror: ${String(e)}`))
	page.on('response', (r) => {
		if (r.status() < 500) return
		const url = r.url()
		if (IGNORE.some((s) => url.includes(s))) return
		if (IGNORE_5XX.some((s) => url.includes(s))) return
		guard.server5xx.push(`${r.status()} ${url}`)
	})
	return guard
}

export async function dismissOverlays(page: Page): Promise<void> {
	// Nextcloud's first-run wizard is an OPAQUE modal mask
	// (`.modal-mask--opaque`) that intercepts every pointer event on the page.
	// Escape alone did not close it on NC 34 — every in-app nav click then
	// retried for the full 30 s test budget and the failure looked like a
	// petstore routing bug ("subtree intercepts pointer events"). Click its own
	// close control first and only fall back to Escape.
	const wizard = page.locator('#firstrunwizard')
	if (await wizard.isVisible().catch(() => false)) {
		const close = wizard.getByRole('button', { name: /close/i }).first()
		if (await close.isVisible().catch(() => false)) {
			await close.click({ timeout: 4000 }).catch(() => {})
		}
		if (await wizard.isVisible().catch(() => false)) {
			await page.keyboard.press('Escape').catch(() => {})
		}
		await wizard.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {})
	}
	// The petstore "Support Petstore" promo dialog opens over the app content
	// and intercepts pointer/innerText calls. Close it if present so content
	// assertions can reach the underlying app surface.
	const support = page.getByRole('dialog', { name: /Support Petstore/i })
	if (await support.isVisible().catch(() => false)) {
		await support.getByRole('button', { name: /^Close$/ }).click().catch(async () => {
			await page.keyboard.press('Escape').catch(() => {})
		})
		await support.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
	}
}

/**
 * Per-page cache of the app's REAL history-mode router base.
 *
 * WHY THIS EXISTS — the deep-link trap that made 9 specs fail and 2 pass for
 * the wrong reason.
 *
 * Nextcloud serves this app under two different canonical path forms, and
 * which one is canonical depends on whether mod_rewrite is available:
 *
 *   - docker dev (Apache, mod_rewrite ON):  /apps/petstore/...
 *   - shared CI  (`php -S`, no rewrite):    /index.php/apps/petstore/...
 *
 * `generateUrl()` follows `OC.config.modRewriteWorking`, so on CI every URL
 * the app itself emits — and therefore the vue-router history base — carries
 * the `/index.php` prefix. Hard-navigating to the PRETTY form there produces a
 * failure that looks like nothing of the sort:
 *
 *   1. `GET /apps/petstore/examples` returns **200 text/html, no redirect** —
 *      the SPA catch-all route in appinfo/routes.php serves it happily.
 *   2. The bundle boots with router base `/index.php/apps/petstore`, which is
 *      NOT a prefix of `location.pathname`, so vue-router resolves no route.
 *   3. The catch-all sends it to `/`, and the URL is rewritten to
 *      `/index.php/apps/petstore/` — the DASHBOARD.
 *
 * Every downstream assertion then reports "element(s) not found" while the
 * server, the bundle and the data layer are all healthy. Worse, two specs
 * PASSED this way: the dashboard also carries an object-table widget, so
 * `#content-vue table` was visible on the page the test had been bounced onto
 * and the Examples assertions were satisfied without Examples ever loading.
 *
 * Resolving the base from the running page (rather than hardcoding either
 * form) makes the suite correct under both deployments. The first navigation
 * per page pays one extra load; the base is cached for the rest of the test.
 */
const APP_BASE = new WeakMap<Page, string>()

/**
 * Resolve the app's actual router base by loading the app root once and
 * reading back the path Nextcloud + vue-router settled on.
 *
 * @param page - the page to resolve the base for
 * @returns the base path, e.g. `/index.php/apps/petstore` or `/apps/petstore`
 */
async function resolveAppBase(page: Page): Promise<string> {
	const cached = APP_BASE.get(page)
	if (cached) return cached
	await page.goto(APP, { waitUntil: 'domcontentloaded' }).catch(() => {})
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
	const base = await page.evaluate(() => {
		const m = window.location.pathname.match(/^(.*\/apps\/petstore)(\/|$)/)
		return m ? m[1] : '/apps/petstore'
	})
	APP_BASE.set(page, base)
	return base
}

/**
 * Direct-navigate to an app route as a REAL history-mode deep link — a full
 * document load at the deep URL, using whichever base this deployment makes
 * canonical (see APP_BASE above).
 *
 * @param page  - the page to navigate
 * @param route - route below the app base, e.g. `examples`; empty for the root
 */
export async function go(page: Page, route = ''): Promise<void> {
	const base = await resolveAppBase(page)
	const url = route ? `${base}/${route}` : `${base}/`
	await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
	// `networkidle` is best-effort only: the example-detail route fires a burst
	// of (legitimately 404-ing, for non-existent demo ids) object-fetch XHRs
	// that may never let the network fully settle. Bound the wait so it can
	// never consume the whole test budget and close the page mid-navigation.
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
	await dismissOverlays(page)
	await page.waitForTimeout(800)
}

/**
 * The petstore Vue app mounts into Nextcloud's `#content-vue` SPA root (class
 * `content app-petstore`), NOT `#content` (which does not exist for this app).
 * Scope every in-app assertion to this root so we never accidentally hit the
 * global Nextcloud header app-menu (NAV-TRAP).
 */
export const APP_ROOT = '#content-vue'

/**
 * Click a left-hand IN-APP navigation entry by its visible label, scoped to
 * the petstore app navigation region. The in-app nav is rendered by the
 * manifest shell inside `#content-vue` once the Vue app mounts.
 */
export async function navClick(page: Page, label: string): Promise<void> {
	await dismissOverlays(page)
	const link = page
		.locator(`${APP_ROOT} nav a:has-text("${label}"), ${APP_ROOT} .app-navigation a:has-text("${label}")`)
		.first()
	await link.click()
	await page.waitForLoadState('networkidle').catch(() => {})
	await dismissOverlays(page)
	await page.waitForTimeout(800)
}

/**
 * Assert the petstore page is reachable and the Nextcloud chrome rendered,
 * and that no NEW (non-environment, non-bootstrap) petstore console error or
 * 5xx occurred. This is the data-independent baseline every page spec shares.
 */
export async function assertCleanChrome(page: Page, guard: ConsoleGuard): Promise<void> {
	await expect(page).toHaveURL(/\/apps\/petstore/)
	const header = page.locator('#header, header.header').first()
	await expect(header).toBeVisible()
	expect(guard.errors, `unexpected petstore console errors: ${guard.errors.join(' | ')}`).toEqual([])
	expect(guard.server5xx, `unexpected petstore 5xx: ${guard.server5xx.join(' | ')}`).toEqual([])
	expect(
		guard.bootstrapCrash,
		`petstore bootstrap crash regressed (${BOOTSTRAP_CRASH_SIGNATURE}): ${guard.bootstrapCrash.join(' | ')}`,
	).toEqual([])
}

/**
 * True once the petstore Vue app has actually mounted content into the
 * `#content-vue` SPA root. A mounted manifest shell renders an in-app
 * navigation (with the Dashboard/Examples route links) plus a content body.
 */
export async function appMounted(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const c = document.querySelector('#content-vue')
		if (!c) return false
		const hasShell = !!c.querySelector('nav, .app-navigation, .app-content, main')
		const hasRouteLink = !!c.querySelector('a[href*="/apps/petstore/"]')
		return hasShell && hasRouteLink
	})
}
