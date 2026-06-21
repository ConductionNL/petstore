<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!-- Copyright (C) 2026 Conduction B.V. -->

<!--
 Nextcloud admin app-settings panel.

 Mounted into `#petstore-settings` by `src/settings.js` (which
 itself is loaded from `templates/settings/admin.php` via
 `Util::addScript`). This is the panel users reach via Nextcloud's
 "Administration settings" → "App Template".

 The shared `CnAdminSettingsShell` (from @conduction/nextcloud-vue)
 renders the canonical header + version card (version via loadState,
 up-to-date indicator, manifest re-import, support/SLA footer). New
 apps copy this file as-is and add their own "before the app boots"
 fields (e.g. choosing the OpenRegister register before the manifest
 renders) into the default slot below.

 In a manifest-driven app this surface is mostly redundant — the
 SPA's `type: "settings"` page (declared in `src/manifest.json`)
 covers admin/user settings inside the app's own UI.
-->
<template>
	<CnAdminSettingsShell
		app-id="petstore"
		app-name="App Template">
		<p class="petstore-admin-settings__hint">
			{{ t('petstore', 'No pre-boot settings yet. Edit `src/views/AdminRoot.vue` to add fields here.') }}
		</p>
	</CnAdminSettingsShell>
</template>

<script>
import { CnAdminSettingsShell } from '@conduction/nextcloud-vue'

export default {
	name: 'AdminRoot',
	components: {
		CnAdminSettingsShell,
	},
}
</script>

<style scoped>
.petstore-admin-settings__hint {
	margin: 0;
	color: var(--color-text-maxcontrast);
	line-height: 1.5;
}
</style>
