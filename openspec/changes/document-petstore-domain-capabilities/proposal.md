---
kind: config
---

## Why

PetStore was scaffolded from `nextcloud-app-template` and then customized with
a real domain — `lib/Settings/petstore_register.json` defines `category`,
`pet`, and `order` schemas, and `src/manifest.json` ships five manifest-driven
pages (`Dashboard`, `Examples` [pets], `Categories`, `Orders`, plus their
detail pages) with dashboard KPI/chart widgets, relation-driven object lists,
and `summaryAggregates`. None of that is documented in `openspec/`.

Every file under `openspec/specs/*/spec.md` still carries the frontmatter
`example: true` / `status: example` and an explicit "⚠️ EXAMPLE SPEC
(documentation-only) — This spec lives in the `nextcloud-app-template`
repository" banner (verified in all eight capability dirs, e.g.
`openspec/specs/dashboard-page/spec.md:1-12`, `openspec/specs/item-management/spec.md:1-17`).
They describe the template's generic scaffolding (a fictitious `Article`
schema, a generic `ItemController`) — not PetStore's actual pet/category/order
domain. There is no spec anywhere for the pet catalog, categories, or orders.

`openspec/config.yaml:5-11` and `openspec/ROADMAP.md:1-11` are also unmodified
template boilerplate: the context block still reads "Project: App Template",
"Key components: Dashboard, Settings, Example objects", "Mount path:
/var/www/html/custom_apps/app-template", and the roadmap table reads
"_(no features defined yet — use `/app-explore` to start)_" — despite the app
having five real pages and three real schemas already built and shipped
(manifest `version: "0.2.0"`).

For PetStore's stated role as the onboarding/tutorial reference app, this
matters: a developer who clones this repo to learn "how do I spec my own
schema and manifest pages" finds only inherited template scaffolding docs and
an empty roadmap — no worked example of the pattern applied to a real
domain, even though the code right next to it is that worked example.

Separately, `lib/Controller/HealthController.php:93` and
`lib/Controller/MetricsController.php:90` both hardcode `version: "0.1.0"`,
and `package.json:3` also reads `"0.1.0"`, while `appinfo/info.xml:11` is
`<version>0.1.7</version>`. The observability endpoints (ADR-006) report a
stale version.

## What Changes

- Add a new `pet-catalog-domain` capability spec documenting the real,
  implemented domain: the `category`/`pet`/`order` OpenRegister schemas and
  their relations, and the manifest-driven Dashboard/Examples/Categories/Orders
  pages (index + detail, `object-list` relation panels, `summaryAggregates`,
  dashboard `stats-block`/`chart-by-field`/`recent-objects` widgets).
- Rewrite `openspec/config.yaml`'s `context:` block to describe PetStore (pet
  catalog demo app) instead of the generic "App Template" text, and correct
  `Mount path` to `custom_apps/petstore`.
- Rewrite `openspec/ROADMAP.md`'s status table to list the already-shipped
  pet/category/order capability instead of the placeholder "no features
  defined yet" row.
- Fix the hardcoded `"0.1.0"` version strings in `HealthController::index()`
  and `MetricsController::index()` to read the app version from
  `\OCP\App\IAppManager::getAppVersion()` (or equivalent) instead of a literal,
  and bump `package.json` to match `appinfo/info.xml` (`0.1.7`).
- Not touched: the eight existing `example: true` specs — they still
  correctly describe the generic template scaffolding code that ships
  unchanged in PetStore (Settings/Dashboard/Observability/etc. controllers),
  so they stay as onboarding reference material for that layer.
