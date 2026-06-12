# Tasks: Petstore — AppHost Three-Layer Tutorial Restructure

## 0. Baseline

- [ ] 0.1 Verify the OpenRegister AppHost changes are merged and deployed in the dev environment (`apphost-observability-engine` + `apphost-boilerplate-controllers`): `OCA\OpenRegister\AppHost\{Bootstrap,Routes}` resolve, `GenericHealthController`/`GenericMetricsController` exist, the parameterised Newman contract collection is available. Do NOT start the restructure against a stub OR.
- [ ] 0.2 Capture the pre-change baseline on a seeded dev instance: `GET /apps/petstore/api/health`, `/api/metrics`, `/api/settings`, `/api/preferences/{key}`, and `GET /apps/petstore/` (SPA page) — record status codes, response shapes, and the Prometheus sample names (note the pre-existing `app_template_*` prefix bug; post-change prefix MUST be `petstore_`).
- [ ] 0.3 Run the existing test suites green before touching anything: PHPUnit (`phpunit-unit.xml`), vitest, Playwright e2e (`tests/e2e/`), Newman (`tests/integration/run-newman.sh`). Fix any pre-existing failures encountered (CLAUDE.md rule), including warnings.
- [ ] 0.4 Confirm schema slugs from `lib/Settings/petstore_register.json`: register `petstore`, schemas `category` / `pet` / `order` — the manifest descriptors in §1 use `register: "petstore"`, `schema: "pet"`.

## 1. Manifest observability block (Layer 1 declarative core)

- [ ] 1.1 Add the `observability` block to `src/manifest.json`: health checks `{"id":"database","type":"database"}` + `{"id":"openregister","type":"orAvailable"}`; metric `pets_total` (`objectCount`, register `petstore`, schema `pet`, help text, gauge); provider descriptor `{"name":"store_status","source":{"kind":"provider"}}` for Layer 3. Every descriptor carries a `//`-free JSON-valid structure (manifest is strict JSON) with the explanation living in docs, not comments.
  - **spec_ref**: `specs/apphost-tutorial/spec.md` — Requirement: Three-Layer Structure
- [ ] 1.2 Validate the block against the canonical schema (`tests/validate-manifest.js` / hydra gate-22 manifest-validation) and against the ADR-040 schema in hydra — flag drift to the hydra change rather than forking the contract here.

## 2. Three-layer restructure (per-file delete / keep / rewrite)

### Layer 1 — delete what the generics cover

- [ ] 2.1 DELETE `lib/Controller/DashboardController.php`, `lib/Controller/PreferencesController.php`, `lib/Controller/SettingsController.php`, `lib/Controller/MetricsController.php` (the `app_template` metric-prefix bug dies here).
- [ ] 2.2 DELETE `lib/Service/SettingsService.php` and `lib/Service/ActionAuthService.php` (covered by `AppHostSettingsService` / `GenericActionAuthService`; `lib/actions.seed.json` stays).
- [ ] 2.3 REWRITE `appinfo/routes.php` → `return \OCA\OpenRegister\AppHost\Routes::standard();` with a short comment showing the `$extra` array form for app-specific routes (teaching note, route names `dashboard#page` etc. unchanged so info.xml navigation keeps working).
- [ ] 2.4 REWRITE `lib/AppInfo/Application.php` → ~20-line stub: `APP_ID` + `Bootstrap::register($context, self::APP_ID)`; keep and comment the teaching registrations: `registerDashboardWidget(ExampleWidget::class)`, MCP alias `OCA\OpenRegister\Mcp\IMcpToolProvider::petstore` → `ExampleToolProvider`, Layer-3 alias `OCA\OpenRegister\AppHost\IMetricsProvider::petstore` → `ExampleMetricsProvider`, Layer-2 controller alias repoint (`OCA\PetStore\Controller\HealthController` stays local — note WHY in a comment), and the `DeepLinkRegistrationListener` event listener (comment: declarative alternative is the manifest `deepLinks` block).
- [ ] 2.5 REWRITE to one-line subclass stubs (NC requires concrete classes in the app namespace for info.xml-referenced classes): `lib/Repair/InitializeSettings.php` (`extends GenericInitializeSettings`), `lib/Repair/InitializeActions.php` (`extends GenericInitializeActions`), `lib/Settings/AdminSettings.php` (`extends GenericAdminSettings`, #299 IDelegatedSettings inherited), `lib/Sections/SettingsSection.php` (`extends GenericSettingsSection`). Each stub carries a 3–5 line comment explaining why the stub must exist (the "acceptable floor" from the boilerplate design.md).

### Layer 2 — the commented override example

- [ ] 2.6 REWRITE `lib/Controller/HealthController.php` → `class HealthController extends \OCA\OpenRegister\AppHost\Controller\GenericHealthController`, overriding exactly ONE protected hook to append a custom `storefront` check to the manifest-declared checks. Tutorial-grade comments: WHY subclass (logic the closed descriptor set can't express), WHEN NOT to (anything the 5 declarative check types cover), HOW the alias wiring picks the subclass over the generic. Auth posture (`#[PublicPage]` + `#[NoCSRFRequired]`) and the `{status, app, version, checks}` shape MUST be inherited, not redeclared.
  - **spec_ref**: `specs/apphost-tutorial/spec.md` — Requirement: Layer-2 Override Changes One Behaviour

### Layer 3 — the imperative escape hatch

- [ ] 2.7 NEW `lib/Observability/ExampleMetricsProvider.php` implementing `OCA\OpenRegister\AppHost\IMetricsProvider`, emitting a small deterministic sample (`petstore_store_status` gauge). Tutorial-grade comments: what belongs here (circuit-breaker state, file parsing — no descriptor kind expresses it), the ADR-035 alias discovery pattern, and the rule that a third app needing the same logic should propose a new descriptor kind via ADR-040.
  - **spec_ref**: `specs/apphost-tutorial/spec.md` — Requirement: Layer-3 Provider Samples in Metrics Output

### Frontend / template

- [ ] 2.8 KEEP `templates/index.php` (generic chunk loader — until the OR-served shell follow-up lands), `lib/Dashboard/ExampleWidget.php`, `lib/Mcp/ExampleToolProvider.php`, `lib/Listener/DeepLinkRegistrationListener.php`, `lib/Settings/petstore_register.json`, `lib/actions.seed.json`. Sweep their header comments so each states its teaching role and layer.
- [ ] 2.9 Sweep `src/` for hardcoded references to deleted endpoints' response quirks (e.g. settings store hitting `settings#load`) — the generic endpoints are contract-compatible, so changes should be zero; verify rather than assume (vitest `settingsStore.spec.js`).

## 3. Verification

- [ ] 3.1 Newman: run the OR AppHost parameterised contract collection against petstore (appId=petstore) — health public + shape, metrics admin-gated (401/403 anonymous), Prometheus content-type, `petstore_info` + `petstore_up` implicit metrics present. Keep/extend petstore's own `tests/integration/app-template.postman_collection.json` for the settings/preferences endpoints; add assertions for `petstore_pets_total` (Layer 1), the `storefront` check (Layer 2), and `petstore_store_status` (Layer 3).
- [ ] 3.2 Diff the live `/api/metrics` output against the 0.2 baseline: the only intended deltas are the prefix fix (`app_template_*` → `petstore_*`), the new `pets_total` / `store_status` samples, and engine-owned `_info`/`_up` labels. Everything else is parity.
- [ ] 3.3 Playwright e2e: SPA page loads via `GenericDashboardController` (deep-link catch-all included), admin settings section renders via the stub `AdminSettings`, dashboard widget still registers. Existing e2e suite (`tests/e2e/`) stays green.
- [ ] 3.4 Regression guard: petstore's historical `@nextcloud/l10n` detectLanguage blank-UI bug means the boot path is sensitive — explicitly re-run the e2e spec that loads the app UI with a non-English user locale and assert the UI renders. Do not weaken or skip this test to get green.
- [ ] 3.5 PHPUnit + vitest suites green; `occ app:enable petstore` on a fresh instance runs both repair-step stubs and imports the register (repair-step pattern preserved — install-order constraint).

## 4. TUTORIALS AND DOCS (mandatory — petstore is the canonical sample domain)

### Academy build-an-app series (`conduction-website/academy/`) — existing parts 0–8 audited 2026-06-12; affected parts:

- [ ] 4.1 REWRITE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-10-build-an-app-tutorial-1-scaffold/index.mdx` — heaviest hit: teaches hand-writing `Application.php` (×5 refs), `routes.php`, `InitializeSettings`/`InitializeActions`, `AdminSettings`, `/api/settings`. Rewrite the scaffold walkthrough around `Bootstrap::register()` + `Routes::standard()` + the four one-line stubs; keep code samples byte-identical to the restructured petstore.
- [ ] 4.2 REWRITE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-13-build-an-app-tutorial-2-schemas-manifest/index.mdx` — references `SettingsController`/`SettingsService` (deleted) and `/api/settings`; repoint to `AppHostSettingsService`/generic settings endpoints and the manifest as the single source of app structure.
- [ ] 4.3 UPDATE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-15-build-an-app-tutorial-3-calendar/index.mdx` — single `/api/settings` mention; verify the call shape still matches the generic endpoint (expected: no change beyond prose).
- [ ] 4.4 UPDATE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-17-build-an-app-tutorial-4-knowledge-and-ship/index.mdx` — 4 `SettingsService` references must become `AppHostSettingsService` (or drop the class-level detail in favour of the endpoint contract).
- [ ] 4.5 UPDATE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-21-build-an-app-tutorial-5-advanced-manifest/index.mdx` — `routes.php` mention → `Routes::standard($extra)`; this part also gains a forward-link to the new observability part.
- [ ] 4.6 UPDATE `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-05-21-build-an-app-tutorial-6-integrate/index.mdx` — 2 `Application.php` references; show the alias-registration teaching block from the restructured `Application.php`.
- [ ] 4.7 NEW series part `/home/rubenlinde/nextcloud-docker-dev/workspace/server/apps-extra/conduction-website/academy/2026-06-12-build-an-app-tutorial-9-apphost-observability/index.mdx` — "Declarative observability and the AppHost" (follow the series naming convention `YYYY-MM-DD-<slug>` and the existing part frontmatter/`<Outcomes>`/`<Prerequisites>` conventions; use the `/tutorial-write` skill). Content = the three layers with petstore as the worked example: Layer-1 manifest block (`pets_total` on the `pet` schema), Layer-2 `HealthController` subclass, Layer-3 `ExampleMetricsProvider`. Code samples copied verbatim from the shipped petstore files.
- [ ] 4.8 Parts 0 (`2026-05-05-...-0-three-paths`), 7 (`2026-06-01-...-7-nc-vue`), 8 (`2026-06-01-...-8-document-and-showcase`) audited — no controller/health/metrics/settings references; verify-only pass, no rewrite expected.

### Petstore's own docs

- [ ] 4.9 UPDATE `docs/intro.md` (+ `docs/sidebars.js` if a page is added) and `README.md`: describe the three-layer architecture (what is declarative, when to subclass, when to write a provider), the delete/keep table from proposal.md, and the pointer to the new academy part.
- [ ] 4.10 Sweep `docs/canonical-files.md` (and `docs/fleet-*-audit.md` if they enumerate the deleted files) so the canonical-file list matches the post-restructure tree.

### Template mirror

- [ ] 4.11 Mirror every code + docs change byte-aligned into `nextcloud-app-template` via its sibling change `apphost-tutorial-overwrite` (`nextcloud-app-template/openspec/changes/apphost-tutorial-overwrite/`) — only the namespace token (`PetStore`→template namespace), app id, and register JSON differ. Add a diff-check step (`diff -r` on lib/ modulo namespace) to the verification of BOTH changes.

## 5. Quality gates

- [ ] 5.1 `composer check:strict` green (PHPCS, PHPMD, Psalm, PHPStan) — fix any pre-existing issues encountered, don't baseline-suppress new code.
- [ ] 5.2 All hydra gates green, in particular gate-22 (manifest-validation, the new `observability` block), gate-5/9 (route-auth/semantic-auth on the Layer-2 subclass), gate-14 (route-reachability after the `Routes::standard()` swap), gate-16 (`@spec` tags on every new/rewritten public method referencing this change), gate-19 (e2e coverage on the spec scenarios).
- [ ] 5.3 npm lint/build green; existing l10n files untouched or extended (en keys are English source strings).
