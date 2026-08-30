---
capability: portal-contribution
status: in-progress
built_by: openspec/changes/portal-contribution
---

# portal-contribution Specification

**Status**: in-progress
**Scope**: petstore
**OpenSpec changes**:
- `openspec/changes/portal-contribution/` — _archived_ (removed from the tree
  in `67266cd`, 2026-07-10). Its delta requirements REQ-PORT-001 …
  REQ-PORT-004 are merged into this document below, which is now their only
  home.
- `openspec/changes/portal-assertion-verifier/` — _archived_ in the same
  commit. It MODIFIED the client manifest (REQ-PORT-003) by declaring the
  `renamePet` endpoint action (contract v2, A6); that modification is folded
  into REQ-PORT-003 below. The receiver itself is specified by
  [`openspec/specs/portal-assertion-verifier/spec.md`](../portal-assertion-verifier/spec.md).

## Purpose

Pet Store contributes a client section to portaliq, the shared external portal
for people without Nextcloud accounts (hydra ADR-046 + 2026-07-06 amendment,
contribution contract v2). The contribution is one plain, dependency-free
provider class (`OCA\PetStore\Portal\PortalContributionProvider`, duck-typed
by FQCN — inert without portaliq) plus an `owner` UUID scoping property on the
portal-exposed `pet` and `order` schemas. This capability is the fleet's
**reference implementation** — Wave-0 of the ADR-046 rollout — and the shape
every other Conduction app copies.

## Requirements

REQ-PORT-000 below is the umbrella requirement; REQ-PORT-001 … REQ-PORT-004
are the detailed requirements, merged in from the archived changes' delta
specs.

### Requirement: Pet Store ships the ADR-046 reference portal contribution (REQ-PORT-000)

The app MUST serve its entire portal contribution through the two artefacts
this capability owns: the plain, dependency-free
`OCA\PetStore\Portal\PortalContributionProvider` class (duck-typed by FQCN,
inert without portaliq) and the `owner` UUID scoping property on the `pet` and
`order` schemas. No other portal *contribution* logic, UI, or dependency may
exist in petstore; the RECEIVING side of forwarded endpoint actions (the
`X-Portal-Subject` verifier and the guarded `renamePet` endpoint) is owned by
the separate `portal-assertion-verifier` capability and stays equally
dependency-free.

#### Scenario: Contribution surface is exactly the provider plus the scoping property

- GIVEN a petstore checkout at this capability's `in-progress` (or later) status
- WHEN portaliq's registry (contract v2) discovers and duck-types the provider
- THEN the whole contribution resolves from `lib/Portal/PortalContributionProvider.php` and the `owner` property in `lib/Settings/petstore_register.json`
- AND removing those two artefacts removes the contribution without affecting any other app behaviour
- @e2e exclude backend-only contract surface with no petstore UI; the portal renders inside portaliq — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

### Requirement: Provider is a plain, dependency-free class (REQ-PORT-001)

The app MUST ship `OCA\PetStore\Portal\PortalContributionProvider` as a plain
PHP class: no imports from portaliq, no `implements` clause, no `info.xml`
dependency on portaliq, and no constructor dependencies. Portaliq discovers it
by convention FQCN and duck-types it via `method_exists` (never `instanceof`),
so without portaliq installed the class MUST be inert and MUST NOT change any
app behaviour (ADR-046 amendment A1).

#### Scenario: Provider constructs standalone

- GIVEN a PHP runtime where portaliq is not installed and no portaliq class is autoloadable
- WHEN `new PortalContributionProvider()` is called
- THEN the class instantiates without error
- AND it declares no `implements` clause and no `use` of any portaliq symbol
- @e2e exclude backend-only contract class with no petstore UI surface; the portal renders inside portaliq — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

### Requirement: Provider declares both v2 and v1 audience methods (REQ-PORT-002)

The provider MUST implement `getAudiences(): array` returning `['client']`
(contract v2, preferred by the registry) AND `getAudience(): string` returning
`'client'` (v1 fallback), so it works against both registry generations
(ADR-046 amendment A2). As the fleet reference it MUST demonstrate both.

#### Scenario: Audience methods agree

- GIVEN a constructed provider
- WHEN `getAudiences()` and `getAudience()` are called
- THEN `getAudiences()` returns exactly `['client']`
- AND `getAudience()` returns `'client'`
- @e2e exclude backend-only contract methods with no petstore UI surface — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

### Requirement: Contribution is a declarative client manifest (REQ-PORT-003)

`getContribution(array $subject): ?array` MUST return `null` unless
`$subject['audience']` is `'client'`. For a client subject it MUST return a
declarative manifest with label `'Pet Store'` and:

- collection `petCollection` — register `petstore`, schema `pet`, `scopeField`
  `owner`, listable;
- collection `orderCollection` — register `petstore`, schema `order`,
  `scopeField` `owner`, listable;
- create-action `createOrder` — `type: 'create'`, register `petstore`, schema
  `order`, field whitelist exactly `['pet', 'quantity', 'shipDate']`;
- endpoint-action `renamePet` (contract v2, A6 — added by the archived
  `portal-assertion-verifier` change) — `endpoint`
  `/apps/petstore/api/portal/pets/rename`, `method` `POST`, and NO `type`
  key, since only create-actions carry one. Portaliq forwards it
  server-to-server with a signed `X-Portal-Subject` assertion; the receiving
  side is specified by REQ-PAV-003;
- empty `notifications`.

The manifest MUST be pure data — no callbacks, no service calls; all subject
identity (subjectRef, audience, organisation, trust) is server-derived by
portaliq and MUST NOT be echoed back or trusted from the client.

#### Scenario: Client subject receives the manifest

- GIVEN a subject array with `audience` `'client'`, a `subjectRef` UUID, an organisation and a trust level
- WHEN `getContribution($subject)` is called
- THEN it returns a manifest labelled `'Pet Store'` with the `petCollection` and `orderCollection` collections both scoped by `owner`
- AND a `createOrder` create-action whose `fields` whitelist is exactly `pet`, `quantity`, `shipDate`
- AND a `renamePet` endpoint-action declaring `POST /apps/petstore/api/portal/pets/rename` and no `type` key
- AND an empty `notifications` list
- @e2e exclude manifest is consumed and rendered by portaliq, not by any petstore UI — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

#### Scenario: Non-client subject receives null

- GIVEN a subject array whose `audience` is `'supplier'` (or any non-client value, or absent)
- WHEN `getContribution($subject)` is called
- THEN it returns `null`
- @e2e exclude backend-only filter logic with no petstore UI surface — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

### Requirement: Portal scoping uses domain-object UUID references (REQ-PORT-004)

The `pet` and `order` schemas in `lib/Settings/petstore_register.json` MUST
each carry an `owner` property of `type: string`, `format: uuid`, titled
"Owner", whose value is the UUID of the owner contact domain object — never a
Nextcloud user id (ADR-046 amendment A4: externals have no NC account by
premise). Because that contact object lives in portaliq's subject registry and
not in the petstore register set, OpenRegister cannot resolve a `$ref` for it;
the property MUST therefore carry `x-external-register: portaliq` rather than
a `$ref` (ADR-062 rule 7, external-reference form). The register version MUST
be bumped in the same change because the OpenRegister import is version-gated.

#### Scenario: Schemas expose the owner scoping property

- GIVEN the shipped `petstore_register.json`
- WHEN the register configuration is parsed
- THEN both the `pet` and `order` schemas define an `owner` property with `type` `string`, `format` `uuid` and `x-external-register` `portaliq`
- AND the register version is higher than the previously shipped `0.2.0`
- AND `owner` is not listed as required on either schema (existing objects stay valid)
- @e2e exclude declarative register configuration with no UI surface — covered by the JSON gates (`npm run check:register`, `check:json-strict`) and PHPUnit manifest assertions

## Non-Functional Requirements

- **Performance:** `getContribution()` is pure data assembly — no I/O, no
  container access; sub-millisecond by construction.
- **Accessibility:** N/A in petstore — the rendering surface is portaliq's SPA
  (ADR-046), which owns WCAG compliance.
- **Internationalization:** manifest labels ship in English source per fleet
  i18n policy; portaliq owns portal-side translation of contributed labels
  (ADR-005/ADR-007 apply at the rendering surface).

## Notes

- Discovery is pull-based from portaliq (`method_exists`, never
  `instanceof`); petstore registers nothing in `lib/AppInfo/Application.php`.
- Related ADRs: hydra ADR-046 (+ amendment A1–A7), ADR-019, ADR-022, ADR-005.
