<?php

/**
 * Unit tests for OrderController.
 *
 * Exercises the ADR-023 action-authorization demo call site:
 *   - unauthenticated caller → 401
 *   - requireAction() refusal → 403 with a generic message (real reason logged)
 *   - authorized cancel of a non-delivered order → 200, status set to cancelled
 *   - delivered order → 409 (terminal, not cancellable)
 *   - missing order → 404
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Unit\Controller
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>
 * SPDX-License-Identifier: EUPL-1.2
 *
 * @link https://conduction.nl
 *
 * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#req-order-cancel-001
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Controller;

use OCA\OpenRegister\Db\ObjectEntity;
use OCA\OpenRegister\Service\ObjectService;
use OCA\PetStore\Controller\OrderController;
use OCA\PetStore\Service\ActionAuthService;
use OCA\PetStore\Service\SettingsService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\OCS\OCSForbiddenException;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * Tests for OrderController::cancel().
 *
 * @spec openspec/changes/wire-action-authorization-demo/specs/order-lifecycle-actions/spec.md#req-order-cancel-001
 */
class OrderControllerTest extends TestCase
{

    /**
     * Mock IRequest.
     *
     * @var IRequest&MockObject
     */
    private IRequest&MockObject $request;

    /**
     * Mock ActionAuthService.
     *
     * @var ActionAuthService&MockObject
     */
    private ActionAuthService&MockObject $actionAuthService;

    /**
     * Mock SettingsService.
     *
     * @var SettingsService&MockObject
     */
    private SettingsService&MockObject $settingsService;

    /**
     * Mock IUserSession.
     *
     * @var IUserSession&MockObject
     */
    private IUserSession&MockObject $userSession;

    /**
     * Mock ContainerInterface.
     *
     * @var ContainerInterface&MockObject
     */
    private ContainerInterface&MockObject $container;

    /**
     * Mock LoggerInterface.
     *
     * @var LoggerInterface&MockObject
     */
    private LoggerInterface&MockObject $logger;

    /**
     * The controller under test.
     *
     * @var OrderController
     */
    private OrderController $controller;

    /**
     * Set up test fixtures.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->request           = $this->createMock(IRequest::class);
        $this->actionAuthService = $this->createMock(ActionAuthService::class);
        $this->settingsService   = $this->createMock(SettingsService::class);
        $this->userSession       = $this->createMock(IUserSession::class);
        $this->container         = $this->createMock(ContainerInterface::class);
        $this->logger            = $this->createMock(LoggerInterface::class);

        $this->controller = new OrderController(
            request: $this->request,
            actionAuthService: $this->actionAuthService,
            settingsService: $this->settingsService,
            userSession: $this->userSession,
            container: $this->container,
            logger: $this->logger,
        );

    }//end setUp()

    /**
     * A signed-in user's UID resolves from the session, not the request.
     *
     * @param string $uid The user id to report.
     *
     * @return IUser&MockObject
     */
    private function signedInUser(string $uid='alice'): IUser&MockObject
    {
        $user = $this->createMock(IUser::class);
        $user->method('getUID')->willReturn($uid);
        return $user;
    }//end signedInUser()

    /**
     * No authenticated user → 401, no authorization check attempted.
     *
     * @return void
     */
    public function testCancelWithoutUserReturnsUnauthorized(): void
    {
        $this->userSession->method('getUser')->willReturn(null);
        $this->actionAuthService->expects($this->never())->method('requireAction');

        $result = $this->controller->cancel('order-1');

        self::assertInstanceOf(JSONResponse::class, $result);
        self::assertSame(Http::STATUS_UNAUTHORIZED, $result->getStatus());

    }//end testCancelWithoutUserReturnsUnauthorized()

    /**
     * requireAction() refusal → 403 generic; no OpenRegister write attempted.
     *
     * @return void
     */
    public function testCancelDeniedReturnsForbidden(): void
    {
        $user = $this->signedInUser();
        $this->userSession->method('getUser')->willReturn($user);

        $this->actionAuthService->expects($this->once())
            ->method('requireAction')
            ->with(user: $user, action: 'order.cancel')
            ->willThrowException(new OCSForbiddenException('not allowed'));

        // No OpenRegister resolution when authorization fails.
        $this->container->expects($this->never())->method('get');

        $result = $this->controller->cancel('order-1');

        self::assertInstanceOf(JSONResponse::class, $result);
        self::assertSame(Http::STATUS_FORBIDDEN, $result->getStatus());
        // Generic message — the real reason is logged, not returned.
        self::assertSame('You are not allowed to cancel orders', $result->getData()['message']);

    }//end testCancelDeniedReturnsForbidden()

    /**
     * Authorized cancel of a placed order → 200 with status cancelled.
     *
     * @return void
     */
    public function testCancelAuthorizedUpdatesStatus(): void
    {
        $user = $this->signedInUser('admin');
        $this->userSession->method('getUser')->willReturn($user);

        // requireAction passes (admin break-glass) — no exception thrown.
        $this->actionAuthService->expects($this->once())
            ->method('requireAction')
            ->with(user: $user, action: 'order.cancel');

        $this->settingsService->method('isOpenRegisterAvailable')->willReturn(true);

        $order = new ObjectEntity();
        $order->setObject(['id' => 'order-1', 'status' => 'placed']);

        $objectService = $this->createMock(ObjectService::class);
        $objectService->expects($this->once())
            ->method('find')
            ->willReturn($order);
        $objectService->expects($this->once())
            ->method('updateObject')
            ->with(objectId: 'order-1', data: ['status' => 'cancelled'])
            ->willReturn($order);

        $this->container->expects($this->once())
            ->method('get')
            ->with('OCA\OpenRegister\Service\ObjectService')
            ->willReturn($objectService);

        $result = $this->controller->cancel('order-1');

        self::assertInstanceOf(JSONResponse::class, $result);
        self::assertSame(Http::STATUS_OK, $result->getStatus());
        self::assertSame('cancelled', $result->getData()['status']);

    }//end testCancelAuthorizedUpdatesStatus()

    /**
     * A delivered order is terminal → 409, no update attempted.
     *
     * @return void
     */
    public function testCancelDeliveredOrderIsConflict(): void
    {
        $user = $this->signedInUser('admin');
        $this->userSession->method('getUser')->willReturn($user);
        $this->actionAuthService->method('requireAction');
        $this->settingsService->method('isOpenRegisterAvailable')->willReturn(true);

        $order = new ObjectEntity();
        $order->setObject(['id' => 'order-1', 'status' => 'delivered']);

        $objectService = $this->createMock(ObjectService::class);
        $objectService->method('find')->willReturn($order);
        $objectService->expects($this->never())->method('updateObject');

        $this->container->method('get')->willReturn($objectService);

        $result = $this->controller->cancel('order-1');

        self::assertInstanceOf(JSONResponse::class, $result);
        self::assertSame(Http::STATUS_CONFLICT, $result->getStatus());

    }//end testCancelDeliveredOrderIsConflict()

    /**
     * Missing order → 404.
     *
     * @return void
     */
    public function testCancelMissingOrderReturnsNotFound(): void
    {
        $user = $this->signedInUser('admin');
        $this->userSession->method('getUser')->willReturn($user);
        $this->actionAuthService->method('requireAction');
        $this->settingsService->method('isOpenRegisterAvailable')->willReturn(true);

        $objectService = $this->createMock(ObjectService::class);
        $objectService->method('find')->willReturn(null);

        $this->container->method('get')->willReturn($objectService);

        $result = $this->controller->cancel('missing');

        self::assertInstanceOf(JSONResponse::class, $result);
        self::assertSame(Http::STATUS_NOT_FOUND, $result->getStatus());

    }//end testCancelMissingOrderReturnsNotFound()
}//end class
