---
status: proposed
---

# Petstore AppHost Three-Layer Tutorial

## Purpose

Petstore is the canonical teaching example for the AppHost: it demonstrates all three integration layers (pure declarative, declarative + subclass override, full imperative provider) with working, heavily-commented code, and the academy build-an-app tutorial series matches the shipped code. Per the demo-app rule, petstore keeps real code at Layers 2 and 3 by design — it is the living proof of the Extension-First Generics requirement in OpenRegister's `apphost-boilerplate-controllers`.

**Cross-references**: `openregister/openspec/changes/apphost-observability-engine/specs/`, `openregister/openspec/changes/apphost-boilerplate-controllers/specs/`, sibling mirror `nextcloud-app-template/openspec/changes/apphost-tutorial-overwrite/`.

---

## Requirements

### Requirement: Three-Layer Structure

Petstore SHALL be structured as the canonical three-layer AppHost example: Layer 1 — `routes.php` delegates to `Routes::standard()`, `Application.php` is a ~20-line `Bootstrap::register()` stub, and `src/manifest.json` carries an `observability` block (health: `database` + `orAvailable`; metrics: `pets_total` as `objectCount` on register `petstore` / schema `pet`; a `provider` descriptor) while Preferences/Settings/Dashboard/Metrics endpoints are served by the AppHost generics; Layer 2 — exactly one local controller subclass remains (`HealthController extends GenericHealthController`); Layer 3 — `ExampleMetricsProvider implements IMetricsProvider` registered via the `OCA\OpenRegister\AppHost\IMetricsProvider::petstore` alias. Each kept artifact SHALL carry tutorial-grade comments stating its layer and why it exists.

#### Scenario: Layer-1 generics serve the boilerplate endpoints

- **GIVEN** petstore is enabled with no local Dashboard/Preferences/Settings/Metrics controllers on disk
- **WHEN** `GET /apps/petstore/api/settings`, `GET /apps/petstore/api/preferences/{key}` (authenticated), and `GET /apps/petstore/api/metrics` (admin) are called
- **THEN** each MUST respond with the contract shape of the pre-restructure skeleton, served by the AppHost generic controllers via Bootstrap aliases, and the metrics output MUST use the engine-derived `petstore_` prefix (not the legacy `app_template_` prefix)
- @e2e exclude API-only endpoint — covered by the OR AppHost Newman contract collection

#### Scenario: Declared objectCount metric reflects register data

- **GIVEN** a seeded instance with N objects in the `pet` schema of the `petstore` register
- **WHEN** `GET /apps/petstore/api/metrics` is called by an admin
- **THEN** the output MUST contain `petstore_pets_total N` rendered from the manifest `objectCount` descriptor, alongside the implicit `petstore_info` and `petstore_up`
- @e2e exclude API-only endpoint — covered by the OR AppHost Newman contract collection

#### Scenario: SPA and admin settings still render through the generics

- **GIVEN** petstore is enabled
- **WHEN** a user opens `/apps/petstore/` (including a deep link handled by the catch-all) and an admin opens the petstore admin settings section
- **THEN** the SPA MUST mount (chunk-loading order preserved by the generic dashboard controller rendering `templates/index.php`) and the admin settings section MUST render via the one-line `AdminSettings`/`SettingsSection` stubs

### Requirement: Layer-2 Override Changes One Behaviour

The `HealthController` subclass SHALL demonstrably change exactly one behaviour — appending a custom `storefront` check via a single overridden protected hook — while every other health behaviour (auth posture, response shape, status/HTTP-code policy, the manifest-declared `database` and `openregister` checks) SHALL come from the generic parent untouched.

#### Scenario: Subclassed health endpoint merges declared and custom checks

- **GIVEN** a healthy instance
- **WHEN** `GET /apps/petstore/api/health` is called anonymously
- **THEN** the response MUST be HTTP 200 with the standard `{status, app, version, checks}` shape containing `checks.database = "ok"`, `checks.openregister = "ok"` (from the manifest descriptors) AND `checks.storefront = "ok"` (from the overridden hook), proving generics and override compose
- @e2e exclude API-only endpoint — covered by the OR AppHost Newman contract collection

#### Scenario: Inherited ADR-006 posture is not redeclared

- **GIVEN** the `HealthController` subclass source
- **WHEN** the hydra route-auth and semantic-auth gates inspect it
- **THEN** the endpoint MUST be public (inherited `#[PublicPage]` + `#[NoCSRFRequired]` semantics) and the subclass MUST NOT reimplement response rendering, status-code policy, or auth — only the single protected hook
- @e2e exclude API-only endpoint — covered by the OR AppHost Newman contract collection

### Requirement: Layer-3 Provider Samples in Metrics Output

The `ExampleMetricsProvider` SHALL be discovered via the `OCA\OpenRegister\AppHost\IMetricsProvider::petstore` service alias and its samples SHALL appear in the generic metrics output, merged by the `{"kind":"provider"}` descriptor.

#### Scenario: Provider sample appears in Prometheus output

- **GIVEN** petstore is enabled and `ExampleMetricsProvider` is registered via the alias in `Application.php`
- **WHEN** `GET /apps/petstore/api/metrics` is called by an admin
- **THEN** the output MUST contain the provider-emitted `petstore_store_status` sample with valid `# HELP`/`# TYPE` lines, alongside the descriptor-driven and implicit metrics
- @e2e exclude API-only endpoint — covered by the OR AppHost Newman contract collection

### Requirement: Tutorial Series Matches Shipped Code

The academy build-an-app tutorial series SHALL match the restructured petstore: affected existing parts (1 scaffold, 2 schemas-manifest, 3 calendar, 4 knowledge-and-ship, 5 advanced-manifest, 6 integrate) are updated so every petstore code sample is byte-identical to the shipped files, a new part "Declarative observability and the AppHost" exists following the series naming convention, and petstore's own README + docs/ describe the three layers. The nextcloud-app-template mirror SHALL stay byte-aligned (modulo namespace/app-id tokens) via its sibling change.

#### Scenario: Tutorial code samples are byte-identical to shipped petstore code

- **GIVEN** the published academy parts 1–6 and the new observability part
- **WHEN** each petstore code sample in the tutorials is compared against the corresponding shipped file
- **THEN** the samples MUST match the shipped code (no references to the deleted DashboardController/PreferencesController/SettingsController/MetricsController/SettingsService/ActionAuthService as files the reader hand-writes)
- @e2e exclude documentation consistency — verified by docs review task, no runtime surface

#### Scenario: Template mirror stays byte-aligned

- **GIVEN** the completed petstore restructure and the sibling `apphost-tutorial-overwrite` change in nextcloud-app-template
- **WHEN** `lib/`, `appinfo/`, `templates/`, and `src/manifest.json` of both apps are diffed modulo namespace, app id, and register JSON
- **THEN** the trees MUST be identical
- @e2e exclude documentation consistency — verified by docs review task, no runtime surface
