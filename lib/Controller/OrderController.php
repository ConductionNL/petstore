<?php

/**
 * PetStore Order Controller
 *
 * Thin REST controller (ADR-003) for order lifecycle actions. The `cancel`
 * endpoint is the first concrete, working call site for ADR-023 action
 * authorization in this template: it calls
 * `ActionAuthService::requireAction($user, 'order.cancel')` before mutating
 * the order, then delegates the write to OpenRegister's ObjectService
 * (ADR-022 — the app owns no database tables and hand-rolls no persistence).
 *
 * @category Controller
 * @package  OCA\PetStore\Controller
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
 * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#requirement-cancel-an-order-with-action-level-authorization
 */

declare(strict_types=1);

namespace OCA\PetStore\Controller;

use OCA\PetStore\AppInfo\Application;
use OCA\PetStore\Service\ActionAuthService;
use OCA\PetStore\Service\SettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\OCS\OCSForbiddenException;
use OCP\IRequest;
use OCP\IUserSession;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * REST controller for order lifecycle actions.
 *
 * Route:
 *   POST /api/orders/{id}/cancel → cancel
 *
 * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#requirement-cancel-an-order-with-action-level-authorization
 */
class OrderController extends Controller
{
    /**
     * Register slug that owns the order schema.
     *
     * @var string
     */
    private const REGISTER = 'petstore';

    /**
     * Schema slug for orders.
     *
     * @var string
     */
    private const SCHEMA = 'order';

    /**
     * The order status that a cancel produces.
     *
     * @var string
     */
    private const STATUS_CANCELLED = 'cancelled';

    /**
     * The terminal status a cancel is not allowed to override.
     *
     * @var string
     */
    private const STATUS_DELIVERED = 'delivered';

    /**
     * Constructor.
     *
     * @param IRequest           $request           The request object.
     * @param ActionAuthService  $actionAuthService ADR-023 action authorization.
     * @param SettingsService    $settingsService   For the OpenRegister availability check.
     * @param IUserSession       $userSession       The current user session (auth source).
     * @param ContainerInterface $container         Service locator for OpenRegister's ObjectService.
     * @param LoggerInterface    $logger            The logger.
     *
     * @return void
     *
     * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#requirement-cancel-an-order-with-action-level-authorization
     */
    public function __construct(
        IRequest $request,
        private ActionAuthService $actionAuthService,
        private SettingsService $settingsService,
        private IUserSession $userSession,
        private ContainerInterface $container,
        private LoggerInterface $logger,
    ) {
        parent::__construct(appName: Application::APP_ID, request: $request);
    }//end __construct()

    /**
     * Cancel an order after an ADR-023 action-authorization check.
     *
     * The authorization decision is delegated to ActionAuthService using a
     * backend-derived UID (IUserSession), never a UID from the request.
     * Error responses carry static, generic messages; the real cause is
     * logged server-side only (ADR-005).
     *
     * @param string $id The order object UUID.
     *
     * @NoAdminRequired
     *
     * @return JSONResponse
     *
     * @psalm-suppress MixedMethodCall   OpenRegister's ObjectService is an optional runtime dependency.
     * @psalm-suppress MixedAssignment   OpenRegister's ObjectService is an optional runtime dependency.
     * @psalm-suppress MixedArrayAccess  OpenRegister returns loosely-typed object data.
     *
     * @SuppressWarnings(PHPMD.CyclomaticComplexity)
     * @SuppressWarnings(PHPMD.NPathComplexity)
     *
     * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#requirement-cancel-an-order-with-action-level-authorization
     */
    public function cancel(string $id): JSONResponse
    {
        $user = $this->userSession->getUser();
        if ($user === null) {
            return new JSONResponse(
                ['message' => 'Authentication required'],
                Http::STATUS_UNAUTHORIZED
            );
        }

        // ADR-023 action gate — the first real requireAction() call site.
        try {
            $this->actionAuthService->requireAction(user: $user, action: 'order.cancel');
        } catch (OCSForbiddenException $e) {
            // ADR-005: log the real reason server-side, return a generic message.
            $this->logger->info(
                'PetStore: order.cancel denied',
                ['uid' => $user->getUID(), 'reason' => $e->getMessage()]
            );
            return new JSONResponse(
                ['message' => 'You are not allowed to cancel orders'],
                Http::STATUS_FORBIDDEN
            );
        }

        if ($this->settingsService->isOpenRegisterAvailable() === false) {
            return new JSONResponse(
                ['message' => 'Order storage is unavailable'],
                Http::STATUS_SERVICE_UNAVAILABLE
            );
        }

        try {
            $objectService = $this->container->get('OCA\OpenRegister\Service\ObjectService');

            $order = $objectService->find(
                id: $id,
                register: self::REGISTER,
                schema: self::SCHEMA
            );

            if ($order === null) {
                return new JSONResponse(
                    ['message' => 'Order not found'],
                    Http::STATUS_NOT_FOUND
                );
            }

            $data          = $order->getObject();
            $currentStatus = ($data['status'] ?? '');

            // A delivered order is terminal — cancelling it is not allowed.
            if ($currentStatus === self::STATUS_DELIVERED) {
                return new JSONResponse(
                    ['message' => 'A delivered order can no longer be cancelled'],
                    Http::STATUS_CONFLICT
                );
            }

            $objectService->updateObject(
                objectId: $id,
                data: ['status' => self::STATUS_CANCELLED]
            );

            return new JSONResponse(
                ['id' => $id, 'status' => self::STATUS_CANCELLED],
                Http::STATUS_OK
            );
        } catch (\Throwable $e) {
            $this->logger->error('PetStore: order cancel failed', ['exception' => $e]);
            return new JSONResponse(
                ['message' => 'Could not cancel the order'],
                Http::STATUS_INTERNAL_SERVER_ERROR
            );
        }//end try
    }//end cancel()
}//end class
