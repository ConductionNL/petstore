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
 * @spec openspec/changes/example-change/tasks.md#task-N
 *   (file-level @spec tag — link back to the OpenSpec change that created or
 *   last modified this file. Multiple @spec tags allowed. Public methods SHOULD
 *   also carry their own @spec tag. ADR-003.)
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

        // Stamp `order.customer` from the session on create (petstore/order
        // scoped). OpenRegister dispatches ObjectCreatingEvent from its central
        // write path; the listener no-ops for every other schema. Registering
        // by ::class name is safe even when OpenRegister is absent (no autoload).
        $context->registerEventListener(
            event: ObjectCreatingEvent::class,
            listener: OrderCustomerListener::class
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
     * Boot the application.
     *
     * @param IBootContext $context The boot context
     *
     * @return void
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     *
     * @spec openspec/changes/document-petstore-domain-capabilities/tasks.md#task-1.1
     */
    public function boot(IBootContext $context): void
    {
    }//end boot()
}//end class
