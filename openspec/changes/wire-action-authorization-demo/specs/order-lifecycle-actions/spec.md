## ADDED Requirements

### Requirement: Cancel an order with action-level authorization

The system MUST expose `POST /api/orders/{id}/cancel`, reachable by
authenticated non-admins (`#[NoAdminRequired]`). Before mutating the order,
`OrderController::cancel()` MUST call
`ActionAuthService::requireAction($user, 'order.cancel')`, where `$user` is
resolved from `IUserSession` (never from the request). The action-authorization
matrix MUST default to `["admin"]` for `order.cancel` on fresh install, per
the seed in `lib/actions.seed.json`, and MUST remain overridable by an admin
via the existing Admin Settings actions-matrix UI (ADR-023) without a code
change.

#### Scenario: Admin cancels an order

- GIVEN a signed-in admin user
- AND an `order` object with `status: "placed"`
- WHEN the admin sends `POST /api/orders/{id}/cancel`
- THEN `requireAction()` MUST succeed (admin break-glass)
- AND the order's `status` MUST be updated
- AND the response MUST be HTTP 200

#### Scenario: Non-admin outside the matrix is refused

- GIVEN a signed-in non-admin user whose groups do not intersect the
  `order.cancel` matrix entry (default: `["admin"]`)
- WHEN that user sends `POST /api/orders/{id}/cancel`
- THEN `requireAction()` MUST throw `OCSForbiddenException`
- AND the controller MUST NOT mutate the order
- AND the response MUST be HTTP 403 with a static, generic message (ADR-005) —
  the real reason MUST only be logged server-side

#### Scenario: Admin broadens the matrix without a code change

- GIVEN an admin opens Admin Settings and adds a non-admin group (e.g.
  `support`) to the `order.cancel` action
- WHEN a member of `support` (not an admin) sends `POST /api/orders/{id}/cancel`
- THEN `requireAction()` MUST succeed because `support` now intersects the
  matrix entry
- AND no controller or service code change is required to enable this
