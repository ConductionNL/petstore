/**
 * SPDX-FileCopyrightText: 2026 Conduction / PetStore Contributors
 * SPDX-License-Identifier: EUPL-1.2
 *
 * COMPONENT-MOUNT example (2 of 2) — proves an emit/interaction round-trip in
 * the offline Vue 2 component-test harness.
 *
 * Mounts the form-field leaf src/formFields/EmailField.vue with
 * @vue/test-utils in jsdom and asserts:
 *   • the label + value props render,
 *   • the for/id wiring between label and input is consistent,
 *   • typing into the input emits an `input` event with the new value.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmailField from '../../../src/formFields/EmailField.vue'

describe('EmailField.vue (component mount)', () => {
	it('renders the label and value props', () => {
		const wrapper = mount(EmailField, {
			propsData: { label: 'Owner email', value: 'a@b.com' },
		})
		expect(wrapper.find('.email-field__label').text()).toBe('Owner email')
		expect(wrapper.find('input').element.value).toBe('a@b.com')
		expect(wrapper.find('input').attributes('type')).toBe('email')
	})

	it('wires the label `for` to the input `id`', () => {
		const wrapper = mount(EmailField)
		const id = wrapper.find('input').attributes('id')
		expect(id).toBeTruthy()
		expect(wrapper.find('label').attributes('for')).toBe(id)
	})

	it('uses the default label and placeholder', () => {
		const wrapper = mount(EmailField)
		expect(wrapper.find('.email-field__label').text()).toBe('Email')
		expect(wrapper.find('input').attributes('placeholder')).toBe('example@domain.com')
	})

	it('emits `input` with the new value when the user types', async () => {
		const wrapper = mount(EmailField, { propsData: { value: '' } })
		const input = wrapper.find('input')
		input.element.value = 'owner@petstore.test'
		await input.trigger('input')
		expect(wrapper.emitted('input')).toBeTruthy()
		expect(wrapper.emitted('input')[0]).toEqual(['owner@petstore.test'])
	})
})
