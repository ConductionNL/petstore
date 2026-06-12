<!--
SPDX-License-Identifier: EUPL-1.2
Copyright (C) 2026 Conduction B.V.

Dashboard page header. Bridges the manifest's flat `page-header` widget
props (title / description / icon) to the presentational CnPageHeader.
Registered in src/registry.js as "page-header" because the v2 render
path (CnPageRenderer body-widgets branch) mounts a bare CnWidgetGrid
without any page chrome, so the title has to come from a widget.
-->
<template>
	<CnPageHeader :title="title"
		:description="description"
		:icon="icon" />
</template>

<script>
import { CnPageHeader } from '@conduction/nextcloud-vue'

export default {
	name: 'PageHeaderWidget',

	components: {
		CnPageHeader,
	},

	props: {
		/** Page title (e.g. "Dashboard"). */
		title: {
			type: String,
			required: true,
		},
		/** Optional description shown below the title. */
		description: {
			type: String,
			default: '',
		},
		/** Optional MDI icon name rendered next to the title. */
		icon: {
			type: String,
			default: '',
		},
	},
}
</script>
