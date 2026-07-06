<!--
  SPDX-FileCopyrightText: 2024 Conduction B.V.
  SPDX-License-Identifier: EUPL-1.2

  Minimal NATIVE Nextcloud Dashboard widget (the server-wide dashboard at
  /apps/dashboard — OCA.Dashboard). For widgets INSIDE the app, do NOT copy
  this file: declare a built-in widget (object-table / stats-block) in
  src/manifest.json instead — see the "recent-orders" object-table entry on
  the Dashboard page for the worked example (hydra ADR-049).

  This renderer uses the universal CnDataTable compact-list pattern:
    - :rows + two columns with cn-cell-- utility classes
      (cn-cell--strong / cn-cell--muted cn-cell--end)
    - hide-header + borderless — the compact dashboard-list surface
    - :empty-text for the empty state
    - @row-click same-tab navigation
    - #footer "View all" link
  The important parts to keep are the axios fetch in mounted() and the
  error handling that downgrades gracefully — a widget that throws breaks
  the whole dashboard mount.
-->
<template>
	<CnDataTable :rows="items"
		:columns="columns"
		:loading="loading"
		hide-header
		borderless
		:empty-text="emptyMessage"
		@row-click="onRowClick">
		<template #footer>
			<a class="cn-data-table__view-all" @click.prevent="onViewAll">
				{{ t('petstore', 'View all') }} →
			</a>
		</template>
	</CnDataTable>
</template>

<script>
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { CnDataTable } from '@conduction/nextcloud-vue'

export default {
	name: 'ExampleWidget',
	components: { CnDataTable },
	props: {
		title: { type: String, default: '' },
	},
	data: () => ({
		items: [],
		loading: true,
		emptyMessage: '',
		columns: [
			{ key: 'mainText', cellClass: 'cn-cell--strong' },
			{ key: 'subText', cellClass: 'cn-cell--muted cn-cell--end' },
		],
	}),
	/**
	 * Load widget rows on mount; degrade to an empty state on failure.
	 *
	 * @spec openspec/specs/scaffold-components/spec.md#REQ-COMP-003
	 * @return {Promise<void>}
	 */
	async mounted() {
		this.emptyMessage = t('petstore', 'No pets yet')
		try {
			// The newest pets from the petstore register's "pet" schema — the
			// same OpenRegister objects API the in-app built-in object-table
			// widget queries declaratively (the "recent-orders" manifest entry).
			const url = generateUrl('/apps/openregister/api/objects/petstore/pet')
			const { data } = await axios.get(url, {
				params: { _limit: 7, _order: { '@self.created': 'DESC' } },
			})
			this.items = (data?.results || []).map(o => ({
				id: o.id,
				mainText: o.name || `#${o.id}`,
				subText: o.status || '',
				targetUrl: generateUrl(`/apps/petstore/examples/${o.id}`),
			}))
		} catch (err) {
			console.warn('[ExampleWidget] fetch failed — empty state', err)
			this.items = []
		} finally {
			this.loading = false
		}
	},
	methods: {
		/**
		 * Navigate to the clicked pet in the same tab. The native dashboard
		 * lives outside the app's router, so navigation is a full page load.
		 *
		 * @spec openspec/specs/scaffold-components/spec.md#REQ-COMP-003
		 * @param {object} row The clicked row (a shaped item).
		 * @return {void}
		 */
		onRowClick(row) {
			if (row?.targetUrl) {
				window.location.href = row.targetUrl
			}
		},
		/**
		 * Navigate to the app's full pet list in the same tab.
		 *
		 * @spec openspec/specs/scaffold-components/spec.md#REQ-COMP-003
		 * @return {void}
		 */
		onViewAll() {
			window.location.href = generateUrl('/apps/petstore/examples')
		},
	},
}
</script>
