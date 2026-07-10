## 1. Schema

- [ ] 1.1 Add `customer` to `lib/Settings/petstore_register.json`'s `order.properties` (`type: "string"`, `description: "Nextcloud UID of the user who placed the order (display-only, not an authorization boundary)"`), not added to `required`
- [ ] 1.2 Bump the `order` schema's `version` field and the register's `version` field per the app's existing register-versioning convention (check `lib/Repair/InitializeSettings.php` for how version bumps trigger re-import)

## 2. Populate customer on create

- [ ] 2.1 Determine whether orders today are created only via the generic manifest-driven `type: "index"` create-dialog (OpenRegister direct write, ADR-022) with no app-side hook point
- [ ] 2.2 If a hook point exists (an OR "before create" listener/event for this app), add one that stamps `customer` from `IUserSession` — never accept `customer` from the request body
- [ ] 2.3 If no hook point exists, document in this spec that `customer` is illustrative/manually-set in the demo data, and do NOT wire it as an authorization field anywhere (avoid a false sense of security)

## 3. Frontend display

- [ ] 3.1 Add a `customer` column to the `Orders` index page `config.columns` in `src/manifest.json`
- [ ] 3.2 Add a small cell renderer (e.g. `src/cellRenderers/UserDisplay.vue`, following the `StatusBadge.vue` pattern already in that directory) that resolves an NC UID to a display name
- [ ] 3.3 Reference the new cell renderer from the `customer` column definition (object column form, matching how the existing `status` column uses `"widget": "badge"`)
- [ ] 3.4 Add `customer` to the `OrderDetail` page's `order-data` widget content

## 4. Seed data

- [ ] 4.1 If demo/seed orders exist (check `lib/Settings/petstore_register.json` or a separate seed file), backfill a plausible `customer` UID on at least one seeded order so the new column is not empty out of the box

## 5. Validate

- [ ] 5.1 Run `openspec validate add-order-customer-reference --strict`
- [ ] 5.2 `npm run check:manifest`
- [ ] 5.3 Manually verify through the UI: open Orders index, confirm the customer column renders a display name (not a raw UID) for any order that has one set
