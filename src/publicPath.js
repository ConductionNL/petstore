// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.

/**
 * Teach webpack where this app's JS actually lives, at RUNTIME.
 *
 * `@nextcloud/webpack-vue-config` hardcodes
 *   output.publicPath = '/apps/<appName>/js/'
 * which is only correct for apps installed in the DEFAULT `apps/` directory.
 * Anything under a secondary app root — `custom_apps/`, which is where every
 * Conduction app is installed in dev, in the e2e images and in most
 * deployments — is served from `/custom_apps/<app>/js/`. Requesting
 * `/apps/petstore/js/<chunk>.js` there does not 404: Nextcloud's router answers
 * **200 with `text/html`**, so the browser rejects it with
 *   Refused to execute script … MIME type ('text/html') is not executable
 * followed by a `ChunkLoadError`.
 *
 * This never bit the Vue 2 build because it produced no async chunks: the
 * entry bundles are loaded by `Util::addScript()` from PHP, which resolves the
 * correct web root itself. The Vue 3 dependency set does split — `@nextcloud/
 * dialogs@7` (FilePicker / ConflictPicker), `@nextcloud/files`, `@nextcloud/
 * paths` and `@mdi/js` are all dynamically imported — so 40+ chunks went from
 * "never requested" to "requested from the wrong path".
 *
 * `generateFilePath` asks Nextcloud itself (via `OC.appswebroots`), so it is
 * right for every app root.
 *
 * MUST be imported FIRST in every webpack entry point: ESM imports are
 * hoisted, and the assignment has to run before any dynamic `import()` is
 * resolved.
 */

import { generateFilePath } from '@nextcloud/router'

// eslint-disable-next-line camelcase, no-undef
__webpack_public_path__ = generateFilePath('petstore', '', 'js/')
