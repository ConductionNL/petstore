---
kind: code
---

# Proposal: Petstore — AppHost Three-Layer Tutorial Restructure

## The demo-app rule (read this first)

**petstore and nextcloud-app-template are the example/tutorial apps — they ALWAYS keep actual code, because we tutorial the override mechanism itself.** This change is therefore deliberately NOT a pure `adopt-apphost` adoption like the other 17 leaf-app changes. Where a production app deletes everything the AppHost generics cover, petstore deletes only what Layer 1 makes declarative and *keeps curated, heavily-commented teaching artifacts* at Layers 2 and 3. Petstore is the living proof of the "Extension-First Generics" requirement in `apphost-boilerplate-controllers` (no `final`, protected hooks, every behaviour overridable) — if the tutorial subclass can't be written, that requirement has failed.

## Problem

Petstore's skeleton is today a full hand-written copy of the fleet boilerplate: 5 controllers, 2 services, 2 repair steps, AdminSettings + SettingsSection, a ~100-line `Application.php`, and a 27-line `routes.php` — exactly the drift-generating duplication the AppHost (`apphost-observability-engine` + `apphost-boilerplate-controllers` in OpenRegister) eliminates. The drift is already visible inside petstore itself: `MetricsController::METRIC_PREFIX` is `'app_template'`, not `'petstore'` — a copy-paste artifact that would mislabel every Prometheus sample. Meanwhile, the academy "build an app" tutorial series uses petstore as its canonical sample domain and currently teaches readers to hand-write all of this boilerplate; once the fleet runs on AppHost, the tutorial would be teaching an anti-pattern.

## Proposed Change

Restructure petstore into the canonical **three-layer teaching example** for the AppHost:

### Layer 1 — pure declarative (the 95% path)

- `appinfo/routes.php` → `return \OCA\OpenRegister\AppHost\Routes::standard();` (one statement; commented to explain `$extra` for app-specific routes).
- `lib/AppInfo/Application.php` → ~20-line stub: `APP_ID` const + `Bootstrap::register($context, self::APP_ID)`, plus the existing teaching registrations (ExampleWidget, MCP ExampleToolProvider alias, Layer-3 metrics-provider alias) each with a comment explaining it is a passthrough/extension, not boilerplate.
- `src/manifest.json` gains an `observability` block with two simple worked-example descriptors:
  - health: `{"id": "database", "type": "database"}` and `{"id": "openregister", "type": "orAvailable"}`;
  - metrics: `{"name": "pets_total", "type": "gauge", "help": "Pets in the store", "source": {"kind": "objectCount", "register": "petstore", "schema": "pet"}}` — slugs resolved from `lib/Settings/petstore_register.json` (register slug `petstore`; schema slugs `pet`, `category`, `order`);
  - plus the `{"name": "store_status", "source": {"kind": "provider"}}` descriptor wiring Layer 3.
- Preferences, Settings, Dashboard, and Metrics endpoints are served by the generics via `Bootstrap::register()` aliases — the local copies are deleted. The `app_template` metric-prefix bug dies with the deleted controller (prefix becomes engine-derived `petstore_`).

### Layer 2 — declarative + override (the subclass escape)

Keep exactly ONE local controller as a heavily-commented subclass example: `lib/Controller/HealthController.php` becomes `class HealthController extends GenericHealthController`, overriding one protected hook to append a custom `storefront` check on top of the manifest-declared checks. The comments are the tutorial: WHY you would subclass (a check that needs app logic the closed descriptor set can't express), WHEN you should not (anything the 5 declarative check types already cover), and HOW the alias in `Bootstrap`/`Application.php` is repointed at the subclass.

### Layer 3 — full imperative escape hatch (the provider)

New `lib/Observability/ExampleMetricsProvider.php` implementing `OCA\OpenRegister\AppHost\IMetricsProvider`, heavily commented, registered in `Application.php` via the ADR-035 alias pattern (`OCA\OpenRegister\AppHost\IMetricsProvider::petstore`) and pulled into the metrics output by the `{"kind":"provider"}` descriptor above. It emits a small deterministic sample (e.g. `petstore_store_status`) so e2e/Newman can assert the provider path works. Comments explain: this is where genuinely custom logic goes (circuit-breaker state, parsed files — things no descriptor kind expresses), and that a third app needing the same logic is the signal to propose a new descriptor kind via ADR-040.

### Explicit delete / keep decision per file

| File | Decision | Rationale |
|---|---|---|
| `lib/Controller/DashboardController.php` | **DELETE** | Layer 1 — `GenericDashboardController` via Bootstrap alias |
| `lib/Controller/PreferencesController.php` | **DELETE** | Layer 1 — `GenericPreferencesController` |
| `lib/Controller/SettingsController.php` | **DELETE** | Layer 1 — `GenericSettingsController` |
| `lib/Controller/MetricsController.php` | **DELETE** | Layer 1 — generic + descriptors; removes the `app_template` prefix bug |
| `lib/Controller/HealthController.php` | **REWRITE → KEEP** | Layer 2 teaching subclass of `GenericHealthController` (one hook override, tutorial-grade comments) |
| `lib/Service/SettingsService.php` | **DELETE** | Layer 1 — `AppHostSettingsService` covers register/schema config + `isOpenRegisterAvailable()`; petstore has no domain residue |
| `lib/Service/ActionAuthService.php` | **DELETE** | Layer 1 — `GenericActionAuthService` (reads `lib/actions.seed.json`, which stays) |
| `lib/Repair/InitializeSettings.php` | **REWRITE → one-line stub** | `extends GenericInitializeSettings {}` — info.xml `<repair-steps>` requires a concrete class in the app namespace (acceptable floor per boilerplate design.md) |
| `lib/Repair/InitializeActions.php` | **REWRITE → one-line stub** | same constraint |
| `lib/Settings/AdminSettings.php` | **REWRITE → one-line stub** | `extends GenericAdminSettings {}` — info.xml `<settings>` requires concrete class; #299 IDelegatedSettings pattern now inherited |
| `lib/Sections/SettingsSection.php` | **REWRITE → one-line stub** | `extends GenericSettingsSection {}` |
| `lib/Dashboard/ExampleWidget.php` | **KEEP** | already a teaching artifact (NC dashboard widget API, not AppHost boilerplate); Bootstrap passthrough noted in comments |
| `lib/Mcp/ExampleToolProvider.php` | **KEEP** | teaching artifact for the ADR-034/035 alias pattern — the exact pattern Layer 3 reuses |
| `lib/Listener/DeepLinkRegistrationListener.php` | **KEEP** | teaching artifact; comment notes the declarative alternative (manifest `deepLinks` block → `GenericDeepLinkRegistrationListener`) so the tutorial shows both forms |
| `lib/Observability/ExampleMetricsProvider.php` | **NEW** | Layer 3 escape hatch |
| `lib/AppInfo/Application.php` | **REWRITE** | Layer 1 stub + commented teaching registrations |
| `appinfo/routes.php` | **REWRITE** | `Routes::standard()` one-liner |
| `src/manifest.json` | **MODIFY** | add `observability` block |
| `templates/index.php` | **KEEP** | generic chunk loader stays until the OR-served shell follow-up lands (boilerplate design.md open question) |
| `lib/Settings/petstore_register.json`, `lib/actions.seed.json` | **KEEP** | the data model and action seeds ARE the declarative app |

## Tutorial and documentation impact (first-class scope, not an afterthought)

Petstore is the canonical sample domain of the academy **build-an-app tutorial series** (`conduction-website/academy/`, parts 0–8). This change rewrites the affected parts so the published tutorials match the shipped code, adds a NEW series part "Declarative observability and the AppHost", and updates petstore's own `docs/` + `README.md` to describe the three layers. See tasks.md §4 for the per-part breakdown. **Mirror constraint**: every code change here must be mirrored byte-aligned into `nextcloud-app-template` via its sibling change `apphost-tutorial-overwrite` (that repo's `openspec/changes/apphost-tutorial-overwrite/`).

## Impact

- **Deleted**: 4 controllers + 2 services (~800 lines of drift-prone boilerplate).
- **Rewritten**: `HealthController` (Layer-2 subclass), `Application.php`, `routes.php`, 4 one-line stubs.
- **New**: `ExampleMetricsProvider`, manifest `observability` block.
- **Docs**: 6 academy parts updated, 1 new part, petstore docs/ + README.
- **Risk**: tutorial readers on old series parts see code that no longer exists — mitigated by updating all affected parts in the same change and keeping the new part's "before/after" framing.
- **Tests**: existing vitest/Playwright/Newman suites must stay green; petstore's `@nextcloud/l10n` detectLanguage blank-UI regression (fixed earlier) is a known sensitivity — the e2e suite that guards it must not be weakened.

## Dependencies

Chained on OpenRegister's `apphost-observability-engine` and `apphost-boilerplate-controllers` (see hydra.json `depends_on`). Sibling: `apphost-tutorial-overwrite` in nextcloud-app-template (byte-alignment mirror).
