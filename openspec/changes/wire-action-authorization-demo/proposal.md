---
kind: code
---

## Why

`lib/Service/ActionAuthService.php` implements the ADR-023 action-authorization
pattern in full (`requireAction()`, matrix stored in `IAppConfig`, admin
break-glass) and is seeded by `lib/Repair/InitializeActions.php` from
`lib/actions.seed.json`. But grepping `lib/` for `requireAction(` and
`ActionAuthService` (excluding the service's own file) turns up exactly one
hit: `lib/Repair/InitializeActions.php`, which only *seeds* the matrix — no
controller anywhere calls `requireAction()`. `lib/actions.seed.json:2` ships
`"actions": {}`, an empty matrix, and its own `$comment` field says outright:
"Template ships with an example commented pattern; remove the `$comment`
field and add real actions when implementing your app" — i.e. it self-admits
there is no real, working example, only a comment describing one.

`openspec/specs/item-management/spec.md:9-12` explicitly claims the opposite:
"the per-object-auth mechanism it describes is now demonstrated concretely by
`ActionAuthService`" — but there is no concrete demonstration in the
codebase. A developer scaffolding a new app from PetStore, wanting to see
ADR-023 wired end-to-end (route → controller annotation → `requireAction()`
call → seeded matrix entry → admin UI to broaden it), finds machinery with no
worked example, which defeats PetStore's onboarding/tutorial purpose for
exactly the security pattern ADR-023 exists to teach.

Separately, PetStore's `order` schema (`lib/Settings/petstore_register.json:67-89`)
has a `status` enum (`placed|approved|delivered`) with no mutation endpoint
at all — status changes on an `order` object are only possible today by
editing the raw OR object via the generic manifest-driven detail page (no
domain action, no authorization gate, no audit-friendly action name). This is
both a missing concrete ADR-023 example and a real gap in the order lifecycle
demo.

## What Changes

- Add `OrderController::cancel(string $id)` (`POST /api/orders/{id}/cancel`),
  a thin controller (ADR-003) marked `#[NoAdminRequired]` that calls
  `ActionAuthService::requireAction($user, 'order.cancel')` before delegating
  to OpenRegister's `ObjectService` to set the order's `status` — the first
  concrete, working call site for `requireAction()` in this codebase.
- Populate `lib/actions.seed.json` with a real entry:
  `{ "actions": { "order.cancel": ["admin"] } }`, replacing the empty
  `{}` and removing the now-inaccurate "`Template ships with an example
  commented pattern`" `$comment` text.
- Add the route to `appinfo/routes.php` (`order#cancel`,
  `POST /api/orders/{id}/cancel`) — reachable per ADR-029.
- Wire an "Cancel order" action button on the `OrderDetail` manifest page
  (`src/manifest.json`) that calls the new endpoint, visible only while
  `order.status != "delivered"`.
- No BREAKING changes — purely additive.
