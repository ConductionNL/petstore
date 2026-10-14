# portal-assertion-verifier Specification (delta)

**Status**: planned
**OpenSpec changes**:
- [portal-verifier-reads-the-secret-through-iappconfig](../../) (this delta)

## ADDED Requirements

### Requirement: The verifier reads portaliq's sensitive secret decrypted, and nothing else (REQ-PAV-010)

The verifier SHALL read portaliq's `jwt_signing_secret` through `IAppConfig::getValueString('portaliq', 'jwt_signing_secret', '', lazy: false)`, which returns it decrypted, and SHALL NOT read it through `IConfig::getAppValue()`, which returns the ciphertext. It SHALL NOT fall back to the Nextcloud instance `secret`. When portaliq's secret is empty or shorter than 16 characters, every assertion SHALL be refused.

#### Scenario: Portaliq's secret is stored sensitive
- GIVEN portaliq stored its signing secret as a sensitive app value
- WHEN an assertion signed with that secret arrives
- THEN it verifies, and an assertion signed with the stored ciphertext is refused
- @e2e exclude pinned by `PortalAssertionVerifierTest::testSensitiveSecretIsReadDecryptedThroughIAppConfig`

#### Scenario: Portaliq has no secret
- GIVEN portaliq's secret is empty
- WHEN an assertion signed with the Nextcloud instance secret arrives
- THEN it is refused
- @e2e exclude pinned by `PortalAssertionVerifierTest::testNoFallbackToTheInstanceSecret`
