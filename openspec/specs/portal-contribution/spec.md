---
capability: portal-contribution
status: in-progress
built_by: openspec/changes/portal-contribution
---

# portal-contribution Specification

**Status**: in-progress
**Scope**: petstore
**OpenSpec changes**:
- [portal-contribution](../../changes/portal-contribution/) _(active)_ — reference ADR-046 provider class + `owner` scoping property + unit tests (kind: code)
- [portal-assertion-verifier](../../changes/portal-assertion-verifier/) _(active)_ — MODIFIES the client manifest (REQ-PORT-003): declares the `renamePet` endpoint action (contract v2, A6) forwarded to the receiver owned by the `portal-assertion-verifier` capability (kind: code)

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

Detailed requirements (REQ-PORT-001 … REQ-PORT-004) are defined in the active
change's delta spec —
[`openspec/changes/portal-contribution/specs/portal-contribution/spec.md`](../../changes/portal-contribution/specs/portal-contribution/spec.md)
— and are merged here by `openspec sync` when the change is archived. The
umbrella requirement below anchors the capability until then.

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

## Notes

- Discovery is pull-based from portaliq (`method_exists`, never
  `instanceof`); petstore registers nothing in `lib/AppInfo/Application.php`.
- Related ADRs: hydra ADR-046 (+ amendment A1–A7), ADR-019, ADR-022, ADR-005.
