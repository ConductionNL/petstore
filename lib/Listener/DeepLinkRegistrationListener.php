<?php

/**
 * PetStore DeepLinkRegistrationListener
 *
 * Registers PetStore's deep link URL patterns with OpenRegister's search provider.
 *
 * @category Listener
 * @package  OCA\PetStore\Listener
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
 */

declare(strict_types=1);

namespace OCA\PetStore\Listener;

use OCA\OpenRegister\Event\DeepLinkRegistrationEvent;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;

/**
 * Registers PetStore's deep link URL patterns with OpenRegister's search provider.
 *
 * When a user searches in Nextcloud's unified search, results for PetStore schemas
 * will link directly to the relevant detail views in the app.
 *
 * @implements IEventListener<Event>
 */
class DeepLinkRegistrationListener implements IEventListener
{
    /**
     * Handle the deep link registration event.
     *
     * @param Event $event The event to handle
     *
     * @return void
     *
     * @spec openspec/specs/deep-linking/spec.md#REQ-LINK-001
     */
    public function handle(Event $event): void
    {
        if ($event instanceof DeepLinkRegistrationEvent === false) {
            return;
        }

        // Register example object deep links.
        // Replace 'petstore' with your app ID and update the register slug,
        // schema slug, and URL template to match your app's actual schemas.
        $event->register(
            appId: 'petstore',
            registerSlug: 'petstore',
            schemaSlug: 'example',
            urlTemplate: '/apps/petstore/#/examples/{uuid}'
        );

    }//end handle()
}//end class
