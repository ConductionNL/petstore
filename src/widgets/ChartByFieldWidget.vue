<!--
SPDX-License-Identifier: EUPL-1.2
Copyright (C) 2026 Conduction B.V.

Dashboard chart card. Fetches the objects of one register/schema from
the OpenRegister objects API, groups them by a single field, and renders
the distribution with CnChartWidget inside a CnWidgetWrapper card.
Registered in src/registry.js as "chart-by-field". The series/labels are
passed directly to CnChartWidget (not via its dataSource prop) so the
widget works on @conduction/nextcloud-vue beta.111.
-->
<template>
	<CnWidgetWrapper :title="title"
		:show-refresh="false"
		:show-request-feature="false">
		<CnChartWidget v-if="!loading"
			:type="chartType"
			:series="series"
			:labels="labels"
			:categories="categories"
			:height="height" />
	</CnWidgetWrapper>
</template>

<script>
import { CnChartWidget, CnWidgetWrapper } from '@conduction/nextcloud-vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export default {
	name: 'ChartByFieldWidget',

	components: {
		CnChartWidget,
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
		/** Object property to group/count by (e.g. "category", "status"). */
		field: {
			type: String,
			required: true,
		},
		/** Card title (e.g. "Pets per category"). */
		title: {
			type: String,
			default: '',
		},
		/** Chart type passed to CnChartWidget: donut, pie, bar, line, area. */
		chartType: {
			type: String,
			default: 'donut',
		},
		/** Chart height in pixels. */
		height: {
			type: Number,
			default: 240,
		},
	},

	data() {
		return {
			groups: {},
			loading: true,
		}
	},

	computed: {
		sortedEntries() {
			return Object.entries(this.groups).sort((a, b) => b[1] - a[1])
		},
		/** Axis charts (bar/line/area) want one named series; circular charts want a flat count array. */
		isAxisChart() {
			return ['bar', 'line', 'area'].includes(this.chartType)
		},
		series() {
			const counts = this.sortedEntries.map(([, count]) => count)
			return this.isAxisChart ? [{ name: this.title || this.field, data: counts }] : counts
		},
		labels() {
			return this.isAxisChart ? [] : this.sortedEntries.map(([label]) => label)
		},
		categories() {
			return this.isAxisChart ? this.sortedEntries.map(([label]) => label) : []
		},
	},

	async mounted() {
		try {
			const url = generateUrl(
				'/apps/openregister/api/objects/{register}/{schema}',
				{ register: String(this.register), schema: String(this.schema) },
			)
			const { data } = await axios.get(url, { params: { _limit: 500 } })
			const groups = {}
			for (const object of data?.results ?? []) {
				const value = object?.[this.field]
				const label = (value === null || value === undefined || value === '') ? '—' : String(value)
				groups[label] = (groups[label] ?? 0) + 1
			}
			this.groups = groups
		} catch (e) {
			// Leave the chart empty rather than breaking the dashboard.
			console.warn('[ChartByFieldWidget] Failed to fetch objects', e)
		} finally {
			this.loading = false
		}
	},
}
</script>
