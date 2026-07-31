/**
 * SPDX-FileCopyrightText: 2026 Conduction / PetStore Contributors
 * SPDX-License-Identifier: EUPL-1.2
 *
 * COMPONENT-MOUNT example (1 of 2) — proves the fleet's offline Vue 2
 * component-test harness works end to end.
 *
 * Mounts the leaf cell-renderer src/cellRenderers/StatusBadge.vue with
 * @vue/test-utils in a jsdom environment (no browser, no Nextcloud) and
 * asserts:
 *   • the raw value renders as the badge text,
 *   • the `value` prop drives the `normalised` computed → CSS-safe class,
 *   • the empty/unknown fallback.
 *
 * See tests/vitest/README.md for how to extend this to components that pull
 * in @nextcloud/vue.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../../../src/cellRenderers/StatusBadge.vue'

describe('StatusBadge.vue (component mount)', () => {
	it('renders the raw value as the badge text', () => {
		const wrapper = mount(StatusBadge, { props: { value: 'Open' } })
		expect(wrapper.text()).toBe('Open')
		expect(wrapper.classes()).toContain('status-badge')
	})

	it('derives a CSS-safe modifier class from the value', () => {
		const wrapper = mount(StatusBadge, { props: { value: 'In Progress' } })
		// lower-cased, non-alphanumerics collapsed to a single hyphen
		expect(wrapper.classes()).toContain('status-badge--in-progress')
	})

	it('falls back to the "unknown" modifier when the value is empty', () => {
		const wrapper = mount(StatusBadge, { props: { value: '' } })
		expect(wrapper.classes()).toContain('status-badge--unknown')
		expect(wrapper.text()).toBe('')
	})

	it('reacts to a prop change', async () => {
		const wrapper = mount(StatusBadge, { props: { value: 'open' } })
		expect(wrapper.classes()).toContain('status-badge--open')
		await wrapper.setProps({ value: 'Closed' })
		expect(wrapper.classes()).toContain('status-badge--closed')
		expect(wrapper.text()).toBe('Closed')
	})
})
