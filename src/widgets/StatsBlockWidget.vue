<!--
SPDX-License-Identifier: EUPL-1.2
Copyright (C) 2026 Conduction B.V.

Dashboard stats card. Bridges the manifest's flat `stats-block` widget
props (register / schema / title / iconClass / countLabel / variant) to
the presentational CnStatsBlock by fetching the object count from the
OpenRegister objects API. Registered in src/registry.js as "stats-block"
because @conduction/nextcloud-vue beta.101 does not ship a built-in
dashboard stats-block widget yet (consumer registry overrides built-ins).
-->
<template>
	<CnStatsBlock :title="title"
		:count="count"
		:count-label="countLabel"
		:variant="variant"
		:loading="loading" />
</template>

<script>
import { CnStatsBlock } from '@conduction/nextcloud-vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export default {
	name: 'StatsBlockWidget',

	components: {
		CnStatsBlock,
	},

	props: {
		/** OpenRegister register slug or id to count objects in. */
		register: {
			type: [String, Number],
			required: true,
		},
		/** OpenRegister schema slug or id to count objects of. */
		schema: {
			type: [String, Number],
			required: true,
		},
		/** Card title (e.g. "Available pets"). */
		title: {
			type: String,
			default: '',
		},
		/** Icon class from the manifest (accepted for compatibility; unused). */
		iconClass: {
			type: String,
			default: '',
		},
		/** Label under the count (e.g. "pets"). */
		countLabel: {
			type: String,
			default: '',
		},
		/** Visual variant passed through to CnStatsBlock. */
		variant: {
			type: String,
			default: 'default',
		},
	},

	data() {
		return {
			count: 0,
			loading: true,
		}
	},

	async mounted() {
		try {
			const url = generateUrl(
				'/apps/openregister/api/objects/{register}/{schema}',
				{ register: String(this.register), schema: String(this.schema) },
			)
			const { data } = await axios.get(url, { params: { _limit: 1 } })
			this.count = typeof data?.total === 'number' ? data.total : 0
		} catch (e) {
			// Leave the count at 0 rather than breaking the dashboard.
			console.warn('[StatsBlockWidget] Failed to fetch object count', e)
		} finally {
			this.loading = false
		}
	},
}
</script>
