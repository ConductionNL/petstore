// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.
//
// v2 component registry for the manifest-driven app shell.
//
// This file is the v2 replacement for customComponents.js. Where
// customComponents.js only supported `type: "custom"` page components,
// this registry supports all five kinds defined in hydra ADR-036:
//
//   - widget       — placeable in any allowed slot via grid coords
//   - modal        — opened by action reference; not gridded externally
//   - page         — full-page custom component (escape hatch; keep near-zero)
//   - form-field   — custom property editor (auto-bound by format/property)
//   - cell-renderer — custom table-cell rendering (auto-bound by schema/property)
//
// Each entry: { kind, component, ...kindMetadata }
//
// Resolution at runtime:
//   1. Built-in widgets    (object-table, form-renderer, wiki-renderer, …)
//   2. This registry       ← consumer-injected components
//
// How to add a new widget:
//   1. Create src/widgets/<YourWidget>.vue.
//   2. Add an entry here with kind: "widget" + required metadata.
//   3. Reference it in src/manifest.json via widgetKey: "<your-key>".
//
// How to add a new modal:
//   1. Create src/modals/<YourModal>.vue.
//   2. Add an entry here with kind: "modal" + propsSchema.
//   3. Trigger it in manifest actions via type: "open-modal", target: "<your-key>".
//
// How to add a custom page:
//   1. Create src/views/<YourPage>.vue.
//   2. Add an entry here with kind: "page".
//   3. Add a manifest page entry with type: "custom", component: "<your-key>",
//      and a _note explaining why a standard page type was not feasible.
//
// See: https://codeberg.org/Conduction/hydra → openspec/architecture/adr-036-universal-widget-manifest.md

import ExampleWidget from './widgets/ExampleWidget.vue'
import StatsBlockWidget from './widgets/StatsBlockWidget.vue'
import PageHeaderWidget from './widgets/PageHeaderWidget.vue'
import ChartByFieldWidget from './widgets/ChartByFieldWidget.vue'
import RecentObjectsWidget from './widgets/RecentObjectsWidget.vue'
import ExampleModal from './modals/ExampleModal.vue'
import EmailField from './formFields/EmailField.vue'
import StatusBadge from './cellRenderers/StatusBadge.vue'
import UserDisplay from './cellRenderers/UserDisplay.vue'
import CustomExample from './views/CustomExample.vue'

export default {
	// -------------------------------------------------------------------------
	// kind: "widget" — placeable in any allowed slot via grid coordinates
	// -------------------------------------------------------------------------

	/**
	 * Example custom widget. Keep or delete when scaffolding a new app.
	 * Not referenced by src/manifest.json by default — wire it up by
	 * adding a widgets[] entry with widgetKey: "example-widget".
	 */
	/**
	 * Dashboard stats card referenced by src/manifest.json (Dashboard page,
	 * widgetKey "stats-block"). Overrides the (absent) built-in: nc-vue
	 * beta.101 has no built-in dashboard stats-block, so without this entry
	 * the Dashboard renders empty with an "Unknown widgetKey" warning.
	 */
	'stats-block': {
		kind: 'widget',
		component: StatsBlockWidget,
		defaultSize: { w: 3, h: 1 },
		minSize: { w: 2, h: 1 },
		maxSize: { w: 12, h: 2 },
		allowedSlots: ['body'],
		propsSchema: {
			type: 'object',
			properties: {
				register: { type: 'string' },
				schema: { type: 'string' },
				title: { type: 'string' },
				iconClass: { type: 'string' },
				countLabel: { type: 'string' },
				variant: { type: 'string' },
				filters: { type: 'object' },
			},
		},
	},

	/**
	 * Dashboard page header (title + description). Restores the page chrome
	 * the v2 body-widgets render path does not provide; place it at gridY 0
	 * spanning all 12 columns.
	 */
	'page-header': {
		kind: 'widget',
		component: PageHeaderWidget,
		defaultSize: { w: 12, h: 1 },
		minSize: { w: 6, h: 1 },
		maxSize: { w: 12, h: 1 },
		allowedSlots: ['body'],
		propsSchema: {
			type: 'object',
			properties: {
				title: { type: 'string' },
				description: { type: 'string' },
				icon: { type: 'string' },
			},
		},
	},

	/**
	 * Dashboard chart card: counts the objects of one register/schema
	 * grouped by a field and renders the distribution (donut/pie/bar/…).
	 */
	'chart-by-field': {
		kind: 'widget',
		component: ChartByFieldWidget,
		defaultSize: { w: 6, h: 3 },
		minSize: { w: 3, h: 2 },
		maxSize: { w: 12, h: 4 },
		allowedSlots: ['body'],
		propsSchema: {
			type: 'object',
			properties: {
				register: { type: 'string' },
				schema: { type: 'string' },
				field: { type: 'string' },
				title: { type: 'string' },
				chartType: { type: 'string' },
				height: { type: 'number' },
			},
		},
	},

	/**
	 * Dashboard table card: the newest N objects of one register/schema.
	 * Bridges live OpenRegister data to CnDataTable (the built-in
	 * object-table widget is presentational and does not self-fetch).
	 */
	'recent-objects': {
		kind: 'widget',
		component: RecentObjectsWidget,
		defaultSize: { w: 12, h: 3 },
		minSize: { w: 6, h: 2 },
		maxSize: { w: 12, h: 6 },
		allowedSlots: ['body'],
		propsSchema: {
			type: 'object',
			properties: {
				register: { type: 'string' },
				schema: { type: 'string' },
				columns: { type: 'array' },
				title: { type: 'string' },
				limit: { type: 'number' },
			},
		},
	},

	'example-widget': {
		kind: 'widget',
		component: ExampleWidget,
		defaultSize: { w: 3, h: 1 },
		minSize: { w: 2, h: 1 },
		maxSize: { w: 12, h: 4 },
		allowedSlots: ['body', 'sidebar'],
		propsSchema: {
			type: 'object',
			properties: {
				message: { type: 'string' },
			},
		},
	},

	// -------------------------------------------------------------------------
	// kind: "modal" — opened via actions[].type: "open-modal"
	// -------------------------------------------------------------------------

	/**
	 * Example confirm-action modal. Keep or delete when scaffolding.
	 * Trigger via manifest action: { type: "open-modal", target: "example-modal" }.
	 */
	'example-modal': {
		kind: 'modal',
		component: ExampleModal,
		propsSchema: {
			type: 'object',
			properties: {
				title: { type: 'string' },
				message: { type: 'string' },
			},
		},
	},

	// -------------------------------------------------------------------------
	// kind: "page" — full-page custom components (escape hatch; keep near-zero)
	//
	// PascalCase keys match the manifest's `component` field so the v1
	// customComponents.js entries work unchanged during the v1 → v2 transition.
	// -------------------------------------------------------------------------

	/**
	 * Example custom page. The manifest does NOT reference this by default;
	 * it is included so the registry's role is visible to first-time cloners.
	 * Wire it up by adding a type: "custom" page entry to src/manifest.json
	 * with component: "CustomExample" and a _note field.
	 */
	CustomExample: {
		kind: 'page',
		component: CustomExample,
	},

	// -------------------------------------------------------------------------
	// kind: "form-field" — custom property editors
	// -------------------------------------------------------------------------

	/**
	 * Email address input. Auto-bound by the form renderer to any JSON Schema
	 * property with format: "email". Replace or extend for your app's fields.
	 */
	'email-field': {
		kind: 'form-field',
		component: EmailField,
		appliesTo: {
			format: 'email',
		},
	},

	// -------------------------------------------------------------------------
	// kind: "cell-renderer" — custom table-cell rendering
	// -------------------------------------------------------------------------

	/**
	 * Status badge renderer. Auto-bound by the object table to the "status"
	 * property column on "example" schema rows. Adjust appliesTo for your schema.
	 */
	'status-badge': {
		kind: 'cell-renderer',
		component: StatusBadge,
		appliesTo: {
			schema: 'example',
			property: 'status',
		},
	},

	/**
	 * Customer display renderer. Auto-bound to the "customer" column on
	 * "order" rows — resolves the stored Nextcloud UID to a display name
	 * (add-order-customer-reference). Demonstrates the OR-object →
	 * NC-native-entity relation shape; the value is display data only,
	 * never an authorization boundary.
	 */
	'user-display': {
		kind: 'cell-renderer',
		component: UserDisplay,
		appliesTo: {
			schema: 'order',
			property: 'customer',
		},
	},
}
