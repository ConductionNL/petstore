---
capability: portal-assertion-verifier
status: in-progress
built_by: openspec/changes/portal-assertion-verifier
---

# portal-assertion-verifier Specification

**Status**: in-progress
**Scope**: petstore
**OpenSpec changes**:
- `openspec/changes/portal-assertion-verifier/` — _archived_ (removed from the
  tree in `67266cd`, 2026-07-10). Its delta requirements REQ-PAV-001 …
  REQ-PAV-004 are merged into this document below, which is now their only
  home. Nothing links to the change directory any more, because it no longer
  exists.

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

REQ-PAV-000 below is the umbrella requirement; REQ-PAV-001 … REQ-PAV-004 are
the detailed requirements, merged in from the archived change's delta spec.

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
- THEN the whole receiving path resolves from `lib/Portal/PortalAssertionVerifier.php` and `lib/Controller/PortalActionController.php` (route `portalAction#renameOwnedPet`)
- AND any request lacking a valid assertion is rejected 401 with no OpenRegister access, and a non-owned or unknown pet is rejected 403
- @e2e exclude server-to-server backend surface with no petstore UI; the portal UI lives in portaliq — covered by PHPUnit (tests/Unit/Portal/PortalAssertionVerifierTest.php, tests/Unit/Controller/PortalActionControllerTest.php)

### Requirement: Verifier is self-contained and fail-closed (REQ-PAV-001)

The app MUST ship `OCA\PetStore\Portal\PortalAssertionVerifier` as a plain
class with no portaliq imports and no JWT composer dependency (hand-rolled
HS256 per the procest `TenantJwtService` precedent). `verify(string $jwt):
?array` MUST return the full claims array only when every check passes and
null on ANY failure — malformed structure, non-`HS256` header (including
`none`), signature mismatch, undecodable claims, wrong or missing `use`,
wrong `iss`, missing/expired `exp`, missing/future `iat`, or empty `sub`. It
MUST never throw and MUST log rejection reasons at debug level only. The
signature comparison MUST use `hash_equals` (constant time).

#### Scenario: A freshly minted portaliq assertion verifies

- GIVEN an HS256 token minted with portaliq's exact assertion claim set (`sub`, `audience`, `organisation`, `trust`, `jti`, `use: "assertion"`, `iat`, `exp`, `iss: "portaliq"`) and the shared secret
- WHEN `verify()` is called within the 60-second TTL
- THEN it returns the claims array with `sub`, `organisation`, and `jti` intact
- @e2e exclude backend crypto boundary with no UI surface; portaliq↔petstore compatibility is pinned by the PHPUnit round-trip test (tests/Unit/Portal/PortalAssertionVerifierTest.php)

#### Scenario: Tampered, expired, and confused tokens all yield null

- GIVEN tokens that are (a) signed with a different secret, (b) expired, (c) `alg: none`, (d) missing or non-`assertion` `use` (i.e. a portal SESSION token), or (e) structurally garbage
- WHEN `verify()` is called on each
- THEN every call returns null and no exception escapes
- @e2e exclude fail-closed rejection matrix is pure backend logic — covered exhaustively by PHPUnit (tests/Unit/Portal/PortalAssertionVerifierTest.php)

### Requirement: Secret derivation matches portaliq exactly (REQ-PAV-002)

The verifier MUST derive the HMAC secret exactly as portaliq's
`PortalSessionService` does: `IConfig::getAppValue('portaliq',
'jwt_signing_secret', '')`; when that value is empty or shorter than 16
characters, `IConfig::getSystemValue('secret', str_pad('portaliq', 32,
'_'))`. The secret MUST never come from the request. The constructor MUST be
DI-auto-wireable from `IConfig` alone while also accepting a plain secret
string override for tests. A derived secret shorter than 16 characters MUST
make `verify()` return null.

#### Scenario: App-config secret takes precedence over the instance secret

- GIVEN `portaliq`/`jwt_signing_secret` is set to a value of 16+ characters
- WHEN the verifier checks a token signed with that value
- THEN verification succeeds, and a token signed with the instance secret instead fails
- @e2e exclude config-sourcing branch is backend-only — covered by PHPUnit with a mocked IConfig (tests/Unit/Portal/PortalAssertionVerifierTest.php)

#### Scenario: Fallback to the instance secret

- GIVEN `portaliq`/`jwt_signing_secret` is unset (or shorter than 16 chars)
- WHEN the verifier checks a token signed with the Nextcloud instance secret
- THEN verification succeeds
- @e2e exclude config-sourcing branch is backend-only — covered by PHPUnit with a mocked IConfig (tests/Unit/Portal/PortalAssertionVerifierTest.php)

### Requirement: Demo endpoint acts only on verified, subject-owned data (REQ-PAV-003)

The app MUST expose `POST /apps/petstore/api/portal/pets/rename`
(`PortalActionController::renameOwnedPet()`, `#[PublicPage]` +
`#[NoCSRFRequired]`) whose ONLY authentication is the `X-Portal-Subject`
assertion. It MUST return 401 when the header is missing or `verify()`
returns null; 400 when `pet` or `name` is missing/not a non-empty string;
403 when the pet does not exist OR its `owner` does not equal the verified
`sub` claim (same status for both — no existence oracle); and on success it
MUST update ONLY the pet's `name` via OpenRegister's ObjectService and
return 200 with `{id, name}`. Subject scope MUST be derived exclusively from
the verified claims, never from request parameters, and there MUST be no
Nextcloud-session fallback identity.

#### Scenario: Owner renames their pet through the forward

- GIVEN a pet whose `owner` equals the assertion's `sub`
- WHEN portaliq forwards `{"pet": "<uuid>", "name": "Rexington"}` with a valid assertion
- THEN the response is 200 with the pet id and the new name, and only the `name` field is written
- @e2e exclude server-to-server receiver with no petstore UI; the portal UI lives in portaliq — covered by PHPUnit with a stubbed ObjectService (tests/Unit/Controller/PortalActionControllerTest.php)

#### Scenario: Missing or invalid assertion fails closed

- GIVEN a request without an `X-Portal-Subject` header, or with an expired/forged one
- WHEN the endpoint is called
- THEN the response is 401 and no OpenRegister read or write occurs
- @e2e exclude fail-closed auth path is backend-only — covered by PHPUnit (tests/Unit/Controller/PortalActionControllerTest.php)

#### Scenario: Foreign or unknown pets are refused identically

- GIVEN a valid assertion whose `sub` does not match the target pet's `owner`, or a pet uuid that does not exist
- WHEN the endpoint is called
- THEN the response is 403 in both cases and nothing is written
- @e2e exclude ownership guard is backend-only — covered by PHPUnit (tests/Unit/Controller/PortalActionControllerTest.php)

### Requirement: Portaliq compatibility is pinned by a round-trip test (REQ-PAV-004)

The unit suite MUST contain a round-trip test that mints an assertion using
portaliq's exact procedure (same header, same claim set and order semantics,
same base64url encoding, same HMAC input) and MUST assert `verify()` accepts
it — so any drift in either side's token format fails CI rather than
production forwards.

#### Scenario: Portaliq-style mint verifies locally

- GIVEN a mint helper that replicates `PortalJwtService::createAssertion()` byte-for-byte
- WHEN its output is passed to `PortalAssertionVerifier::verify()`
- THEN the claims round-trip losslessly
- @e2e exclude compatibility pin is a pure unit concern (tests/Unit/Portal/PortalAssertionVerifierTest.php); the live pair is exercised in portaliq's own Newman/e2e suites

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
