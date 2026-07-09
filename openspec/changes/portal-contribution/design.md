# Design: portal-contribution

## Architecture Overview

Portaliq (hydra ADR-046) is the one shared external portal for people without
Nextcloud accounts. Domain apps contribute by shipping a single plain class at
a convention FQCN; portaliq's `PortalContributionRegistry` resolves
`OCA\{App}\Portal\PortalContributionProvider` per installed app and duck-types
it (`method_exists`, never `instanceof`). Pet Store therefore adds exactly one
new file under `lib/Portal/` and touches nothing else in the runtime app:

```
portaliq (if installed)
  └─ registry resolves OCA\Petstore\Portal\PortalContributionProvider (FQCN)
       └─ getAudiences() → ['client']          (v2, preferred)
       └─ getAudience()  → 'client'            (v1 fallback)
       └─ getContribution($subject) → manifest (pure data) or null
            └─ collections read/create via OpenRegister, scoped by
               pet.owner / order.owner == subject's owner-contact UUID
```

Note on the FQCN: PHP resolves class names case-insensitively, so the
registry's `OCA\Petstore\...` candidate (built via `ucfirst(appId)`) resolves
to this app's `OCA\PetStore\Portal\PortalContributionProvider` — the class
keeps the repo's canonical `PetStore` namespace casing (composer PSR-4 +
`info.xml` `<namespace>`).

Without portaliq the class is never instantiated: it is inert dead-weight of
~1 KB, by design (amendment A1). There is deliberately **no** DI registration
in `lib/AppInfo/Application.php` — unlike the MCP provider (which aliases into
OpenRegister), portal discovery is entirely pull-based from portaliq's side.

## Declarative-vs-imperative decision

The contribution is **declarative by nature**: `getContribution()` returns a
pure-data manifest (label, collections, actions, notifications) that portaliq
interprets — the same philosophy as the ADR-024 app manifest and ADR-031
declarative business logic. No behaviour, no I/O, no callbacks live in the
provider. A provider *class* (rather than, say, a JSON file) is used only
because it is the delivery vehicle ADR-046 mandates: a class is autoloadable
cross-app without any file-path coupling, discoverable via the DI container by
FQCN, and can branch on the server-derived `$subject` (audience filtering)
without portaliq having to parse app-private config. The imperative surface is
kept to that single branch; everything portaliq renders or enforces
(scoping, trust, RBAC) is data in the manifest, evaluated portaliq-side.

## Mixed-spec rationale

This change is `kind: code` (provider class + unit tests), but it also carries
a ~4-line **declarative schema addition**: the `owner` property on the `pet`
and `order` schemas in `lib/Settings/petstore_register.json` plus the version
bump. That JSON edit is thin glue for the code deliverable — the manifest's
`scopeField: owner` is meaningless unless the schemas actually define `owner`
— so it rides in this code change instead of a separate `kind: config` change
(ADR-032 sizing: a 4-line additive property does not justify a second change
and a cross-change dependency).

## API Design

None. No routes, controllers, or endpoints are added. Reads/creates against
the collections go through OpenRegister's existing object API, invoked by
portaliq server-side with subject scoping (ADR-022 — no app-local CRUD
wrappers).

## Database Changes

None owned by this app — Pet Store is a thin OR client with no tables. The
register JSON gains the additive, optional `owner` property on `pet` and
`order`; the existing version-gated import (repair step →
`ConfigurationService::importFromApp()`) applies it on upgrade because the
register/schema versions bump 0.2.0 → 0.3.0. No `migration.md` artifact: there
is no data transformation, no required-field change, and no rollback beyond
reverting the JSON (existing objects remain valid with `owner` absent).

## Nextcloud Integration

- Controllers: none.
- Services: none.
- Mappers/Entities: none (OR owns storage).
- Events/Hooks: none — no `Application.php` registration by design (see
  Architecture Overview).

## Security Considerations

- **Server-derived subject only** (ADR-005 / ADR-046 A6): the `$subject`
  array (subjectRef, audience, organisation, trust) is constructed by
  portaliq's auth edge. The provider only *reads* `audience` to filter; it
  never echoes subject data into the manifest and never trusts anything
  client-supplied.
- **UUID domain-object scoping** (A4): `owner` holds the UUID of the owner
  contact object — never an NC uid. Externals have no NC account by premise;
  NC-uid scoping is the anti-pattern A4 exists to kill.
- **Fail-closed audience filter**: any subject whose `audience` is not
  exactly `'client'` gets `null` — absent, empty, or unknown audiences
  contribute nothing.
- **Field whitelist on create**: `createOrder` exposes only `pet`,
  `quantity`, `shipDate`. Status, completion, and pricing fields are
  deliberately excluded so an external client cannot self-approve or
  self-complete an order; portaliq enforces the whitelist server-side.
- No secrets, no tokens, no endpoints in this change.

## File Structure

```
lib/
  Portal/
    PortalContributionProvider.php      (new — plain class, no deps)
  Settings/
    petstore_register.json              (owner on pet + order, 0.2.0 → 0.3.0)
tests/
  Unit/
    Portal/
      PortalContributionProviderTest.php (new)
openspec/
  changes/portal-contribution/           (this change)
  specs/portal-contribution/spec.md      (capability status stub)
```

## Seed Data

The demo register already seeds categories, pets, and orders. Portal scoping
needs pets/orders that carry an `owner` UUID pointing at an owner-contact
domain object. Because the owner contact lives outside this change (contacts
are a Nextcloud entity — reuse the NC addressbook `contact` schema), seed rows
below use the **nil-UUID placeholder `00000000-0000-0000-0000-000000000000`**;
the tutorial/demo environment replaces it with the UUID of a real seeded
contact at import time. `owner` stays optional, so seeds without it remain
valid.

### Schema: `pet`

| Field  | Object 1 | Object 2 | Object 3 |
|--------|----------|----------|----------|
| @self  | register `petstore`, schema `pet` | register `petstore`, schema `pet` | register `petstore`, schema `pet` |
| name   | Rex | Whiskers | Nemo |
| category | (Dogs category UUID) | (Cats category UUID) | (Fish category UUID) |
| status | sold | available | pending |
| price  | 249.00 | 120.00 | 15.50 |
| owner  | 00000000-0000-0000-0000-000000000000 | — (no owner yet) | 00000000-0000-0000-0000-000000000000 |

### Schema: `order`

| Field    | Object 1 | Object 2 | Object 3 |
|----------|----------|----------|----------|
| @self    | register `petstore`, schema `order` | register `petstore`, schema `order` | register `petstore`, schema `order` |
| pet      | (Rex UUID) | (Nemo UUID) | (Whiskers UUID) |
| quantity | 1 | 1 | 2 |
| shipDate | 2026-07-14T09:00:00Z | 2026-07-21T09:00:00Z | 2026-08-01T09:00:00Z |
| status   | delivered | placed | approved |
| owner    | 00000000-0000-0000-0000-000000000000 | 00000000-0000-0000-0000-000000000000 | — (back-office order, not portal-visible) |

**Related items per object:** none required — the portal demo only needs the
owner-scoped rows themselves; inbox/notification seeds are portaliq's own.

## Trade-offs

- **Both audience methods vs v2-only** — v2-only would be leaner, but this is
  the fleet reference and the registry's v1 fallback path must be
  demonstrated; two constant-return methods cost nothing.
- **`owner` optional vs required** — required would guarantee scoping on
  every row but would break every existing seed/object and force a data
  migration; optional keeps the change additive (rows without `owner` are
  simply invisible in the portal — fail-closed).
- **No `minTrust` / `scopeClaim` / `via` in the demo** — the client demo
  needs none (A3–A5); including them speculatively would teach copiers to
  cargo-cult unused keys. The spec's Notes point at the amendment for when
  they apply.
- **Plain class vs shared interface package** — an interface import would
  give static safety but create exactly the coupling A1 forbids; duck typing
  is the accepted cost of optionality.
