## ADDED Requirements

### Requirement: Pet catalog schemas

The system MUST define three OpenRegister schemas in the `petstore` register
(`lib/Settings/petstore_register.json`): `category` (`name`, `description`),
`pet` (`name`, `category` relation, `status` enum `available|pending|sold`,
`tags`, `photoUrls`, `price`, `notes`), and `order` (`pet` relation,
`quantity`, `shipDate`, `status` enum `placed|approved|delivered`,
`complete`). `pet.category` MUST be a many-to-one relation to `category`;
`order.pet` MUST be a many-to-one relation to `pet`.

#### Scenario: Pet references its category

- GIVEN a `pet` object with `category` set to a `category` object's UUID
- WHEN the object is read back via OpenRegister
- THEN the relation MUST resolve via `x-openregister-relations` (`schema: category`, `cardinality: many-to-one`)
- AND the pet detail page's `pet-related` widget MUST show the linked category

### Requirement: Manifest-driven catalog pages

The system MUST expose the pet catalog exclusively through declarative
`src/manifest.json` pages (ADR-036) — no bespoke Vue page component backs
`Examples` (pets), `Categories`, or `Orders`. Each index page (`type:
"index"`) MUST declare its `register`/`schema`/`columns`; each detail page
(`type: "detail"`) MUST declare its `widgets`/`layout` using the shared
widget kinds (`data`, `related`, `object-list`, `integration`).

#### Scenario: Categories index lists categories with no custom code

- GIVEN the `Categories` page (`src/manifest.json`, id `Categories`)
- WHEN a user navigates to `/categories`
- THEN the generic manifest-driven index renderer MUST list `category`
  objects using the declared `columns` (`name`, `description`)
- AND no `.vue` file specific to categories MUST exist under `src/views`

#### Scenario: Category detail shows its pets via relation filter

- GIVEN the `CategoryDetail` page's `category-pets` widget
  (`content.filter: { "category": "@objectId" }`)
- WHEN a user opens a category's detail page
- THEN the system MUST render an `object-list` of `pet` objects whose
  `category` field equals the current category's id
- AND a `summaryAggregates` KPI MUST show the live count of pets in that category

### Requirement: Dashboard aggregates read live OpenRegister counts

The Dashboard page's `stats-block` and `chart-by-field` widgets MUST source
their numbers directly from OpenRegister aggregations over the `pet` and
`order` schemas (e.g. count of `pet` where `status: "available"`, sum grouped
by `order.status`) — no client-side re-derivation of counts from a locally
cached object list (ADR-022).

#### Scenario: "Available pets" KPI matches a live OR count

- GIVEN the Dashboard `stats-block` widget with
  `{ register: "petstore", schema: "pet", filters: { status: "available" } }`
- WHEN the dashboard renders
- THEN the displayed count MUST equal OpenRegister's live count of `pet`
  objects with `status == "available"` at render time
- AND clicking the tile MUST route to `Examples` pre-filtered to `status=available`
