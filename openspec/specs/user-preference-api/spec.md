---
example: true
capability: user-preference-api
status: example
---

# User Preference API Specification

> NOTE ON THIS DIRECTORY'S NAME — the obvious name for this capability is
> `user-preferences`, and that name is a trap. Several repos in this fleet
> (verified with `git check-ignore` on nextcloud-app-template and portaliq;
> petstore is clean) carry a `**/*references*` rule in `.gitignore`, and
> "user-p*references*" matches it. A spec placed there is silently untracked:
> it exists on disk, gate-46 resolves it locally, and it is absent from the
> commit — so CI reports every `@spec` pointing at it as a file that does not
> exist, while the file sits in the working tree. The name here sidesteps that;
> the `.gitignore` rule is a separate landmine and is reported, not fixed here.

> ⚠️ **EXAMPLE SPEC** — This spec lives in the `nextcloud-app-template`
> repository as a demonstration of the OpenSpec format. It describes the
> behaviour of `lib/Controller/PreferencesController.php` in the template's own
> code. Apps built from this template keep this capability as-is if they keep
> the controller, and replace it otherwise.

## Purpose

`settings-management` covers **app** configuration: instance-wide, admin-guarded,
OpenRegister-backed. This capability is the separate, **user-scoped** store
behind `GET`/`PUT /api/preferences/{key}`.

It exists because the shared `@conduction/nextcloud-vue` widgets need somewhere
to remember a per-user choice — `CnSupportDialog` remembering that this user
dismissed a hint — without granting the user any admin surface and without
leaking one user's state to another. The two stores are deliberately not merged:
they differ in scope, in authorization, and in who may write them.

## Data Model

- **Preference key**: caller-supplied, sanitised to a safe charset and stored
  under a `pref_` prefix so a caller cannot address arbitrary `IConfig` user
  values outside that namespace.
- **Preference value**: a string owned by one user, for this app only. The empty
  string is not a storable value — it is the clear operation.

## Requirements

### REQ-PREF-001: Read a per-user preference

The system MUST expose a `GET /api/preferences/{key}` endpoint readable by any
logged-in user and scoped to that user alone. The key MUST be sanitised before
it reaches the config layer, and an unset key MUST read back as `null` rather
than as an error, so that "never set" is an ordinary state rather than a failure
the caller has to handle.

@e2e exclude API-level per-user config contract with no UI surface of its own —
the endpoint is called by shared `@conduction/nextcloud-vue` widgets, never by a
page in this app; the auth and sanitisation behaviour is unit-testable and a
browser test would exercise the widget, not this contract.

#### Scenario: Logged-in user reads a preference

- GIVEN a logged-in user and a key the user has previously set
- WHEN `GET /api/preferences/{key}` is called
- THEN the system MUST return `{ "value": "<stored value>" }`

#### Scenario: Key was never set

- GIVEN a logged-in user and a key that has never been written
- WHEN `GET /api/preferences/{key}` is called
- THEN the system MUST return `{ "value": null }` rather than an error

#### Scenario: Anonymous caller

- GIVEN no user session
- WHEN `GET /api/preferences/{key}` is called
- THEN the system MUST return HTTP 401 with a generic message (per ADR-005)

#### Scenario: Key fails sanitisation

- GIVEN a key that is empty after sanitisation
- WHEN `GET /api/preferences/{key}` is called
- THEN the system MUST return HTTP 400
- AND the system MUST NOT read any config value

### REQ-PREF-002: Write a per-user preference

The system MUST expose a `PUT /api/preferences/{key}` endpoint that stores a
value for the calling user only. Writing an empty value MUST DELETE the stored
preference rather than storing an empty string, so that a cleared preference and
a never-set preference are indistinguishable on read — otherwise REQ-PREF-001's
`null` contract would depend on how the key came to be empty.

@e2e exclude API-level per-user config contract with no UI surface of its own —
same reasoning as REQ-PREF-001; the clear-vs-store branch is a storage-layer
invariant, observable through the API and not through any page in this app.

#### Scenario: User stores a preference

- GIVEN a logged-in user
- WHEN `PUT /api/preferences/{key}` is called with a non-empty value
- THEN the system MUST persist it against that user's UID and this app only
- AND the response MUST echo `{ "value": "<stored value>" }`

#### Scenario: User clears a preference

- GIVEN a logged-in user with the preference set
- WHEN `PUT /api/preferences/{key}` is called with an empty value
- THEN the system MUST delete the stored value
- AND a subsequent read MUST return `{ "value": null }`

#### Scenario: Anonymous caller

- GIVEN no user session
- WHEN `PUT /api/preferences/{key}` is called
- THEN the system MUST return HTTP 401
- AND the system MUST NOT write any config value
