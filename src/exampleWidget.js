// SPDX-FileCopyrightText: 2024 Conduction B.V.
// SPDX-License-Identifier: EUPL-1.2

/**
 * Dashboard widget renderer.
 *
 * The first argument to `OCA.Dashboard.register(...)` MUST equal the string
 * returned by `ExampleWidget::getId()` in `lib/Dashboard/ExampleWidget.php`.
 * If they don't match, Nextcloud's registry silently ignores the callback
 * and the widget renders blank — check the browser console for
 * `No callback registered for widget '<id>'`.
 *
 * @see lib/Dashboard/ExampleWidget.php
 */

import { createApp } from 'vue'
import { translate as t, translatePlural as n } from '@nextcloud/l10n'

import pinia from './pinia.js'
import ExampleWidget from './views/widgets/ExampleWidget.vue'

OCA.Dashboard.register('petstore_example_widget', (el, { widget }) => {
	// Vue 3: `createApp(Component, props)` replaces `Vue.extend()` + `propsData`,
	// and mixins/plugins are per-app-instance — a module-level `Vue.mixin` /
	// `Vue.use(PiniaVuePlugin)` has no Vue 3 equivalent.
	//
	// `mount(el)` renders INSIDE `el` instead of replacing it (Vue 2's
	// `$mount(el)` swapped the node out), which is the shape Nextcloud's
	// dashboard registry expects for the container it hands us.
	const app = createApp(ExampleWidget, { title: widget.title })
	app.mixin({ methods: { t, n } })
	app.use(pinia)
	app.mount(el)
})
