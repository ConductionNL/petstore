---
kind: code
---

# Proposal: portal-assertion-verifier

## Summary

Ship the fleet's **REFERENCE** ADR-046 contract-v2 **A6 endpoint-action
RECEIVER** in the Pet Store demo app: one self-contained verifier class
(`lib/Portal/PortalAssertionVerifier.php`) that validates the short-lived
`X-Portal-Subject` HS256 assertion portaliq attaches to server-to-server
action forwards, plus one guarded demo endpoint
(`POST /apps/petstore/api/portal/pets/rename` →
`PortalActionController::renameOwnedPet()`) whose entire authorization is
"verify the assertion, then derive ALL scope from the verified claims". The
existing `PortalContributionProvider` manifest gains the matching declared
endpoint action so portaliq can forward to it. Together with the merged
portal-contribution reference provider this completes petstore's canonical
copy-me example: contribute (provider) **and** receive (verifier + endpoint).

## Motivation

ADR-046 contract v2 (A6) lets a contribution declare
`{id, label, endpoint, method, minTrust?}` actions that portaliq forwards
server-to-server with a signed 60-second `X-Portal-Subject` assertion — the
client's bearer is never relayed. Portaliq's side (mint + forward) is merged;
what the fleet lacks is a vetted RECEIVING side: how a domain app verifies the
assertion (constant-time HS256, exp/iat sanity, `use === "assertion"`), how it
sources the SAME signing secret portaliq used (app config
`portaliq.jwt_signing_secret`, fallback instance secret), and how it derives
subject scope exclusively from verified claims (never request params —
ADR-005). Without this reference, every Wave 1–3 app would reinvent JWT
verification on a security boundary — the exact class of code that must be
copied, not improvised.

## Affected Projects

- [x] Project: `petstore` — new `lib/Portal/PortalAssertionVerifier.php` + `lib/Controller/PortalActionController.php`, one route in `appinfo/routes.php`, endpoint action declared in `lib/Portal/PortalContributionProvider.php`, unit tests under `tests/Unit/`, README recipe section.

## Scope

### In Scope

- `OCA\PetStore\Portal\PortalAssertionVerifier` — self-contained (no portaliq
  import, no firebase/php-jwt), hand-rolled HS256 verify with `hash_equals`,
  mirroring procest's `TenantJwtService` precedent. `verify(string $jwt):
  ?array` — claims array or null, fail-closed on everything.
- Secret sourcing that MATCHES portaliq's derivation exactly (see design.md).
- Demo guarded endpoint: `POST /api/portal/pets/rename` — rename a pet the
  asserted subject owns (`pet.owner === claims.sub`), 401/403 fail-closed.
- Declared endpoint action `renamePet` in the existing contribution manifest.
- Unit tests: verifier matrix, controller happy/401/403 paths, and a
  round-trip test minting a token exactly the way portaliq does (compat pin).
- README section "Receiving portal actions (A6)" — the copy-me recipe.
- OpenSpec capability `portal-assertion-verifier` (this change) + a MODIFIED
  delta on `portal-contribution` (manifest now declares the endpoint action).

### Out of Scope

- Any change to portaliq — the forward side is merged; this change only
  receives.
- Session verification / portal login — assertions are the ONLY token petstore
  ever sees; portal sessions never reach domain apps by contract.
- Revocation lookups against the session `jti` — the claim is carried for
  audit correlation; a 60-second TTL bounds the exposure window (recorded as a
  known trade-off in design.md).
- A shared fleet library for the verifier — deliberate per-app copy (same
  reasoning as the provider: A1 forbids coupling; ~150 LOC is the accepted
  duplication cost). Recorded in design.md trade-offs.
- New schemas, register changes, or frontend — the rename endpoint operates on
  the existing `pet` schema through OpenRegister.

## Approach

Mirror the two proven precedents. (1) The verifier is a plain class like the
provider — portaliq is never imported; the token format is pinned by the
contract spec and by a round-trip unit test that mints assertions with the
identical claim set + signing procedure portaliq uses. (2) The controller
follows portaliq's fail-closed edge posture: `#[PublicPage]` +
`#[NoCSRFRequired]` (server-to-server; the assertion IS the auth), verify
first, 401 on any verification failure, then load the pet via OpenRegister's
`ObjectService` (lazy `ContainerInterface` lookup, exactly like
`SettingsService`) and enforce `owner === sub` before writing. Details in
design.md.

## New Dependencies

None. No composer packages (hand-rolled HS256 — ~40 lines — beats a
firebase/php-jwt dependency for one HMAC verify), no portaliq coupling, no
info.xml dependency changes.

## Impact

- `lib/Portal/PortalAssertionVerifier.php` — new, self-contained.
- `lib/Controller/PortalActionController.php` — new.
- `appinfo/routes.php` — one POST route (before the SPA catch-all).
- `lib/Portal/PortalContributionProvider.php` — one declared endpoint action
  appended to the manifest `actions` list.
- `appinfo/info.xml` — version bump 0.1.6 → 0.1.7.
- `tests/Unit/Portal/PortalAssertionVerifierTest.php`,
  `tests/Unit/Controller/PortalActionControllerTest.php` — new;
  `tests/Unit/Portal/PortalContributionProviderTest.php` — updated for the
  second action (union — the createOrder pins stay).
- `README.md` — new "Receiving portal actions (A6)" section.

## Cross-Project Dependencies

None at build or install time (A1). At runtime the endpoint is only ever
called by portaliq's forward (or by tests); without portaliq installed the
route exists but every request lacks a valid assertion and fails closed 401.
The compatibility contract with portaliq (claim set, signing, secret
derivation) is pinned by the round-trip unit test.

## Risks

### Risk 1: Secret-derivation drift between portaliq and receivers

**Severity:** High (silent 401s on every forward) — **Mitigation:** the
derivation is copied verbatim from portaliq's `PortalSessionService`
constructor, documented in the verifier docblock with a pointer to the
source of truth, and the round-trip test pins the full claim set + signing
procedure so any format drift fails the suite, not production.

### Risk 2: The demo endpoint becomes an unauthenticated write surface

**Severity:** High — **Mitigation:** fail-closed ordering (verify → derive →
authorize → act), no fallback identity source, `owner === sub` enforced
against the OpenRegister row before the write, and 403 for both "not found"
and "not owned" (no existence oracle). Unit tests cover every rejection path.

## Rollback Strategy

Delete `lib/Portal/PortalAssertionVerifier.php`,
`lib/Controller/PortalActionController.php`, the route, the manifest action
entry, and the new tests; revert the README section. No data model changes —
nothing to migrate. Portaliq-side forwards to the removed action simply 403 at
portaliq (action no longer in the aggregated manifest).
