---
kind: config
---

## Why

`lib/Settings/petstore_register.json:67-89` defines the `order` schema with
`required: ["pet", "quantity", "status"]` and properties `pet` (relation),
`quantity`, `shipDate`, `status`, `complete` — there is no field identifying
*who placed the order*. An order in this demo is only ever "a pet plus a
quantity"; there is no customer, no purchaser, nothing that could answer "who
does the store need to contact about order X?" This is a real hole in the
canonical pet-store domain (the reference Swagger Petstore API this app's
`order`/`pet`/`category` triad is clearly modeled after has an `Order` with a
purchaser concept).

It also means PetStore's manifest-driven relations demo
(`src/manifest.json` `OrderDetail`/`ExampleDetail`/`CategoryDetail`, all using
`x-openregister-relations` + `object-list`/`related` widgets) only ever
demonstrates relations *between two OpenRegister objects of this app's own
register* (`order.pet` → `pet`, `pet.category` → `category`). It never shows
the other common real-world relation shape: an OR object referencing a
Nextcloud-native entity (a user or an NC Contact — see the fleet gotcha "[[Contact
is a Nextcloud entity]]": reuse the NC addressbook + `contact` schema rather
than inventing a local `customer` register). A developer copying PetStore to
build a real app has no worked example of that pattern here.

## What Changes

- Add a `customer` property to the `order` schema in
  `lib/Settings/petstore_register.json`: `type: "string"`, storing the
  Nextcloud UID of the user who placed the order (not `required`, so existing
  seeded/demo orders remain valid without a data migration).
- Populate `customer` automatically server-side from `IUserSession` when an
  order is created through the generic manifest-driven create flow — this
  requires a minimal `OrderCreateListener`-style hook (or, if the generic OR
  create path has no per-schema hook point, document the constraint and set
  `customer` via the same `OrderController` introduced by the sibling change
  `wire-action-authorization-demo`, if merged first; otherwise leave `customer`
  settable by the generic form and document it as illustrative-only for the
  no-hook case). The authorization pattern is: **never trust a `customer`
  value from the request body for anything security-relevant** — this field
  is informational display data in PetStore, not an ownership check (compare
  with the real per-object-owner pattern already documented in
  `openspec/specs/item-management/spec.md`, which uses `@self.owner`, not a
  domain field, for authorization).
- Add a `customer` column to the `Orders` index page and the `OrderDetail`
  page's data widget. Render it via a small custom cell renderer (following
  the existing `src/cellRenderers/StatusBadge.vue` precedent) that resolves
  the stored UID to an NC display name instead of showing the raw UID string.
- Not BREAKING: `customer` is optional; existing `order` objects without it
  continue to validate and render (blank customer cell).
