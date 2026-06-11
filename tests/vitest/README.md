<!--
  SPDX-FileCopyrightText: 2026 Conduction / PetStore Contributors
  SPDX-License-Identifier: EUPL-1.2
-->

# PetStore frontend unit tests (Vitest)

This suite is **offline** — it runs without a Nextcloud runtime or a browser and
gates in CI via the `frontend-unit` job (`.forgejo/workflows/tests.yml`).

```bash
npm run test:unit          # one-shot (CI)
npm run test:unit:watch    # watch mode (local)
```

Specs live under `tests/vitest/**/*.spec.{js,ts}`. Two kinds:

| Kind | Where | Env | What it proves |
| --- | --- | --- | --- |
| Pure logic | `tests/vitest/*.spec.js` | jsdom | Pinia store actions/getters, fetch envelope-unwrap, flag derivation |
| **Component mount** | `tests/vitest/components/*.spec.js` | jsdom | A real Vue 2 SFC mounts, renders props, and emits |

## Component-test harness (the reference pattern)

PetStore is the canonical scaffold app, so its component specs are the fleet
reference for offline Vue 2 component testing. The moving parts:

1. **`@vitejs/plugin-vue2`** compiles `.vue` single-file components for Vite /
   Vitest. (Webpack's `vue-loader` is a separate pipeline used only for the
   production bundle.) It is registered in `vitest.config.js` `plugins`.
2. **`environment: 'jsdom'`** gives `mount()` a DOM so `wrapper.find()`,
   `wrapper.text()`, `wrapper.classes()`, `setProps()` and `trigger('input')`
   work without a browser.
3. **`@vue/test-utils`** `mount()` instantiates the component with `propsData`
   and exposes the rendered tree + emitted events.

A minimal component spec:

```js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../../../src/cellRenderers/StatusBadge.vue'

it('derives a CSS-safe class from the value', () => {
  const wrapper = mount(StatusBadge, { propsData: { value: 'In Progress' } })
  expect(wrapper.classes()).toContain('status-badge--in-progress')
})
```

See `tests/vitest/components/StatusBadge.spec.js` (prop → computed → class) and
`EmailField.spec.js` (prop render + `input` emit round-trip).

## Extending to components that import `@nextcloud/vue`

The two demo components depend on no `@nextcloud/vue` runtime, so the config is
deliberately minimal. When you test a component that **does** pull in
`@nextcloud/vue` (or `@conduction/nextcloud-vue`), copy the extra wiring from
the OpenBuild config (`openbuild/vitest.config.js`):

- a **`cssNoop` plugin** that resolves `*.css` side-effect imports to an empty
  module (the published NC packages ship CSS that does not exist on disk in
  unit-test mode, so an un-noop'd import crashes with
  `ERR_UNKNOWN_FILE_EXTENSION`);
- **`test.server.deps.inline`** listing `/@nextcloud\/vue/`,
  `/vue-material-design-icons/`, etc. so their ESM is transformed rather than
  externalised;
- a **global `setup.js`** registering `t()` / `n()` translation stubs on
  `globalThis` and as a `Vue.mixin` (Vue 2 templates compile to `_vm.t(...)`,
  plain script calls `t(...)`);
- aliasing `@conduction/nextcloud-vue` to a lightweight stub because its CJS
  bundle uses `require('*.vue')`, which Vite's transform pipeline cannot
  consume.

Keep new pure-logic specs in `tests/vitest/*.spec.js` and new component specs
under `tests/vitest/components/`.
