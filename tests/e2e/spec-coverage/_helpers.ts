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
 * IMPORTANT — KNOWN BOOTSTRAP BUG (see BUG-PETSTORE-BOOTSTRAP below):
 * the petstore Vue app currently CRASHES at module-eval time inside the
 * `petstore-shared-nc-vue` chunk with
 *   TypeError: getGettextBuilder(...).detectLanguage is not a function
 * because the bundled @nextcloud/vue / @conduction/nextcloud-vue code calls
 * the pre-2.0 `detectLanguage()` GettextBuilder method, while the resolved
 * `@nextcloud/l10n` is 2.2.0 which removed it. As a result NO in-app UI
 * renders on any route — `#content` stays empty. The `pageerror` carrying
 * this signature is therefore tracked separately as `bootstrapCrash` so the
 * structural tests can prove the bug is still present and the content tests
 * (test.fixme) document the intended behaviour for once it is fixed.
 */

import { type Page, expect } from '@playwright/test'

export const APP = '/apps/petstore'

const IGNORE = [
	'user_status',
	'/heartbeat',
	'Failed to load user status',
	'favicon',
	'Failed to load resource',
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
		guard.server5xx.push(`${r.status()} ${url}`)
	})
	return guard
}

export async function dismissOverlays(page: Page): Promise<void> {
	const wizard = page.locator('#firstrunwizard')
	if (await wizard.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape').catch(() => {})
		await wizard.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
	}
}

/** Direct-navigate to an app route (history-mode router base /apps/petstore). */
export async function go(page: Page, route = ''): Promise<void> {
	const url = route ? `${APP}/${route}` : APP
	await page.goto(url)
	await page.waitForLoadState('networkidle').catch(() => {})
	await dismissOverlays(page)
	await page.waitForTimeout(800)
}

/**
 * Click a left-hand IN-APP navigation entry by its visible label, scoped to
 * the petstore app navigation region so we never hit the global Nextcloud
 * header app-menu (NAV-TRAP). The in-app nav is rendered by the manifest
 * shell inside `#content` once the Vue app mounts.
 */
export async function navClick(page: Page, label: string): Promise<void> {
	await dismissOverlays(page)
	const link = page
		.locator(`#content .app-navigation a:has-text("${label}"), #content nav a:has-text("${label}")`)
		.first()
	await link.click()
	await page.waitForLoadState('networkidle').catch(() => {})
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
}

/** True once the petstore Vue app has actually mounted content into #content. */
export async function appMounted(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const c = document.querySelector('#content')
		// A mounted manifest shell renders an app-navigation + content body.
		return !!c && !!c.querySelector('.app-navigation, nav, .app-content, main')
	})
}
