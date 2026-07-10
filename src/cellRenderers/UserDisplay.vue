<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!-- Copyright (C) 2026 Conduction B.V. -->

<!--
  UserDisplay — kind: "cell-renderer" that resolves a Nextcloud UID to a
  human display name.

  Registered (src/registry.js) with appliesTo: { schema: "order",
  property: "customer" } so the object table substitutes this component for
  the "customer" column on "order" rows. It demonstrates the OR-object →
  Nextcloud-native-entity relation shape: the stored value is an NC UID, not
  another OpenRegister object id, and it is DISPLAY DATA only — never an
  authorization boundary (see openspec/specs/item-management/spec.md for the
  real @self.owner per-object-auth pattern).

  Resolution strategy:
    1. window.OC.currentUser (cheap hit for the common self case)
    2. the shared /ocs user endpoint (best effort, cached)
  Falls back to the raw UID only if both miss — but never renders a blank
  when the value is empty (renders an em dash).

  @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
-->
<template>
	<span class="user-display" :title="uid">
		{{ label }}
	</span>
</template>

<script>
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'

// Module-level cache so a table with many rows for the same user resolves once.
const displayNameCache = new Map()

export default {
	name: 'UserDisplay',

	props: {
		/** Raw cell value — a Nextcloud UID (may be empty for legacy orders). */
		value: {
			type: String,
			default: '',
		},
	},

	data() {
		return {
			resolvedName: '',
		}
	},

	computed: {
		/**
		 * The UID as trimmed string (empty when unset).
		 *
		 * @return {string} The trimmed UID.
		 */
		uid() {
			return (this.value || '').trim()
		},

		/**
		 * The label to render: resolved display name, else the raw UID, else
		 * an em dash for orders that predate the customer field.
		 *
		 * @return {string} The display label.
		 */
		label() {
			if (this.uid === '') {
				return '—'
			}
			return this.resolvedName || this.uid
		},
	},

	watch: {
		uid: {
			immediate: true,
			handler() {
				this.resolve()
			},
		},
	},

	methods: {
		/**
		 * Resolve the UID to a display name (cache → current user → OCS).
		 *
		 * @return {Promise<void>} Resolves when resolvedName is set.
		 */
		async resolve() {
			const uid = this.uid
			if (uid === '') {
				this.resolvedName = ''
				return
			}

			if (displayNameCache.has(uid)) {
				this.resolvedName = displayNameCache.get(uid)
				return
			}

			// Cheap hit: the signed-in user resolving their own orders.
			const current = window.OC?.currentUser
			const currentName = window.OC?.getCurrentUser?.()?.displayName
			if (current === uid && currentName) {
				displayNameCache.set(uid, currentName)
				this.resolvedName = currentName
				return
			}

			try {
				const url = generateOcsUrl('cloud/users/{uid}', { uid })
				const { data } = await axios.get(url)
				const name = data?.ocs?.data?.displayname || data?.ocs?.data?.['display-name'] || ''
				if (name) {
					displayNameCache.set(uid, name)
					this.resolvedName = name
				}
			} catch (e) {
				// Best-effort — fall back to the raw UID via the `label` computed.
				this.resolvedName = ''
			}
		},
	},
}
</script>

<style scoped>
.user-display {
	color: var(--color-main-text, #222);
}
</style>
