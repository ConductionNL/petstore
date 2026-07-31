<?php

use OCP\Util;

$appId = OCA\PetStore\AppInfo\Application::APP_ID;

// webpack splitChunks (see webpack.config.js) emits two shared chunks
// (`shared-vendor`, `shared-nc-vue`) via `enforce: true` cacheGroups. The
// main entry's bundle tail wraps the Vue mount in
// `__webpack_require__.O(0, [shared chunks], …)` which only fires once every
// listed chunk has registered itself on `self.webpackChunk<appId>`. If we
// only `addScript` the main entry, the shared chunks never load, the
// callback never fires, and the Vue app silently fails to mount inside the
// `#content` wrapper. Register every chunk produced by splitChunks here,
// in dependency order, before the main entry. (Mirrors zaakafhandelapp#206.)
Util::addScript($appId, $appId . '-shared-vendor');
Util::addScript($appId, $appId . '-shared-nc-vue');
Util::addScript($appId, $appId . '-main');
?>
<!--
  Vue 3 mount host.

  This used to be `<div id="content">`, which is a DUPLICATE id: Nextcloud's own
  `layout.user.php` already wraps this template's output in
  `<div id="content" class="app-petstore">`. Vue 2's `$mount('#content')`
  resolved the selector to the FIRST match in document order — Nextcloud's outer
  wrapper, not this one — and then replaced it wholesale. The app only worked
  because `$mount` replaces its target; Vue 3's `mount()` renders INSIDE the
  target instead, so the same selector would have mounted the app into
  Nextcloud's content wrapper and left this inner div dangling next to it.

  A unique id removes the ambiguity. Verified live on NC 34.0.0
  (2026-07-31): the app mounts, and the rendered `#content-vue` ends up as a
  direct child of <body> exactly as it did under Vue 2.
-->
<div id="petstore-app"></div>
