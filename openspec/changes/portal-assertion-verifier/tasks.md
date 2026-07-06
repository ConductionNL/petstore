# Tasks: portal-assertion-verifier

<!-- HYDRA CAP: max 20 unindented `- [ ]` lines. This file uses 14.
     Acceptance criteria are plain bullets, not checkboxes. -->

## Implementation Tasks

### Task 1: Ship the self-contained PortalAssertionVerifier

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md#requirement-verifier-is-self-contained-and-fail-closed-req-pav-001`
- **files**: `lib/Portal/PortalAssertionVerifier.php`
- **acceptance_criteria**:
  - GIVEN the new class WHEN inspected THEN it is namespace `OCA\PetStore\Portal`, has NO `use` of any portaliq symbol and NO JWT composer dependency, uses `hash_equals` for the signature check, and carries the repo-standard EUPL-1.2/SPDX docblock plus `@spec` tags
  - GIVEN any input failing a check (structure, alg≠HS256/none, bad signature, bad claims JSON, `use`≠assertion, `iss`≠portaliq, exp missing/past, iat missing/future, empty `sub`) WHEN `verify()` is called THEN it returns null without throwing
  - GIVEN the docblock WHEN read THEN it documents the secret derivation as copied from portaliq's `PortalSessionService::__construct()`
- [x] Implement
- [x] Test

### Task 2: Match portaliq's secret derivation exactly

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md#requirement-secret-derivation-matches-portaliq-exactly-req-pav-002`
- **files**: `lib/Portal/PortalAssertionVerifier.php`
- **acceptance_criteria**:
  - GIVEN a mocked `IConfig` WHEN `getAppValue('portaliq','jwt_signing_secret','')` returns a ≥16-char value THEN that value signs/verifies; WHEN it returns ''/short THEN `getSystemValue('secret', str_pad('portaliq', 32, '_'))` is used
  - GIVEN the DI container WHEN constructing the class THEN it auto-wires from `IConfig` alone (the `?string $secretOverride=null` scalar defaults), and tests can construct it with a plain secret
- [x] Implement
- [x] Test

### Task 3: Guarded demo endpoint — controller + route

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md#requirement-demo-endpoint-acts-only-on-verified-subject-owned-data-req-pav-003`
- **files**: `lib/Controller/PortalActionController.php`, `appinfo/routes.php`, `appinfo/info.xml`
- **acceptance_criteria**:
  - GIVEN `appinfo/routes.php` WHEN parsed THEN `portal_action#renameOwnedPet` maps `POST /api/portal/pets/rename` and the method carries `#[PublicPage]` + `#[NoCSRFRequired]`
  - GIVEN the handler WHEN executed THEN order is verify→derive→authorize→act: 401 (no/invalid assertion), 400 (bad `pet`/`name`), 403 (missing pet or `owner`≠`sub`, identical), 503 (OR unresolvable), 200 `{id, name}` writing ONLY `name` via ObjectService (lazy `ContainerInterface` lookup, `_rbac`/`_multitenancy` false, metadata keys stripped before save)
  - GIVEN `appinfo/info.xml` WHEN read THEN the version is bumped to 0.1.7
- [x] Implement
- [x] Test

### Task 4: Declare the endpoint action in the contribution manifest

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-contribution/spec.md#requirement-contribution-is-a-declarative-client-manifest-req-port-003`
- **files**: `lib/Portal/PortalContributionProvider.php`
- **acceptance_criteria**:
  - GIVEN a client subject WHEN `getContribution()` is called THEN `actions` contains, after `createOrder`, `{id: 'renamePet', label, endpoint: '/apps/petstore/api/portal/pets/rename', method: 'POST'}` with no `type` key
  - GIVEN the provider class WHEN inspected THEN it remains plain and dependency-free (A1 unchanged)
- [x] Implement
- [x] Test

### Task 5: Unit tests — verifier matrix + portaliq round-trip pin

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md#requirement-portaliq-compatibility-is-pinned-by-a-round-trip-test-req-pav-004`
- **files**: `tests/Unit/Portal/PortalAssertionVerifierTest.php`
- **acceptance_criteria**:
  - GIVEN the suite WHEN run THEN it covers: valid token, expired, bad signature, wrong/missing `use` (session-token confusion), `alg: none`, wrong alg, garbage/structure, empty `sub`, future `iat`, wrong `iss`, secret precedence + instance-secret fallback (mocked IConfig), short-secret refusal — constructing with a plain secret where config is not under test
  - GIVEN the round-trip test WHEN run THEN it mints with portaliq's exact `createAssertion()` procedure (same header/claims/encoding/HMAC) and `verify()` returns the claims losslessly
- [x] Implement
- [x] Test

### Task 6: Unit tests — controller happy/401/400/403/503 paths

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md#requirement-demo-endpoint-acts-only-on-verified-subject-owned-data-req-pav-003`
- **files**: `tests/Unit/Controller/PortalActionControllerTest.php`, `tests/Unit/Portal/PortalContributionProviderTest.php`
- **acceptance_criteria**:
  - GIVEN the controller suite WHEN run via `vendor/bin/phpunit -c phpunit-unit.xml` (php 8.3 container) THEN it proves 200 happy path (only `name` written, owner match), 401 (missing + invalid header, no container access), 400, 403 (foreign owner AND unknown pet, identical body), 503 — with mocked IConfig/stub ObjectService and no real Nextcloud
  - GIVEN `PortalContributionProviderTest` WHEN updated THEN existing createOrder pins stay (union, no regression) and the new `renamePet` declaration is pinned; the full pre-existing suite still passes
- [x] Implement
- [x] Test

### Task 7: Capability specs, README recipe, gates

- **spec_ref**: `openspec/changes/portal-assertion-verifier/specs/portal-assertion-verifier/spec.md`
- **files**: `openspec/specs/portal-assertion-verifier/spec.md`, `openspec/specs/portal-contribution/spec.md`, `README.md`
- **acceptance_criteria**:
  - GIVEN the capability set WHEN listed THEN `portal-assertion-verifier` exists with status `in-progress` pointing at this change, and `portal-contribution` records the modified manifest requirement + this change in its changes list
  - GIVEN README WHEN read THEN a "Receiving portal actions (A6)" section gives the copy-me recipe (verifier class, secret rule, controller ordering, manifest declaration, test pin)
  - GIVEN the gates WHEN run in the php:8.3-cli container THEN phpunit (phpunit-unit.xml), phpcs, phpstan, psalm pass and `openspec validate` is green
- [x] Implement
- [x] Test

## Quality checklist

- All new/changed business logic covered by PHPUnit unit tests (`tests/Unit/`)
- New endpoint is server-to-server (portaliq forward) → contract covered in unit tests; no petstore UI change → no Playwright (portal UI lives in portaliq)
- All tests pass (`vendor/bin/phpunit -c phpunit-unit.xml` in the php 8.3 container) — pre-existing 27 tests included
- No user-facing strings added inside petstore (error payloads are machine-readable keys; manifest label is portal-side data, English source per i18n policy)
- `openspec validate` passes
