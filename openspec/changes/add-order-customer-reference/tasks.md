## 1. Schema

- [x] 1.1 Add `customer` to `lib/Settings/petstore_register.json`'s `order.properties` (`type: "string"`, `description: "Nextcloud UID of the user who placed the order (display-only, not an authorization boundary)"`), not added to `required`
- [x] 1.2 Bump the `order` schema's `version` field and the register's `version` field (0.2.0 → 0.2.1) per the app's existing register-versioning convention (InitializeSettings re-imports on version bump)

## 2. Populate customer on create

- [x] 2.1 Determine whether orders today are created only via the generic manifest-driven `type: "index"` create-dialog (OpenRegister direct write, ADR-022) with no app-side hook point — confirmed: no bespoke create endpoint; orders are created via the generic OR write path
- [x] 2.2 A hook point DOES exist — OpenRegister dispatches a vetoable `ObjectCreatingEvent` from its central write path (`MagicMapper::insertObjectEntity`) and merges a listener's `setModifiedData()` into the object before persisting. Added `lib/Listener/OrderCustomerListener.php` (registered in `Application::register()`) that stamps `customer` from `IUserSession`, scoped strictly to the petstore/order register+schema (slugs resolved via OR's SchemaMapper/RegisterMapper), never trusting a request-body value, and never throwing (best-effort on a shared instance-wide event)
- [x] 2.3 N/A — a hook point exists, so 2.2 applies. The field remains display-only: nothing in the app makes an authorization decision based on `customer` (documented in the listener + spec)

## 3. Frontend display

- [x] 3.1 Add a `customer` column to the `Orders` index page `config.columns` in `src/manifest.json`
- [x] 3.2 Add a small cell renderer (`src/cellRenderers/UserDisplay.vue`, following the `StatusBadge.vue` pattern) that resolves an NC UID to a display name (cache → current user → OCS `cloud/users/{uid}`)
- [x] 3.3 Reference the new cell renderer: registered in `src/registry.js` as a `kind: "cell-renderer"` with `appliesTo: { schema: "order", property: "customer" }` — auto-binds to the `customer` column (matching the existing `StatusBadge` registry precedent, the idiomatic cell-renderer mechanism)
- [~] 3.4 Add `customer` to the `OrderDetail` page's `order-data` widget content — the `data` widget derives its fields from the schema automatically, so the new `customer` property renders without an explicit per-field list to edit (the widget config carries only `content.columns`). No manifest edit needed.

## 4. Seed data

- [~] 4.1 The register JSON defines registers/schemas only — it ships NO seeded `order` objects, so there is nothing to backfill. New orders get `customer` stamped by the create-listener. (Backfilling would require a live instance + a separate seed step.)

## 5. Validate

- [x] 5.1 Run `openspec validate add-order-customer-reference --strict` — PASS
- [x] 5.2 `npm run check:manifest` — PASS (Ajv validation: 0 errors)
- [~] 5.3 Manually verify through the UI — DEFERRED: needs a live Nextcloud instance with OpenRegister + orders that carry a `customer` UID. Not run in the isolated worktree.
