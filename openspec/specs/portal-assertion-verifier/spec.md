---
capability: portal-assertion-verifier
status: in-progress
built_by: openspec/changes/portal-assertion-verifier
---

# portal-assertion-verifier Specification

**Status**: in-progress
**Scope**: petstore
**OpenSpec changes**:
- [portal-assertion-verifier](../../changes/portal-assertion-verifier/) _(active)_ — fleet-reference A6 receiver: self-contained assertion verifier + guarded demo endpoint + round-trip compatibility pin (kind: code)

## Purpose

Pet Store receives portal-subject endpoint actions forwarded server-to-server
by portaliq (hydra ADR-046 contract v2, A6). This capability is the fleet's
**reference implementation** of an A6 RECEIVER: a self-contained
`X-Portal-Subject` assertion verifier (`PortalAssertionVerifier`) plus one
guarded demo endpoint (`PortalActionController::renameOwnedPet()`) whose
entire authorization is "verify the assertion, then derive all scope from the
verified claims" (ADR-005). Together with the `portal-contribution` provider
it completes the canonical contribute-and-receive example other fleet apps
copy.

## Requirements

Detailed requirements (REQ-PAV-001 … REQ-PAV-004) are defined in the active
change's delta spec —
[`openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md`](../../changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md)
— and are merged here by `openspec sync` when the change is archived. The
umbrella requirement below anchors the capability until then.

### Requirement: Pet Store ships the ADR-046 reference A6 receiver (REQ-PAV-000)

The app MUST receive forwarded portal actions through exactly two artefacts
this capability owns: the self-contained
`OCA\PetStore\Portal\PortalAssertionVerifier` (no portaliq import, no JWT
composer dependency, `hash_equals`-based HS256, portaliq-identical secret
derivation, fail-closed null on any check failure) and the guarded
`POST /apps/petstore/api/portal/pets/rename` endpoint whose only credential is
the verified `X-Portal-Subject` assertion and whose subject scope comes only
from the verified claims (`pet.owner === sub`). There MUST be no
Nextcloud-session fallback identity and no other portal-receiving surface in
petstore.

#### Scenario: Receiving surface is exactly the verifier plus the guarded endpoint

- GIVEN a petstore checkout at this capability's `in-progress` (or later) status
- WHEN portaliq forwards the declared `renamePet` action with a valid assertion
- THEN the whole receiving path resolves from `lib/Portal/PortalAssertionVerifier.php` and `lib/Controller/PortalActionController.php` (route `portal_action#renameOwnedPet`)
- AND any request lacking a valid assertion is rejected 401 with no OpenRegister access, and a non-owned or unknown pet is rejected 403
- @e2e exclude server-to-server backend surface with no petstore UI; the portal UI lives in portaliq — covered by PHPUnit (tests/Unit/Portal/PortalAssertionVerifierTest.php, tests/Unit/Controller/PortalActionControllerTest.php)

## Notes

- The verifier is deliberately NOT registered in `lib/AppInfo/Application.php`
  — it is constructor-injected into the controller and auto-wired from
  `IConfig` alone (the scalar constructor params default).
- Secret derivation is copied verbatim from portaliq's
  `PortalSessionService::__construct()` and pinned by a round-trip unit test
  that mints assertions exactly like `PortalJwtService::createAssertion()`.
- Related: hydra ADR-046 (+ amendment A6), portaliq
  `openspec/specs/portal-contribution-contract/spec.md` (forward side),
  ADR-005 (server-derived scope, fail-closed), ADR-022 (OR abstractions).
