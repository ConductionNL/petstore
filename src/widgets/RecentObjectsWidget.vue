<!--
SPDX-License-Identifier: EUPL-1.2
Copyright (C) 2026 Conduction B.V.

Dashboard "recent objects" table card. Fetches the newest objects of one
register/schema from the OpenRegister objects API and renders them with
CnDataTable inside a CnWidgetWrapper card. Registered in src/registry.js
as "recent-objects" — the built-in object-table widget is a presentational
pass-through (CnDataTable does not self-fetch rows), so the manifest needs
this bridge to show live data.
-->
<template>
	<CnWidgetWrapper :title="title"
		:show-refresh="false"
		:show-request-feature="false">
		<CnDataTable :columns="normalizedColumns"
			:rows="rows"
			:loading="loading" />
	</CnWidgetWrapper>
</template>

<script>
import { CnDataTable, CnWidgetWrapper } from '@conduction/nextcloud-vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export default {
	name: 'RecentObjectsWidget',

	components: {
		CnDataTable,
		CnWidgetWrapper,
	},

	props: {
		/** OpenRegister register slug or id to read objects from. */
		register: {
			type: [String, Number],
			required: true,
		},
		/** OpenRegister schema slug or id to read objects of. */
		schema: {
			type: [String, Number],
			required: true,
		},
		/**
		 * Columns to show. Strings become { key, label } with a capitalised
		 * label; objects are passed to CnDataTable unchanged.
		 */
		columns: {
			type: Array,
			default: () => [],
		},
		/** Card title (e.g. "Recent orders"). */
		title: {
			type: String,
			default: '',
		},
		/** How many of the newest objects to show. */
		limit: {
			type: Number,
			default: 5,
		},
	},

	data() {
		return {
			rows: [],
			loading: true,
		}
	},

	computed: {
		normalizedColumns() {
			return this.columns.map((column) => {
				if (typeof column === 'string') {
					return { key: column, label: column.charAt(0).toUpperCase() + column.slice(1) }
				}
				return column
			})
		},
	},

	async mounted() {
		try {
			const url = generateUrl(
				'/apps/openregister/api/objects/{register}/{schema}',
				{ register: String(this.register), schema: String(this.schema) },
			)
			const { data } = await axios.get(url, {
				params: { _limit: this.limit, _order: { '@self.created': 'DESC' } },
			})
			this.rows = data?.results ?? []
		} catch (e) {
			// Leave the table empty rather than breaking the dashboard.
			console.warn('[RecentObjectsWidget] Failed to fetch objects', e)
		} finally {
			this.loading = false
		}
	},
}
</script>
