<?php

/**
 * PetStore Application
 *
 * Main application class for the PetStore Nextcloud app.
 *
 * @category AppInfo
 * @package  OCA\PetStore\AppInfo
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
 * @spec openspec/specs/deep-linking/spec.md#REQ-LINK-001
 *   (file-level @spec tag — link back to the REQUIREMENT this file exists to
 *   satisfy. Multiple @spec tags allowed. Public methods SHOULD also carry
 *   their own @spec tag. ADR-003.
 *
 *   Point at the canonical spec under `openspec/specs/`, never at
 *   `openspec/changes/<name>/` — a change directory is temporary, and every
 *   tag into it dangles once the change is archived or dropped. This tag was
 *   inherited from nextcloud-app-template and read `#task-N`, a literal
 *   placeholder that resolved to nothing. See ConductionNL/.github#228.)
 */

declare(strict_types=1);

namespace OCA\PetStore\AppInfo;

use OCA\PetStore\Dashboard\ExampleWidget;
use OCA\PetStore\Listener\DeepLinkRegistrationListener;
use OCA\PetStore\Listener\OrderCustomerListener;
use OCA\PetStore\Mcp\ExampleToolProvider;
use OCA\PetStore\Repair\InitializeSettings;
use OCA\OpenRegister\Event\DeepLinkRegistrationEvent;
use OCA\OpenRegister\Event\ObjectCreatingEvent;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\EventDispatcher\IEventDispatcher;

/**
 * Main application class for the PetStore Nextcloud app.
 *
 * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md
 */
class Application extends App implements IBootstrap
{
    public const APP_ID = 'petstore';

    /**
     * Constructor for the Application class.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct(appName: self::APP_ID);
    }//end __construct()

    /**
     * Register event listeners and services.
     *
     * @param IRegistrationContext $context The registration context
     *
     * @return void
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     *
     * @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
     */
    public function register(IRegistrationContext $context): void
    {
        // Register deep link patterns with OpenRegister's unified search provider.
        // Only fires when OpenRegister is installed and dispatches the event.
        $context->registerEventListener(
            event: DeepLinkRegistrationEvent::class,
            listener: DeepLinkRegistrationListener::class
        );

        // Sample dashboard widget — see lib/Dashboard/ExampleWidget.php.
        // Delete this line and the ExampleWidget files if your app has no
        // dashboard widgets.
        $context->registerDashboardWidget(ExampleWidget::class);

        // AI Chat Companion (hydra ADR-034/035): expose this app's capabilities to the in-app AI
        // by registering an IMcpToolProvider under the alias OCA\OpenRegister\Mcp\IMcpToolProvider::{appId}.
        // OpenRegister's McpToolsService discovers providers by this alias. See lib/Mcp/ExampleToolProvider.php.
        $context->registerServiceAlias(
            'OCA\\OpenRegister\\Mcp\\IMcpToolProvider::'.self::APP_ID,
            ExampleToolProvider::class
        );

    }//end register()

    /**
     * Register an object-lifecycle listener that declares its interest up front.
     *
     * OpenRegister's `ObjectEventSubscription` records the register/schema slugs
     * a listener reacts to and routes dispatches through a single shared proxy,
     * so an uninterested listener is neither constructed nor invoked. When
     * OpenRegister is absent — petstore carries no hard dependency on it — this
     * degrades to the plain global registration it replaced, which is exactly
     * the behaviour every listener had before.
     *
     * This MUST be called from boot(), never from register(). Nextcloud enables
     * each app's autoloader immediately before calling that app's own
     * register(), so during register() OpenRegister's classes are only
     * autoloadable to apps that register after it — the class_exists() guard
     * below would silently resolve to false purely because of this app's
     * position in the enabled-app list, and the unfiltered fallback would look
     * identical to a working narrowing. boot() runs only after every app's
     * register() has completed, so the guard resolves regardless of ordering.
     *
     * @param IEventDispatcher  $dispatcher The live event dispatcher.
     * @param string            $event      OpenRegister event class name.
     * @param string            $listener   Listener class name.
     * @param array<int,string> $registers  Register slugs the listener reacts to.
     * @param array<int,string> $schemas    Schema slugs the listener reacts to.
     *
     * @return void
     *
     * @spec openspec/changes/add-order-customer-reference/specs/pet-catalog-domain/spec.md
     */
    private function registerFilteredObjectListener(
        IEventDispatcher $dispatcher,
        string $event,
        string $listener,
        array $registers,
        array $schemas
    ): void {
        $subscription = '\\OCA\\OpenRegister\\Event\\ObjectEventSubscription';
        if (class_exists($subscription) === true) {
            $subscription::subscribe(
                dispatcher: $dispatcher,
                event: $event,
                listener: $listener,
                registers: $registers,
                schemas: $schemas
            );
            return;
        }

        // Loud on purpose. This fallback is correct but UNFILTERED, and while it
        // was silent it was indistinguishable from a working narrowing.
        \OCP\Server::get(\Psr\Log\LoggerInterface::class)->warning(
            'OpenRegister ObjectEventSubscription unavailable: '.$listener
            .' fell back to an UNFILTERED registration for '.$event
            .' and will be invoked on every object write instance-wide.',
            ['app' => self::APP_ID]
        );

        $dispatcher->addServiceListener($event, $listener);

    }//end registerFilteredObjectListener()

    /**
     * Boot the application.
     *
     * @param IBootContext $context The boot context
     *
     * @return void
     *
     * @spec openspec/changes/document-petstore-domain-capabilities/tasks.md#task-1.1
     */
    public function boot(IBootContext $context): void
    {
        $dispatcher = $context->getServerContainer()->get(IEventDispatcher::class);

        // Stamp `order.customer` from the session on create (petstore/order
        // scoped). OpenRegister dispatches ObjectCreatingEvent from its central
        // write path; the listener no-ops for every other schema. Registering
        // by ::class name is safe even when OpenRegister is absent (no autoload).
        //
        // That petstore/order scope (OrderCustomerListener::REGISTER_SLUG +
        // ::SCHEMA_SLUG) is now also declared at REGISTRATION time, so an
        // unrelated app's object create no longer constructs the listener — nor
        // performs the two mapper lookups isPetstoreOrder() needs to reject it.
        // The in-listener guard stays in place as defence in depth.
        $this->registerFilteredObjectListener(
            dispatcher: $dispatcher,
            event: ObjectCreatingEvent::class,
            listener: OrderCustomerListener::class,
            registers: ['petstore'],
            schemas: ['order']
        );

    }//end boot()
}//end class
