# portal-contribution Specification (delta)

## MODIFIED Requirements

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
- endpoint action `renamePet` — `endpoint:
  '/apps/petstore/api/portal/pets/rename'` (instance-local absolute path),
  `method: 'POST'`, no `type` key (contract-v2 A6 vocabulary: `{id, label,
  endpoint, method, minTrust?}`);
- empty `notifications`.

The manifest MUST be pure data — no callbacks, no service calls; all subject
identity (subjectRef, audience, organisation, trust) is server-derived by
portaliq and MUST NOT be echoed back or trusted from the client.

#### Scenario: Client subject receives the manifest

- GIVEN a subject array with `audience` `'client'`, a `subjectRef` UUID, an organisation and a trust level
- WHEN `getContribution($subject)` is called
- THEN it returns a manifest labelled `'Pet Store'` with the `petCollection` and `orderCollection` collections both scoped by `owner`
- AND a `createOrder` create-action whose `fields` whitelist is exactly `pet`, `quantity`, `shipDate`
- AND a `renamePet` endpoint action declaring `endpoint` `/apps/petstore/api/portal/pets/rename` and `method` `POST`
- AND an empty `notifications` list
- @e2e exclude manifest is consumed and rendered by portaliq, not by any petstore UI — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)

#### Scenario: Non-client subject receives null

- GIVEN a subject array whose `audience` is `'supplier'` (or any non-client value, or absent)
- WHEN `getContribution($subject)` is called
- THEN it returns `null`
- @e2e exclude backend-only filter logic with no petstore UI surface — covered by PHPUnit (tests/Unit/Portal/PortalContributionProviderTest.php)
