# Tasks: portal-contribution

<!-- HYDRA CAP: max 20 unindented `- [ ]` lines. This file uses 10.
     Acceptance criteria are plain bullets, not checkboxes. -->

## Implementation Tasks

### Task 1: Add `owner` scoping property to `pet` and `order` schemas

- **spec_ref**: `openspec/changes/portal-contribution/specs/portal-contribution/spec.md#requirement-portal-scoping-uses-domain-object-uuid-references-req-port-004`
- **files**: `lib/Settings/petstore_register.json`
- **acceptance_criteria**:
  - GIVEN the shipped register JSON WHEN parsed THEN `pet` and `order` each define `owner` (`type: string`, `format: uuid`, title "Owner", description marking it as the portal-subject/owner contact reference — a domain object UUID, not an NC user id)
  - GIVEN the previous version 0.2.0 WHEN the file is compared THEN the register and both touched schema versions are bumped to 0.3.0 (`info.version` included) and `owner` is NOT in either `required` list
  - GIVEN the edited file WHEN loaded with `python3 -c "import json; json.load(...)"` THEN it parses without error
- [ ] Implement
- [ ] Test

### Task 2: Ship the plain PortalContributionProvider class

- **spec_ref**: `openspec/changes/portal-contribution/specs/portal-contribution/spec.md#requirement-provider-is-a-plain-dependency-free-class-req-port-001`
- **files**: `lib/Portal/PortalContributionProvider.php`
- **acceptance_criteria**:
  - GIVEN the new class WHEN inspected THEN it is namespace `OCA\PetStore\Portal`, has NO `use` of any portaliq symbol, NO `implements` clause, NO constructor dependencies, and carries the repo-standard EUPL-1.2/SPDX docblock header plus `@spec` tags
  - GIVEN portaliq is absent WHEN the app runs THEN nothing references the class (no DI registration, no route) — it is inert
- [ ] Implement
- [ ] Test

### Task 3: Implement the v2+v1 audience contract and the client manifest

- **spec_ref**: `openspec/changes/portal-contribution/specs/portal-contribution/spec.md#requirement-contribution-is-a-declarative-client-manifest-req-port-003`
- **files**: `lib/Portal/PortalContributionProvider.php`
- **acceptance_criteria**:
  - GIVEN the provider WHEN `getAudiences()` / `getAudience()` are called THEN they return `['client']` / `'client'` (REQ-PORT-002)
  - GIVEN a non-client or audience-less subject WHEN `getContribution()` is called THEN it returns `null`
  - GIVEN a client subject WHEN `getContribution()` is called THEN the manifest has label `Pet Store`; collections `petCollection` (petstore/pet, scopeField `owner`, listable) and `orderCollection` (petstore/order, scopeField `owner`, listable); action `createOrder` (`type: create`, petstore/order, fields exactly `pet`,`quantity`,`shipDate`); `notifications: []`
- [ ] Implement
- [ ] Test

### Task 4: Unit-test the full provider contract

- **spec_ref**: `openspec/changes/portal-contribution/specs/portal-contribution/spec.md#requirement-provider-declares-both-v2-and-v1-audience-methods-req-port-002`
- **files**: `tests/Unit/Portal/PortalContributionProviderTest.php`
- **acceptance_criteria**:
  - GIVEN the test class WHEN it constructs the provider THEN it does so directly (`new`, no mocks/container) following existing `tests/Unit/` conventions
  - GIVEN the suite WHEN run via `vendor/bin/phpunit -c phpunit-unit.xml` (php 8.3 container) THEN it asserts audiences, null for non-client subjects, manifest shape incl. `scopeField: owner`, and the exact create-order field whitelist — and passes
- [ ] Implement
- [ ] Test

### Task 5: Register the capability spec and pass the quality gates

- **spec_ref**: `openspec/changes/portal-contribution/specs/portal-contribution/spec.md`
- **files**: `openspec/specs/portal-contribution/spec.md`, `openspec/changes/portal-contribution/*`
- **acceptance_criteria**:
  - GIVEN the declared capability WHEN the change is in flight THEN `openspec/specs/portal-contribution/spec.md` exists with status `in-progress` pointing at this change
  - GIVEN the repo gates WHEN run (php -l, phpcs, phpstan, unit suite via the php:8.3-cli container; `openspec validate`) THEN the new/changed files pass with zero new violations
- [ ] Implement
- [ ] Test

## Quality checklist

- All new/changed business logic covered by PHPUnit unit tests (`tests/Unit/`)
- No new API endpoints → no Newman collection needed; no UI change → no Playwright needed (portal renders in portaliq)
- All tests pass (`vendor/bin/phpunit -c phpunit-unit.xml` in the php 8.3 container)
- No user-facing strings added inside petstore (manifest labels are portal-side data; English source per i18n policy)
- `openspec validate` passes
