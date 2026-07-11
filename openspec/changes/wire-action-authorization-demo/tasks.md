## 1. Backend: first real requireAction() call site

- [ ] 1.1 Add `lib/Controller/OrderController.php`: constructor-injects `ActionAuthService`, `IUserSession`, and OpenRegister's `ObjectService`/equivalent abstraction (ADR-022 — no direct SQL, reuse the same object-mutation path the manifest-driven generic endpoints use)
- [ ] 1.2 Implement `cancel(string $id): JSONResponse`, `#[NoAdminRequired]`, that: reads the current user from `IUserSession`, calls `$this->actionAuthService->requireAction($user, 'order.cancel')`, then updates the `order` object's `status` — reuse OR's existing update path, do not hand-roll persistence
- [ ] 1.3 Return generic error responses on failure (ADR-005): `OCSForbiddenException` from `requireAction()` maps to HTTP 403 with a static message; log the real reason server-side only
- [ ] 1.4 Add SPDX header + `@spec` tag pointing at `openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#req-order-cancel-001`

## 2. Route + reachability (ADR-029)

- [ ] 2.1 Add `['name' => 'order#cancel', 'url' => '/api/orders/{id}/cancel', 'verb' => 'POST']` to `appinfo/routes.php`
- [ ] 2.2 Confirm `OrderController::cancel()` exists with matching signature (no route-to-missing-method drift)

## 3. Seed a real matrix entry (replace the empty scaffold)

- [ ] 3.1 Replace `lib/actions.seed.json`'s `"actions": {}` with `{ "order.cancel": ["admin"] }`
- [ ] 3.2 Rewrite the `$comment` field: remove the "Template ships with an example commented pattern; remove the `$comment` field..." text (no longer true) and instead describe the one real entry as the worked example for apps copying this template
- [ ] 3.3 Confirm `InitializeActions` repair step still preserves an admin-customized matrix on upgrade (existing behavior, no change needed — verify by reading `lib/Repair/InitializeActions.php:75-84`)

## 4. Frontend: wire a real action button

- [ ] 4.1 Add a `orderCancelAction` handler function to the app's registry (`src/registry.js` or wherever `customComponents`/handler functions are registered) that POSTs to `/api/orders/{id}/cancel` and refreshes the object on success
- [ ] 4.2 Add a page-level action to the `OrderDetail` page in `src/manifest.json`: `{ "id": "cancel-order", "label": "Cancel order", "type": "handler", "handler": "orderCancelAction", "icon": "Cancel" }`, gated so it does not render when `status == "delivered"` (use the manifest's existing conditional-visibility mechanism, matching the pattern used elsewhere in the manifest for status-gated UI)
- [ ] 4.3 Run `npm run check:manifest` to confirm the action resolves

## 5. Fix the now-inaccurate spec claim

- [ ] 5.1 `openspec/specs/item-management/spec.md:9-12` claims `ActionAuthService` "demonstrates concretely" the pattern — after this change that claim becomes true; no edit needed, but add a cross-reference from that note to `specs/order-lifecycle-actions/spec.md` (this change) as the concrete example

## 6. Validate

- [ ] 6.1 Run `openspec validate wire-action-authorization-demo --strict`
- [ ] 6.2 `composer check:strict` (PHPCS/PHPMD/Psalm/PHPStan) on the new controller
- [ ] 6.3 Manually verify through the UI (not API-direct, per house rule): sign in as a non-admin not in any allowed group, open an order, confirm the Cancel action is hidden or 403s with a generic message; sign in as admin, confirm cancel succeeds and status updates
