## 1. Backend: first real requireAction() call site

- [x] 1.1 Add `lib/Controller/OrderController.php`: constructor-injects `ActionAuthService`, `IUserSession`, and OpenRegister's `ObjectService`/equivalent abstraction (ADR-022 — no direct SQL, reuse the same object-mutation path the manifest-driven generic endpoints use) — ObjectService is resolved via `ContainerInterface` (the app's existing OR-soft-dependency pattern, matching `SettingsService`)
- [x] 1.2 Implement `cancel(string $id): JSONResponse`, `#[NoAdminRequired]`, that: reads the current user from `IUserSession`, calls `$this->actionAuthService->requireAction($user, 'order.cancel')`, then updates the `order` object's `status` (to `cancelled`) — reuses OR's `updateObject()`, no hand-rolled persistence
- [x] 1.3 Return generic error responses on failure (ADR-005): `OCSForbiddenException` from `requireAction()` maps to HTTP 403 with a static message; log the real reason server-side only
- [x] 1.4 Add SPDX header + `@spec` tag pointing at `openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#req-order-cancel-001`

## 2. Route + reachability (ADR-029)

- [x] 2.1 Add `['name' => 'order#cancel', 'url' => '/api/orders/{id}/cancel', 'verb' => 'POST']` to `appinfo/routes.php`
- [x] 2.2 Confirm `OrderController::cancel()` exists with matching signature (no route-to-missing-method drift)

## 3. Seed a real matrix entry (replace the empty scaffold)

- [x] 3.1 Replace `lib/actions.seed.json`'s `"actions": {}` with `{ "order.cancel": ["admin"] }`
- [x] 3.2 Rewrite the `$comment` field: remove the "Template ships with an example commented pattern; remove the `$comment` field..." text (no longer true) and instead describe the one real entry as the worked example for apps copying this template
- [x] 3.3 Confirm `InitializeActions` repair step still preserves an admin-customized matrix on upgrade (existing behavior, no change needed — verified: `InitializeActions::run()` returns early when the matrix already has entries)

## 4. Frontend: wire a real action button

- [x] 4.1 Add a `orderCancelAction` handler function (`src/actions/orderActions.js`) registered in `src/customComponents.js` that POSTs to `/api/orders/{id}/cancel` and fires a refresh event on success
- [~] 4.2 Add a page-level action to the `OrderDetail` page in `src/manifest.json` (`{ "id": "cancel-order", "label": "Cancel order", "type": "handler", "handler": "orderCancelAction", "icon": "Cancel" }`). PARTIAL: the object-status gating (`status != "delivered"`) is NOT expressible on a page `action` in the current manifest-v2 schema — `action` is `additionalProperties:false` and the only conditional mechanism (`visibleIf`) evaluates against `manifest.runtime`, not the loaded object. The SERVER enforces the delivered-guard (409 Conflict) as the real safety boundary; UI-level hiding would require an nc-vue renderer feature (out of scope for the petstore worktree).
- [x] 4.3 Run `npm run check:manifest` to confirm the action resolves — PASS (Ajv validation: 0 errors)

## 5. Fix the now-inaccurate spec claim

- [x] 5.1 Added a cross-reference from `openspec/specs/item-management/spec.md`'s note to `specs/order-lifecycle-actions/spec.md` as the concrete worked example

## 6. Validate

- [x] 6.1 Run `openspec validate wire-action-authorization-demo --strict` — PASS
- [x] 6.2 `composer check:strict` (PHPCS/PHPMD/Psalm/PHPStan) on the new controller — PHPCS 0 errors, PHPMD clean, Psalm no errors, PHPStan level 5 OK; OrderControllerTest 5 tests pass
- [~] 6.3 Manually verify through the UI (not API-direct, per house rule) — DEFERRED: needs a live Nextcloud instance with OpenRegister + seeded orders; not run in the isolated worktree. Backend behavior is covered by unit tests (403 for denied, 200 for authorized, 409 for delivered, 404 for missing).
