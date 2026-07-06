---
kind: code
---

# Proposal: portal-contribution

## Summary

Ship the fleet's **reference** ADR-046 portal contribution in the Pet Store demo
app: one plain, dependency-free class
(`lib/Portal/PortalContributionProvider.php`) that declares what a portal
*client* may see and do (their pets, their orders, placing an order), plus an
`owner` UUID scoping property on the `pet` and `order` schemas so portaliq can
scope reads and creates to the authenticated external subject. This is the
Wave-0 "petstore reference provider" deliverable named in the ADR-046
amendment (contribution contract v2, hydra main 2026-07-06); every other fleet
app copies this shape.

## Motivation

ADR-046 establishes portaliq as the single external portal for people without
Nextcloud accounts; its 2026-07-06 amendment defines contribution contract v2
(multi-audience providers, trust levels, UUID subject scoping). Domain apps
contribute by shipping one duck-typed class — no portaliq import, no info.xml
dependency — so portal support is always optional (amendment A1). Because
petstore is the Conduction app-template demo, it must carry the canonical,
copy-me implementation of that contract: both `getAudiences()` (v2, preferred)
and `getAudience()` (v1 fallback), a fully declarative manifest, and
domain-object UUID scoping instead of Nextcloud user ids (amendment A4).
Without this reference, Wave 1–3 apps have no vetted example to copy and the
tutorial cannot be written.

## Affected Projects

- [x] Project: `petstore` — new `lib/Portal/PortalContributionProvider.php`, `owner` property on `pet` + `order` schemas in `lib/Settings/petstore_register.json` (register version bump), unit tests under `tests/Unit/Portal/`.

## Scope

### In Scope

- A plain `OCA\PetStore\Portal\PortalContributionProvider` class (no
  portaliq imports, no `implements` clause) exposing `getAudiences()`,
  `getAudience()`, and `getContribution(array $subject): ?array`.
- Declarative client manifest: `petCollection` + `orderCollection`
  (both scoped by `owner`), a `createOrder` create-action with a field
  whitelist (`pet`, `quantity`, `shipDate`), empty `notifications`.
- `owner` property (`type: string`, `format: uuid`) on the `pet` and `order`
  schemas + register version bump so the version-gated import picks it up.
- PHPUnit unit tests for the provider's full contract.
- OpenSpec capability `portal-contribution` (this change).

### Out of Scope

- Any portal UI, auth edge, inbox, or rendering — portaliq owns the entire
  external surface (ADR-046); petstore ships zero portal frontend.
- Claim maps (`scopeClaim`), two-hop `via` joins, `minTrust` thresholds, and
  endpoint actions (amendment A3–A6) — the client demo needs none of them;
  the design records why so copiers know when they *would* use them.
- Seeding real owner contact objects and the end-to-end tutorial (the Wave-0
  tutorial is a separate deliverable; seed placeholders are documented in
  design.md).
- Any change to portaliq itself — contract v2 lands there in parallel.

## Approach

Duck-typed discovery per amendment A1: portaliq's registry resolves
`OCA\{App}\Portal\PortalContributionProvider` by FQCN and probes it with
`method_exists` — so petstore ships a plain class with the three contract
methods and nothing else. The contribution itself is a declarative manifest
(data, not behaviour); the provider class is merely the ADR-046 delivery
vehicle. Scoping follows amendment A4: `owner` holds the UUID of the owner
contact (a domain object reference), never a Nextcloud user id. Details in
design.md.

## New Dependencies

None. The provider is dependency-free by contract; the class is inert when
portaliq is not installed.

## Impact

- `lib/Portal/PortalContributionProvider.php` — new, self-contained.
- `lib/Settings/petstore_register.json` — additive `owner` property on `pet`
  and `order`; register/schema versions bumped (import is version-gated).
- `tests/Unit/Portal/PortalContributionProviderTest.php` — new.
- No routes, controllers, services, frontend, or info.xml changes.

## Cross-Project Dependencies

None at build or install time (that is the point of amendment A1). At runtime,
portaliq — when installed — discovers and renders the contribution; contract
v2 is being implemented in portaliq in parallel, which is why the provider
implements both the v1 and v2 audience methods.

## Risks

### Risk 1: Contract v2 drift while portaliq lands in parallel

**Severity:** Medium — **Mitigation:** implement both `getAudiences()` (v2)
and `getAudience()` (v1 fallback) and use only manifest keys fixed by the
ADR-046 amendment (`label`, `collections`, `actions`, `notifications`,
`scopeField`, create-action `fields`). Unit tests pin the exact shape so any
later contract change is a visible, reviewed edit.

### Risk 2: Register re-import misses the new `owner` property

**Severity:** Low — **Mitigation:** the import is version-gated, so the
register and the two touched schema versions are bumped (0.2.0 → 0.3.0) in
the same edit; JSON validity is verified mechanically.

## Rollback Strategy

Delete `lib/Portal/` and `tests/Unit/Portal/` and revert the register JSON.
The `owner` property is additive and optional, so no object data is lost;
existing objects simply keep no `owner` value. Without the provider class,
portaliq discovery finds nothing and the portal shows no Pet Store section —
the app itself is unaffected.
