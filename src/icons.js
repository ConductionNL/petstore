// SPDX-License-Identifier: EUPL-1.2
// Copyright (C) 2026 Conduction B.V.
//
// Icon registry for petstore (ADR-077 semantic icon vocabulary).
//
// CnAppNav, CnIcon, CnIndexPage / CnDetailPage headers and empty states resolve
// an `icon` by PascalCase name through the registry that `registerIcons()`
// populates. A name that is not registered renders NO icon in the navigation —
// not a fallback glyph — so this file must cover every `icon` the manifests and
// register files name. Keep it in sync when you add a menu entry.
//
// Generated from the app's own manifests; every name is verified to exist in
// vue-material-design-icons.

import BookOpenVariantOutline from 'vue-material-design-icons/BookOpenVariantOutline.vue'
import Cash from 'vue-material-design-icons/Cash.vue'
import ClipboardListOutline from 'vue-material-design-icons/ClipboardListOutline.vue'
import ClipboardTextOutline from 'vue-material-design-icons/ClipboardTextOutline.vue'
import Domain from 'vue-material-design-icons/Domain.vue'
import FileDocumentOutline from 'vue-material-design-icons/FileDocumentOutline.vue'
import FolderOutline from 'vue-material-design-icons/FolderOutline.vue'
import History from 'vue-material-design-icons/History.vue'
import LinkVariant from 'vue-material-design-icons/LinkVariant.vue'
import MapMarkerPath from 'vue-material-design-icons/MapMarkerPath.vue'
import Package from 'vue-material-design-icons/Package.vue'
import Paw from 'vue-material-design-icons/Paw.vue'
import Receipt from 'vue-material-design-icons/Receipt.vue'
import TableColumn from 'vue-material-design-icons/TableColumn.vue'
import Tag from 'vue-material-design-icons/Tag.vue'
import TagOutline from 'vue-material-design-icons/TagOutline.vue'
import ViewDashboardOutline from 'vue-material-design-icons/ViewDashboardOutline.vue'

export default {
	BookOpenVariantOutline,
	Cash,
	ClipboardListOutline,
	ClipboardTextOutline,
	Domain,
	FileDocumentOutline,
	FolderOutline,
	History,
	LinkVariant,
	MapMarkerPath,
	Package,
	Paw,
	Receipt,
	TableColumn,
	Tag,
	TagOutline,
	ViewDashboardOutline,
}
