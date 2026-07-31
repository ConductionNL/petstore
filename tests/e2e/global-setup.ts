/*
 * SPDX-FileCopyrightText: 2026 Conduction B.V.
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Playwright globalSetup — logs into Nextcloud once and persists the
 * resulting cookie jar / localStorage to `tests/e2e/.auth/admin.json`.
 * Every spec then reuses that storage state via the `use.storageState`
 * setting in playwright.config.ts, so individual tests start from an
 * authenticated session without each one paying the login cost.
 *
 * Driving the real login form (instead of POSTing /login) sidesteps the
 * Nextcloud CSRF requesttoken + session passphrase rotation contract,
 * which has shifted across NC 28 / 29 / 30.
 *
 * Pattern reference: ADR-030 (hydra/openspec/architecture/), mirrored
 * from decidesk's journeydoc setup.
 */

import { chromium, request, type FullConfig } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { BASE_URL } from './_base-url'

const AUTH_DIR = path.resolve(__dirname, '.auth')
const STORAGE_STATE = path.join(AUTH_DIR, 'admin.json')

async function ensureNextcloudReachable(baseURL: string): Promise<void> {
	const ctx = await request.newContext()
	try {
		const res = await ctx.get(`${baseURL}/status.php`, { failOnStatusCode: false })
		if (!res.ok()) {
			throw new Error(
				`Nextcloud status.php returned ${res.status()} at ${baseURL}. `
				+ 'Make sure the docker container is running and reachable.',
			)
		}
		const body = await res.json().catch(() => ({}))
		if (!body || body.installed !== true) {
			throw new Error(
				`Nextcloud at ${baseURL} is not installed (status.php = ${JSON.stringify(body)}).`,
			)
		}
	} finally {
		await ctx.dispose()
	}
}

export default async function globalSetup(config: FullConfig): Promise<void> {
	// `config` is unused for the target on purpose: every project's baseURL is
	// already BASE_URL, and reading projects[0] made the login target diverge
	// from the specs' target whenever a per-project `use.baseURL` was added.
	void config
	const baseURL = BASE_URL
	const username = process.env.NC_ADMIN_USER ?? 'admin'
	const password = process.env.NC_ADMIN_PASS ?? 'admin'

	await ensureNextcloudReachable(baseURL)
	fs.mkdirSync(AUTH_DIR, { recursive: true })

	const browser = await chromium.launch()
	const context = await browser.newContext({ baseURL })
	const page = await context.newPage()

	// Hit the login form so the CSRF token + session passphrase land in
	// the browser jar.
	await page.goto('/index.php/login')
	await page.locator('input[name="user"]').fill(username)
	await page.locator('input[name="password"]').fill(password)
	await page.locator('button[type="submit"]').first().click()
	// Nextcloud bounces to /apps/dashboard/ (or another default app) on
	// success. Wait for the global header that only renders on
	// authenticated pages.
	await page.waitForSelector('#header, header.header', { timeout: 20_000 })
	const currentUrl = page.url()
	if (/\/login(\?|$|\/)/.test(currentUrl)) {
		throw new Error(
			`Login appears to have failed — still on ${currentUrl}. `
			+ 'Check NC_ADMIN_USER / NC_ADMIN_PASS (defaults admin/admin).',
		)
	}

	// Turn off Nextcloud's first-run wizard for this user, once, before any spec
	// runs.
	//
	// The wizard is an OPAQUE modal mask (`.modal-mask--opaque`) that swallows
	// every pointer event on the page. It appears on the first authenticated
	// page load of a fresh instance, i.e. inside whichever spec happens to run
	// first, and made unrelated specs fail with 30 s timeouts and
	// "subtree intercepts pointer events". Dismissing it from `dismissOverlays`
	// is a race: the wizard mounts asynchronously and can arrive after the
	// helper has already looked.
	//
	// `DELETE /apps/firstrunwizard/wizard` is the wizard's own "do not show
	// again" endpoint (Wizard#disable), so this is the supported way to opt out
	// rather than a UI trick. It is Nextcloud onboarding chrome with no
	// relation to petstore; nothing under test is affected.
	await page.evaluate(async () => {
		const token = (window as unknown as { OC?: { requestToken?: string } }).OC?.requestToken
		await fetch('/apps/firstrunwizard/wizard', {
			method: 'DELETE',
			headers: { requesttoken: token ?? '', 'OCS-APIRequest': 'true' },
		}).catch(() => {})
	})

	await context.storageState({ path: STORAGE_STATE })
	await browser.close()
}
