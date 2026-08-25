<?php

/**
 * Wire contract of the SPA entry point and its history-mode catch-all.
 *
 * @category Test
 * @package  OCA\PetStore\Tests\Unit\Controller
 *
 * @author    Conduction Development Team <info@conduction.nl>
 * @copyright 2026 Conduction B.V.
 * @license   EUPL-1.2 https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * @link https://conduction.nl
 *
 * SPDX-FileCopyrightText: 2026 Conduction B.V. <info@conduction.nl>
 * SPDX-License-Identifier: EUPL-1.2
 *
 * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-001
 * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-002
 */

declare(strict_types=1);

namespace OCA\PetStore\Tests\Unit\Controller;

use OCA\PetStore\Controller\DashboardController;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

/**
 * Both routed entry points serve ONE template, and the catch-all must serve the
 * SAME one as the root.
 *
 * That equality is the whole of history-mode deep linking: `/apps/petstore/orders`
 * is a full document load that the server must answer with the SPA shell, after
 * which vue-router resolves the path client-side. If `catchAll()` ever stopped
 * delegating to `page()` — a different template, a redirect, a 404 — every deep
 * link, bookmark and page refresh below the app root would break while the app
 * root itself kept working, which is the shape of defect nobody notices in
 * development because development navigates in-app.
 *
 * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-001
 * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-002
 */
class DashboardControllerTest extends TestCase
{
    /**
     * The controller under test.
     *
     * @var DashboardController
     */
    private DashboardController $controller;

    /**
     * Build the controller.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->controller = new DashboardController($this->createMock(IRequest::class));

    }//end setUp()

    /**
     * The root route renders the app's `index` template.
     *
     * @return void
     *
     * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-001
     */
    public function testPageRendersTheAppIndexTemplate(): void
    {
        $response = $this->controller->page();

        $this->assertInstanceOf(TemplateResponse::class, $response);
        $this->assertSame('petstore', $response->getApp());
        $this->assertSame('index', $response->getTemplateName());

    }//end testPageRendersTheAppIndexTemplate()

    /**
     * The catch-all serves the same shell as the root — see the class docblock.
     *
     * @return void
     *
     * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-002
     */
    public function testCatchAllServesTheSameShellAsTheRoot(): void
    {
        $page     = $this->controller->page();
        $catchAll = $this->controller->catchAll();

        $this->assertInstanceOf(TemplateResponse::class, $catchAll);
        $this->assertSame($page->getApp(), $catchAll->getApp());
        $this->assertSame($page->getTemplateName(), $catchAll->getTemplateName());
        $this->assertSame($page->getRenderAs(), $catchAll->getRenderAs());
        $this->assertSame($page->getParams(), $catchAll->getParams());

    }//end testCatchAllServesTheSameShellAsTheRoot()

    /**
     * The shell renders inside Nextcloud's chrome (`user`), not standalone.
     *
     * A `blank`/`base` render would drop the header, the navigation and the
     * bootstrap the SPA reads its initial state from, so the page would load
     * and then mount into nothing.
     *
     * @return void
     *
     * @spec openspec/specs/dashboard-page/spec.md#REQ-DASH-001
     */
    public function testPageRendersInsideTheNextcloudChrome(): void
    {
        $this->assertSame(TemplateResponse::RENDER_AS_USER, $this->controller->page()->getRenderAs());

    }//end testPageRendersInsideTheNextcloudChrome()
}//end class
