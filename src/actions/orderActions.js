// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.
//
// Manifest action handlers for the Order domain.
//
// These are plain functions registered in the customComponents map (see
// src/customComponents.js) so the manifest renderer can resolve a
// `type: "handler"` action by name. This is the frontend half of the ADR-023
// action-authorization demo: the button calls the server, and the server —
// not the button — is the authorization boundary (OrderController::cancel →
// ActionAuthService::requireAction). A non-authorized user who calls this
// handler still gets a 403 from the backend.
//
// @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#requirement-cancel-an-order-with-action-level-authorization

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { showSuccess, showError } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'

/**
 * Extract the order id from the handler payload. The manifest renderer invokes
 * a handler as `fn({ actionId, item })` (row/detail context) — `item` is the
 * current object. Falls back to `item.id` / `item['@self'].id`.
 *
 * @param {object} payload The handler payload.
 * @param {object} [payload.item] The current object.
 * @return {string|null} The order id, or null when it cannot be resolved.
 */
function resolveOrderId(payload) {
	const item = (payload && payload.item) || {}
	return item.id ?? item.uuid ?? (item['@self'] && item['@self'].id) ?? null
}

/**
 * Cancel an order via the authorization-gated backend endpoint.
 *
 * POSTs to `/api/orders/{id}/cancel`. On success the OpenRegister object's
 * status becomes `cancelled`; the caller is expected to refresh its view.
 * All error branches surface a toast and resolve (never throw) so the
 * manifest dispatcher stays happy.
 *
 * @param {object} payload The handler payload `{ actionId, item }`.
 * @return {Promise<boolean>} True on a successful cancel, false otherwise.
 */
export async function orderCancelAction(payload) {
	const id = resolveOrderId(payload)
	if (!id) {
		showError(t('petstore', 'Could not determine which order to cancel'))
		return false
	}

	try {
		const url = generateUrl('/apps/petstore/api/orders/{id}/cancel', { id })
		await axios.post(url)
		showSuccess(t('petstore', 'Order cancelled'))
		// Let any listening view refresh. The manifest detail/index renderer
		// re-fetches on this app-level event.
		window.dispatchEvent(new CustomEvent('petstore:order-updated', { detail: { id } }))
		return true
	} catch (error) {
		const status = error?.response?.status
		if (status === 403) {
			showError(t('petstore', 'You are not allowed to cancel orders'))
		} else if (status === 409) {
			showError(t('petstore', 'A delivered order can no longer be cancelled'))
		} else {
			showError(t('petstore', 'Could not cancel the order'))
		}
		return false
	}
}
