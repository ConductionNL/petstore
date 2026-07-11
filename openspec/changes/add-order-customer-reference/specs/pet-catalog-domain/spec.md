## MODIFIED Requirements

### Requirement: Pet catalog schemas

The system MUST define three OpenRegister schemas in the `petstore` register
(`lib/Settings/petstore_register.json`): `category` (`name`, `description`),
`pet` (`name`, `category` relation, `status` enum `available|pending|sold`,
`tags`, `photoUrls`, `price`, `notes`), and `order` (`pet` relation,
`quantity`, `shipDate`, `status` enum `placed|approved|delivered`,
`complete`, `customer` — the Nextcloud UID of the user who placed the order,
optional, display-only). `pet.category` MUST be a many-to-one relation to
`category`; `order.pet` MUST be a many-to-one relation to `pet`. The
`customer` field MUST NOT be used as an authorization boundary anywhere in
the app — it is informational display data, distinct from the `@self.owner`
per-object-authorization pattern documented in
`openspec/specs/item-management/spec.md`.

#### Scenario: Order displays its customer as a display name, not a raw UID

- GIVEN an `order` object with `customer` set to a valid Nextcloud UID
- WHEN the `Orders` index page or `OrderDetail` page renders that order
- THEN the system MUST resolve the UID to the user's display name via a
  dedicated cell renderer
- AND the raw UID string MUST NOT be shown to the end user

#### Scenario: Order without a customer still renders

- GIVEN an `order` object created before this field existed (no `customer`
  property set)
- WHEN the object is read back
- THEN the schema MUST still validate (no data migration required)
- AND the UI MUST render an empty/blank customer cell rather than an error
