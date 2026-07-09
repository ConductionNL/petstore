# Design: portal-assertion-verifier

## Architecture Overview

Contract v2 (A6) action forwarding, receiving side. Portaliq authenticates the
external subject, authorises the declared action against the subject's own
aggregated manifest, and forwards server-to-server with a short-lived signed
assertion. Petstore is the domain endpoint at the end of that arrow:

```
portal client ──Bearer session──▶ portaliq POST /portal/api/actions/petstore/renamePet
                                     │  authorise against subject's own manifest
                                     │  mint X-Portal-Subject (HS256, TTL 60s,
                                     │  use="assertion", session jti)
                                     ▼
                       POST /apps/petstore/api/portal/pets/rename
                       PortalActionController::renameOwnedPet()
                          │ 1. PortalAssertionVerifier::verify(header) → claims | null → 401
                          │ 2. subjectRef := claims.sub   (NEVER from request params)
                          │ 3. pet := ObjectService->find(body.pet)  (lazy container lookup)
                          │ 4. pet.owner === subjectRef ? … : 403 (also 403 when absent)
                          ▼ 5. saveObject(name := body.name) → 200 {id, name}
```

Two new files, one route, one manifest entry:

- `lib/Portal/PortalAssertionVerifier.php` — plain class, ZERO portaliq
  imports, ZERO composer deps. Hand-rolled HS256 verification (`hash_hmac` +
  `hash_equals`), mirroring procest's proven `TenantJwtService` /
  portaliq's `PortalJwtService` shape.
- `lib/Controller/PortalActionController.php` — the guarded demo endpoint.
- `appinfo/routes.php` — `POST /api/portal/pets/rename` (registered BEFORE the
  SPA catch-all, which swallows only GET, but ordering is kept explicit).
- `PortalContributionProvider::getContribution()` — appends the declared
  endpoint action `{id: renamePet, label, endpoint, method: POST}` (contract
  vocabulary: endpoint actions have no `type` key; portaliq's create path
  requires `type === 'create'`, so the entry can never be misread as a create).

### Secret derivation (MUST match portaliq byte-for-byte)

Copied verbatim from portaliq `PortalSessionService::__construct()` (the
single place portaliq derives its signing secret, used for sessions AND
assertions):

```php
$secret = (string) $config->getAppValue('portaliq', 'jwt_signing_secret', '');
if ($secret === '' || strlen($secret) < 16) {
    $secret = (string) $config->getSystemValue('secret', str_pad('portaliq', 32, '_'));
}
```

i.e. app-config value `jwt_signing_secret` **of the portaliq app id** via
`OCP\IConfig::getAppValue()`; when absent or shorter than 16 chars, the
Nextcloud instance secret (`getSystemValue('secret')`) with portaliq's own
`str_pad('portaliq', 32, '_')` default-of-last-resort. Same instance ⇒ same
config store ⇒ same secret on both ends; nothing is exchanged out of band.
`IConfig` (not `IAppConfig`) is used deliberately so the fallback chain is the
identical API portaliq calls.

### Verifier contract

`verify(string $jwt): ?array` — returns the claims array only when ALL of the
following hold, null otherwise (fail-closed; no exceptions escape):

1. compact JWS structure: exactly three non-empty base64url segments;
2. header decodes to JSON with `alg === 'HS256'` exactly (kills `none`,
   case-tricks, and algorithm-confusion in one check);
3. signature: `hash_equals(expectedSig, actualSig)` over `header.payload`
   with the derived secret — constant-time by construction;
4. claims decode to a JSON object;
5. `use === 'assertion'` — the mirror image of portaliq's token-confusion
   guard: a (longer-lived) portal SESSION token can never drive a domain
   endpoint, exactly as an assertion can never be replayed as a session;
6. `iss === 'portaliq'` — pins the minting edge;
7. `exp` present, integer, strictly in the future;
8. `iat` present, integer, not in the future (60s leeway), and `iat <= exp`;
9. `sub` present, non-empty string — an assertion without a subject cannot
   scope anything, so it authorises nothing.

Constructor: `__construct(IConfig $config, ?string $secretOverride = null)` —
auto-wireable via DI (the optional scalar defaults to null), while unit tests
construct it with a plain secret string, mirroring how portaliq keeps
`PortalJwtService` testable with a plain secret. A derived secret shorter
than 16 chars makes `verify()` return null (portaliq refuses to *mint* with
such a secret; the receiver refuses to *accept*).

## Declarative-vs-imperative

The split follows the provider precedent. **Declarative:** the endpoint
action itself — `{id, label, endpoint, method}` is pure manifest data that
portaliq authorises and renders; petstore ships no portal UI and no forward
logic. **Imperative (deliberately):** the verifier and the controller. Token
verification is a cryptographic boundary — it cannot be expressed as
manifest data, and hiding it behind config would obscure exactly the code
copiers must read. The imperative surface is kept minimal and linear
(verify → derive → authorize → act, ~2 short methods) with the domain write
delegated to OpenRegister's ObjectService (ADR-022 — no app-local CRUD
layer). This controller is NOT a redundant OR pass-through: it exists
precisely because an external subject cannot call OR (no NC account), so a
trusted, assertion-verified, subject-scoped edge is the only correct path.

## API Design

One new endpoint (instance-local, called by portaliq's forward):

```
POST /apps/petstore/api/portal/pets/rename
Headers: X-Portal-Subject: <HS256 assertion JWT>   (the ONLY credential)
Body:    {"pet": "<pet uuid>", "name": "<new name>"}

200 {"id": "<pet uuid>", "name": "<new name>"}         renamed
400 {"error": "invalid_request"}                       pet/name missing or not a usable string
401 {"error": "unauthorized"}                          header missing / any verify() failure
403 {"error": "forbidden"}                             pet absent OR pet.owner !== sub (no existence oracle)
503 {"error": "openregister_unavailable"}              OR not resolvable / read-write failed
```

`#[PublicPage]` (portal subjects are not NC users) + `#[NoCSRFRequired]`
(server-to-server; no browser session to protect). The assertion is the
authentication — there is no fallback identity source.

## Database Changes

None. The pet already carries `owner` (added by portal-contribution, register
0.3.0); the rename mutates only `name` via `ObjectService::saveObject()` with
the strip-metadata-then-save posture (drop `@…`/`id` keys before writing back)
so the OR roundtrip cannot corrupt the object.

## Nextcloud Integration

- Controllers: `PortalActionController` (new) — extends
  `OCP\AppFramework\Controller`, standard route registration.
- Services: `PortalAssertionVerifier` is constructor-injected (auto-wired; no
  `Application.php` registration needed). OR's `ObjectService` is resolved
  lazily by string FQCN through `Psr\Container\ContainerInterface` — the
  exact `SettingsService`/portaliq pattern, so petstore keeps zero
  compile-time OR coupling.
- Events/Hooks/Middleware: none. The verify call sits in the controller
  method on purpose: the reference must show the check inline where copiers
  will look for it; a middleware abstraction is portaliq's pattern for MANY
  protected routes, overkill for one.

## Security Considerations

- **Auth = the assertion, nothing else** (A6 / ADR-005): identity comes ONLY
  from `verify()`'s returned claims. Request params choose the *target*
  (which pet) and the *effect* (the new name) — never the subject. There is
  no NC-session fallback: a logged-in admin without a valid assertion gets
  401 like anyone else (one auth path, no confused-deputy ambiguity).
- **Constant-time signature check**: `hash_equals` over the full encoded
  signature; the secret never leaves the server, is never logged, and
  rejection reasons are logged at debug level only (mirrors portaliq —
  never tell an attacker which check failed; the response is a bare 401).
- **Algorithm pinning**: only exact `HS256` is accepted; `none` and any
  RS/ES header are malformed by definition. No JWT library means no library
  alg-confusion surface.
- **Token-confusion guard, receiver side**: `use === 'assertion'` required —
  a leaked long-lived portal SESSION bearer cannot drive domain endpoints
  (portaliq enforces the inverse: assertions are rejected as sessions).
- **Replay window**: bounded by portaliq's 60s TTL + the exp check. The
  session `jti` is carried in the verified claims for audit correlation; a
  server-side jti/nonce replay cache is a deliberate non-goal for the
  reference (single-instance loopback hop, 60s window) — recorded as a
  trade-off below.
- **IDOR** (`hydra-gate-no-admin-idor` posture): the per-object guard is
  `pet.owner === claims.sub`, checked against the OR row AFTER verification
  and BEFORE any write. Both "no such pet" and "not your pet" return the
  same 403 — no existence oracle for enumerating pet UUIDs.
- **OR RBAC bypass is scoped**: `_rbac: false, _multitenancy: false` mirrors
  portaliq's reader/writer — portal subjects are not NC users, so NC-user
  RBAC would deny everything; the ownership check above IS the security
  boundary, and only `name` is writable (server-side field control: the
  endpoint writes exactly one whitelisted field, and `owner` can never be
  touched).
- **SSRF/exposure**: the endpoint is instance-local by contract; it performs
  no outbound requests and echoes back only `{id, name}`.

## File Structure

```
lib/
  Portal/
    PortalAssertionVerifier.php          (new — plain class, IConfig only)
    PortalContributionProvider.php       (+ renamePet endpoint action)
  Controller/
    PortalActionController.php           (new)
appinfo/
  routes.php                             (+ portal_action#renameOwnedPet)
  info.xml                               (0.1.6 → 0.1.7)
tests/Unit/
  Portal/PortalAssertionVerifierTest.php     (new — incl. portaliq round-trip pin)
  Portal/PortalContributionProviderTest.php  (updated — two actions)
  Controller/PortalActionControllerTest.php  (new)
openspec/
  changes/portal-assertion-verifier/         (this change)
  specs/portal-assertion-verifier/spec.md    (capability, in-progress)
  specs/portal-contribution/spec.md          (manifest requirement updated)
README.md                                    (+ "Receiving portal actions (A6)")
```

## Seed Data

No new schemas and no register changes — the endpoint operates on the pets
seeded by portal-contribution. For a live A6 demo the pet must carry an
`owner` equal to the portal subject's subjectRef. As in portal-contribution,
owner contacts live outside this change, so rows use the **nil-UUID
placeholder `00000000-0000-0000-0000-000000000000`**; the demo environment
replaces it with the real subject UUID at import time.

### Schema: `pet` (existing — demo rows the rename acts on)

| Field  | Object 1 | Object 2 | Object 3 |
|--------|----------|----------|----------|
| @self  | register `petstore`, schema `pet` | register `petstore`, schema `pet` | register `petstore`, schema `pet` |
| name   | Rex | Whiskers | Nemo |
| status | sold | available | pending |
| owner  | 00000000-0000-0000-0000-000000000000 | — (no owner → rename yields 403) | 00000000-0000-0000-0000-000000000000 |

**Related items per object:** none — the A6 demo needs only owner-scoped pet
rows. Assertions are minted by portaliq at forward time (60s TTL), so no
token/seed material exists to seed.

## Trade-offs

- **Hand-rolled HS256 vs firebase/php-jwt** — a dependency would outsource
  ~40 lines but add a supply-chain surface and an alg-confusion-prone API to
  every copying app. The fleet already has two audited hand-rolled
  precedents (procest, portaliq); the receiver mirrors them so all three
  stay reviewable side-by-side.
- **Per-app copy vs shared verifier package** — same A1 reasoning as the
  provider: a shared package would couple every domain app to a portal
  artefact. ~150 LOC of copied, test-pinned code is the accepted cost.
- **No jti replay cache** — a nonce store would shrink the replay window
  from 60s to zero but drags in state (memcache/DB) for a loopback-only hop
  portaliq already authorises per-request. Receivers with stricter threat
  models can add one; the claims expose `jti` precisely so they can.
- **403 for not-found** — hides pet existence from portal subjects at the
  cost of a less specific error for legitimate misses; the portal UI only
  ever offers pets from the subject's own collection, so the ambiguity is
  invisible in practice.
- **Verify in controller vs middleware** — one endpoint doesn't justify the
  indirection; the reference optimises for copy-readability. Apps guarding
  several A6 endpoints should promote the call into a middleware (portaliq's
  own pattern).
