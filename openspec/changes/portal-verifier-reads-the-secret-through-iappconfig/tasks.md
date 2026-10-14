# Tasks: portal-verifier-reads-the-secret-through-iappconfig

### Task 1: Read the sensitive secret decrypted, with no fallback
- **spec_ref**: `openspec/changes/portal-verifier-reads-the-secret-through-iappconfig/specs/portal-assertion-verifier/spec.md#requirement-the-verifier-reads-portaliqs-sensitive-secret-decrypted-and-nothing-else-req-pav-010`
- **files**: `lib/Portal/PortalAssertionVerifier.php`, `tests/Unit/Portal/PortalAssertionVerifierTest.php`, `tests/Unit/Controller/PortalActionControllerTest.php`
- [x] Implement
- [x] Test (fails on the old code)
