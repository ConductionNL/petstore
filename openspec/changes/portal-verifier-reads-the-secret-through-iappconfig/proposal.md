---
kind: code
---

# Proposal: portal-verifier-reads-the-secret-through-iappconfig

## Summary

Petstore is the reference receiver the fleet copies `PortalAssertionVerifier` from. It still read portaliq's `jwt_signing_secret` through the legacy `IConfig::getAppValue()`. Portaliq stores that key sensitive, so the legacy call returns the stored ciphertext and every assertion fails its HMAC check: a 401 on every portal action, as found in the Zuiddrecht demo on 13 and 14 October 2026. The fleet's receivers now read it with `IAppConfig::getValueString('portaliq', 'jwt_signing_secret', '', lazy: false)`, which decrypts it, and no longer fall back to the Nextcloud instance `secret` (portaliq never signs with it, ADR-054). The reference now does the same, so the next copy starts right.

## What changes

- `lib/Portal/PortalAssertionVerifier.php`: the constructor takes `?IAppConfig` instead of `?IConfig`. The secret is portaliq's, read decrypted, or nothing.
- Tests: the verifier is built the way the DI container builds it. A token signed with the real secret verifies; one signed with the ciphertext, or with the instance secret, is refused. Both tests fail on the old code.
