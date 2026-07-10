## 1. Spec the real domain

- [ ] 1.1 Write `specs/pet-catalog-domain/spec.md` (this change's delta) documenting:
  - the `category`, `pet`, `order` schemas from `lib/Settings/petstore_register.json` (fields, `required`, relations)
  - the `Examples` (pets), `Categories`, `Orders` index pages and their detail pages from `src/manifest.json`
  - the Dashboard KPI/chart widgets (`stats-block`, `chart-by-field`, `recent-objects`) and what OR aggregation each reads
- [ ] 1.2 Cross-reference ADR-036 (universal widget manifest) and ADR-022 (apps consume OR abstractions) as the architectural basis — no bespoke Vue pages back these routes

## 2. Fix the stale project context

- [ ] 2.1 Rewrite `openspec/config.yaml` `context:` block: `Project: PetStore`, `Repo:` the actual petstore repo, `Description:` pet catalog demo, `Key components: Dashboard, Categories, Pets, Orders`, `Mount path: /var/www/html/custom_apps/petstore`
- [ ] 2.2 Rewrite `openspec/ROADMAP.md` status table to list the shipped `pet-catalog-domain` capability (status: done) instead of the placeholder row

## 3. Fix version drift in observability endpoints

- [ ] 3.1 In `lib/Controller/HealthController.php::index()` (line 93), replace the hardcoded `'version' => '0.1.0'` with the app's actual version (inject `\OCP\App\IAppManager` and call `getAppVersion(Application::APP_ID)`, or read `appinfo/info.xml` via the existing DI convention used elsewhere in the app)
- [ ] 3.2 Apply the same fix to `lib/Controller/MetricsController.php::index()` (line 90), which hardcodes `version="0.1.0"` in the `{app}_info` gauge
- [ ] 3.3 Bump `package.json` `"version"` from `"0.1.0"` to `"0.1.7"` to match `appinfo/info.xml`
- [ ] 3.4 Update `openspec/specs/observability/spec.md` only if the version-source requirement needs to move out of "illustrative stub" wording (leave the example banner itself intact)

## 4. Validate

- [ ] 4.1 Run `openspec validate document-petstore-domain-capabilities --strict` and resolve any errors
- [ ] 4.2 Confirm PHPCS/PHPStan pass on the two touched controllers (`composer check:strict`)
