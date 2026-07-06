<?php

/**
 * PetStore Portal Contribution Provider (fleet reference implementation)
 *
 * The fleet's REFERENCE example of an ADR-046 portal contribution (hydra
 * adr-046-portaliq-external-portal.md + 2026-07-06 amendment, contract v2).
 * Portaliq — the one shared external portal for people WITHOUT Nextcloud
 * accounts — discovers each app's provider by convention FQCN
 * (`OCA\{App}\Portal\PortalContributionProvider`) and duck-types it via
 * method_exists(), never instanceof. Therefore this class is deliberately
 * PLAIN: no portaliq imports, no `implements` clause, no info.xml dependency,
 * no constructor dependencies. Without portaliq installed it is inert and the
 * app behaves exactly as before (amendment A1). Copy this shape — including
 * both the v2 getAudiences() and the v1 getAudience() fallback — when adding
 * portal support to your own app.
 *
 * @category Portal
 * @package  OCA\PetStore\Portal
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>
 * SPDX-License-Identifier: EUPL-1.2
 *
 * @version GIT: <git-id>
 *
 * @link https://conduction.nl
 *
 * @spec openspec/changes/portal-contribution/tasks.md#task-2
 */

declare(strict_types=1);

namespace OCA\PetStore\Portal;

/**
 * Declares what an external portal *client* may see and do in the Pet Store.
 *
 * The contribution is a declarative manifest (pure data — no I/O, no
 * callbacks): two collections scoped by the `owner` UUID property and one
 * whitelisted create-action. All subject identity (subjectRef, audience,
 * organisation, trust) is derived server-side by portaliq's auth edge and
 * MUST never be trusted from the client (ADR-005). Scoping uses domain-object
 * UUID references (the owner *contact*), never Nextcloud user ids — externals
 * have no Nextcloud account by premise (amendment A4).
 *
 * @spec openspec/changes/portal-contribution/tasks.md#task-2
 */
class PortalContributionProvider
{
    /**
     * The audiences this provider contributes to (contract v2, preferred).
     *
     * The registry probes for this method first; the audience vocabulary is an
     * open string set (amendment A2). Pet Store serves its (pet) owners, so it
     * contributes to the `client` audience only.
     *
     * @return array<int, string> The audience identifiers.
     *
     * @spec openspec/changes/portal-contribution/tasks.md#task-3
     */
    public function getAudiences(): array
    {
        return ['client'];

    }//end getAudiences()

    /**
     * The single audience this provider contributes to (contract v1 fallback).
     *
     * Kept alongside getAudiences() so the provider also works against a v1
     * registry that predates multi-audience support. Implement BOTH in real
     * apps until the fleet is fully on contract v2.
     *
     * @return string The audience identifier.
     *
     * @spec openspec/changes/portal-contribution/tasks.md#task-3
     */
    public function getAudience(): string
    {
        return 'client';

    }//end getAudience()

    /**
     * Build the declarative portal manifest for one resolved subject.
     *
     * The subject array is server-derived by portaliq (subjectRef UUID,
     * audience, organisation, trust level low|substantial|high). Returns null
     * when this app has nothing for the subject — here: for any non-client
     * audience (fail-closed; the registry already filters by audience, but a
     * provider must not rely on that).
     *
     * Manifest vocabulary (amendment A2–A6): `collections` are read surfaces
     * portaliq serves from OpenRegister, scoped by `scopeField` == the
     * subject's owner-contact UUID; `actions` of type `create` expose a strict
     * field whitelist (status/complete/price stay back-office-only);
     * `notifications` feed the shared inbox (none in this demo).
     *
     * @param array<string, mixed> $subject The resolved portal subject.
     *
     * @return array<string, mixed>|null The manifest, or null when not contributing.
     *
     * @spec openspec/changes/portal-contribution/tasks.md#task-3
     */
    public function getContribution(array $subject): ?array
    {
        if (($subject['audience'] ?? '') !== 'client') {
            return null;
        }

        return [
            'label'         => 'Pet Store',
            'collections'   => [
                [
                    'id'         => 'petCollection',
                    'register'   => 'petstore',
                    'schema'     => 'pet',
                    'scopeField' => 'owner',
                    'label'      => 'My pets',
                    'listable'   => true,
                ],
                [
                    'id'         => 'orderCollection',
                    'register'   => 'petstore',
                    'schema'     => 'order',
                    'scopeField' => 'owner',
                    'label'      => 'My orders',
                    'listable'   => true,
                ],
            ],
            'actions'       => [
                [
                    'id'       => 'createOrder',
                    'type'     => 'create',
                    'label'    => 'Place an order',
                    'register' => 'petstore',
                    'schema'   => 'order',
                    'fields'   => [
                        'pet',
                        'quantity',
                        'shipDate',
                    ],
                ],
            ],
            'notifications' => [],
        ];

    }//end getContribution()
}//end class
